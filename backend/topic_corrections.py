"""Validated learner corrections; Postgres owns atomic application and fences."""

from typing import Annotated, Literal
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import Field, field_validator
from backend.schemas import StrictModel
from backend.sources import SourceGateway, owned_sources
from backend.study_store import StudyStore, StudyStorageError

WireUUID = Annotated[UUID, Field(strict=False)]


class RenameTopic(StrictModel):
    action: Literal["rename"]
    topic_id: WireUUID
    title: str = Field(min_length=1, max_length=100)

    @field_validator("title")
    @classmethod
    def nonblank(cls, title):
        if not title.strip():
            raise ValueError("A topic name is required")
        return title.strip()


class MergeTopics(StrictModel):
    action: Literal["merge"]
    topic_id: WireUUID
    target_id: WireUUID


class ConnectionChoice(StrictModel):
    action: Literal["connection"]
    source: WireUUID
    target: WireUUID
    state: Literal["accepted", "rejected"]


class SourceAssignments(StrictModel):
    action: Literal["assign"]
    source_id: WireUUID
    topic_ids: list[WireUUID] = Field(min_length=1, max_length=12)
    evidence_ids: list[str] = Field(min_length=1, max_length=10)

    @field_validator("topic_ids", "evidence_ids")
    @classmethod
    def distinct_choices(cls, values):
        if len(set(values)) != len(values):
            raise ValueError("Choose distinct topics and passages")
        return values


TopicCorrection = Annotated[RenameTopic | MergeTopics | ConnectionChoice | SourceAssignments, Field(discriminator="action")]


router = APIRouter()


@router.post("/topic-corrections", status_code=204)
async def correct_topics(
    payload: TopicCorrection,
    gateway: SourceGateway = Depends(owned_sources),
):
    try:
        result = await StudyStore(gateway.client, gateway.project_url, gateway.headers).request(
            "/rpc/correct_topic_library", body={"p_action": payload.model_dump(mode="json")}
        )
        if result is not True:
            raise StudyStorageError()
    except StudyStorageError as exc:
        if exc.code == "not_found":
            raise HTTPException(404, "This topic or source is no longer available. Reload topics.") from exc
        if exc.code == "session":
            raise HTTPException(401, "Your library session is unavailable. Retry connecting.") from exc
        raise HTTPException(503, "Topic corrections could not be saved. Check the migration and retry.") from exc
    return Response(status_code=204)
