import type {
  PublicQuestion,
  PublicQuiz,
  QuizAnswerInput,
  QuizAttemptResult,
  QuizAttemptSummary,
  QuizErrorBody,
  QuizErrorCode,
  QuizOption,
  QuizOutcomeResult,
  QuizState,
  QuizSubmitInput,
} from "./quiz.ts";
import { QUIZ_COPY, fill } from "./quiz-copy.ts";

/**
 * Pure quiz logic (spec section 12.5). No React, no zod: only types come from
 * ./quiz.ts, so this file runs under `node --experimental-strip-types`.
 */

// --- timing and caps shown to the learner ---------------------------------------

export const QUIZ_TIMEOUTS = {
  state: 15_000,
  generate: 130_000,
  submit: 20_000,
  feedback: 60_000,
};
export const POLL_INTERVAL_MS = 4000;
export const POLL_MAX = 30;
export const ATTEMPT_CAP = 20;
export const PLAN_QUIZ_CAP = 20;
const PROGRESS_MAX_AGE_MS = 24 * 60 * 60 * 1000;

// --- errors ------------------------------------------------------------------------

export type QuizClientCode = QuizErrorCode | "quiz_unknown";

export function isQuizErrorCode(code: string): code is QuizErrorCode {
  return Object.prototype.hasOwnProperty.call(QUIZ_COPY.errors, code);
}

export interface QuizApiErrorInit {
  status: number;
  code: string;
  limit?: number | null;
  used?: number | null;
  resetsAt?: string | null;
  retryAfterSeconds?: number | null;
  reason?: string | null;
  charged?: boolean | null;
  retryable?: boolean;
}

/** A typed quiz API failure. Only these fields are ever shown; never server text. */
export class QuizApiError extends Error {
  status: number;
  code: QuizClientCode;
  limit: number | null;
  used: number | null;
  resetsAt: string | null;
  retryAfterSeconds: number | null;
  reason: string | null;
  charged: boolean | null;
  retryable: boolean;

  constructor(init: QuizApiErrorInit) {
    super(
      isQuizErrorCode(init.code)
        ? QUIZ_COPY.errors[init.code]
        : QUIZ_COPY.error.generic,
    );
    this.name = "QuizApiError";
    this.status = init.status;
    this.code = isQuizErrorCode(init.code) ? init.code : "quiz_unknown";
    this.limit = init.limit ?? null;
    this.used = init.used ?? null;
    this.resetsAt = init.resetsAt ?? null;
    this.retryAfterSeconds = init.retryAfterSeconds ?? null;
    this.reason = init.reason ?? null;
    this.charged = init.charged ?? null;
    this.retryable = init.retryable ?? false;
  }
}

/**
 * Builds the error for a non-2xx quiz response. HTTP 401 always means the library
 * session expired; a body without `error` (FastAPI's own 422) is a bad request.
 */
export function quizApiErrorFrom(
  status: number,
  body: QuizErrorBody | null,
): QuizApiError {
  if (status === 401)
    return new QuizApiError({ status, code: "quiz_session_expired" });
  if (!body)
    return new QuizApiError({
      status,
      code: status === 422 ? "quiz_request_invalid" : "quiz_unknown",
    });
  const error = body.error;
  return new QuizApiError({
    status,
    code: error.code,
    limit: error.limit,
    used: error.used,
    resetsAt: error.resets_at,
    retryAfterSeconds: error.retry_after_seconds,
    reason: error.reason,
    charged: error.charged,
    retryable: error.retryable,
  });
}

export function toQuizApiError(value: unknown): QuizApiError {
  return value instanceof QuizApiError
    ? value
    : new QuizApiError({ status: 0, code: "quiz_unknown" });
}

