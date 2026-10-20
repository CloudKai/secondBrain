import { z } from "zod";

/**
 * Wire contracts for the path quiz (docs/planning/path-quiz-spec.md section 5).
 *
 * Three unrelated families keep the answer key out of anything shown before an
 * attempt is graded: the public question schemas (no key fields), the graded
 * question schemas (key fields required) and the redacted variant (no text at all).
 */

/** Every code in backend/tests/fixtures/quiz_error_codes.json. */
export const QUIZ_ERROR_CODES = [
  "quiz_generation_limit_reached",
  "quiz_grading_limit_reached",
  "quiz_attempt_limit_reached",
  "quiz_plan_cap_reached",
  "quiz_generation_attempts_capped",
  "quiz_grading_exhausted",
  "quiz_not_ready",
  "quiz_request_invalid",
  "quiz_answer_invalid",
  "quiz_not_found",
  "quiz_plan_not_current",
  "quiz_evidence_changed",
  "quiz_generation_in_progress",
  "quiz_attempt_in_progress",
  "quiz_grading_busy",
  "quiz_lease_lost",
  "quiz_request_changed",
  "quiz_request_exhausted",
  "quiz_attempt_conflict",
  "quiz_generation_unavailable",
  "quiz_disabled",
  "quiz_storage_unavailable",
  "quiz_session_expired",
] as const;
export const quizErrorCodeSchema = z.enum(QUIZ_ERROR_CODES);
export type QuizErrorCode = (typeof QUIZ_ERROR_CODES)[number];

// The server limits Unicode code points, not UTF-16 units.
const unicode = (min: number, max: number) =>
  z.string().refine((value) => {
    const length = Array.from(value).length;
    return length >= min && length <= max;
  }, `Expected ${min}–${max} characters.`);
const moment = z.string().datetime({ offset: true });
const optionId = z.string().regex(/^(o[1-5]|true|false)$/);
const evidenceId = z.string().min(1).max(16);
const position = z.number().int().min(0).max(9);
const outcomeIndex = z.number().int().min(0).max(3);

export const quizOptionSchema = z
  .object({ id: optionId, text: unicode(1, 200) })
  .strict();
export const quizOutcomeSchema = z
  .object({ index: outcomeIndex, title: unicode(1, 500) })
  .strict();

// --- public (no key) ---------------------------------------------------------

const publicBase = {
  id: z.string().uuid(),
  position,
  outcome_index: outcomeIndex,
  outcome_title: unicode(1, 500),
  prompt: unicode(1, 400),
};
export const publicQuestionSchema = z.discriminatedUnion("kind", [
  z
    .object({
      ...publicBase,
      kind: z.literal("single_choice"),
      options: z.array(quizOptionSchema).length(4),
    })
    .strict(),
  z
    .object({
      ...publicBase,
      kind: z.literal("true_false"),
      options: z.array(quizOptionSchema).length(2),
    })
    .strict(),
  z
    .object({
      ...publicBase,
      kind: z.literal("multi_select"),
      options: z.array(quizOptionSchema).length(5),
    })
    .strict(),
  z
    .object({
      ...publicBase,
      kind: z.literal("short_answer"),
      max_chars: z.number().int().min(100).max(5000),
    })
    .strict(),
]);

export const publicQuizSchema = z
  .object({
    id: z.string().uuid(),
    generated_at: moment,
    question_count: z.number().int().min(4).max(10),
    outcomes: z.array(quizOutcomeSchema).min(1).max(4),
    redacted: z.boolean(),
    source_version: z.number().int().min(1).max(20),
    questions: z.array(publicQuestionSchema).max(10),
  })
  .strict()
  .refine(
    (quiz) =>
      quiz.redacted === (quiz.questions.length === 0) &&
      (quiz.redacted || quiz.questions.length === quiz.question_count) &&
      new Set(quiz.questions.map((question) => question.position)).size ===
        quiz.questions.length,
    "Unexpected quiz questions",
  );

