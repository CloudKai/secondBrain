"""Derived source indexing. Postgres owns leases; Qdrant stores only scoped spans.

Policy and collection names are immutable: change both for a new embedding or
chunk configuration. No assistant query path uses this index yet.
"""
import hashlib
import json
import math
import re
from typing import Literal
from uuid import UUID, uuid5

import httpx
from pydantic import Field, model_validator

from backend.core.schemas import StrictModel
from backend.sources.models import PDFDocument
from backend.sources.transcript_models import TranscriptDocument
from backend.studies.store import StudyStore, StudyStorageError

COLLECTION = 'web_sources_recursive_v1_openai_small_1536'
POLICY = 'structure_recursive_v1'
EMBEDDING_MODEL = 'text-embedding-3-small'
DIMENSIONS = 1536
BATCH_SIZE = 16
MAX_CHARS = 2800  # Allow at most 200 characters of sentence overlap.


class IndexClaim(StrictModel):
    source_id: UUID
    user_id: UUID
    source_version: int = Field(ge=1, le=20)
    generation: UUID
    lease_token: UUID
    action: Literal['index', 'delete']
    captured_text: str | None
    capture_sha256: str = Field(pattern=r'^[a-f0-9]{64}$')
    document: PDFDocument | None
    transcript: TranscriptDocument | None
    chunks_completed: int = Field(ge=0, le=2000)

    @model_validator(mode='after')
    def source_is_valid(self):
        if self.action == 'index':
            text = self.captured_text
            if text is None or not 120 <= len(text) <= 120000:
                raise ValueError('Invalid capture')
            if hashlib.sha256(text.encode()).hexdigest() != self.capture_sha256:
                raise ValueError('Capture fingerprint mismatch')
            if self.document and self.transcript:
                raise ValueError('Conflicting locations')
            if self.document and self.document.pages[-1].end != len(text):
                raise ValueError('Invalid PDF coverage')
            if self.transcript and self.transcript.segments[-1].end != len(text):
                raise ValueError('Invalid transcript coverage')
        return self


def _split(text: str, start: int, end: int, level: int = 0):
    """Recursively prefer paragraph, sentence, whitespace, then bounded words."""
    if end - start <= MAX_CHARS:
        return [(start, end)] if text[start:end].strip() else []
    separators = [r'\n[ \t]*\n+', r'[.!?][\"”\')\]]*\s+', r'\s+']
    if level == len(separators):
        return [(i, min(i + MAX_CHARS, end)) for i in range(start, end, MAX_CHARS)]
    cuts = [start, *[m.end() for m in re.finditer(separators[level], text[start:end])], end]
    # Regex offsets are relative to the slice.
    cuts = [start, *[start + c for c in cuts[1:-1]], end]
    if len(cuts) == 2:
        return _split(text, start, end, level + 1)
    result = []
    first = cuts[0]
    previous = first
    for last in cuts[1:]:
        if last - first > MAX_CHARS:
            if previous > first:
                result.extend(_split(text, first, previous, level + 1))
            first = previous
            if last - first > MAX_CHARS:
                result.extend(_split(text, first, last, level + 1))
                first = last
        previous = last
    result.extend(_split(text, first, end, level + 1))
    return result