const LIMIT_CODES: readonly string[] = [
  "quiz_generation_limit_reached",
  "quiz_grading_limit_reached",
  "quiz_attempt_limit_reached",
  "quiz_plan_cap_reached",
  "quiz_generation_attempts_capped",
  "quiz_grading_exhausted",
];
export function isLimitCode(code: string): boolean {
  return LIMIT_CODES.includes(code);
}

// --- seeded shuffle (section 11) -----------------------------------------------------

export function hashSeed(id: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleSeeded<T>(items: readonly T[], seed: number): T[] {
  const result = items.slice();
  const random = mulberry32(seed);
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const held = result[i];
    result[i] = result[j];
    result[j] = held;
  }
  return result;
}

export function optionsOf(question: PublicQuestion): QuizOption[] {
  return question.kind === "short_answer" ? [] : question.options;
}

export interface QuizStep {
  question: PublicQuestion;
  options: QuizOption[];
}

/** Stored `position` order, whatever order the learner saw while answering. */
export function inPositionOrder<T extends { position: number }>(
  items: readonly T[],
): T[] {
  return items.slice().sort((a, b) => a.position - b.position);
}

/**
 * First attempt: stored question order with shuffled options. Later attempts:
 * shuffled questions and options. True/false stays True, False.
 */
export function orderForAttempt(
  quiz: Pick<PublicQuiz, "questions">,
  attemptKey: string,
  isFirstAttempt: boolean,
): QuizStep[] {
  const stored = inPositionOrder(quiz.questions);
  const questions = isFirstAttempt
    ? stored
    : shuffleSeeded(stored, hashSeed(attemptKey));
  return questions.map((question) => {
    const options = optionsOf(question);
    if (question.kind === "true_false")
      return {
        question,
        options: options
          .slice()
          .sort((a, b) => (a.id === b.id ? 0 : a.id === "true" ? -1 : 1)),
      };
    return {
      question,
      options: shuffleSeeded(options, hashSeed(`${attemptKey}:${question.id}`)),
    };
  });
}

// --- answer state ---------------------------------------------------------------------

export interface AnswerEntry {
  optionIds: string[];
  text: string;
}
export type QuizAnswers = Record<string, AnswerEntry>;

function entryOf(answers: QuizAnswers, questionId: string): AnswerEntry {
  return answers[questionId] ?? { optionIds: [], text: "" };
}

export function selectSingle(
  answers: QuizAnswers,
  questionId: string,
  optionId: string,
): QuizAnswers {
  return { ...answers, [questionId]: { optionIds: [optionId], text: "" } };
}

export function toggleMulti(
  answers: QuizAnswers,
  questionId: string,
  optionId: string,
): QuizAnswers {
  const current = entryOf(answers, questionId).optionIds;
  const next = current.includes(optionId)
    ? current.filter((id) => id !== optionId)
    : [...current, optionId].sort();
  return { ...answers, [questionId]: { optionIds: next, text: "" } };
}

/** Clamps by Unicode code points; a textarea maxLength would cut emoji in half. */
export function clampText(
  text: string,
  max: number,
): { text: string; clamped: boolean } {
  const points = Array.from(text);
  return points.length > max
    ? { text: points.slice(0, max).join(""), clamped: true }
    : { text, clamped: false };
}

export function setText(
  answers: QuizAnswers,
  questionId: string,
  text: string,
  max: number,
): { answers: QuizAnswers; clamped: boolean } {
  const result = clampText(text, max);
  return {
    answers: { ...answers, [questionId]: { optionIds: [], text: result.text } },
    clamped: result.clamped,
  };
}

export function answerStatus(
  question: PublicQuestion,
  answer: AnswerEntry | undefined,
): "answered" | "unanswered" {
  if (!answer) return "unanswered";
  if (question.kind === "short_answer")
    return answer.text.trim() ? "answered" : "unanswered";
  return answer.optionIds.length ? "answered" : "unanswered";
}

export function answeredCount(
  questions: readonly PublicQuestion[],
  answers: QuizAnswers,
): number {
  return questions.filter(
    (question) => answerStatus(question, answers[question.id]) === "answered",
  ).length;
}

