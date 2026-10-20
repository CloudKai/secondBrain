"""Owned lesson conversations; Postgres fences retries, revisions and evidence."""
import json
from datetime import datetime
from typing import Literal
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Path
from pydantic import Field, model_validator

from backend.learning.errors import storage_failure
from backend.learning.collection_store import CollectionStore
from backend.learning.generation import LearningGenerator
from backend.learning.models import TutorReply, TutorQuestion, TutorMessage
from backend.studies.generation import GenerationFailure
from backend.learning.store import LearningStore
from backend.core.schemas import StrictModel
from backend.sources.routes import SourceGateway, owned_sources
from backend.studies.store import StudyStorageError


class ConversationSend(StrictModel):
    question: str = Field(min_length=1, max_length=2000)
    expected_revision: int = Field(ge=0)
    request_id: UUID = Field(strict=False)


class ConversationClear(StrictModel):
    expected_revision: int = Field(ge=0)


class TutorExchange(StrictModel):
    id: UUID
    question: str = Field(min_length=1, max_length=2000)
    status: Literal['processing', 'failed', 'completed']
    reply: TutorReply | None
    redacted: bool
    model: Literal['gpt-6-luna', 'gpt-6.1-sol'] | None
    policy_version: Literal['learning_v1']
    created_at: datetime
    completed_at: datetime | None

    @model_validator(mode='after')
    def saved_state(self):
        if self.created_at.utcoffset() is None:
            raise ValueError('Missing exchange timezone')
        if self.status == 'completed':
            if (self.model is None or self.completed_at is None or self.completed_at.utcoffset() is None
                    or (self.reply is None) != self.redacted):
                raise ValueError('Incomplete tutor exchange')
        elif self.reply is not None or self.model is not None or self.completed_at is not None:
            raise ValueError('Uncompleted tutor reply')
        return self


class LessonConversation(StrictModel):
    user_id: UUID = Field(exclude=True)
    collection_id: UUID
    plan_id: UUID
    lesson_index: int = Field(ge=0, le=3)
    scope: Literal['lesson']
    source_version: int = Field(ge=1, le=20)
    evidence_current: bool
    revision: int = Field(ge=0)
    exchanges: list[TutorExchange] = Field(max_length=50)

    @model_validator(mode='after')
    def ordered_exchanges(self):
        if len({item.id for item in self.exchanges}) != len(self.exchanges):
            raise ValueError('Duplicate tutor exchange')
        if self.exchanges != sorted(self.exchanges, key=lambda item: (item.created_at, str(item.id))):
            raise ValueError('Unordered tutor exchanges')
        return self


class ConversationClaim(StrictModel):
    conversation: LessonConversation
    lease_token: UUID | None


class ConversationStore:
    def __init__(self, gateway):
        self.learning = LearningStore(gateway)

    def validate(self, value, collection_id, plan_id, lesson_index):
        try:
            result = LessonConversation.model_validate_json(json.dumps(value))
            if (result.user_id != self.learning.user_id or result.collection_id != collection_id
                    or result.plan_id != plan_id or result.lesson_index != lesson_index):
                raise ValueError('Unexpected conversation identity')
            return result
        except (ValueError, TypeError) as exc:
            raise StudyStorageError() from exc

    async def read(self, collection_id, plan_id, lesson_index):
        value = await self.learning.call('get_learning_conversation', p_collection_id=str(collection_id),
                                         p_plan_id=str(plan_id), p_lesson_index=lesson_index)
        return self.validate(value, collection_id, plan_id, lesson_index)


router = APIRouter(prefix='/learning/collections/{collection_id}/plans/{plan_id}/lessons/{lesson_index}/conversation', tags=['learning conversations'])


@router.get('', response_model=LessonConversation)
async def read_conversation(collection_id: UUID, plan_id: UUID,
                            lesson_index: int = Path(ge=0, le=3), gateway: SourceGateway = Depends(owned_sources)):
    try:
        return await ConversationStore(gateway).read(collection_id, plan_id, lesson_index)
    except StudyStorageError as exc:
        raise storage_failure(exc) from exc


