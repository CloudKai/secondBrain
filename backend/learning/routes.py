"""Authenticated learning journeys, separate from read-only source notes."""
from uuid import UUID
import httpx

from fastapi import APIRouter, Depends, HTTPException, Query
from backend.learning.models import LearningHistory, LearningCandidates, RevisionRequest, LessonPlaceRequest, LearningGraph, LearningSummary

from backend.learning.models import LearningSnapshot, PreviewRequest, AttemptRequest, ActivityRequest, TutorQuestion, TutorReply
from backend.learning.generation import LearningGenerator
from backend.learning.capture import select_capture_teaching, revalidate_capture_teaching
from backend.studies.generation import GenerationFailure
from backend.learning.store import LearningStore
from backend.sources.routes import SourceGateway, owned_sources
from backend.studies.store import StudyStorageError

from backend.learning.errors import storage_failure
from backend.learning.collections import router as collections_router

router = APIRouter(prefix="/api/v2", tags=["learning journeys"])
router.include_router(collections_router)


@router.get("/sources/{source_id}/learning", response_model=LearningSnapshot)
async def get_learning(source_id: UUID, gateway: SourceGateway = Depends(owned_sources)):
    try:
        return await LearningStore(gateway).read(source_id)
    except StudyStorageError as exc:
        raise storage_failure(exc) from exc


@router.get("/learning/history", response_model=LearningHistory)
async def learning_history(offset: int = Query(default=0, ge=0), gateway: SourceGateway = Depends(owned_sources)):
    try:
        return await LearningStore(gateway).history(offset)
    except StudyStorageError as exc:
        raise storage_failure(exc) from exc


@router.get("/learning/graph", response_model=LearningGraph)
async def learning_graph(gateway: SourceGateway = Depends(owned_sources)):
    try:
        return await LearningStore(gateway).graph()
    except StudyStorageError as exc:
        raise storage_failure(exc) from exc


@router.get("/learning/summary", response_model=LearningSummary)
async def learning_summary(gateway: SourceGateway = Depends(owned_sources)):
    try:
        return await LearningStore(gateway).summary()
    except StudyStorageError as exc:
        raise storage_failure(exc) from exc


@router.post("/sources/{source_id}/learning/preview", response_model=LearningSnapshot)
async def preview_learning(source_id: UUID, payload: PreviewRequest, gateway: SourceGateway = Depends(owned_sources)):
    store = LearningStore(gateway)
    try:
        context = await store.preview_context(source_id, payload)
        if context.lease_token is None:
            return await store.read(source_id)
        manifest, snapshots = None, None
        try:
            if payload.evidence_mode == "capture":
                selected = await select_capture_teaching(gateway, context, payload.goal)
                async with httpx.AsyncClient(trust_env=False) as client:
                    draft, manifest, model = await LearningGenerator(client).capture_preview(context, payload.goal, payload.difficulty, selected.references)
                await revalidate_capture_teaching(gateway, context, selected)
                references, snapshots = selected.references, selected.snapshots
            else:
                async with httpx.AsyncClient(trust_env=False) as client:
                    draft, model, references = await LearningGenerator(client).preview(context, payload.goal, payload.difficulty, payload.path_id is not None)
        except (GenerationFailure, StudyStorageError, HTTPException, TimeoutError):
            # Release a failed preview without replacing the original failure.
            try:
                await store.finish_preview(source_id, context)
            except StudyStorageError:
                pass
            raise
        return await store.finish_preview(source_id, context, draft=draft, model=model,
            goal=payload.goal.strip() or draft.suggested_goal, references=references, manifest=manifest, snapshots=snapshots)
    except StudyStorageError as exc:
        raise storage_failure(exc) from exc
    except (GenerationFailure, TimeoutError) as exc:
        raise HTTPException(503, "The learning preview could not be generated. Your source and previous progress are safe; retry.") from exc


async def owned_plan(store, source_id, plan_id, *, confirmed=False):
    snapshot = await store.read(source_id)
    plan = next((plan for plan in snapshot.plans if plan.id == plan_id), None)
    if plan is None:
        raise StudyStorageError("not_found")
    if plan.needs_review or confirmed and plan.confirmed_at is None:
        raise StudyStorageError("stale")
    return plan


@router.get("/sources/{source_id}/learning/plans/{plan_id}/candidates", response_model=LearningCandidates)
async def learning_candidates(source_id: UUID, plan_id: UUID, gateway: SourceGateway = Depends(owned_sources)):
    store = LearningStore(gateway)
    try:
        await owned_plan(store, source_id, plan_id, confirmed=True)
        return await store.candidates(source_id, plan_id)
    except StudyStorageError as exc:
        raise storage_failure(exc) from exc


@router.post("/sources/{source_id}/learning/plans/{plan_id}/revision", response_model=LearningSnapshot)
async def learning_revision(source_id: UUID, plan_id: UUID, payload: RevisionRequest, gateway: SourceGateway = Depends(owned_sources)):
    store = LearningStore(gateway)
    try:
        await owned_plan(store, source_id, plan_id, confirmed=True)
        context = await store.revision_context(source_id, plan_id, payload)
        if context.lease_token is None:
            return await store.read(source_id)
        try:
            async with httpx.AsyncClient(trust_env=False) as client:
                draft, model, evidence = await LearningGenerator(client).revision(context)
        except GenerationFailure:
            await store.finish_revision(source_id, context)
            raise
        return await store.finish_revision(source_id, context, draft, evidence, model)
    except StudyStorageError as exc:
        raise storage_failure(exc) from exc
    except GenerationFailure as exc:
        raise HTTPException(503, "The contribution preview is unavailable. Your current plan and progress are saved; retry.") from exc


