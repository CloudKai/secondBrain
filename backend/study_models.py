"""Structured browser notes and their persisted processing contract."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field, model_validator

from backend.schemas import StrictModel
from backend.source_models import PDFDocument
from backend.transcript_models import TranscriptDocument

StudyState = Literal["queued", "processing", "succeeded", "failed"]
StudyError = Literal[
    "provider_unavailable",
    "invalid_output",
    "timeout",
    "setup_required",
    "worker_interrupted",
]


class Explanation(StrictModel):
    text: str = Field(min_length=1, max_length=2_000)
    citation_ids: list[str] = Field(min_length=1, max_length=10)


class StudyConcept(Explanation):
    title: str = Field(min_length=1, max_length=160)


class StudyEquation(Explanation):
    expression: str = Field(min_length=1, max_length=500)


class StudyRecall(StrictModel):
    question: str = Field(min_length=1, max_length=500)
    answer: str = Field(min_length=1, max_length=2_000)
    citation_ids: list[str] = Field(min_length=1, max_length=10)


class DraftStudyNote(StrictModel):
    overview: Explanation
    concepts: list[StudyConcept] = Field(min_length=1, max_length=10)
    examples: list[StudyConcept] = Field(max_length=6)
    equations: list[StudyEquation] = Field(max_length=6)
    recall: list[StudyRecall] = Field(min_length=1, max_length=10)


class SourceReference(StrictModel):
    id: str = Field(min_length=1, max_length=16)
    start: int = Field(ge=0)
    end: int = Field(gt=0)
    excerpt: str = Field(min_length=1, max_length=1_000)
    page: int | None = Field(default=None, ge=1, le=100)
    start_ms: int | None = Field(default=None, ge=0, le=604_800_000)
    end_ms: int | None = Field(default=None, gt=0, le=604_800_000)

    @model_validator(mode="after")
    def consistent_location(self):
        if (self.start_ms is None) != (self.end_ms is None) or (
            self.start_ms is not None
            and (self.end_ms <= self.start_ms or self.page is not None)
        ):
            raise ValueError("Invalid source time range")
        return self


class StudyNote(DraftStudyNote):
    references: list[SourceReference] = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def references_resolve(self):
        ids = {reference.id for reference in self.references}
        if len(ids) != len(self.references) or any(
            r.end <= r.start for r in self.references
        ):
            raise ValueError("Invalid source references")
        claims = [
            self.overview,
            *self.concepts,
            *self.examples,
            *self.equations,
            *self.recall,
        ]
        if any(not set(claim.citation_ids) <= ids for claim in claims):
            raise ValueError("Unknown source reference")
        return self


class StudyRecord(StrictModel):
    source_version: int = Field(default=1, ge=1, le=20)
    source_id: UUID
    user_id: UUID = Field(exclude=True)
    status: StudyState
    attempts: int = Field(ge=0, le=3)
    max_attempts: Literal[3]
    next_attempt_at: datetime
    error_code: StudyError | None
    note: StudyNote | None
    updated_at: datetime

    @model_validator(mode="after")
    def completed_note_only(self):
        if (self.status == "succeeded") != (self.note is not None):
            raise ValueError("Only succeeded studies contain notes")
        return self


class StudyPage(StrictModel):
    studies: list[StudyRecord]
    next_offset: int | None


class StudyRequest(StrictModel):
    retry: bool = False


class WorkerClaim(StrictModel):
    source_id: UUID
    user_id: UUID
    captured_text: str = Field(min_length=120, max_length=30_000)
    lease_token: UUID
    attempt: int = Field(ge=1, le=3)
    document: PDFDocument | None = None
    transcript: TranscriptDocument | None = None

    @model_validator(mode="after")
    def location_metadata(self):
        if self.document and self.transcript:
            raise ValueError("A source cannot be a PDF and video")
        if self.transcript and self.transcript.segments[-1].end != len(
            self.captured_text
        ):
            raise ValueError("Transcript locations must cover captured text")
        return self


class StudyDispatch(StrictModel):
    source_id: UUID
