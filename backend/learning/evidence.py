"""Read-only, goal-specific captured evidence for future lesson generation."""
import asyncio
import os
from typing import Literal
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import Field, model_validator

from backend.assistant.models import AssistantQuestion
from backend.assistant.store import AssistantStore
from backend.learning.collection_store import CollectionStore
from backend.retrieval.hybrid import HybridRetriever
from backend.learning.errors import storage_failure
from backend.learning.models import LearningEvidence
from backend.core.schemas import StrictModel
from backend.sources.routes import SourceGateway, owned_sources
from backend.studies.generation import GenerationFailure
from backend.studies.store import StudyStorageError

router = APIRouter(tags=["teaching evidence"])
POLICY = "teaching_evidence_v1"
MAX_REFERENCES = 24
MAX_EXCERPT_CHARS = 16000


class TeachingEvidenceRequest(StrictModel):
    query: str = Field(min_length=1, max_length=2000)
    allow_partial: bool = False

    @model_validator(mode="after")
    def meaningful_query(self):
        if not self.query.strip() or self.query != self.query.strip():
            raise ValueError("Enter a trimmed learning goal or outcome")
        return self


class TeachingSourceCoverage(StrictModel):
    source_id: UUID
    source_version: int = Field(ge=1, le=20)
    status: Literal["ready", "unavailable"]
    selected_passages: int = Field(ge=0, le=24)


class TeachingEvidencePreview(StrictModel):
    policy_version: Literal["teaching_evidence_v1"]
    collection_id: UUID
    plan_id: UUID
    query: str
    collection_source_count: int = Field(ge=1, le=200)
    plan_source_count: int = Field(ge=1, le=8)
    indexing_partial: bool
    sources: list[TeachingSourceCoverage] = Field(min_length=1, max_length=8)
    references: list[LearningEvidence] = Field(max_length=24)
    limitations: list[str]
    gap: str | None


def participating_sources(detail, plan_id):
    plan = next((item for item in detail.learning.plans if item.id == plan_id), None)
    if plan is None or plan.confirmed_at is None:
        raise StudyStorageError("not_found")
    if plan.needs_review or plan.source_id is None:
        raise StudyStorageError("stale")
    members = [(item.source_id, item.source_version) for item in plan.source_members]
    if not members:
        members = [(plan.source_id, plan.source_version)]
    available = {item.id: item.source_version for item in detail.sources}
    if (not 1 <= len(members) <= 8 or len({sid for sid, _ in members}) != len(members)
            or any(available.get(sid) != version for sid, version in members)):
        raise StudyStorageError("stale")
    return members


async def select_teaching_evidence(gateway, collection_id, plan_id, payload):
    collections = CollectionStore(gateway)
    captures = AssistantStore(gateway)
    detail = await collections.read(collection_id)
    members = participating_sources(detail, plan_id)
    inventories = []
    questions = []
    for source_id, version in members:
        question = AssistantQuestion(question=payload.query, source_version=version)
        inventory = await captures.inventory(source_id, question)
        if len(inventory) != 1:
            raise StudyStorageError()
        inventories.append(inventory)
        questions.append(question)
    ready = [group[0] for group in inventories if group[0].generation is not None and group[0].chunks_total > 0]
    partial = len(ready) != len(members)
    if not ready or partial and not payload.allow_partial:
        raise HTTPException(409, "Some path sources are not indexed. Retry when indexing is ready, or explicitly request partial evidence.")
    async with httpx.AsyncClient(trust_env=False) as client:
        hits = await HybridRetriever(client, openai_key=os.getenv("OPENAI_API_KEY", ""),
                                     qdrant_url=os.getenv("QDRANT_URL", ""),
                                     qdrant_key=os.getenv("QDRANT_API_KEY", "")).search(payload.query, gateway.user_id, ready)
    groups = []
    for inventory, question in zip(inventories, questions):
        source = inventory[0]
        if source not in ready:
            continue
        rows, passages, _snapshots, _ranks = await captures.hybrid_context(
            source.source_id, question, inventory, [hit for hit in hits if hit.source_id == source.source_id])
        groups.append((source, rows[0].title, passages[source.source_id]))
    references = []
    length = 0
    for index in range(max((len(passages) for _, _, passages in groups), default=0)):
        for source, title, passages in groups:
            if index >= len(passages) or len(references) >= MAX_REFERENCES:
                continue
            passage = passages[index]
            if length + len(passage.excerpt) > MAX_EXCERPT_CHARS:
                continue
            references.append(LearningEvidence(id=f"p{len(references) + 1:04d}", source_id=source.source_id,
                              source_version=source.source_version, title=title, passage=passage))
            length += len(passage.excerpt)
        if len(references) == MAX_REFERENCES:
            break
    # Revalidate even excluded indexes: readiness/version changes require a new preview.
    for inventory, question in zip(inventories, questions):
        await captures.validate_hybrid(inventory[0].source_id, question, [inventory[0].model_dump(mode="json")])
    current = await collections.read(collection_id)
    if (participating_sources(current, plan_id) != members
            or current.collection.revision != detail.collection.revision
            or current.sources != detail.sources):
        raise StudyStorageError("stale")
    limitations = ["Retrieved passages are a bounded sample, not exhaustive coverage or verified claim support.",
                   "Images, diagrams, uncaptured pages and external material are not evidence."]
    if partial:
        limitations.append("Unavailable indexes were excluded by explicit choice; this preview has partial source coverage.")
    if len(detail.sources) > len(members):
        limitations.append(f"This path uses {len(members)} of {len(detail.sources)} collection sources; other sources were not searched.")
    return TeachingEvidencePreview(policy_version=POLICY, collection_id=collection_id, plan_id=plan_id,
        query=payload.query, collection_source_count=len(detail.sources), plan_source_count=len(members),
        indexing_partial=partial, sources=[TeachingSourceCoverage(source_id=group[0].source_id,
        source_version=group[0].source_version, status="ready" if group[0] in ready else "unavailable",
        selected_passages=sum(item.source_id == group[0].source_id for item in references)) for group in inventories],
        references=references, limitations=limitations,
        gap=None if references else "No matching passages were retrieved for this goal. Try a more specific outcome or add relevant captured material.")


@router.post("/learning/collections/{collection_id}/plans/{plan_id}/evidence-preview", response_model=TeachingEvidencePreview)
async def teaching_evidence_preview(collection_id: UUID, plan_id: UUID, payload: TeachingEvidenceRequest,
                                    gateway: SourceGateway = Depends(owned_sources)):
    try:
        async with asyncio.timeout(35):
            return await select_teaching_evidence(gateway, collection_id, plan_id, payload)
    except StudyStorageError as exc:
        raise storage_failure(exc) from exc
    except (GenerationFailure, TimeoutError) as exc:
        raise HTTPException(503, "Teaching evidence is unavailable. Your current lessons and progress are unchanged; retry.") from exc
