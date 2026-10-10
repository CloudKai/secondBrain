"""Goal-aware captured evidence selection for a new source-based path."""
import asyncio
import os
from dataclasses import dataclass

import httpx
from fastapi import HTTPException

from backend.assistant_models import AssistantQuestion
from backend.assistant_store import AssistantStore
from backend.hybrid_retrieval import HybridRetriever
from backend.study_models import SourceReference
from backend.study_store import StudyStorageError
from backend.teaching_evidence import MAX_REFERENCES, MAX_EXCERPT_CHARS


@dataclass(frozen=True)
class CaptureTeachingEvidence:
    references: list[SourceReference]
    snapshots: list[dict]
    question: AssistantQuestion


async def select_capture_teaching(gateway, context, goal: str) -> CaptureTeachingEvidence:
    async with asyncio.timeout(35):
        captures = AssistantStore(gateway)
        question = AssistantQuestion(question=(context.source.title + ': ' + (goal.strip() or 'Identify teachable concepts and their qualifications')),
                                     source_version=context.source.source_version)
        inventory = await captures.inventory(context.source.id, question)
        if len(inventory) != 1 or inventory[0].source_id != context.source.id:
            raise StudyStorageError()
        if inventory[0].generation is None or inventory[0].chunks_total == 0:
            raise HTTPException(409, 'This source is still indexing or its index is unavailable. Wait and retry, or explicitly choose Saved note passages.')
        async with httpx.AsyncClient(trust_env=False) as client:
            hits = await HybridRetriever(client, openai_key=os.getenv('OPENAI_API_KEY', ''),
                qdrant_url=os.getenv('QDRANT_URL', ''), qdrant_key=os.getenv('QDRANT_API_KEY', '')).search(question.question, gateway.user_id, inventory)
        rows, passages, snapshots, _ranks = await captures.hybrid_context(context.source.id, question, inventory, hits)
        if rows[0].captured_text != context.source.captured_text or rows[0].document != context.source.document or rows[0].transcript != context.source.transcript:
            raise StudyStorageError('stale')
        selected = []
        length = 0
        for passage in passages[context.source.id]:
            if len(selected) >= MAX_REFERENCES:
                break
            if length + len(passage.excerpt) <= MAX_EXCERPT_CHARS:
                selected.append(passage)
                length += len(passage.excerpt)
        if not selected:
            raise HTTPException(409, 'No captured evidence matched this goal. Try a more specific goal or add relevant material. No plan was generated.')
        await captures.validate_hybrid(context.source.id, question, snapshots)
        return CaptureTeachingEvidence(selected, snapshots, question)


async def revalidate_capture_teaching(gateway, context, selected):
    await AssistantStore(gateway).validate_hybrid(context.source.id, selected.question, selected.snapshots)
