"""Strict quiz contracts.

Three unrelated families keep the answer key out of anything a learner can read
before an attempt is graded:

* Public*  - what the learner sees while taking a quiz (no key fields, no results);
* Graded*  - the key snapshot of a graded attempt (key fields are required);
* Generated* - the model-facing output, which carries the key and is never sent out.

No class converts one family into another by deleting fields.
"""

from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import Field, model_validator

from backend.quiz_rules import canonical_answers_hash, normalize_answer_text
from backend.schemas import StrictModel

__all__ = ["canonical_answers_hash", "normalize_answer_text"]

OptionId = Annotated[str, Field(pattern=r"^(o[1-5]|true|false)$")]
EvidenceId = Annotated[str, Field(min_length=1, max_length=16)]
ChoiceResult = Literal["correct", "partly_correct", "incorrect", "unanswered"]
ShortResult = Literal["unanswered", "addressed", "needs_review", "uncertain", "unavailable"]
Signal = Literal["positive", "negative", "neutral"]
GradingState = Literal["not_applicable", "pending", "graded", "unavailable"]
UnavailableReason = Literal["limit", "provider", "invalid_output", "setup_required", "timeout"]
Assessment = Literal["addressed", "try_again", "uncertain"]
OutcomeLabel = Literal["looks_solid", "worth_reviewing"]
QuizStatus = Literal["not_ready", "none", "generating", "ready"]
NotReadyReason = Literal["plan_not_confirmed", "evidence_changed", "not_enough_cited_material", "disabled"]
GenerateBlocked = Literal[
    "disabled", "setup", "plan_not_confirmed", "not_enough_cited_material",
    "not_active", "evidence_changed", "limit", "generating",
]


# --- public (no key) --------------------------------------------------------------


class QuizOption(StrictModel):
    id: OptionId
    text: str = Field(min_length=1, max_length=200)


class QuizOutcome(StrictModel):
    index: int = Field(ge=0, le=3)
    title: str = Field(min_length=1, max_length=500)


class PublicQuestionBase(StrictModel):
    id: UUID
    position: int = Field(ge=0, le=9)
    outcome_index: int = Field(ge=0, le=3)
    outcome_title: str = Field(min_length=1, max_length=500)
    prompt: str = Field(min_length=1, max_length=400)


class PublicSingleChoiceQuestion(PublicQuestionBase):
    kind: Literal["single_choice"]
    options: list[QuizOption] = Field(min_length=4, max_length=4)


class PublicTrueFalseQuestion(PublicQuestionBase):
    kind: Literal["true_false"]
    options: list[QuizOption] = Field(min_length=2, max_length=2)


class PublicMultiSelectQuestion(PublicQuestionBase):
    kind: Literal["multi_select"]
    options: list[QuizOption] = Field(min_length=5, max_length=5)


class PublicShortAnswerQuestion(PublicQuestionBase):
    kind: Literal["short_answer"]
    max_chars: int = Field(ge=100, le=5000)


PublicQuestion = Annotated[
    PublicSingleChoiceQuestion | PublicTrueFalseQuestion | PublicMultiSelectQuestion | PublicShortAnswerQuestion,
    Field(discriminator="kind"),
]


class PublicQuiz(StrictModel):
    id: UUID
    generated_at: datetime
    question_count: int = Field(ge=4, le=10)
    outcomes: list[QuizOutcome] = Field(min_length=1, max_length=4)
    redacted: bool
    source_version: int = Field(ge=1, le=20)
    questions: list[PublicQuestion] = Field(max_length=10)

    @model_validator(mode="after")
    def questions_match_count(self):
        # A quiz whose source text was removed keeps its shape but shows no questions.
        if self.redacted != (not self.questions) or (not self.redacted and len(self.questions) != self.question_count):
            raise ValueError("Unexpected quiz questions")
        if len({q.position for q in self.questions}) != len(self.questions):
            raise ValueError("Duplicate question position")
        return self


class QuizPlanFlags(StrictModel):
    is_active: bool
    evidence_current: bool
    source_version: int = Field(ge=1, le=20)


