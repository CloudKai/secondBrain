"""Authenticated topic library backed by separately persisted source maps."""

from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from backend.sources import SourceGateway, owned_sources
from backend.study_models import StudyRequest
from backend.study_store import StudyStorageError
from backend.topic_models import TopicLibrary, TopicRecord, TopicPlacement
from backend.topic_store import TopicStore
from backend.topic_library import build_topic_library

from backend.overviews import router as overview_router
from backend.topic_corrections import router as correction_router

router = APIRouter(prefix="/api/v2", tags=["browser topics"])
router.include_router(overview_router)
router.include_router(correction_router)


def storage_failure(error: StudyStorageError):
    if error.code == "not_found":
        return HTTPException(
            404, "Source or suggested placement is unavailable. Reload topics."
        )
    if error.code == "session":
        return HTTPException(
            401, "Your library session is unavailable. Retry connecting."
        )
    return HTTPException(
        503, "Topic storage is unavailable. Check the topic migration and retry."
    )


@router.get("/topic-library", response_model=TopicLibrary)
async def topic_library(gateway: SourceGateway = Depends(owned_sources)):
    try:
        store = TopicStore(
            gateway.client, gateway.project_url, gateway.headers
        )
        records = await store.list_owned(gateway.user_id)
        decisions = await store.decisions(gateway.user_id)
        return build_topic_library(records[:500], partial=len(records) > 500 or len(decisions) > 5000, decisions=decisions)
    except StudyStorageError as exc:
        raise storage_failure(exc) from exc


@router.post("/sources/{source_id}/topics", response_model=TopicRecord, status_code=202)
async def request_topics(
    source_id: UUID,
    payload: StudyRequest,
    gateway: SourceGateway = Depends(owned_sources),
):
    try:
        return await TopicStore(
            gateway.client, gateway.project_url, gateway.headers
        ).accept(source_id, gateway.user_id, payload.retry)
    except StudyStorageError as exc:
        raise storage_failure(exc) from exc


@router.post("/sources/{source_id}/topics/placement", response_model=TopicRecord)
async def confirm_placement(
    source_id: UUID,
    payload: TopicPlacement,
    gateway: SourceGateway = Depends(owned_sources),
):
    try:
        return await TopicStore(
            gateway.client, gateway.project_url, gateway.headers
        ).placement(source_id, gateway.user_id, payload)
    except StudyStorageError as exc:
        raise storage_failure(exc) from exc
