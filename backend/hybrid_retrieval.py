"""Bounded hybrid candidates; authoritative inventory is supplied by Postgres."""
import asyncio
import json
import math
from datetime import datetime
from typing import Literal
from uuid import UUID, uuid5

import httpx
from pydantic import Field
from backend.schemas import StrictModel
from backend.retrieval_policy import COLLECTION, EMBEDDING_MODEL, DIMENSIONS
from backend.study_generation import GenerationFailure


class SearchSource(StrictModel):
    source_id: UUID
    user_id: UUID
    source_version: int = Field(ge=1, le=20)
    scope: Literal['note', 'topic', 'library']
    generation: UUID | None
    capture_sha256: str = Field(pattern=r'^[a-f0-9]{64}$')
    chunks_total: int = Field(ge=0, le=2000)
    study_updated_at: datetime
    map_updated_at: datetime | None


class SearchHit(StrictModel):
    user_id: UUID
    source_id: UUID
    source_version: int = Field(ge=1, le=20)
    generation: UUID
    capture_sha256: str = Field(pattern=r'^[a-f0-9]{64}$')
    chunk_policy: Literal['structure_recursive_v1']
    embedding_model: Literal['text-embedding-3-small']
    chunk_index: int = Field(ge=0, lt=2000)
    start: int = Field(ge=0, lt=120000)
    end: int = Field(gt=0, le=120000)
    page: int | None = Field(ge=1, le=100)
    start_ms: int | None = Field(ge=0, le=604800000)
    end_ms: int | None = Field(gt=0, le=604800000)


class HybridRetriever:
    def __init__(self, client: httpx.AsyncClient, *, openai_key: str,
                 qdrant_url: str, qdrant_key: str):
        if any(not value or value=='replace-me' for value in (openai_key,qdrant_key)) or not qdrant_url.startswith('https://'):
            raise GenerationFailure('setup_required')
        self.client = client
        self.openai_key = openai_key
        self.url = qdrant_url.rstrip('/')
        self.key = qdrant_key

    async def search(self, question: str, owner: UUID, inventory: list[SearchSource]) -> list[SearchHit]:
        try:
            if not question.strip() or len(question)>2000 or not 1<=len(inventory)<=200:
                raise ValueError('Invalid search bounds')
            if any(s.user_id!=owner for s in inventory) or len({s.source_id for s in inventory})!=len(inventory):
                raise ValueError('Unowned inventory')
            ready={s.source_id:s for s in inventory if s.generation is not None and s.chunks_total>0}
            if not ready:
                return []
            owner_filter={'must':[{'key':'user_id','match':{'value':str(owner)}}]}
            scope_filter={'must':[*owner_filter['must'],{'should':[
                {'must':[{'key':'source_id','match':{'value':str(s.source_id)}},
                         {'key':'source_version','match':{'value':s.source_version}},
                         {'key':'generation','match':{'value':str(s.generation)}}]}
                for s in ready.values()]}]}
            async with asyncio.timeout(20):
                response=await self.client.post('https://api.openai.com/v1/embeddings',
                    headers={'Authorization':'Bearer '+self.openai_key},
                    json={'model':EMBEDDING_MODEL,'input':[question],'dimensions':DIMENSIONS},timeout=10)
                response.raise_for_status()
                rows=response.json()['data']
                if len(rows)!=1 or rows[0]['index']!=0:
                    raise ValueError('Invalid query embedding')
                vector=rows[0]['embedding']
                if len(vector)!=DIMENSIONS or any(type(v) not in (int,float) or not math.isfinite(v) for v in vector):
                    raise ValueError('Invalid query embedding')
                response=await self.client.post(self.url+'/collections/'+COLLECTION+'/points/query',
                    headers={'api-key':self.key},json={
                        'prefetch':[
                            {'query':vector,'using':'dense','filter':scope_filter,'limit':40},
                            {'query':{'text':question,'model':'qdrant/bm25','options':{'language':'english'}},
                             'using':'bm25','filter':scope_filter,'limit':40,
                             'params':{'idf':{'corpus':owner_filter}}}],
                        'query':{'fusion':'rrf'},'filter':scope_filter,'limit':24,
                        'with_payload':True,'with_vector':False},timeout=10)
                response.raise_for_status()
                result=response.json()
                if result['status']!='ok':
                    raise ValueError('Search rejected')
                points=result['result']['points']
                if not isinstance(points,list) or len(points)>24:
                    raise ValueError('Invalid candidates')
                hits=[]
                seen=set()
                for point in points:
                    hit=SearchHit.model_validate_json(json.dumps(point['payload']))
                    source=ready.get(hit.source_id)
                    if (source is None or hit.user_id!=owner or hit.source_version!=source.source_version
                        or hit.generation!=source.generation or hit.capture_sha256!=source.capture_sha256
                        or hit.chunk_index>=source.chunks_total or not 0<hit.end-hit.start<=3000
                        or str(uuid5(hit.generation,str(hit.chunk_index)))!=point['id']):
                        raise ValueError('Invalid candidate identity')
                    if point['id'] in seen:
                        raise ValueError('Duplicate candidate')
                    seen.add(point['id']);hits.append(hit)
                return hits
        except (TimeoutError,httpx.HTTPError) as exc:
            raise GenerationFailure('provider_unavailable') from exc
        except (ValueError,TypeError,KeyError,AttributeError) as exc:
            raise GenerationFailure('invalid_output') from exc