/** Every question is sent; an empty entry means unanswered. */
export function buildSubmitBody(
  attemptKey: string,
  quizId: string,
  questions: readonly PublicQuestion[],
  answers: QuizAnswers,
): QuizSubmitInput {
  const body: QuizAnswerInput[] = inPositionOrder(questions).map((question) => {
    const entry = entryOf(answers, question.id);
    if (question.kind === "short_answer")
      return {
        question_id: question.id,
        kind: question.kind,
        text: entry.text,
      };
    const valid = new Set(question.options.map((option) => option.id));
    const chosen = entry.optionIds.filter((id) => valid.has(id));
    if (question.kind === "multi_select")
      return {
        question_id: question.id,
        kind: question.kind,
        option_ids: chosen,
      };
    return chosen.length
      ? { question_id: question.id, kind: question.kind, option_id: chosen[0] }
      : { question_id: question.id, kind: question.kind };
  });
  return { attempt_key: attemptKey, quiz_id: quizId, answers: body };
}

// --- step navigation ------------------------------------------------------------------
// Steps 0..total-1 are questions; step `total` is the "Check your answers" step.

function clampStep(step: number, total: number): number {
  return Math.min(Math.max(Math.trunc(step) || 0, 0), total);
}
export const stepNext = (step: number, total: number) =>
  clampStep(step + 1, total);
export const stepBack = (step: number, total: number) =>
  clampStep(step - 1, total);
export const goToStep = (_step: number, target: number, total: number) =>
  clampStep(target, total);
export const isReviewStep = (step: number, total: number) => step >= total;

// --- display text ----------------------------------------------------------------------

export function scoreText(score: { correct: number; total: number }): string {
  return fill(QUIZ_COPY.results.score, score);
}

export function outcomeLabelText(label: QuizOutcomeResult["label"]): string {
  return label === "looks_solid"
    ? QUIZ_COPY.outcome.looksSolid
    : QUIZ_COPY.outcome.worthReviewing;
}

/** The count lines under an outcome. The AI line appears only when it contributed. */
export function outcomeCountsText(outcome: QuizOutcomeResult): string[] {
  const lines = [
    fill(QUIZ_COPY.outcome.counts, {
      correct: outcome.correct,
      toReview: outcome.to_review,
    }),
  ];
  if (outcome.short_needs_review > 0)
    lines.push(
      fill(QUIZ_COPY.outcome.shortToReview, { n: outcome.short_needs_review }),
    );
  if (outcome.short_blank > 0)
    lines.push(fill(QUIZ_COPY.outcome.shortBlank, { n: outcome.short_blank }));
  if (outcome.ai_contributed) lines.push(QUIZ_COPY.outcome.ai);
  return lines;
}

export function questionResultText(
  result: "correct" | "partly_correct" | "incorrect" | "unanswered" | null,
): string {
  if (result === "correct") return QUIZ_COPY.q.correct;
  if (result === "partly_correct") return QUIZ_COPY.q.partly;
  if (result === "incorrect") return QUIZ_COPY.q.incorrect;
  return QUIZ_COPY.q.none;
}

/** "You chose only correct options, but missed k." or null when it doesn't apply. */
export function partlyCorrectNote(
  selected: readonly string[],
  correct: readonly string[],
): string | null {
  if (!selected.length || selected.some((id) => !correct.includes(id)))
    return null;
  const missed = correct.filter((id) => !selected.includes(id)).length;
  return missed > 0 ? fill(QUIZ_COPY.q.partlyNote, { k: missed }) : null;
}

