"""Collection entry points; legacy source routes remain available."""
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from backend.collection_models import CollectionDetail, CollectionList, CollectionPlaceRequest
from backend.collection_store import CollectionStore
from backend.sources import SourceGateway, owned_sources
from backend.study_store import StudyStorageError
from backend.learning_errors import storage_failure

from backend.learning_drafts import router as drafts_router
from backend.learning_conversations import router as conversations_router
from backend.teaching_evidence import router as evidence_router

router = APIRouter(tags=["learning collections"])
router.include_router(drafts_router)
router.include_router(conversations_router)
router.include_router(evidence_router)


@router.get("/learning/collections", response_model=CollectionList)
async def list_collections(offset: int = Query(default=0, ge=0), gateway: SourceGateway = Depends(owned_sources)):
    try:
        return await CollectionStore(gateway).list(offset)
    except StudyStorageError as exc:
        raise storage_failure(exc) from exc


@router.get("/learning/collections/{collection_id}", response_model=CollectionDetail)
async def get_collection(collection_id: UUID, gateway: SourceGateway = Depends(owned_sources)):
    try:
        return await CollectionStore(gateway).read(collection_id)
    except StudyStorageError as exc:
        raise storage_failure(exc) from exc


@router.get("/sources/{source_id}/learning/collection", response_model=CollectionDetail)
async def resolve_collection(source_id: UUID, gateway: SourceGateway = Depends(owned_sources)):
    try:
        return await CollectionStore(gateway).resolve(source_id)
    except StudyStorageError as exc:
        raise storage_failure(exc) from exc


@router.post("/learning/collections/{collection_id}/plans/{plan_id}/place", response_model=CollectionDetail)
async def select_collection_lesson(collection_id: UUID, plan_id: UUID, payload: CollectionPlaceRequest,
                                   gateway: SourceGateway = Depends(owned_sources)):
    try:
        return await CollectionStore(gateway).select(collection_id, plan_id, payload)
    except StudyStorageError as exc:
        raise storage_failure(exc) from exc