@router.post("/sources/{source_id}/learning/plans/{plan_id}/confirm", response_model=LearningSnapshot)
async def confirm_learning(source_id: UUID, plan_id: UUID, gateway: SourceGateway = Depends(owned_sources)):
    store = LearningStore(gateway)
    try:
        await owned_plan(store, source_id, plan_id)
        return store.snapshot(await store.call("confirm_learning_plan", p_plan_id=str(plan_id)), source_id)
    except StudyStorageError as exc:
        raise storage_failure(exc) from exc


@router.post("/sources/{source_id}/learning/plans/{plan_id}/place", response_model=LearningSnapshot)
async def select_lesson(source_id: UUID, plan_id: UUID, payload: LessonPlaceRequest, gateway: SourceGateway = Depends(owned_sources)):
    store = LearningStore(gateway)
    try:
        snapshot = await store.read(source_id)
        if not any(plan.id == plan_id and plan.confirmed_at is not None for plan in snapshot.plans):
            raise StudyStorageError("not_found")
        body = {"p_plan_id": str(plan_id), "p_lesson_index": payload.lesson_index}
        name = "select_learning_lesson"
        if payload.expected_revision is not None:
            name = "select_learning_lesson_checked"
            body["p_expected_revision"] = payload.expected_revision
        return store.snapshot(await store.call(name, **body), source_id)
    except StudyStorageError as exc:
        raise storage_failure(exc) from exc


@router.post("/sources/{source_id}/learning/plans/{plan_id}/attempts", response_model=LearningSnapshot, status_code=202)
async def submit_attempt(source_id: UUID, plan_id: UUID, payload: AttemptRequest, gateway: SourceGateway = Depends(owned_sources)):
    store = LearningStore(gateway)
    try:
        plan = await owned_plan(store, source_id, plan_id, confirmed=True)
        if payload.lesson_index >= len(plan.content.lessons):
            raise HTTPException(422, "Choose an available understanding check.")
        return store.snapshot(await store.call("submit_learning_attempt", p_plan_id=str(plan_id),
                              p_request_id=str(payload.request_id), p_lesson_index=payload.lesson_index,
                              p_response=payload.response), source_id)
    except StudyStorageError as exc:
        raise storage_failure(exc) from exc


@router.post("/sources/{source_id}/learning/plans/{plan_id}/activity", response_model=LearningSnapshot)
async def record_activity(source_id: UUID, plan_id: UUID, payload: ActivityRequest, gateway: SourceGateway = Depends(owned_sources)):
    store = LearningStore(gateway)
    try:
        plan = await owned_plan(store, source_id, plan_id, confirmed=True)
        count = len(plan.content.background) if payload.kind == "background_opened" else len(plan.content.lessons)
        if payload.lesson_index >= count:
            raise HTTPException(422, "Choose an available learning activity.")
        return store.snapshot(await store.call("record_learning_activity", p_plan_id=str(plan_id),
                              p_lesson_index=payload.lesson_index, p_kind=payload.kind), source_id)
    except StudyStorageError as exc:
        raise storage_failure(exc) from exc


@router.post("/sources/{source_id}/learning/attempts/{attempt_id}/feedback", response_model=LearningSnapshot)
async def practice_feedback(source_id: UUID, attempt_id: UUID, gateway: SourceGateway = Depends(owned_sources)):
    store = LearningStore(gateway)
    try:
        snapshot = await store.read(source_id)
        attempt = next((attempt for attempt in snapshot.attempts if attempt.id == attempt_id), None)
        if attempt is None:
            raise StudyStorageError("not_found")
        plan = await owned_plan(store, source_id, attempt.plan_id, confirmed=True)
        context = await store.feedback_context(source_id, attempt_id, attempt)
        if context.lease_token is None:
            return await store.read(source_id)
        body = {"p_attempt_id": str(attempt_id), "p_lease_token": str(context.lease_token)}
        try:
            async with httpx.AsyncClient(trust_env=False) as client:
                feedback, _model = await LearningGenerator(client).feedback(plan, context.lesson_index, context.response)
        except GenerationFailure:
            await store.finish("finish_learning_feedback", **body, p_feedback=None)
            return await store.read(source_id)
        await store.finish("finish_learning_feedback", **body, p_feedback=feedback.model_dump(mode="json"))
        return await store.read(source_id)
    except StudyStorageError as exc:
        raise storage_failure(exc) from exc


@router.post("/sources/{source_id}/learning/plans/{plan_id}/tutor", response_model=TutorReply)
async def lesson_tutor(source_id: UUID, plan_id: UUID, payload: TutorQuestion, gateway: SourceGateway = Depends(owned_sources)):
    store = LearningStore(gateway)
    try:
        plan = await owned_plan(store, source_id, plan_id, confirmed=True)
        if payload.lesson_index >= len(plan.content.lessons):
            raise HTTPException(422, "Choose an available lesson.")
        async with httpx.AsyncClient(trust_env=False) as client:
            reply = await LearningGenerator(client).tutor(plan, payload)
        await owned_plan(store, source_id, plan_id, confirmed=True)
        return reply
    except StudyStorageError as exc:
        raise storage_failure(exc) from exc
    except GenerationFailure as exc:
        raise HTTPException(503, "The lesson tutor is unavailable. Your learning progress is saved; retry.") from exc