export function attemptRowText(
  attempt: QuizAttemptSummary,
  locale?: string,
  timeZone?: string,
): string {
  const date = new Date(attempt.submitted_at);
  const shown = Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString(locale, {
        timeZone,
        year: "numeric",
        month: "short",
        day: "numeric",
      });
  // An interrupted submit has no score yet; opening it finishes the checking.
  if (attempt.correct === null)
    return fill(QUIZ_COPY.attempts.checking, { date: shown });
  return fill(QUIZ_COPY.attempts.row, {
    date: shown,
    correct: attempt.correct,
    total: attempt.total,
  });
}

// --- AI feedback policy (section 6.3 G6a, Rev 3 #19) ---------------------------------

export const feedbackKey = (attemptId: string, questionId: string) =>
  `${attemptId}:${questionId}`;

export function feedbackAllowance(
  result: Pick<QuizAttemptResult, "grading_usage">,
): { remaining: number; limit: number } | null {
  const usage = result.grading_usage;
  return usage
    ? { remaining: Math.max(usage.limit - usage.used, 0), limit: usage.limit }
    : null;
}

/** Short answers still waiting for feedback, in stored position order. */
export function pendingShortAnswers(result: QuizAttemptResult): string[] {
  return inPositionOrder(result.questions)
    .filter(
      (question) =>
        question.kind === "short_answer" &&
        question.grading_state === "pending",
    )
    .map((question) => question.question_id);
}

/**
 * Which short answers to request automatically: only pending answers of the
 * attempt just submitted, never ones already requested, and none when the daily
 * allowance is known to be used up.
 */
export function feedbackRequests(
  result: QuizAttemptResult,
  justSubmitted: boolean,
  alreadyRequested: ReadonlySet<string> | readonly string[],
): string[] {
  if (!justSubmitted) return [];
  const allowance = feedbackAllowance(result);
  if (allowance && allowance.remaining <= 0) return [];
  const done: ReadonlySet<string> =
    alreadyRequested instanceof Set
      ? alreadyRequested
      : new Set(alreadyRequested);
  return pendingShortAnswers(result).filter(
    (id) => !done.has(feedbackKey(result.attempt_id, id)),
  );
}

// --- reset time and limit copy ---------------------------------------------------------

function dayKey(date: Date, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function nextDayKey(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1))
    .toISOString()
    .slice(0, 10);
}

/** "5:00 PM today", "5:00 PM tomorrow" or "Friday 5:00 PM", in the learner's zone. */
export function formatResetTime(
  iso: string | null | undefined,
  now: Date,
  timeZone?: string,
): string {
  const moment = iso ? new Date(iso) : null;
  if (!moment || Number.isNaN(moment.getTime())) return "the next UTC midnight";
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  })
    .format(moment)
    .replace(/[\u202f\u00a0]/g, " ");
  const today = dayKey(now, timeZone);
  const that = dayKey(moment, timeZone);
  if (that === today) return `${time} today`;
  if (that === nextDayKey(today)) return `${time} tomorrow`;
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
  }).format(moment);
  return `${weekday} ${time}`;
}

export interface QuizTextContext {
  now: Date;
  timeZone?: string;
  /** True when a quiz exists, so the "you can still retake it" note applies. */
  hasQuiz?: boolean;
}

/** Limit copy with the local reset time. Safe for every code; others fall through. */
export function formatLimitMessage(
  error: QuizApiError,
  context: QuizTextContext,
): string {
  if (!isQuizErrorCode(error.code)) return QUIZ_COPY.error.generic;
  const time = `${formatResetTime(error.resetsAt, context.now, context.timeZone)} ${QUIZ_COPY.limit.resetsNote}`;
  return fill(QUIZ_COPY.errors[error.code], {
    limit: error.limit ?? "your",
    time,
    n: error.code === "quiz_plan_cap_reached" ? PLAN_QUIZ_CAP : ATTEMPT_CAP,
    retakeNote: context.hasQuiz ? QUIZ_COPY.limit.retakeNote : "",
  });
}

/** Daily generation numbers for the "uses one of your generations" lines. */
export function generationUsage(server: QuizState): {
  limit: number;
  remaining: number;
} {
  return {
    limit: server.usage.generations_limit,
    remaining: generationsLeft(server),
  };
}

