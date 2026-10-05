"""Bounded questions and saved passage attribution for the study assistant."""
from datetime import datetime
from typing import Literal
from uuid import UUID
from pydantic import Field, model_validator
from backend.schemas import StrictModel
from backend.study_models import StudyNote, SourceReference
from backend.source_models import PDFDocument
from backend.transcript_models import TranscriptDocument
from backend.capture_limits import MAX_CAPTURE_CHARS


class AssistantTurn(StrictModel):
    role: Literal["user", "assistant"]
    text: str = Field(min_length=1, max_length=2000)


class AssistantQuestion(StrictModel):
    question: str = Field(min_length=1, max_length=2000)
    source_version: int = Field(ge=1, le=20)
    topic_id: UUID | None = Field(default=None, strict=False)
    library: bool = False
    history: list[AssistantTurn] = Field(default_factory=list, max_length=4)

    @model_validator(mode='after')
    def nonblank(self):
        if not self.question.strip():
            raise ValueError('Enter a question')
        return self


class AssistantInput(StrictModel):
    source_id: UUID
    user_id: UUID
    title: str = Field(min_length=1, max_length=200)
    source_version: int = Field(ge=1, le=20)
    captured_text: str = Field(min_length=120, max_length=MAX_CAPTURE_CHARS)
    document: PDFDocument | None
    transcript: TranscriptDocument | None
    note: StudyNote
    study_updated_at: datetime
    map_updated_at: datetime | None
    scope: Literal['note', 'topic', 'library']


class AssistantClaim(StrictModel):
    text: str = Field(min_length=1, max_length=2000)
    reference_ids: list[str] = Field(min_length=1, max_length=10)


class DraftAssistantAnswer(StrictModel):
    status: Literal['supported', 'unsupported']
    claims: list[AssistantClaim] = Field(max_length=8)
    gap: str | None = Field(max_length=1000)

    @model_validator(mode='after')
    def evidence_or_gap(self):
        if self.status == 'supported' and (not self.claims or self.gap is not None):
            raise ValueError('A supported answer needs claims only')
        if self.status == 'unsupported' and (self.claims or not self.gap or not self.gap.strip()):
            raise ValueError('An unsupported answer needs an evidence gap only')
        return self


class AssistantReference(StrictModel):
    id: str = Field(min_length=38, max_length=53)
    source_id: UUID
    source_version: int = Field(ge=1, le=20)
    title: str = Field(min_length=1, max_length=200)
    passage: SourceReference


class AssistantAnswer(DraftAssistantAnswer):
    references: list[AssistantReference] = Field(max_length=80)
    partial: bool
    source_ids: list[UUID] = Field(min_length=1, max_length=9)

    @model_validator(mode='after')
    def attribution(self):
        refs = {r.id for r in self.references}
        used = {r for c in self.claims for r in c.reference_ids}
        if len(refs) != len(self.references) or refs != used:
            raise ValueError('Invalid answer references')
        if len(set(self.source_ids)) != len(self.source_ids) or any(r.source_id not in self.source_ids or r.id != f'{r.source_id}:{r.passage.id}' for r in self.references):
            raise ValueError('Invalid source attribution')
        return self
