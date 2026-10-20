import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  QUIZ_ERROR_CODES,
  gradedQuestionSchema,
  publicQuestionSchema,
  quizAttemptResultSchema,
  quizErrorBodySchema,
  quizStateSchema,
} from "./quiz";

const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const options = (ids: string[]) =>
  ids.map((value) => ({ id: value, text: `Option ${value}` }));
function without(value: object, key: string): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...value };
  delete copy[key];
  return copy;
}
const when = "2026-10-21T09:14:03Z";

const single = {
  kind: "single_choice",
  id: id(1),
  position: 0,
  outcome_index: 0,
  outcome_title: "A",
  prompt: "Which?",
  options: options(["o1", "o2", "o3", "o4"]),
};
const trueFalse = {
  kind: "true_false",
  id: id(2),
  position: 1,
  outcome_index: 0,
  outcome_title: "A",
  prompt: "True?",
  options: [
    { id: "true", text: "True" },
    { id: "false", text: "False" },
  ],
};
const multi = {
  kind: "multi_select",
  id: id(3),
  position: 2,
  outcome_index: 1,
  outcome_title: "B",
  prompt: "All?",
  options: options(["o1", "o2", "o3", "o4", "o5"]),
};
const short = {
  kind: "short_answer",
  id: id(4),
  position: 3,
  outcome_index: 1,
  outcome_title: "B",
  prompt: "Explain.",
  max_chars: 1500,
};

const state = {
  status: "ready",
  regenerating: false,
  not_ready_reason: null,
  plan: { is_active: true, evidence_current: true, source_version: 1 },
  quiz: {
    id: id(100),
    generated_at: when,
    question_count: 4,
    outcomes: [
      { index: 0, title: "A" },
      { index: 1, title: "B" },
    ],
    redacted: false,
    source_version: 1,
    questions: [single, trueFalse, multi, short],
  },
  attempts: [
    {
      attempt_id: id(9),
      quiz_id: id(100),
      quiz_is_current: true,
      status: "graded",
      submitted_at: when,
      correct: 2,
      total: 3,
      short_answers_total: 1,
      short_answers_pending: 0,
    },
  ],
  usage: {
    generations_used: 1,
    generations_limit: 3,
    resets_at: "2026-10-22T00:00:00Z",
  },
  can_generate: true,
  generate_blocked: null,
  can_take: true,
};

const gradedChoice = {
  kind: "single_choice",
  question_id: id(1),
  position: 0,
  prompt: "Which?",
  outcome_index: 0,
  explanation: "Because the passage says so.",
  citation_ids: ["p0001"],
  options: options(["o1", "o2", "o3", "o4"]),
  selected_option_ids: ["o1"],
  correct_option_ids: ["o1"],
  result: "correct",
  signal: "positive",
};
const gradedShort = {
  kind: "short_answer",
  question_id: id(4),
  position: 3,
  prompt: "Explain.",
  outcome_index: 1,
  explanation: "Because.",
  citation_ids: ["p0002"],
  answer_text: "my words",
  result: null,
  signal: "neutral",
  grading_state: "pending",
  unavailable_reason: null,
  criteria: [
    {
      index: 0,
      text: "Mentions a",
      assessment: null,
      observation: null,
      citation_ids: [],
    },
    {
      index: 1,
      text: "Mentions b",
      assessment: null,
      observation: null,
      citation_ids: [],
    },
  ],
  feedback_summary: null,
  next_hint: null,
  model_answer: "A and b.",
  provisional: true,
};
const redacted = {
  kind: "redacted",
  question_id: id(3),
  position: 2,
  outcome_index: 1,
  original_kind: "multi_select",
  selected_option_ids: ["o2"],
  answer_text: null,
  result: "incorrect",
  signal: "negative",
};
const attempt = {
  attempt_id: id(9),
  quiz_id: id(100),
  plan_id: id(300),
  quiz_is_current: true,
  submitted_at: when,
  score: { correct: 1, total: 2 },
  outcomes: [
    {
      index: 0,
      title: "A",
      label: "worth_reviewing",
      ai_contributed: false,
      correct: 1,
      to_review: 0,
      short_needs_review: 0,
      short_blank: 0,
      short_open: 1,
    },
  ],
  review_first: [0],
  short_answers: { total: 1, pending: 1, unavailable: 0 },
  grading_usage: { used: 0, limit: 20, resets_at: "2026-10-22T00:00:00Z" },
  questions: [gradedChoice, redacted, gradedShort],
};

test("the state example parses; unknown keys are rejected", () => {
  assert.equal(quizStateSchema.parse(state).quiz?.questions.length, 4);
  assert.throws(() => quizStateSchema.parse({ ...state, extra: 1 }));
  assert.throws(() =>
    quizStateSchema.parse({ ...state, usage: { ...state.usage, extra: 1 } }),
  );
  assert.ok(
    quizStateSchema.parse({ ...state, regenerating: true }).regenerating,
  );
});

test("not-ready, none and generating states have no quiz", () => {
  const empty = { ...state, quiz: null, attempts: [], can_take: false };
  assert.ok(quizStateSchema.parse({ ...empty, status: "none" }));
  assert.ok(
    quizStateSchema.parse({
      ...empty,
      status: "generating",
      generate_blocked: "generating",
      can_generate: false,
    }),
  );
  assert.ok(
    quizStateSchema.parse({
      ...empty,
      status: "not_ready",
      not_ready_reason: "disabled",
      generate_blocked: "disabled",
      can_generate: false,
    }),
  );
  assert.throws(
    () => quizStateSchema.parse({ ...empty, status: "ready" }),
    "ready needs a quiz",
  );
  assert.throws(() =>
    quizStateSchema.parse({
      ...empty,
      status: "none",
      not_ready_reason: "disabled",
    }),
  );
  assert.throws(() => quizStateSchema.parse({ ...empty, status: "bogus" }));
});