/** Why generating is blocked right now, or null when it isn't (or the UI already shows it). */
export function generateBlockedText(
  server: QuizState,
  context: QuizTextContext,
): string | null {
  switch (server.generate_blocked) {
    case "disabled":
      return QUIZ_COPY.notReady.disabled;
    case "setup":
      return QUIZ_COPY.generateBlocked.setup;
    case "plan_not_confirmed":
      return QUIZ_COPY.notReady.plan_not_confirmed;
    case "not_enough_cited_material":
      return QUIZ_COPY.notReady.not_enough_cited_material;
    case "evidence_changed":
      return QUIZ_COPY.notReady.evidence_changed;
    case "not_active":
      return server.quiz
        ? QUIZ_COPY.generateBlocked.notActive
        : QUIZ_COPY.noQuizOlder;
    case "limit":
      return fill(QUIZ_COPY.limit.generation, {
        limit: server.usage.generations_limit,
        time: `${formatResetTime(server.usage.resets_at, context.now, context.timeZone)} ${QUIZ_COPY.limit.resetsNote}`,
        retakeNote: server.quiz ? QUIZ_COPY.limit.retakeNote : "",
      });
    case "generating":
    case null:
      return null;
  }
}

/** What a failed generation says. "Didn't use a generation" only when it provably didn't. */
export function generationErrorText(error: QuizApiError): string {
  if (error.reason === "setup_required") return QUIZ_COPY.error.setup;
  if (error.reason === "truncated") return QUIZ_COPY.error.truncated;
  if (error.reason === "refused") return QUIZ_COPY.error.refused;
  return fill(QUIZ_COPY.error.generation, {
    chargeNote:
      error.charged === false ? QUIZ_COPY.error.free : QUIZ_COPY.error.charged,
  });
}

/** The one place a quiz error becomes learner-visible text. */
export function quizErrorText(
  error: unknown,
  context: QuizTextContext,
): string {
  const failure = toQuizApiError(error);
  if (failure.code === "quiz_unknown") return QUIZ_COPY.error.generic;
  if (failure.code === "quiz_generation_unavailable")
    return generationErrorText(failure);
  return formatLimitMessage(failure, context);
}

// --- progress persistence (section 12.6) --------------------------------------------------

export interface QuizProgress {
  v: 1;
  quizId: string;
  attemptKey: string;
  answers: QuizAnswers;
  step: number;
  savedAt: number;
}

export const progressKey = (quizId: string) =>
  `secondbrain.quiz.progress.${quizId}`;

export function serializeProgress(progress: Omit<QuizProgress, "v">): string {
  return JSON.stringify({ v: 1, ...progress });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Null for anything malformed, of another version or quiz, or older than 24 hours. */
export function parseProgress(
  raw: string | null | undefined,
  quizId: string,
  now: number,
): QuizProgress | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value) || value.v !== 1 || value.quizId !== quizId) return null;
  const { attemptKey, step, savedAt, answers } = value;
  if (typeof attemptKey !== "string" || !attemptKey || attemptKey.length > 64)
    return null;
  if (
    typeof step !== "number" ||
    !Number.isInteger(step) ||
    step < 0 ||
    step > 10
  )
    return null;
  if (
    typeof savedAt !== "number" ||
    !Number.isFinite(savedAt) ||
    now - savedAt > PROGRESS_MAX_AGE_MS ||
    savedAt - now > 60_000
  )
    return null;
  if (!isRecord(answers)) return null;
  const clean: QuizAnswers = {};
  const entries = Object.entries(answers);
  if (entries.length > 10) return null;
  for (const [questionId, entry] of entries) {
    if (!questionId || questionId.length > 64 || !isRecord(entry)) return null;
    const { optionIds, text } = entry;
    if (
      !Array.isArray(optionIds) ||
      optionIds.length > 5 ||
      optionIds.some((id) => typeof id !== "string" || id.length > 10)
    )
      return null;
    if (typeof text !== "string" || text.length > 20_000) return null;
    clean[questionId] = { optionIds: optionIds as string[], text };
  }
  return { v: 1, quizId, attemptKey, answers: clean, step, savedAt };
}