def _chunks(claim: IndexClaim):
    text = claim.captured_text or ''
    if claim.document:
        groups = [(p.start, p.end, p.page) for p in claim.document.pages]
    elif claim.transcript:
        groups = []
        first = None
        previous = None
        for cue in claim.transcript.segments:
            if first is not None and previous is not None and (
                cue.end - first > MAX_CHARS
                or (cue.start_ms is not None and previous.end_ms is not None
                    and cue.start_ms - previous.end_ms > 1500)
            ):
                groups.append((first, previous.end, None))
                first = None
            if first is None:
                first = cue.start
            previous = cue
        if previous is not None:
            groups.append((first, previous.end, None))
    else:
        groups = [(0, len(text), None)]
    chunks = []
    for first, last, page in groups:
        previous = None
        for start, end in _split(text, first, last):
            # Overlap only a complete short sentence within this structural group.
            if previous is not None:
                sentences = list(re.finditer(r'[.!?]\s+', text[previous:start]))
                overlap_start = previous + sentences[-2].end() if len(sentences) > 1 else previous
                if 0 < start - overlap_start <= 200:
                    start = overlap_start
            previous = start
            cues = [s for s in claim.transcript.segments if s.start < end and s.end > start] if claim.transcript else []
            chunks.append({
                'start': start, 'end': end, 'page': page,
                'start_ms': cues[0].start_ms if cues else None,
                'end_ms': max(s.end_ms for s in cues) if cues and cues[0].end_ms is not None else None,
            })
    if not chunks or len(chunks) > 2000:
        raise ValueError('Invalid chunk plan')
    return chunks


def _filter(claim: IndexClaim, *, generation: bool = False, obsolete: bool = False):
    result = {'must': [
        {'key': 'user_id', 'match': {'value': str(claim.user_id)}},
        {'key': 'source_id', 'match': {'value': str(claim.source_id)}},
    ]}
    condition = {'key': 'generation', 'match': {'value': str(claim.generation)}}
    if generation:
        result['must'].append(condition)
    if obsolete:
        result['must_not'] = [condition]
        result['must'].append({'key': 'source_version', 'range': {'lt': claim.source_version}})
    return result


class IndexProviderError(Exception):
    pass


async def _qdrant(client, url, key, method, path, body):
    response = await client.request(method, url.rstrip('/') + path,
                                    headers={'api-key': key}, json=body, timeout=30)
    response.raise_for_status()
    data = response.json()
    if data.get('status') != 'ok':
        raise IndexProviderError('Index service rejected work')
    result = data.get('result')
    if '/points' in path and (not isinstance(result, dict) or result.get('status') != 'completed'):
        raise IndexProviderError('Index write is not confirmed')
    return result


