"""Authenticated readiness for the derived web retrieval index."""
import json
from typing import Literal
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from pydantic import Field, model_validator
from backend.core.schemas import StrictModel
from backend.sources.routes import SourceGateway, owned_sources
from backend.studies.store import StudyStore, StudyStorageError

router = APIRouter(prefix='/api/v2/sources', tags=['retrieval indexing'])


class IndexStatus(StrictModel):
    source_id: UUID
    source_version: int = Field(ge=1, le=20)
    status: Literal['queued','processing','ready','failed']
    chunks_total: int = Field(ge=0, le=2000)
    chunks_completed: int = Field(ge=0, le=2000)
    error_code: Literal['provider_unavailable','worker_interrupted'] | None

    @model_validator(mode='after')
    def consistent_progress(self):
        if self.chunks_completed > self.chunks_total:
            raise ValueError('Invalid indexing progress')
        if self.status == 'ready' and (not self.chunks_total or self.chunks_completed != self.chunks_total):
            raise ValueError('Incomplete ready index')
        return self


@router.get('/{source_id}/index-status', response_model=IndexStatus)
async def index_status(source_id: UUID, gateway: SourceGateway = Depends(owned_sources)):
    try:
        value = await StudyStore(gateway.client, gateway.project_url, gateway.headers).request(
            '/rpc/get_retrieval_index_status', body={'p_source_id': str(source_id)})
        result = IndexStatus.model_validate_json(json.dumps(value))
        if result.source_id != source_id:
            raise ValueError('Incorrect source identity')
        return result
    except StudyStorageError as exc:
        raise HTTPException({'not_found':404,'session':401}.get(exc.code,503),
                            'Indexing status is unavailable. Retry after checking library setup.') from exc
    except ValueError as exc:
        raise HTTPException(503, 'Indexing status is unavailable.') from exc
