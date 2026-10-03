"""Evidence-backed topic maps; source notes remain immutable."""

from datetime import datetime
from typing import Literal, Annotated
from uuid import UUID
from pydantic import Field, model_validator
from backend.schemas import StrictModel
from backend.study_models import StudyError, StudyNote, StudyState

ShortText = Annotated[str, Field(min_length=1, max_length=100)]


class TopicDescription(StrictModel):
    id: UUID
    title: str = Field(min_length=1, max_length=100)
    context: str = Field(min_length=1, max_length=100)
    aliases: list[ShortText] = Field(max_length=6)
    groups: list[ShortText] = Field(max_length=4)
    description: str = Field(min_length=1, max_length=500)


class TopicAssignment(TopicDescription):
    role: Literal["main", "supporting"]
    citation_ids: list[str] = Field(min_length=1, max_length=10)
    uncertain: bool
    suggested_topic_id: UUID | None
    placement_reason: str = Field(min_length=1, max_length=500)


class TopicRelation(StrictModel):
    source: UUID
    target: UUID
    kind: Literal["uses", "requires", "evaluates"]
    reason: str = Field(min_length=1, max_length=500)
    citation_ids: list[str] = Field(min_length=1, max_length=10)


class TopicAnalysis(StrictModel):
    topics: list[TopicAssignment] = Field(min_length=1, max_length=12)
    relations: list[TopicRelation] = Field(max_length=24)
    catalog_partial: bool = False

    @model_validator(mode="after")
    def connected_topics(self):
        ids = {t.id for t in self.topics}
        if len(ids) != len(self.topics) or not any(
            t.role == "main" for t in self.topics
        ):
            raise ValueError("Distinct topics and a main topic are required")
        if any(
            r.source == r.target or r.source not in ids or r.target not in ids
            for r in self.relations
        ):
            raise ValueError("Relationship endpoints must be covered topics")
        return self


class TopicRecord(StrictModel):
    source_id: UUID
    user_id: UUID = Field(exclude=True)
    status: StudyState
    attempts: int = Field(ge=0, le=3)
    max_attempts: Literal[3]
    next_attempt_at: datetime
    error_code: StudyError | None
    analysis: TopicAnalysis | None
    updated_at: datetime

    @model_validator(mode="after")
    def completed_analysis(self):
        if (self.status == "succeeded") != (self.analysis is not None):
            raise ValueError("Only succeeded maps contain analysis")
        return self


class TopicNode(TopicDescription):
    aliases: list[ShortText] = Field(max_length=500)
    groups: list[ShortText] = Field(max_length=100)
    source_ids: list[UUID]
    uncertain: bool


class TopicConnection(StrictModel):
    id: str
    source: UUID
    target: UUID
    kind: Literal["uses", "requires", "evaluates"]
    reason: str
    source_ids: list[UUID]
    evidence: dict[str, list[str]]


class TopicLibrary(StrictModel):
    maps: list[TopicRecord]
    topics: list[TopicNode]
    connections: list[TopicConnection]
    graph_ready: bool
    partial: bool


class TopicPlacement(StrictModel):
    topic_id: UUID
    target_id: UUID | None = None


class TopicClaim(StrictModel):
    source_id: UUID
    user_id: UUID
    lease_token: UUID
    attempt: int = Field(ge=1, le=3)
    note: StudyNote


class DraftTopic(StrictModel):
    key: str = Field(min_length=1, max_length=100, pattern=r"^[a-z0-9-]+$")
    title: str = Field(min_length=1, max_length=100)
    context: str = Field(min_length=1, max_length=100)
    aliases: list[ShortText] = Field(max_length=6)
    groups: list[ShortText] = Field(max_length=4)
    description: str = Field(min_length=1, max_length=500)
    role: Literal["main", "supporting"]
    coverage: Literal["substantive", "mention"]
    citation_ids: list[str] = Field(min_length=1, max_length=10)
    existing_topic_id: str | None
    uncertain: bool
    suggested_topic_id: str | None
    placement_reason: str = Field(min_length=1, max_length=500)


class DraftRelation(StrictModel):
    source_key: str
    target_key: str
    kind: Literal["uses", "requires", "evaluates"]
    reason: str = Field(min_length=1, max_length=500)
    citation_ids: list[str] = Field(min_length=1, max_length=10)


class DraftTopicMap(StrictModel):
    topics: list[DraftTopic] = Field(min_length=1, max_length=12)
    relations: list[DraftRelation] = Field(max_length=24)