test("a redacted quiz keeps its shape but shows no questions", () => {
  const quiz = { ...state.quiz, redacted: true, questions: [] };
  assert.ok(quizStateSchema.parse({ ...state, quiz, can_take: false }));
  assert.throws(() =>
    quizStateSchema.parse({ ...state, quiz: { ...quiz, redacted: false } }),
  );
  assert.throws(() =>
    quizStateSchema.parse({
      ...state,
      quiz: { ...state.quiz, redacted: true },
    }),
  );
});

test("the public question schema is strict and carries no key fields", () => {
  for (const question of [single, trueFalse, multi, short])
    assert.ok(publicQuestionSchema.parse(question));
  for (const leak of [
    { correct_option_ids: ["o1"] },
    { explanation: "x" },
    { citation_ids: ["p0001"] },
    { criteria: ["x"] },
    { model_answer: "x" },
    { is_correct: true },
    { result: "correct" },
    { signal: "positive" },
    { reveal: {} },
  ]) {
    assert.throws(
      () => publicQuestionSchema.parse({ ...single, ...leak }),
      JSON.stringify(leak),
    );
    assert.throws(() => publicQuestionSchema.parse({ ...short, ...leak }));
  }
  assert.throws(() =>
    publicQuestionSchema.parse({
      ...single,
      options: [
        { id: "o1", text: "x", is_correct: true },
        ...single.options.slice(1),
      ],
    }),
  );
  assert.throws(
    () =>
      publicQuestionSchema.parse({
        ...single,
        options: single.options.slice(0, 3),
      }),
    "four options",
  );
  assert.throws(
    () => publicQuestionSchema.parse({ ...short, options: [] }),
    "short answers have no options",
  );
  assert.throws(() => publicQuestionSchema.parse({ ...single, kind: "essay" }));
});

test("graded questions require the key; the redacted variant forbids it", () => {
  assert.ok(gradedQuestionSchema.parse(gradedChoice));
  assert.ok(gradedQuestionSchema.parse(gradedShort));
  assert.ok(gradedQuestionSchema.parse(redacted));
  for (const key of ["correct_option_ids", "explanation", "citation_ids"])
    assert.throws(
      () => gradedQuestionSchema.parse(without(gradedChoice, key)),
      key,
    );
  for (const field of [
    { prompt: "Which?" },
    { options: options(["o1", "o2"]) },
    { correct_option_ids: ["o1"] },
    { explanation: "x" },
    { citation_ids: ["p0001"] },
    { model_answer: "x" },
    { criteria: [] },
  ])
    assert.throws(
      () => gradedQuestionSchema.parse({ ...redacted, ...field }),
      JSON.stringify(field),
    );
});

test("an attempt result parses with graded, short and redacted questions", () => {
  assert.equal(quizAttemptResultSchema.parse(attempt).questions.length, 3);
  assert.throws(() =>
    quizAttemptResultSchema.parse({ ...attempt, extra: true }),
  );
  assert.throws(() =>
    quizAttemptResultSchema.parse({
      ...attempt,
      score: { correct: 3, total: 2 },
    }),
  );
  assert.throws(
    () =>
      quizAttemptResultSchema.parse({
        ...attempt,
        questions: [gradedChoice, gradedChoice, gradedShort],
      }),
    "duplicate question ids",
  );
  assert.ok(quizAttemptResultSchema.parse({ ...attempt, grading_usage: null }));
  assert.throws(() =>
    quizAttemptResultSchema.parse({
      ...attempt,
      outcomes: [{ ...attempt.outcomes[0], short_to_review: 0 }],
    }),
  );
  const blank = {
    ...gradedShort,
    answer_text: "",
    result: "unanswered",
    signal: "negative",
    grading_state: "not_applicable",
  };
  assert.ok(
    quizAttemptResultSchema.parse({
      ...attempt,
      questions: [gradedChoice, redacted, blank],
    }),
  );
});

test("the error body parser is lenient about unknown codes but needs an error member", () => {
  assert.ok(
    quizErrorBodySchema.parse({
      detail: "x",
      error: {
        code: "quiz_generation_limit_reached",
        message: "m",
        retryable: false,
        limit: 3,
        used: 3,
        resets_at: "2026-10-22T00:00:00Z",
      },
    }),
  );
  assert.ok(quizErrorBodySchema.parse({ error: { code: "something_new" } }));
  assert.equal(
    quizErrorBodySchema.safeParse({ detail: [{ msg: "bad" }] }).success,
    false,
  );
  assert.equal(
    quizErrorBodySchema.safeParse({ detail: "only" }).success,
    false,
  );
});

test("the error-code enum equals the shared fixture", () => {
  const fixture: { code: string }[] = JSON.parse(
    readFileSync(
      new URL(
        "../../../backend/tests/fixtures/quiz_error_codes.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  assert.deepEqual(
    [...QUIZ_ERROR_CODES].sort(),
    fixture.map((row) => row.code).sort(),
  );
});