// --- state machine (section 12.3) -----------------------------------------------------------

export type QuizPhase =
  | "loading"
  | "load_error"
  | "idle"
  | "taking"
  | "reviewing"
  | "submitting"
  | "results"
  | "submit_error"
  | "evidence_changed_on_submit";

export type QuizView =
  | "loading"
  | "load_error"
  | "not_ready"
  | "none"
  | "generating"
  | "ready_first"
  | "ready_again"
  | "in_progress"
  | "review_answers"
  | "submitting"
  | "results"
  | "submit_error"
  | "evidence_changed_on_submit"
  | "limit_reached"
  | "older_version"
  | "evidence_changed"
  | "redacted";

export interface QuizUiState {
  phase: QuizPhase;
  server: QuizState | null;
  /** Our own POST "" is in flight. */
  requesting: boolean;
  error: QuizApiError | null;
  step: number;
  attemptKey: string | null;
  firstAttempt: boolean;
  answers: QuizAnswers;
  result: QuizAttemptResult | null;
  justSubmitted: boolean;
}

export const initialQuizState: QuizUiState = {
  phase: "loading",
  server: null,
  requesting: false,
  error: null,
  step: 0,
  attemptKey: null,
  firstAttempt: true,
  answers: {},
  result: null,
  justSubmitted: false,
};

export type QuizEvent =
  | { type: "load_started" }
  | { type: "loaded"; server: QuizState }
  | { type: "load_failed"; error: QuizApiError }
  | { type: "generate_started" }
  | { type: "generate_finished"; server: QuizState }
  | { type: "generate_failed"; error: QuizApiError }
  | { type: "error_dismissed" }
  | { type: "attempt_started"; attemptKey: string; firstAttempt: boolean }
  | {
      type: "progress_restored";
      attemptKey: string;
      answers: QuizAnswers;
      step: number;
      firstAttempt: boolean;
    }
  | { type: "answers_changed"; answers: QuizAnswers }
  | { type: "step_next" }
  | { type: "step_back" }
  | { type: "step_to"; step: number }
  | { type: "submit_started" }
  | { type: "submit_succeeded"; result: QuizAttemptResult }
  | { type: "submit_failed"; error: QuizApiError }
  | { type: "result_opened"; result: QuizAttemptResult }
  | { type: "result_updated"; result: QuizAttemptResult }
  | { type: "closed" };

/** The number of attempts recorded against the quiz that is current now. */
export function attemptsForCurrentQuiz(server: QuizState | null): number {
  const quiz = server?.quiz;
  return quiz
    ? server.attempts.filter((attempt) => attempt.quiz_id === quiz.id).length
    : 0;
}

export function shouldPoll(server: QuizState | null): boolean {
  return !!server && (server.status === "generating" || server.regenerating);
}

export function generationsLeft(server: QuizState): number {
  return Math.max(
    server.usage.generations_limit - server.usage.generations_used,
    0,
  );
}

function questionTotal(state: QuizUiState): number {
  return state.server?.quiz?.questions.length ?? 0;
}

function taking(state: QuizUiState, step: number): QuizUiState {
  const total = questionTotal(state);
  const next = clampStep(step, total);
  return {
    ...state,
    step: next,
    phase: isReviewStep(next, total) ? "reviewing" : "taking",
  };
}