class QuizAttemptSummary(StrictModel):
    attempt_id: UUID
    quiz_id: UUID
    quiz_is_current: bool
    status: Literal["grading", "graded"]
    submitted_at: datetime
    correct: int | None = Field(ge=0, le=10)
    total: int = Field(ge=3, le=10)
    short_answers_total: int = Field(ge=0, le=2)
    short_answers_pending: int = Field(ge=0, le=2)


class QuizUsage(StrictModel):
    generations_used: int = Field(ge=0)
    generations_limit: int = Field(ge=1)
    resets_at: datetime


class QuizState(StrictModel):
    status: QuizStatus
    regenerating: bool
    not_ready_reason: NotReadyReason | None
    plan: QuizPlanFlags
    quiz: PublicQuiz | None
    attempts: list[QuizAttemptSummary] = Field(max_length=20)
    usage: QuizUsage
    can_generate: bool
    generate_blocked: GenerateBlocked | None
    can_take: bool


# --- requests ---------------------------------------------------------------------


class QuizGenerateRequest(StrictModel):
    request_id: UUID = Field(strict=False)
    regenerate: bool = False


class ChoiceAnswer(StrictModel):
    question_id: UUID = Field(strict=False)
    kind: Literal["single_choice", "true_false"]
    option_id: OptionId | None = None


class MultiSelectAnswer(StrictModel):
    question_id: UUID = Field(strict=False)
    kind: Literal["multi_select"]
    option_ids: list[OptionId] = Field(default_factory=list, max_length=5)


class ShortAnswerInput(StrictModel):
    question_id: UUID = Field(strict=False)
    kind: Literal["short_answer"]
    # The raw cap bounds the payload; the configured cap applies after normalisation.
    text: str = Field(default="", max_length=20_000)


QuizAnswer = Annotated[ChoiceAnswer | MultiSelectAnswer | ShortAnswerInput, Field(discriminator="kind")]


class QuizSubmitRequest(StrictModel):
    attempt_key: UUID = Field(strict=False)
    quiz_id: UUID = Field(strict=False)
    answers: list[QuizAnswer] = Field(max_length=10)


# --- graded (key released after grading) --------------------------------------------


class QuizOutcomeResult(StrictModel):
    index: int = Field(ge=0, le=3)
    title: str = Field(min_length=1, max_length=500)
    label: OutcomeLabel
    ai_contributed: bool
    correct: int = Field(ge=0)
    to_review: int = Field(ge=0)
    short_needs_review: int = Field(ge=0)
    short_blank: int = Field(ge=0)
    short_open: int = Field(ge=0)


class QuizScore(StrictModel):
    correct: int = Field(ge=0, le=10)
    total: int = Field(ge=0, le=10)


class QuizShortAnswerTotals(StrictModel):
    total: int = Field(ge=0, le=2)
    pending: int = Field(ge=0, le=2)
    unavailable: int = Field(ge=0, le=2)


class QuizGradingUsage(StrictModel):
    used: int = Field(ge=0)
    limit: int = Field(ge=1)
    resets_at: datetime


class GradedQuestionBase(StrictModel):
    question_id: UUID
    position: int = Field(ge=0, le=9)
    prompt: str = Field(min_length=1, max_length=400)
    outcome_index: int = Field(ge=0, le=3)
    explanation: str = Field(min_length=1, max_length=800)
    citation_ids: list[EvidenceId] = Field(min_length=1, max_length=3)


class GradedChoiceBase(GradedQuestionBase):
    options: list[QuizOption] = Field(min_length=2, max_length=5)
    selected_option_ids: list[OptionId] = Field(max_length=5)
    correct_option_ids: list[OptionId] = Field(min_length=1, max_length=3)
    result: ChoiceResult
    signal: Signal


class GradedSingleChoiceQuestion(GradedChoiceBase):
    kind: Literal["single_choice"]


class GradedTrueFalseQuestion(GradedChoiceBase):
    kind: Literal["true_false"]


class GradedMultiSelectQuestion(GradedChoiceBase):
    kind: Literal["multi_select"]


