"""Versioned teaching contracts; practice activity never implies mastery."""

from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import Field, field_validator, model_validator

from backend.schemas import StrictModel
from backend.study_models import Explanation, SourceReference
from backend.study_models import StudyNote
from backend.source_models import CapturedSource

Difficulty = Literal["foundation", "intermediate", "advanced"]
LearningText = Annotated[str, Field(min_length=1, max_length=500)]


class TeachingExample(StrictModel):
    text: str = Field(min_length=1, max_length=2000)
    provenance: Literal["source_backed", "generated_example"]
    citation_ids: list[str] = Field(max_length=10)

    @model_validator(mode="after")
    def attribution(self):
        if (self.provenance == "source_backed") != bool(self.citation_ids):
            raise ValueError("Generated examples cannot borrow source citations")
        return self


class UnderstandingCheck(StrictModel):
    kind: Literal["explain", "apply", "quick_question"]
    question: str = Field(min_length=1, max_length=1000)
    criteria: list[LearningText] = Field(min_length=1, max_length=5)
    hint: str = Field(min_length=1, max_length=1000)
    worked_answer: Explanation


class LearningLesson(StrictModel):
    title: str = Field(min_length=1, max_length=160)
    outcome: str = Field(min_length=1, max_length=500)
    explanation: Explanation
    example: TeachingExample | None
    check: UnderstandingCheck


class BackgroundLesson(StrictModel):
    title: str = Field(min_length=1, max_length=160)
    purpose: str = Field(min_length=1, max_length=500)
    text: str = Field(min_length=1, max_length=2000)


class PathDraft(StrictModel):
    title: str = Field(min_length=1, max_length=160)
    outcomes: list[LearningText] = Field(min_length=1, max_length=5)
    prerequisites: list[LearningText] = Field(max_length=5)
    coverage: str = Field(min_length=1, max_length=1000)
    gaps: list[LearningText] = Field(max_length=5)
    background: list[BackgroundLesson] = Field(max_length=3)
    lessons: list[LearningLesson] = Field(min_length=1, max_length=4)


class LearningDraft(StrictModel):
    suggested_goal: str = Field(min_length=1, max_length=500)
    paths: list[PathDraft] = Field(min_length=1, max_length=3)


class PreviewRequest(StrictModel):
    request_id: UUID = Field(strict=False)
    source_version: int = Field(ge=1, le=20)
    goal: str = Field(default="", max_length=500)
    difficulty: Difficulty = "foundation"
    path_id: UUID | None = Field(default=None, strict=False)


class PreviewContext(StrictModel):
    user_id: UUID
    request_id: UUID
    source: CapturedSource
    note: StudyNote
    lease_token: UUID | None
    path_direction: PathDraft | None = None


class CriterionFeedback(StrictModel):
    criterion_index: int = Field(ge=0, le=4)
    observation: str = Field(min_length=1, max_length=1000)
    assessment: Literal["addressed", "try_again", "uncertain"]
    citation_ids: list[str] = Field(min_length=1, max_length=10)


class PracticeFeedback(StrictModel):
    summary: str = Field(min_length=1, max_length=2000)
    criteria: list[CriterionFeedback] = Field(min_length=1, max_length=5)
    next_hint: str = Field(min_length=1, max_length=1000)


class LearningPlan(StrictModel):
    id: UUID
    path_id: UUID
    request_id: UUID
    source_id: UUID | None
    source_title: str
    source_version: int = Field(ge=1, le=20)
    goal: str = Field(min_length=1, max_length=500)
    difficulty: Difficulty
    content: PathDraft
    references: list[SourceReference] = Field(max_length=100)
    confirmed_at: datetime | None
    active: bool
    needs_review: bool
    model: Literal["gpt-6-luna", "gpt-6.1-sol"]
    policy_version: Literal["learning_v1"]
    created_at: datetime

    @model_validator(mode="after")
    def references_resolve(self):
        historical = self.source_id is None and self.needs_review and not self.references
        if not self.references and not historical:
            raise ValueError("Current teaching requires evidence")
        ids = {reference.id for reference in self.references}
        if len(ids) != len(self.references):
            raise ValueError("Duplicate learning references")
        for lesson in self.content.lessons:
            claims = [lesson.explanation, lesson.check.worked_answer]
            if lesson.example is not None:
                claims.append(lesson.example)
            if not historical and any(not set(claim.citation_ids) <= ids for claim in claims):
                raise ValueError("Unknown learning reference")
        if self.active and self.confirmed_at is None:
            raise ValueError("Preview cannot be active")
        return self


class PracticeAttempt(StrictModel):
    id: UUID
    plan_id: UUID
    lesson_index: int = Field(ge=0, le=3)
    response: str = Field(min_length=1, max_length=5000)
    difficulty: Difficulty
    status: Literal["pending", "needs_review", "failed"]
    feedback: PracticeFeedback | None
    created_at: datetime

    @model_validator(mode="after")
    def inconclusive_assessment(self):
        if (self.status == "needs_review") != (self.feedback is not None):
            raise ValueError("Only reviewed attempts contain provisional feedback")
        return self


class FeedbackContext(StrictModel):
    user_id: UUID
    source_id: UUID
    attempt_id: UUID
    plan_id: UUID
    lesson_index: int = Field(ge=0, le=3)
    response: str = Field(min_length=1, max_length=5000)
    lease_token: UUID | None


class LearningActivity(StrictModel):
    plan_id: UUID
    lesson_index: int = Field(ge=0, le=3)
    kind: Literal["read", "hint", "reveal", "background_opened"]


class LearningSnapshot(StrictModel):
    source_id: UUID
    user_id: UUID = Field(exclude=True)
    plans: list[LearningPlan] = Field(max_length=60)
    attempts: list[PracticeAttempt] = Field(max_length=1000)
    activities: list[LearningActivity] = Field(max_length=1000)


class LearningHistoryItem(StrictModel):
    source_id: UUID
    title: str = Field(min_length=1, max_length=200)
    source_available: bool


class LearningHistory(StrictModel):
    user_id: UUID = Field(exclude=True)
    collections: list[LearningHistoryItem] = Field(max_length=50)
    next_offset: int | None = Field(ge=0)


class AttemptRequest(StrictModel):
    request_id: UUID = Field(strict=False)
    lesson_index: int = Field(ge=0, le=3)
    response: str = Field(min_length=1, max_length=5000)

    @field_validator("response")
    @classmethod
    def nonblank(cls, value):
        if not value.strip():
            raise ValueError("Write an answer before submitting")
        return value


class ActivityRequest(StrictModel):
    lesson_index: int = Field(ge=0, le=3)
    kind: Literal["read", "hint", "reveal", "background_opened"]


class TutorMessage(StrictModel):
    role: Literal["user", "assistant"]
    text: str = Field(min_length=1, max_length=1000)


class TutorQuestion(StrictModel):
    lesson_index: int = Field(ge=0, le=3)
    question: str = Field(min_length=1, max_length=2000)
    history: list[TutorMessage] = Field(default_factory=list, max_length=4)


class TutorReply(StrictModel):
    text: str = Field(min_length=1, max_length=2000)
    citation_ids: list[str] = Field(max_length=10)
    gap: str | None = Field(max_length=500)

    @model_validator(mode="after")
    def support_or_gap(self):
        if not self.citation_ids and not self.gap:
            raise ValueError("A tutor reply needs evidence or an explicit gap")
        return self
