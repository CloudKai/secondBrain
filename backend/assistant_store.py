"""Owned retrieval and post-generation revision fences."""
import json
import hashlib
from uuid import UUID
from types import SimpleNamespace
from pydantic import TypeAdapter
from backend.study_store import StudyStore, StudyStorageError
from backend.assistant_models import AssistantInput, AssistantQuestion
from backend.hybrid_retrieval import SearchSource
from backend.source_references import source_passages, reference_matches_source


class AssistantStore:
    def __init__(self, gateway):
        self.transport = StudyStore(gateway.client, gateway.project_url, gateway.headers)
        self.user_id = gateway.user_id

    async def context(self, source_id: UUID, question: AssistantQuestion):
        values = await self.transport.request('/rpc/get_assistant_context', body={
            'p_source_id': str(source_id), 'p_source_version': question.source_version,
            'p_question': question.question, 'p_topic_id': str(question.topic_id) if question.topic_id else None,
            'p_library': question.library,
        })
        try:
            rows = TypeAdapter(list[AssistantInput]).validate_json(json.dumps(values))
            if not 1 <= len(rows) <= 9 or len({r.source_id for r in rows}) != len(rows):
                raise ValueError('Invalid context size')
            if any(sum(r.scope == scope for r in rows) > 4 for scope in ('topic', 'library')):
                raise ValueError('Invalid scope size')
            if rows[0].source_id != source_id or rows[0].source_version != question.source_version or rows[0].scope != 'note':
                raise StudyStorageError('stale')
            if any(r.user_id != self.user_id or i and (r.scope == 'note' or r.scope == 'topic' and not question.topic_id or r.scope == 'library' and not question.library) for i,r in enumerate(rows)):
                raise ValueError('Unowned or unselected evidence')
            return rows
        except (ValueError, TypeError) as exc:
            raise StudyStorageError() from exc

    async def validate(self, source_id: UUID, question: AssistantQuestion, rows: list[AssistantInput]):
        result = await self.transport.request('/rpc/validate_assistant_context', body={
            'p_source_id': str(source_id), 'p_topic_id': str(question.topic_id) if question.topic_id else None,
            'p_sources': [{'source_id': str(r.source_id), 'source_version': r.source_version,
                           'study_updated_at': r.study_updated_at.isoformat(),
                           'map_updated_at': r.map_updated_at.isoformat() if r.map_updated_at else None,
                           'scope': r.scope} for r in rows],
        })
        if result is False:
            raise StudyStorageError('stale')
        if result is not True:
            raise StudyStorageError()

    async def inventory(self, source_id: UUID, question: AssistantQuestion):
        values = await self.transport.request('/rpc/get_assistant_search_inventory', body={
            'p_source_id': str(source_id), 'p_source_version': question.source_version,
            'p_topic_id': str(question.topic_id) if question.topic_id else None,
            'p_library': question.library,
        })
        try:
            rows = TypeAdapter(list[SearchSource]).validate_json(json.dumps(values))
            if not 1 <= len(rows) <= 200 or len({r.source_id for r in rows}) != len(rows):
                raise ValueError('Invalid inventory size')
            if rows[0].source_id != source_id or rows[0].source_version != question.source_version or rows[0].scope != 'note':
                raise StudyStorageError('stale')
            if any(r.user_id != self.user_id or i and (r.scope == 'note' or r.scope == 'topic' and not question.topic_id or r.scope == 'library' and not question.library) for i,r in enumerate(rows)):
                raise ValueError('Unowned or unselected inventory')
            return rows
        except (ValueError, TypeError) as exc:
            raise StudyStorageError() from exc

    async def hybrid_context(self, source_id: UUID, question: AssistantQuestion, inventory, hits):
        # Always retain the current note; cap additional sources by existing scope limits.
        selected=[inventory[0]]
        lookup={s.source_id:s for s in inventory}
        for hit in hits:
            source=lookup[hit.source_id]
            if source not in selected and sum(r.scope==source.scope for r in selected)<4:
                selected.append(source)
        snapshots=[r.model_dump(mode='json') for r in selected]
        values=await self.transport.request('/rpc/get_hybrid_assistant_context',body={
            'p_source_id':str(source_id),'p_source_version':question.source_version,
            'p_topic_id':str(question.topic_id) if question.topic_id else None,
            'p_library':question.library,'p_sources':snapshots})
        try:
            rows=TypeAdapter(list[AssistantInput]).validate_json(json.dumps(values))
            if len(rows)!=len(selected):
                raise StudyStorageError('stale')
            evidence={}
            passage_ranks={}
            for row,source in zip(rows,selected):
                if (row.source_id!=source.source_id or row.user_id!=self.user_id
                    or row.source_version!=source.source_version or row.scope!=source.scope
                    or row.study_updated_at!=source.study_updated_at or row.map_updated_at!=source.map_updated_at
                    or hashlib.sha256(row.captured_text.encode()).hexdigest()!=source.capture_sha256):
                    raise StudyStorageError('stale')
                passages=source_passages(row.captured_text,row.document,row.transcript)
                saved={(p.start,p.end):p for p in row.note.references}
                ranked=[]
                for hit_rank,hit in enumerate(hits):
                    if hit.source_id!=row.source_id:
                        continue
                    # Validate the returned chunk's coordinates before deriving exact smaller citations.
                    location=SimpleNamespace(start=hit.start,end=hit.end,
                        excerpt=row.captured_text[hit.start:hit.end],page=hit.page,
                        start_ms=hit.start_ms,end_ms=hit.end_ms)
                    if not reference_matches_source(row.captured_text,location,row.document,row.transcript):
                        raise ValueError('Invalid chunk location')
                    for p in passages:
                        if p.start<hit.end and p.end>hit.start and (p.start,p.end) not in {(v.start,v.end) for v in ranked}:
                            ranked.append(saved.get((p.start,p.end),p.model_copy(update={'id':f'r{p.start:x}-{p.end:x}'})))
                            passage_ranks[row.source_id,p.start,p.end]=hit_rank
                if any(not reference_matches_source(row.captured_text,p,row.document,row.transcript) for p in ranked):
                    raise ValueError('Invalid evidence')
                evidence[row.source_id]=ranked
            return rows,evidence,snapshots,passage_ranks
        except (ValueError,TypeError) as exc:
            raise StudyStorageError() from exc

    async def validate_hybrid(self, source_id, question, snapshots):
        result=await self.transport.request('/rpc/validate_hybrid_assistant_context',body={
            'p_source_id':str(source_id),'p_source_version':question.source_version,
            'p_topic_id':str(question.topic_id) if question.topic_id else None,
            'p_library':question.library,'p_sources':snapshots})
        if result is False:
            raise StudyStorageError('stale')
        if result is not True:
            raise StudyStorageError()
