"""Owned retrieval and post-generation revision fences."""
import json
from uuid import UUID
from pydantic import TypeAdapter
from backend.study_store import StudyStore, StudyStorageError
from backend.assistant_models import AssistantInput, AssistantQuestion


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