class GradedCriterion(StrictModel):
    index: int = Field(ge=0, le=3)
    text: str = Field(min_length=1, max_length=300)
    assessment: Assessment | None
    observation: str | None = Field(max_length=500)
    citation_ids: list[EvidenceId] = Field(max_length=3)


class GradedShortAnswerQuestion(GradedQuestionBase):
    kind: Literal["short_answer"]
    answer_text: str = Field(max_length=5000)
    result: ShortResult | None
    signal: Signal | None
    grading_state: Literal["pending", "graded", "unavailable", "not_applicable"]
    unavailable_reason: UnavailableReason | None
    criteria: list[GradedCriterion] = Field(min_length=2, max_length=4)
    feedback_summary: str | None = Field(max_length=800)
    next_hint: str | None = Field(max_length=400)
    model_answer: str = Field(min_length=1, max_length=800)
    provisional: Literal[True]


class RedactedGradedQuestion(StrictModel):
    """A question whose source text was removed: no prompt, options or key, by type."""

    kind: Literal["redacted"]
    question_id: UUID
    position: int = Field(ge=0, le=9)
    outcome_index: int = Field(ge=0, le=3)
    original_kind: Literal["single_choice", "true_false", "multi_select", "short_answer"]
    selected_option_ids: list[OptionId] = Field(default_factory=list, max_length=5)
    answer_text: str | None = Field(default=None, max_length=5000)
    result: ShortResult | ChoiceResult | None
    signal: Signal | None


GradedQuestion = Annotated[
    GradedSingleChoiceQuestion | GradedTrueFalseQuestion | GradedMultiSelectQuestion
    | GradedShortAnswerQuestion | RedactedGradedQuestion,
    Field(discriminator="kind"),
]


class QuizAttemptResult(StrictModel):
    attempt_id: UUID
    quiz_id: UUID
    plan_id: UUID
    quiz_is_current: bool
    submitted_at: datetime
    score: QuizScore
    outcomes: list[QuizOutcomeResult] = Field(max_length=4)
    review_first: list[int] = Field(max_length=3)
    short_answers: QuizShortAnswerTotals
    grading_usage: QuizGradingUsage | None
    questions: list[GradedQuestion] = Field(min_length=3, max_length=10)


# --- model-facing generation (carries the key; never serialised to a client) -------


class GeneratedOption(StrictModel):
    text: str = Field(min_length=1, max_length=100)
    is_correct: bool


class GeneratedQuestion(StrictModel):
    kind: Literal["single_choice", "true_false", "multi_select", "short_answer"]
    lesson_index: int = Field(ge=0, le=3)
    prompt: str = Field(min_length=1, max_length=200)
    options: list[GeneratedOption] = Field(max_length=5)
    explanation: str = Field(min_length=1, max_length=400)
    citation_ids: list[EvidenceId] = Field(min_length=1, max_length=3)
    criteria: list[Annotated[str, Field(min_length=1, max_length=150)]] = Field(max_length=4)
    model_answer: str | None = Field(max_length=400)


class GeneratedQuiz(StrictModel):
    questions: list[GeneratedQuestion] = Field(min_length=4, max_length=10)


class FeedbackCriterion(StrictModel):
    criterion_index: int = Field(ge=0, le=3)
    assessment: Assessment
    observation: str = Field(min_length=1, max_length=500)
    citation_ids: list[EvidenceId] = Field(max_length=3)


class QuizShortAnswerFeedback(StrictModel):
    summary: str = Field(min_length=1, max_length=800)
    next_hint: str = Field(min_length=1, max_length=400)
    criteria: list[FeedbackCriterion] = Field(min_length=2, max_length=4)


# --- errors -----------------------------------------------------------------------


class QuizErrorBody(StrictModel):
    code: str
    message: str = Field(max_length=500)
    retryable: bool
    limit: int | None = None
    used: int | None = None
    resets_at: datetime | None = None
    retry_after_seconds: int | None = None
    reason: str | None = None
    charged: bool | None = None


class QuizErrorResponse(StrictModel):
    detail: str = Field(max_length=500)
    error: QuizErrorBody
