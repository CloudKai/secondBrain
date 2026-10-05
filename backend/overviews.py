"""Authenticated, read-only topic overview and view-choice endpoints."""

from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from backend.sources import SourceGateway, owned_sources
from backend.study_store import StudyStorageError
from backend.overview_store import OverviewStore
from backend.overview_models import OverviewSnapshot, OverviewView

router = APIRouter(prefix="/topics", tags=["browser topic overviews"])


def storage_error(exc: StudyStorageError):
    if exc.code == "not_found":
        return HTTPException(
            404, "This topic or its completed sources are unavailable. Reload topics."
        )
    if exc.code == "session":
        return HTTPException(
            401, "Your library session is unavailable. Retry connecting."
        )
    return HTTPException(
        503,
        "Topic overviews are unavailable. Check the overview migration and worker, then retry.",
    )


@router.get("/{topic_id}/overview", response_model=OverviewSnapshot)
async def get_overview(topic_id: UUID, gateway: SourceGateway = Depends(owned_sources)):
    try:
        return await OverviewStore(
            gateway.client, gateway.project_url, gateway.headers
        ).snapshot(topic_id, user_id=gateway.user_id)
    except StudyStorageError as exc:
        raise storage_error(exc) from exc


@router.post("/{topic_id}/overview", response_model=OverviewSnapshot)
async def set_view(
    topic_id: UUID,
    payload: OverviewView,
    gateway: SourceGateway = Depends(owned_sources),
):
    try:
        return await OverviewStore(
            gateway.client, gateway.project_url, gateway.headers
        ).snapshot(topic_id, payload, user_id=gateway.user_id)
    except StudyStorageError as exc:
        raise storage_error(exc) from exc