export function quizReducer(state: QuizUiState, event: QuizEvent): QuizUiState {
  switch (event.type) {
    case "load_started":
      return state.phase === "load_error" || !state.server
        ? { ...state, phase: "loading", error: null }
        : state;
    case "loaded": {
      const settled = state.phase === "loading" || state.phase === "load_error";
      return {
        ...state,
        server: event.server,
        phase: settled ? "idle" : state.phase,
        error: settled ? null : state.error,
      };
    }
    case "load_failed": {
      const quiet = ["taking", "reviewing", "submitting", "results"].includes(
        state.phase,
      );
      return quiet
        ? state
        : { ...state, phase: "load_error", error: event.error };
    }
    case "generate_started":
      return { ...state, requesting: true, error: null };
    case "generate_finished":
      return {
        ...state,
        requesting: false,
        server: event.server,
        error: null,
        phase: state.phase === "loading" ? "idle" : state.phase,
      };
    case "generate_failed":
      return {
        ...state,
        requesting: false,
        error: event.error,
        phase: state.phase === "loading" ? "idle" : state.phase,
      };
    case "error_dismissed":
      return state.phase === "idle" ? { ...state, error: null } : state;
    case "attempt_started":
      return {
        ...state,
        phase: "taking",
        step: 0,
        attemptKey: event.attemptKey,
        firstAttempt: event.firstAttempt,
        answers: {},
        result: null,
        justSubmitted: false,
        error: null,
      };
    case "progress_restored":
      return taking(
        {
          ...state,
          attemptKey: event.attemptKey,
          firstAttempt: event.firstAttempt,
          answers: event.answers,
          result: null,
          justSubmitted: false,
          error: null,
        },
        event.step,
      );
    case "answers_changed":
      return { ...state, answers: event.answers };
    case "step_next":
      return taking(state, state.step + 1);
    case "step_back":
      return taking(state, state.step - 1);
    case "step_to":
      return taking(state, event.step);
    case "submit_started":
      return { ...state, phase: "submitting", error: null };
    case "submit_succeeded":
      return {
        ...state,
        phase: "results",
        result: event.result,
        justSubmitted: true,
        answers: {},
        attemptKey: null,
        step: 0,
        error: null,
      };
    case "submit_failed":
      return {
        ...state,
        phase:
          event.error.code === "quiz_evidence_changed"
            ? "evidence_changed_on_submit"
            : "submit_error",
        error: event.error,
      };
    case "result_opened":
      return {
        ...state,
        phase: "results",
        result: event.result,
        justSubmitted: false,
        error: null,
      };
    case "result_updated":
      return state.result && state.result.attempt_id === event.result.attempt_id
        ? { ...state, result: event.result }
        : state;
    case "closed":
      return {
        ...state,
        phase: "idle",
        result: null,
        justSubmitted: false,
        attemptKey: null,
        error: null,
      };
  }
}

/** Maps the reducer state to one named state of the section 12.3 table. */
export function quizView(state: QuizUiState): QuizView {
  switch (state.phase) {
    case "loading":
      return "loading";
    case "load_error":
      return "load_error";
    case "taking":
      return "in_progress";
    case "reviewing":
      return "review_answers";
    case "submitting":
      return "submitting";
    case "results":
      return "results";
    case "submit_error":
      return "submit_error";
    case "evidence_changed_on_submit":
      return "evidence_changed_on_submit";
    case "idle":
      break;
  }
  const server = state.server;
  if (!server) return "loading";
  if (server.status === "not_ready") return "not_ready";
  if (server.status === "generating") return "generating";
  if (server.status === "none") {
    if (state.requesting) return "generating";
    const limited =
      server.generate_blocked === "limit" ||
      (state.error !== null && isLimitCode(state.error.code));
    return limited ? "limit_reached" : "none";
  }
  const quiz = server.quiz;
  if (!quiz) return "none";
  if (quiz.redacted) return "redacted";
  if (!server.plan.evidence_current) return "evidence_changed";
  if (!server.plan.is_active) return "older_version";
  return attemptsForCurrentQuiz(server) > 0 ? "ready_again" : "ready_first";
}
