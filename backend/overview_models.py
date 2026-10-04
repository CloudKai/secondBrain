"""Owned topic views; source notes remain authoritative."""

from typing import Literal
from uuid import UUID
from pydantic import Field
from backend.schemas import StrictModel


class OverviewView(StrictModel):
    view_mode: Literal["combined", "separate"]
    retry: bool = False


from datetime import datetime
from pydantic import model_validator
from backend.study_models import SourceReference, StudyNote, StudyState, StudyError


class OverviewInput(StrictModel):
    source_id: UUID
    title: str = Field(min_length=1, max_length=200)
    topic_title: str = Field(min_length=1, max_length=100)
    context: str = Field(min_length=1, max_length=100)
    citation_ids: list[str] = Field(min_length=1, max_length=10)
    note: StudyNote


class OverviewClaim(StrictModel):
    text: str = Field(min_length=1, max_length=2000)
    reference_ids: list[str] = Field(min_length=2, max_length=20)


class DraftTopicOverview(StrictModel):
    overview: OverviewClaim
    agreements: list[OverviewClaim] = Field(max_length=8)
    differences: list[OverviewClaim] = Field(max_length=8)


class OverviewReference(StrictModel):
    id: str = Field(min_length=38, max_length=53)
    source_id: UUID
    title: str = Field(min_length=1, max_length=200)
    passage: SourceReference


class TopicOverview(DraftTopicOverview):
    references: list[OverviewReference] = Field(min_length=2, max_length=200)
    source_ids: list[UUID] = Field(min_length=2, max_length=20)
    partial: bool

    @model_validator(mode="after")
    def grounded_claims(self):
        refs = {r.id: r for r in self.references}
        if len(refs) != len(self.references) or len(set(self.source_ids)) != len(
            self.source_ids
        ):
            raise ValueError("Duplicate overview evidence")
        if any(r.id != f"{r.source_id}:{r.passage.id}" for r in self.references):
            raise ValueError("Invalid source passage identity")
        if {r.source_id for r in self.references} != set(self.source_ids):
            raise ValueError("Source attribution does not match evidence")
        for claim in [self.overview, *self.agreements, *self.differences]:
            if (
                not set(claim.reference_ids) <= refs.keys()
                or len({refs[k].source_id for k in claim.reference_ids}) < 2
            ):
                raise ValueError(
                    "Combined claims need evidence from independent sources"
                )
        return self


class OverviewRecord(StrictModel):
    id: UUID
    topic_id: UUID
    user_id: UUID = Field(exclude=True)
    status: StudyState
    attempts: int = Field(ge=0, le=3)
    max_attempts: Literal[3]
    error_code: StudyError | None
    overview: TopicOverview | None
    updated_at: datetime

    @model_validator(mode="after")
    def completed_overview_only(self):
        if (self.status == "succeeded") != (self.overview is not None):
            raise ValueError("Only completed synthesis has an overview")
        return self


class OverviewClaimJob(StrictModel):
    id: UUID
    topic_id: UUID
    user_id: UUID
    lease_token: UUID
    source_count: int = Field(ge=2)
    inputs: list[OverviewInput] = Field(min_length=2, max_length=20)


class OverviewSnapshot(StrictModel):
    topic_id: UUID
    view_mode: Literal["combined", "separate"]
    source_ids: list[UUID] = Field(min_length=1, max_length=500)
    source_count: int = Field(ge=1)
    needs_refresh: bool
    record: OverviewRecord | None

    @model_validator(mode="after")
    def current_membership(self):
        if len(set(self.source_ids)) != len(self.source_ids) or self.source_count < len(self.source_ids):
            raise ValueError("Invalid topic membership")
        if self.record and (self.record.topic_id != self.topic_id or self.record.overview and not set(self.record.overview.source_ids) <= set(self.source_ids)):
            raise ValueError("Overview does not match current topic members")
        return self