async def index_source(client: httpx.AsyncClient, project_url: str, secret: str,
                       qdrant_url: str, qdrant_key: str, model_key: str,
                       source_id: str) -> None:
    store = StudyStore(client, project_url, {'apikey': secret})
    value = await store.request('/rpc/claim_retrieval_index', body={'p_source_id': str(UUID(source_id))})
    if value is None:
        return
    claim = IndexClaim.model_validate_json(json.dumps(value))
    if str(claim.source_id) != str(UUID(source_id)):
        raise StudyStorageError()
    base = '/collections/' + COLLECTION
    async def delete(**selector):
        await _qdrant(client, qdrant_url, qdrant_key, 'POST', base+'/points/delete?wait=true',
                      {'filter': _filter(claim, **selector)})
    async def checkpoint(completed, total):
        result = await store.request('/rpc/checkpoint_retrieval_index', body={
            'p_source_id': source_id, 'p_generation': str(claim.generation),
            'p_lease_token': str(claim.lease_token), 'p_completed': completed, 'p_total': total})
        if result is not True:
            raise StudyStorageError('stale' if result is False else 'unavailable')
    async def finish(error=None):
        result = await store.request('/rpc/finish_retrieval_index', body={
            'p_source_id': source_id, 'p_generation': str(claim.generation),
            'p_lease_token': str(claim.lease_token), 'p_error_code': error})
        if not isinstance(result, bool):
            raise StudyStorageError()
        return result
    try:
        if claim.action == 'delete':
            await delete()
        else:
            chunks = _chunks(claim)
            if claim.chunks_completed > len(chunks):
                raise ValueError('Invalid checkpoint')
            await checkpoint(claim.chunks_completed, len(chunks))
            for offset in range(claim.chunks_completed, len(chunks), BATCH_SIZE):
                batch = chunks[offset:offset+BATCH_SIZE]
                texts = [claim.captured_text[c['start']:c['end']] for c in batch]
                response = await client.post('https://api.openai.com/v1/embeddings',
                    headers={'Authorization': 'Bearer '+model_key},
                    json={'model': EMBEDDING_MODEL, 'dimensions': DIMENSIONS, 'input': texts}, timeout=30)
                response.raise_for_status()
                rows = response.json()['data']
                vectors = {r['index']: r['embedding'] for r in rows}
                if len(rows) != len(batch) or set(vectors) != set(range(len(batch))):
                    raise ValueError('Invalid embedding batch')
                points = []
                for i, chunk in enumerate(batch):
                    vector = vectors[i]
                    if len(vector) != DIMENSIONS or any(type(v) not in (int,float) or not math.isfinite(v) for v in vector):
                        raise ValueError('Invalid embedding dimensions')
                    payload = {'user_id': str(claim.user_id), 'source_id': source_id,
                        'source_version': claim.source_version, 'generation': str(claim.generation),
                        'capture_sha256': claim.capture_sha256, 'chunk_policy': POLICY,
                        'embedding_model': EMBEDDING_MODEL, 'chunk_index': offset+i, **chunk}
                    points.append({'id': str(uuid5(claim.generation, str(offset+i))),
                        'payload': payload, 'vector': {'dense': vector,
                        'bm25': {'text': texts[i], 'model': 'qdrant/bm25', 'options': {'language': 'english'}}}})
                # Renew/recheck the authoritative lease immediately before each write.
                await checkpoint(offset, len(chunks))
                await _qdrant(client, qdrant_url, qdrant_key, 'PUT', base+'/points?wait=true', {'points': points})
                await checkpoint(offset+len(batch), len(chunks))
            await delete(obsolete=True)
        if await finish() is False and claim.action == 'index':
            await delete(generation=True)
    except StudyStorageError as exc:
        if exc.code != 'stale':
            raise
        if claim.action == 'index':
            await delete(generation=True)
    except (httpx.HTTPError, ValueError, KeyError, TypeError, IndexProviderError):
        if await finish('provider_unavailable') is False and claim.action == 'index':
            await delete(generation=True)


async def ensure_collection(client: httpx.AsyncClient, url: str, key: str) -> None:
    """Explicit setup; never overwrite or recreate an existing collection."""
    base = '/collections/' + COLLECTION
    response = await client.get(url.rstrip('/')+base, headers={'api-key': key}, timeout=15)
    if response.status_code == 404:
        await _qdrant(client,url,key,'PUT',base,{
            'vectors': {'dense': {'size': DIMENSIONS, 'distance': 'Cosine'}},
            'sparse_vectors': {'bm25': {'modifier': 'idf'}}})
    else:
        response.raise_for_status()
        params = response.json()['result']['config']['params']
        dense = params.get('vectors',{}).get('dense',{})
        sparse = params.get('sparse_vectors',{}).get('bm25',{})
        if dense.get('size') != DIMENSIONS or dense.get('distance') != 'Cosine' or sparse.get('modifier') != 'idf':
            raise IndexProviderError('Collection configuration does not match the indexing policy')
    for field in ('user_id','source_id','generation','source_version'):
        schema = 'integer' if field == 'source_version' else 'keyword'
        if field == 'user_id': schema = {'type':'keyword','is_tenant':True}
        await _qdrant(client,url,key,'PUT',base+'/index?wait=true', {'field_name':field,'field_schema':schema})


def main() -> None:
    import asyncio
    import os
    from pathlib import Path
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=False)
    async def setup():
        url, key = os.getenv('QDRANT_URL',''), os.getenv('QDRANT_API_KEY','')
        if not url or not key or key == 'replace-me':
            raise RuntimeError('Configure server Qdrant settings first')
        async with httpx.AsyncClient(trust_env=False) as client:
            await ensure_collection(client,url,key)
        print('Retrieval collection configuration verified.')
    asyncio.run(setup())


if __name__ == "__main__":
    main()