export const quizAttemptSummarySchema = z
  .object({
    attempt_id: z.string().uuid(),
    quiz_id: z.string().uuid(),
    quiz_is_current: z.boolean(),
    status: z.enum(["grading", "graded"]),
    submitted_at: moment,
    correct: z.number().int().min(0).max(10).nullable(),
    total: z.number().int().min(3).max(10),
    short_answers_total: z.number().int().min(0).max(2),
    short_answers_pending: z.number().int().min(0).max(2),
  })
  .strict();

export const quizStateSchema = z
  .object({
    status: z.enum(["not_ready", "none", "generating", "ready"]),
    regenerating: z.boolean(),
    not_ready_reason: z
      .enum([
        "plan_not_confirmed",
        "evidence_changed",
        "not_enough_cited_material",
        "disabled",
      ])
      .nullable(),
    plan: z
      .object({
        is_active: z.boolean(),
        evidence_current: z.boolean(),
        source_version: z.number().int().min(1).max(20),
      })
      .strict(),
    quiz: publicQuizSchema.nullable(),
    attempts: z.array(quizAttemptSummarySchema).max(20),
    usage: z
      .object({
        generations_used: z.number().int().min(0),
        generations_limit: z.number().int().min(1),
        resets_at: moment,
      })
      .strict(),
    can_generate: z.boolean(),
    generate_blocked: z
      .enum([
        "disabled",
        "setup",
        "plan_not_confirmed",
        "not_enough_cited_material",
        "not_active",
        "evidence_changed",
        "limit",
        "generating",
      ])
      .nullable(),
    can_take: z.boolean(),
  })
  .strict()
  .refine(
    (state) =>
      (state.status === "ready") === (state.quiz !== null) &&
      (state.status === "not_ready") === (state.not_ready_reason !== null),
    "Unexpected quiz state",
  );

// --- graded (key released after grading) --------------------------------------

const choiceResult = z.enum([
  "correct",
  "partly_correct",
  "incorrect",
  "unanswered",
]);
const shortResult = z.enum([
  "unanswered",
  "addressed",
  "needs_review",
  "uncertain",
  "unavailable",
]);
const signal = z.enum(["positive", "negative", "neutral"]);
const gradedBase = {
  question_id: z.string().uuid(),
  position,
  prompt: unicode(1, 400),
  outcome_index: outcomeIndex,
  explanation: unicode(1, 800),
  citation_ids: z.array(evidenceId).min(1).max(3),
};
const gradedChoice = {
  ...gradedBase,
  options: z.array(quizOptionSchema).min(2).max(5),
  selected_option_ids: z.array(optionId).max(5),
  correct_option_ids: z.array(optionId).min(1).max(3),
  result: choiceResult,
  signal,
};
export const gradedCriterionSchema = z
  .object({
    index: z.number().int().min(0).max(3),
    text: unicode(1, 300),
    assessment: z.enum(["addressed", "try_again", "uncertain"]).nullable(),
    observation: unicode(0, 500).nullable(),
    citation_ids: z.array(evidenceId).max(3),
  })
  .strict();
export const unavailableReasonSchema = z.enum([
  "limit",
  "provider",
  "invalid_output",
  "setup_required",
  "timeout",
]);

export const gradedQuestionSchema = z.discriminatedUnion("kind", [
  z.object({ ...gradedChoice, kind: z.literal("single_choice") }).strict(),
  z.object({ ...gradedChoice, kind: z.literal("true_false") }).strict(),
  z.object({ ...gradedChoice, kind: z.literal("multi_select") }).strict(),
  z
    .object({
      ...gradedBase,
      kind: z.literal("short_answer"),
      answer_text: unicode(0, 5000),
      result: shortResult.nullable(),
      signal: signal.nullable(),
      grading_state: z.enum([
        "pending",
        "graded",
        "unavailable",
        "not_applicable",
      ]),
      unavailable_reason: unavailableReasonSchema.nullable(),
      criteria: z.array(gradedCriterionSchema).min(2).max(4),
      feedback_summary: unicode(0, 800).nullable(),
      next_hint: unicode(0, 400).nullable(),
      model_answer: unicode(1, 800),
      provisional: z.literal(true),
    })
    .strict(),
  // A question whose source text was removed: no prompt, options or key.
  z
    .object({
      kind: z.literal("redacted"),
      question_id: z.string().uuid(),
      position,
      outcome_index: outcomeIndex,
      original_kind: z.enum([
        "single_choice",
        "true_false",
        "multi_select",
        "short_answer",
      ]),
      selected_option_ids: z.array(optionId).max(5),
      answer_text: unicode(0, 5000).nullable(),
      result: z.union([shortResult, choiceResult]).nullable(),
      signal: signal.nullable(),
    })
    .strict(),
]);