@router.post('', response_model=LessonConversation)
async def send_conversation(collection_id: UUID, plan_id: UUID, payload: ConversationSend,
                            lesson_index: int = Path(ge=0, le=3), gateway: SourceGateway = Depends(owned_sources)):
    store = ConversationStore(gateway)
    lease = None
    try:
        value = await store.learning.call('request_learning_conversation', p_collection_id=str(collection_id),
                                         p_plan_id=str(plan_id), p_lesson_index=lesson_index,
                                         p_request_id=str(payload.request_id), p_question=payload.question,
                                         p_expected_revision=payload.expected_revision)
        try:
            claim = ConversationClaim.model_validate_json(json.dumps(value))
            conversation = store.validate(value['conversation'], collection_id, plan_id, lesson_index)
            lease = claim.lease_token
            if lease is not None and (conversation.revision != payload.expected_revision or not conversation.evidence_current):
                raise ValueError('Unexpected claimed conversation revision')
            exchange = next(item for item in conversation.exchanges if item.id == payload.request_id)
            if exchange.question != payload.question or exchange.status != ('processing' if lease else 'completed'):
                raise ValueError('Unexpected tutor request')
        except (ValueError, TypeError, KeyError, StopIteration) as exc:
            raise StudyStorageError() from exc
        if lease is None:
            return conversation
        detail = await CollectionStore(gateway).read(collection_id)
        plan = next((item for item in detail.learning.plans if item.id == plan_id), None)
        if plan is None or plan.confirmed_at is None or plan.needs_review or plan.source_version != conversation.source_version or lesson_index >= len(plan.content.lessons):
            raise StudyStorageError('stale')
        recent = [item for item in conversation.exchanges if item.status == 'completed' and not item.redacted][-2:]
        history = []
        for item in recent:
            history.extend([TutorMessage(role='user', text=item.question[:1000]),
                            TutorMessage(role='assistant', text=item.reply.text[:1000])])
        question = TutorQuestion(lesson_index=lesson_index, question=payload.question, history=history)
        async with httpx.AsyncClient() as client:
            reply, model = await LearningGenerator(client).tutor_exchange(plan, question)
        await store.learning.finish('finish_learning_conversation', p_request_id=str(payload.request_id),
                                    p_lease_token=str(lease), p_reply=reply.model_dump(mode='json'), p_model=model)
        lease = None
        result = await store.read(collection_id, plan_id, lesson_index)
        if not any(item.id == payload.request_id and item.status == 'completed' for item in result.exchanges):
            raise StudyStorageError('stale')
        return result
    except StudyStorageError as exc:
        raise storage_failure(exc) from exc
    except GenerationFailure as exc:
        raise HTTPException(503, 'The tutor could not complete this reply. Your question is saved; retry this send.') from exc
    finally:
        if lease is not None:
            try:
                await store.learning.finish('finish_learning_conversation', p_request_id=str(payload.request_id),
                                            p_lease_token=str(lease), p_reply=None, p_model=None)
            except StudyStorageError:
                pass  # The expiring database lease permits recovery after a storage outage.


@router.delete('', response_model=LessonConversation)
async def clear_conversation(collection_id: UUID, plan_id: UUID, payload: ConversationClear,
                             lesson_index: int = Path(ge=0, le=3), gateway: SourceGateway = Depends(owned_sources)):
    store = ConversationStore(gateway)
    try:
        value = await store.learning.call('clear_learning_conversation', p_collection_id=str(collection_id),
                                         p_plan_id=str(plan_id), p_lesson_index=lesson_index,
                                         p_expected_revision=payload.expected_revision)
        result = store.validate(value, collection_id, plan_id, lesson_index)
        if result.exchanges or result.revision != payload.expected_revision + 1:
            raise StudyStorageError()
        return result
    except StudyStorageError as exc:
        raise storage_failure(exc) from exc
