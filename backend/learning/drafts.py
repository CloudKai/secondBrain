"""Owned unfinished learner work, separate from teaching and attempts."""
import json
from datetime import datetime
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path
from pydantic import Field, model_validator

from backend.learning.errors import storage_failure
from backend.learning.store import LearningStore
from backend.core.schemas import StrictModel
from backend.sources.routes import SourceGateway, owned_sources
from backend.studies.store import StudyStorageError

DraftKind = Literal['answer', 'question']


class DraftSave(StrictModel):
    text: str = Field(max_length=5000)
    expected_revision: int = Field(ge=0)
    save_id: UUID = Field(strict=False)


class LessonDraft(StrictModel):
    user_id: UUID = Field(exclude=True)
    collection_id: UUID
    plan_id: UUID
    lesson_index: int = Field(ge=0, le=3)
    kind: DraftKind
    scope: Literal['lesson']
    source_version: int = Field(ge=1, le=20)
    evidence_current: bool
    text: str = Field(max_length=5000)
    revision: int = Field(ge=0)
    save_id: UUID | None
    updated_at: datetime | None

    @model_validator(mode='after')
    def saved_state(self):
        if self.kind == 'question' and len(self.text) > 2000:
            raise ValueError('Question draft too long')
        if self.revision == 0:
            if self.text or self.save_id is not None or self.updated_at is not None:
                raise ValueError('Unexpected unsaved draft')
        elif self.save_id is None or self.updated_at is None or self.updated_at.utcoffset() is None:
            raise ValueError('Incomplete saved draft')
        return self


class DraftStore:
    def __init__(self, gateway):
        self.learning = LearningStore(gateway)

    async def read_or_save(self, collection_id, plan_id, lesson_index, kind, payload=None):
        body = dict(p_collection_id=str(collection_id), p_plan_id=str(plan_id),
                    p_lesson_index=lesson_index, p_kind=kind)
        if payload is not None:
            body.update(p_text=payload.text, p_expected_revision=payload.expected_revision, p_save_id=str(payload.save_id))
        value = await self.learning.call('save_learning_draft' if payload else 'get_learning_draft', **body)
        try:
            draft = LessonDraft.model_validate_json(json.dumps(value))
            if (draft.user_id != self.learning.user_id or draft.collection_id != collection_id
                    or draft.plan_id != plan_id or draft.lesson_index != lesson_index or draft.kind != kind):
                raise ValueError('Unexpected draft identity')
            if payload and (draft.text != payload.text or draft.save_id != payload.save_id
                            or draft.revision != payload.expected_revision + 1):
                raise ValueError('Unexpected saved draft')
            return draft
        except (ValueError, TypeError) as exc:
            raise StudyStorageError() from exc


router = APIRouter(prefix='/learning/collections/{collection_id}/plans/{plan_id}/lessons/{lesson_index}/drafts', tags=['learning drafts'])


@router.get('/{kind}', response_model=LessonDraft)
async def read_draft(collection_id: UUID, plan_id: UUID, kind: DraftKind,
                     lesson_index: int = Path(ge=0, le=3), gateway: SourceGateway = Depends(owned_sources)):
    try:
        return await DraftStore(gateway).read_or_save(collection_id, plan_id, lesson_index, kind)
    except StudyStorageError as exc:
        raise storage_failure(exc) from exc


@router.put('/{kind}', response_model=LessonDraft)
async def save_draft(collection_id: UUID, plan_id: UUID, kind: DraftKind, payload: DraftSave,
                     lesson_index: int = Path(ge=0, le=3), gateway: SourceGateway = Depends(owned_sources)):
    if kind == 'question' and len(payload.text) > 2000:
        raise HTTPException(422, 'Keep a tutor question within 2000 characters.')
    try:
        return await DraftStore(gateway).read_or_save(collection_id, plan_id, lesson_index, kind, payload)
    except StudyStorageError as exc:
        if exc.code == 'stale':
            raise HTTPException(409, 'This draft changed in another tab. Compare the saved version before replacing it.') from exc
        raise storage_failure(exc) from exc
