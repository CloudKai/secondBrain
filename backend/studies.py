"""Learner-owned study acceptance and persisted status; no model calls in HTTP."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query

from backend.sources import SourceGateway, owned_sources
from backend.study_models import StudyPage, StudyRecord, StudyRequest
from backend.study_store import StudyStorageError, StudyStore

router = APIRouter(prefix="/api/v2", tags=["browser studies"])


def storage_failure(error: StudyStorageError) -> HTTPException:
    if error.code == "not_found":
        return HTTPException(404, "Source not found.")
    if error.code == "session":
        return HTTPException(
            401, "Your library session is unavailable. Retry connecting."
        )
    return HTTPException(
        503, "Study note storage is unavailable. Check the study migration and retry."
    )


@router.post("/sources/{source_id}/study", response_model=StudyRecord, status_code=202)
async def request_study(
    source_id: UUID,
    payload: StudyRequest,
    gateway: SourceGateway = Depends(owned_sources),
) -> StudyRecord:
    store = StudyStore(gateway.client, gateway.project_url, gateway.headers)
    try:
        return await store.accept(source_id, gateway.user_id, payload.retry)
    except StudyStorageError as exc:
        raise storage_failure(exc) from exc


@router.get("/studies", response_model=StudyPage)
async def list_studies(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    gateway: SourceGateway = Depends(owned_sources),
) -> StudyPage:
    store = StudyStore(gateway.client, gateway.project_url, gateway.headers)
    try:
        records = await store.list_owned(gateway.user_id, limit + 1, offset)
        return StudyPage(
            studies=records[:limit],
            next_offset=offset + limit if len(records) > limit else None,
        )
    except StudyStorageError as exc:
        raise storage_failure(exc) from exc