export const quizOutcomeResultSchema = z
  .object({
    index: outcomeIndex,
    title: unicode(1, 500),
    label: z.enum(["looks_solid", "worth_reviewing"]),
    ai_contributed: z.boolean(),
    correct: z.number().int().min(0),
    to_review: z.number().int().min(0),
    short_needs_review: z.number().int().min(0),
    short_blank: z.number().int().min(0),
    short_open: z.number().int().min(0),
  })
  .strict();

export const quizAttemptResultSchema = z
  .object({
    attempt_id: z.string().uuid(),
    quiz_id: z.string().uuid(),
    plan_id: z.string().uuid(),
    quiz_is_current: z.boolean(),
    submitted_at: moment,
    score: z
      .object({
        correct: z.number().int().min(0).max(10),
        total: z.number().int().min(0).max(10),
      })
      .strict(),
    outcomes: z.array(quizOutcomeResultSchema).max(4),
    review_first: z.array(outcomeIndex).max(3),
    short_answers: z
      .object({
        total: z.number().int().min(0).max(2),
        pending: z.number().int().min(0).max(2),
        unavailable: z.number().int().min(0).max(2),
      })
      .strict(),
    grading_usage: z
      .object({
        used: z.number().int().min(0),
        limit: z.number().int().min(1),
        resets_at: moment,
      })
      .strict()
      .nullable(),
    questions: z.array(gradedQuestionSchema).min(3).max(10),
  })
  .strict()
  .refine(
    (result) =>
      result.score.correct <= result.score.total &&
      new Set(result.questions.map((question) => question.question_id)).size ===
        result.questions.length,
    "Unexpected quiz result",
  );

// --- errors --------------------------------------------------------------------

/** Lenient on purpose: an unknown code or extra member still yields a readable message. */
export const quizErrorBodySchema = z.object({
  detail: z.string().max(500).optional(),
  error: z.object({
    code: z.string().min(1).max(100),
    message: z.string().max(500).optional(),
    retryable: z.boolean().optional(),
    limit: z.number().int().nonnegative().optional(),
    used: z.number().int().nonnegative().optional(),
    resets_at: z.string().max(40).optional(),
    retry_after_seconds: z.number().int().nonnegative().optional(),
    reason: z.string().max(60).optional(),
    charged: z.boolean().optional(),
  }),
});

// --- types -----------------------------------------------------------------------

export type PublicQuestion = z.infer<typeof publicQuestionSchema>;
export type PublicQuiz = z.infer<typeof publicQuizSchema>;
export type QuizAttemptSummary = z.infer<typeof quizAttemptSummarySchema>;
export type QuizState = z.infer<typeof quizStateSchema>;
export type GradedQuestion = z.infer<typeof gradedQuestionSchema>;
export type QuizOutcomeResult = z.infer<typeof quizOutcomeResultSchema>;
export type QuizAttemptResult = z.infer<typeof quizAttemptResultSchema>;
export type QuizErrorBody = z.infer<typeof quizErrorBodySchema>;
export type QuizOption = z.infer<typeof quizOptionSchema>;

export interface QuizGenerateInput {
  request_id: string;
  regenerate: boolean;
}
export type QuizAnswerInput =
  | {
      question_id: string;
      kind: "single_choice" | "true_false";
      option_id?: string;
    }
  | { question_id: string; kind: "multi_select"; option_ids: string[] }
  | { question_id: string; kind: "short_answer"; text: string };
export interface QuizSubmitInput {
  attempt_key: string;
  quiz_id: string;
  answers: QuizAnswerInput[];
}
