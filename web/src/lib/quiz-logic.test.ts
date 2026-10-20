import assert from "node:assert/strict";
import test from "node:test";
import {
  QuizApiError,
  answerStatus,
  answeredCount,
  attemptRowText,
  buildSubmitBody,
  clampText,
  feedbackKey,
  feedbackRequests,
  formatLimitMessage,
  generateBlockedText,
  generationUsage,
  formatResetTime,
  goToStep,
  hashSeed,
  inPositionOrder,
  initialQuizState,
  mulberry32,
  orderForAttempt,
  outcomeCountsText,
  outcomeLabelText,
  parseProgress,
  partlyCorrectNote,
  progressKey,
  quizApiErrorFrom,
  quizErrorText,
  quizReducer,
  quizView,
  scoreText,
  selectSingle,
  serializeProgress,
  setText,
  shouldPoll,
  shuffleSeeded,
  stepBack,
  stepNext,
  toggleMulti,
} from "./quiz-logic.ts";
import type { QuizEvent, QuizUiState } from "./quiz-logic.ts";
import type {
  PublicQuestion,
  QuizAttemptResult,
  QuizOutcomeResult,
  QuizState,
} from "./quiz.ts";

const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const opt = (ids: string[]) =>
  ids.map((value) => ({ id: value, text: `Option ${value}` }));

const questions: PublicQuestion[] = [
  {
    kind: "single_choice",
    id: id(1),
    position: 0,
    outcome_index: 0,
    outcome_title: "A",
    prompt: "One?",
    options: opt(["o1", "o2", "o3", "o4"]),
  },
  {
    kind: "true_false",
    id: id(2),
    position: 1,
    outcome_index: 0,
    outcome_title: "A",
    prompt: "Two?",
    options: [
      { id: "true", text: "True" },
      { id: "false", text: "False" },
    ],
  },
  {
    kind: "multi_select",
    id: id(3),
    position: 2,
    outcome_index: 1,
    outcome_title: "B",
    prompt: "Three?",
    options: opt(["o1", "o2", "o3", "o4", "o5"]),
  },
  {
    kind: "short_answer",
    id: id(4),
    position: 3,
    outcome_index: 1,
    outcome_title: "B",
    prompt: "Four?",
    max_chars: 100,
  },
];

function server(over: Partial<QuizState> = {}): QuizState {
  return {
    status: "ready",
    regenerating: false,
    not_ready_reason: null,
    plan: { is_active: true, evidence_current: true, source_version: 1 },
    quiz: {
      id: id(100),
      generated_at: "2026-10-21T09:00:00Z",
      question_count: 4,
      outcomes: [
        { index: 0, title: "A" },
        { index: 1, title: "B" },
      ],
      redacted: false,
      source_version: 1,
      questions,
    },
    attempts: [],
    usage: {
      generations_used: 1,
      generations_limit: 3,
      resets_at: "2026-10-22T00:00:00Z",
    },
    can_generate: true,
    generate_blocked: null,
    can_take: true,
    ...over,
  };
}

function result(
  over: Partial<QuizAttemptResult> = {},
  shortState = "pending",
): QuizAttemptResult {
  return {
    attempt_id: id(200),
    quiz_id: id(100),
    plan_id: id(300),
    quiz_is_current: true,
    submitted_at: "2026-10-21T09:20:00Z",
    score: { correct: 1, total: 3 },
    outcomes: [],
    review_first: [],
    short_answers: { total: 1, pending: 1, unavailable: 0 },
    grading_usage: { used: 0, limit: 20, resets_at: "2026-10-22T00:00:00Z" },
    questions: [
      {
        kind: "short_answer",
        question_id: id(4),
        position: 3,
        prompt: "Four?",
        outcome_index: 1,
        explanation: "Because.",
        citation_ids: ["p0001"],
        answer_text: "x",
        result: null,
        signal: "neutral",
        grading_state: shortState as "pending",
        unavailable_reason: null,
        criteria: [
          {
            index: 0,
            text: "a",
            assessment: null,
            observation: null,
            citation_ids: [],
          },
          {
            index: 1,
            text: "b",
            assessment: null,
            observation: null,
            citation_ids: [],
          },
        ],
        feedback_summary: null,
        next_hint: null,
        model_answer: "m",
        provisional: true,
      },
      {
        kind: "single_choice",
        question_id: id(1),
        position: 0,
        prompt: "One?",
        outcome_index: 0,
        explanation: "Because.",
        citation_ids: ["p0001"],
        options: opt(["o1", "o2", "o3", "o4"]),
        selected_option_ids: ["o1"],
        correct_option_ids: ["o1"],
        result: "correct",
        signal: "positive",
      },
      {
        kind: "true_false",
        question_id: id(2),
        position: 1,
        prompt: "Two?",
        outcome_index: 0,
        explanation: "Because.",
        citation_ids: ["p0001"],
        options: [
          { id: "true", text: "True" },
          { id: "false", text: "False" },
        ],
        selected_option_ids: [],
        correct_option_ids: ["true"],
        result: "unanswered",
        signal: "negative",
      },
    ],
    ...over,
  };
}

// --- seeded shuffle -------------------------------------------------------------------

test("the shuffle is deterministic, a permutation, and safe for tiny inputs", () => {
  const items = [1, 2, 3, 4, 5, 6, 7, 8];
  const a = shuffleSeeded(items, 42);
  assert.deepEqual(a, shuffleSeeded(items, 42));
  assert.deepEqual([...a].sort(), items);
  assert.notDeepEqual(shuffleSeeded(items, 1), shuffleSeeded(items, 2));
  assert.deepEqual(items, [1, 2, 3, 4, 5, 6, 7, 8], "input is not mutated");
  assert.deepEqual(shuffleSeeded([], 7), []);
  assert.deepEqual(shuffleSeeded(["x"], 7), ["x"]);
  const random = mulberry32(5);
  for (let i = 0; i < 50; i++) {
    const value = random();
    assert.ok(value >= 0 && value < 1);
  }
  assert.equal(hashSeed("abc"), hashSeed("abc"));
  assert.notEqual(hashSeed("abc"), hashSeed("abd"));
});

test("a first attempt keeps question order and a retake shuffles both", () => {
  const quiz = { questions: [...questions].reverse() };
  const first = orderForAttempt(quiz, "key-one", true);
  assert.deepEqual(
    first.map((s) => s.question.id),
    questions.map((q) => q.id),
  );
  const optionsFirst = first[0].options.map((o) => o.id);
  assert.deepEqual([...optionsFirst].sort(), ["o1", "o2", "o3", "o4"]);
  assert.deepEqual(
    first,
    orderForAttempt(quiz, "key-one", true),
    "same key, same order",
  );
  const orders = new Set<string>();
  for (let n = 0; n < 12; n++)
    orders.add(
      orderForAttempt(quiz, `retake-${n}`, false)
        .map((s) => s.question.id)
        .join(),
    );
  assert.ok(orders.size > 1, "retakes shuffle the question order");
  for (const step of orderForAttempt(quiz, "retake-3", false)) {
    if (step.question.kind === "true_false")
      assert.deepEqual(
        step.options.map((o) => o.id),
        ["true", "false"],
      );
    if (step.question.kind === "short_answer")
      assert.deepEqual(step.options, []);
  }
});

test("results are always listed in stored position order", () => {
  const shuffled = orderForAttempt({ questions }, "any", false).map(
    (s) => s.question,
  );
  assert.deepEqual(
    inPositionOrder(shuffled).map((q) => q.position),
    [0, 1, 2, 3],
  );
  assert.deepEqual(
    inPositionOrder(result().questions).map((q) => q.position),
    [0, 1, 3],
  );
});

// --- answers ----------------------------------------------------------------------------

test("single choice replaces, multi select toggles, text clamps by code points", () => {
  let answers = selectSingle({}, id(1), "o2");
  answers = selectSingle(answers, id(1), "o3");
  assert.deepEqual(answers[id(1)].optionIds, ["o3"]);
  answers = toggleMulti(answers, id(3), "o2");
  answers = toggleMulti(answers, id(3), "o1");
  assert.deepEqual(answers[id(3)].optionIds, ["o1", "o2"]);
  answers = toggleMulti(answers, id(3), "o1");
  assert.deepEqual(answers[id(3)].optionIds, ["o2"]);
  answers = toggleMulti(answers, id(3), "o2");
  assert.deepEqual(answers[id(3)].optionIds, []);

  const emoji = "🧠".repeat(10);
  const clamped = setText({}, id(4), emoji, 4);
  assert.equal(clamped.clamped, true);
  assert.equal(Array.from(clamped.answers[id(4)].text).length, 4);
  assert.equal(clamped.answers[id(4)].text, "🧠🧠🧠🧠");
  assert.deepEqual(clampText("short", 10), { text: "short", clamped: false });
  assert.equal(setText({}, id(4), "ok", 10).clamped, false);
});

test("answer status follows each kind", () => {
  assert.equal(answerStatus(questions[0], undefined), "unanswered");
  assert.equal(
    answerStatus(questions[0], { optionIds: ["o1"], text: "" }),
    "answered",
  );
  assert.equal(
    answerStatus(questions[2], { optionIds: [], text: "" }),
    "unanswered",
  );
  assert.equal(
    answerStatus(questions[3], { optionIds: [], text: "   " }),
    "unanswered",
  );
  assert.equal(
    answerStatus(questions[3], { optionIds: [], text: "words" }),
    "answered",
  );
  const answers = selectSingle({}, id(1), "o1");
  assert.equal(answeredCount(questions, answers), 1);
});

test("buildSubmitBody sends every question with attempt_key and wire field names", () => {
  let answers = selectSingle({}, id(1), "o2");
  answers = toggleMulti(answers, id(3), "o1");
  answers = toggleMulti(answers, id(3), "o9");
  answers = setText(answers, id(4), "  my answer ", 100).answers;
  const body = buildSubmitBody(
    "key-1",
    id(100),
    [...questions].reverse(),
    answers,
  );
  assert.equal(body.attempt_key, "key-1");
  assert.equal(body.quiz_id, id(100));
  assert.deepEqual(body.answers, [
    { question_id: id(1), kind: "single_choice", option_id: "o2" },
    { question_id: id(2), kind: "true_false" },
    { question_id: id(3), kind: "multi_select", option_ids: ["o1"] },
    { question_id: id(4), kind: "short_answer", text: "  my answer " },
  ]);
  const empty = buildSubmitBody("key-2", id(100), questions, {});
  assert.equal(empty.answers.length, 4, "nothing is omitted");
  assert.deepEqual(empty.answers[2], {
    question_id: id(3),
    kind: "multi_select",
    option_ids: [],
  });
  assert.deepEqual(empty.answers[3], {
    question_id: id(4),
    kind: "short_answer",
    text: "",
  });
});

test("step navigation includes the review step and respects bounds", () => {
  assert.equal(stepNext(0, 4), 1);
  assert.equal(stepNext(3, 4), 4, "the last question leads to the review step");
  assert.equal(stepNext(4, 4), 4);
  assert.equal(stepBack(0, 4), 0);
  assert.equal(stepBack(4, 4), 3);
  assert.equal(goToStep(4, 2, 4), 2);
  assert.equal(goToStep(0, 99, 4), 4);
  assert.equal(goToStep(0, -3, 4), 0);
});

// --- display text ---------------------------------------------------------------------------

test("score, labels and counts read plainly", () => {
  assert.equal(scoreText({ correct: 4, total: 6 }), "4 of 6");
  assert.equal(scoreText({ correct: 0, total: 3 }), "0 of 3");
  assert.equal(outcomeLabelText("looks_solid"), "Looks solid");
  assert.equal(outcomeLabelText("worth_reviewing"), "Worth reviewing");
  const base: QuizOutcomeResult = {
    index: 0,
    title: "A",
    label: "worth_reviewing",
    ai_contributed: false,
    correct: 2,
    to_review: 1,
    short_needs_review: 0,
    short_blank: 0,
    short_open: 0,
  };
  assert.deepEqual(outcomeCountsText(base), [
    "2 answered correctly · 1 to review",
  ]);
  assert.deepEqual(outcomeCountsText({ ...base, short_blank: 1 }), [
    "2 answered correctly · 1 to review",
    "1 short answer left blank",
  ]);
  const ai = outcomeCountsText({
    ...base,
    short_needs_review: 1,
    ai_contributed: true,
  });
  assert.ok(ai.some((line) => line.includes("(provisional)")));
  assert.ok(ai.includes("Includes provisional AI feedback"));
  assert.ok(
    !outcomeCountsText({ ...base, short_blank: 2 }).includes(
      "Includes provisional AI feedback",
    ),
  );
});

test("partlyCorrectNote counts missed options only for a subset answer", () => {
  assert.equal(
    partlyCorrectNote(["o1"], ["o1", "o2", "o3"]),
    "You chose only correct options, but missed 2.",
  );
  assert.equal(partlyCorrectNote(["o1", "o4"], ["o1", "o2"]), null);
  assert.equal(partlyCorrectNote([], ["o1"]), null);
  assert.equal(partlyCorrectNote(["o1", "o2"], ["o1", "o2"]), null);
});

test("an attempt row shows the date and X of Y", () => {
  const text = attemptRowText(
    {
      attempt_id: id(1),
      quiz_id: id(2),
      quiz_is_current: true,
      status: "graded",
      submitted_at: "2026-10-21T09:20:41Z",
      correct: 4,
      total: 6,
      short_answers_total: 0,
      short_answers_pending: 0,
    },
    "en-US",
    "UTC",
  );
  assert.equal(text, "Oct 21, 2026 — 4 of 6");
});

// --- feedback policy ---------------------------------------------------------------------------

test("automatic feedback is only for pending answers of the attempt just submitted", () => {
  const fresh = result();
  assert.deepEqual(feedbackRequests(fresh, true, new Set()), [id(4)]);
  assert.deepEqual(
    feedbackRequests(fresh, false, new Set()),
    [],
    "old attempts are never automatic",
  );
  assert.deepEqual(
    feedbackRequests(result({}, "unavailable"), true, new Set()),
    [],
    "unavailable is manual",
  );
  assert.deepEqual(feedbackRequests(result({}, "graded"), true, new Set()), []);
  assert.deepEqual(
    feedbackRequests(result({}, "not_applicable"), true, new Set()),
    [],
  );
  assert.deepEqual(
    feedbackRequests(
      fresh,
      true,
      new Set([feedbackKey(fresh.attempt_id, id(4))]),
    ),
    [],
    "at most once per attempt and question",
  );
  assert.deepEqual(
    feedbackRequests(fresh, true, [feedbackKey(fresh.attempt_id, id(4))]),
    [],
  );
});

test("automatic feedback is skipped when the daily allowance is known to be used up", () => {
  const spent = result({
    grading_usage: { used: 20, limit: 20, resets_at: "2026-10-22T00:00:00Z" },
  });
  assert.deepEqual(feedbackRequests(spent, true, new Set()), []);
  const some = result({
    grading_usage: { used: 19, limit: 20, resets_at: "2026-10-22T00:00:00Z" },
  });
  assert.deepEqual(feedbackRequests(some, true, new Set()), [id(4)]);
  assert.deepEqual(
    feedbackRequests(result({ grading_usage: null }), true, new Set()),
    [id(4)],
  );
});

// --- reset time and limit copy ---------------------------------------------------------------------

test("reset times read in the learner's time zone", () => {
  const now = new Date("2026-10-21T10:00:00Z");
  assert.equal(
    formatResetTime("2026-10-21T17:00:00Z", now, "UTC"),
    "5:00 PM today",
  );
  assert.equal(
    formatResetTime("2026-10-22T00:00:00Z", now, "UTC"),
    "12:00 AM tomorrow",
  );
  assert.equal(
    formatResetTime("2026-10-22T00:00:00Z", now, "America/Los_Angeles"),
    "5:00 PM today",
  );
  assert.equal(
    formatResetTime("2026-10-22T00:00:00Z", now, "Asia/Tokyo"),
    "9:00 AM tomorrow",
  );
  assert.equal(
    formatResetTime("2026-10-25T00:00:00Z", now, "UTC"),
    "Sunday 12:00 AM",
  );
  assert.equal(
    formatResetTime("not a date", now, "UTC"),
    "the next UTC midnight",
  );
  assert.equal(formatResetTime(null, now, "UTC"), "the next UTC midnight");
});

test("limit messages carry the limit, the local reset time and the retake note", () => {
  const now = new Date("2026-10-21T10:00:00Z");
  const error = new QuizApiError({
    status: 429,
    code: "quiz_generation_limit_reached",
    limit: 3,
    used: 3,
    resetsAt: "2026-10-22T00:00:00Z",
  });
  const text = formatLimitMessage(error, {
    now,
    timeZone: "UTC",
    hasQuiz: true,
  });
  assert.equal(
    text,
    "You've used all 3 quiz generations for today. You can generate new questions again after 12:00 AM tomorrow (resets at midnight UTC). You can still retake this quiz as often as you like.",
  );
  const without = formatLimitMessage(error, { now, timeZone: "UTC" });
  assert.ok(!without.includes("retake"));
  const grading = new QuizApiError({
    status: 429,
    code: "quiz_grading_limit_reached",
    limit: 20,
    used: 20,
    resetsAt: "2026-10-22T00:00:00Z",
  });
  assert.match(
    formatLimitMessage(grading, { now, timeZone: "UTC" }),
    /all 20 AI-feedback requests/,
  );
  const attempts = new QuizApiError({
    status: 429,
    code: "quiz_attempt_limit_reached",
  });
  assert.match(formatLimitMessage(attempts, { now }), /limit of 20 attempts/);
});

test("errors map to calm copy; unknown codes and foreign errors become the generic message", () => {
  const now = new Date("2026-10-21T10:00:00Z");
  assert.equal(
    quizErrorText(new Error("boom: provider said no"), { now }),
    "We couldn't do that just now. Try again in a moment.",
  );
  assert.equal(
    quizErrorText(quizApiErrorFrom(500, { error: { code: "something_new" } }), {
      now,
    }),
    "We couldn't do that just now. Try again in a moment.",
  );
  assert.equal(
    quizErrorText(
      quizApiErrorFrom(409, {
        detail: "x",
        error: { code: "quiz_lease_lost", message: "SECRET provider text" },
      }),
      { now },
    ),
    "That request took too long and was released. Try again.",
  );
  const charged = quizErrorText(
    quizApiErrorFrom(503, {
      error: {
        code: "quiz_generation_unavailable",
        reason: "timeout",
        charged: true,
      },
    }),
    { now },
  );
  assert.ok(charged.includes("used one of today's generations"));
  const free = quizErrorText(
    quizApiErrorFrom(503, {
      error: {
        code: "quiz_generation_unavailable",
        reason: "setup_required",
        charged: false,
      },
    }),
    { now },
  );
  assert.equal(free, "Quiz generation isn't set up on this server yet.");
});

test("quizApiErrorFrom carries the 429 fields and maps 401 and bare 422", () => {
  const limited = quizApiErrorFrom(429, {
    detail: "x",
    error: {
      code: "quiz_generation_limit_reached",
      message: "m",
      retryable: false,
      limit: 3,
      used: 3,
      resets_at: "2026-10-22T00:00:00Z",
      retry_after_seconds: 100,
    },
  });
  assert.equal(limited.code, "quiz_generation_limit_reached");
  assert.equal(limited.status, 429);
  assert.equal(limited.limit, 3);
  assert.equal(limited.used, 3);
  assert.equal(limited.resetsAt, "2026-10-22T00:00:00Z");
  assert.equal(limited.retryAfterSeconds, 100);
  assert.ok(limited instanceof Error);
  assert.equal(quizApiErrorFrom(401, null).code, "quiz_session_expired");
  assert.equal(
    quizApiErrorFrom(401, { error: { code: "quiz_not_found" } }).code,
    "quiz_session_expired",
  );
  assert.equal(quizApiErrorFrom(422, null).code, "quiz_request_invalid");
  assert.equal(quizApiErrorFrom(502, null).code, "quiz_unknown");
});

// --- progress -------------------------------------------------------------------------------------

test("progress round-trips and rejects anything doubtful", () => {
  const now = Date.parse("2026-10-21T10:00:00Z");
  const progress = {
    quizId: id(100),
    attemptKey: "k",
    answers: { [id(1)]: { optionIds: ["o1"], text: "" } },
    step: 2,
    savedAt: now - 1000,
  };
  const raw = serializeProgress(progress);
  assert.deepEqual(parseProgress(raw, id(100), now), { v: 1, ...progress });
  assert.equal(progressKey(id(100)), `secondbrain.quiz.progress.${id(100)}`);
  assert.equal(parseProgress(null, id(100), now), null);
  assert.equal(parseProgress("{nope", id(100), now), null);
  assert.equal(parseProgress(raw, id(101), now), null, "another quiz");
  assert.equal(
    parseProgress(raw.replace('"v":1', '"v":2'), id(100), now),
    null,
    "wrong version",
  );
  assert.equal(
    parseProgress(raw, id(100), now + 25 * 3600 * 1000),
    null,
    "older than 24 hours",
  );
  assert.equal(
    parseProgress(
      serializeProgress({ ...progress, savedAt: now + 3600_000 }),
      id(100),
      now,
    ),
    null,
    "from the future",
  );
  assert.equal(
    parseProgress(
      JSON.stringify({
        v: 1,
        quizId: id(100),
        attemptKey: 5,
        answers: {},
        step: 0,
        savedAt: now,
      }),
      id(100),
      now,
    ),
    null,
  );
  assert.equal(
    parseProgress(
      JSON.stringify({
        v: 1,
        quizId: id(100),
        attemptKey: "k",
        answers: { a: { optionIds: [1], text: "" } },
        step: 0,
        savedAt: now,
      }),
      id(100),
      now,
    ),
    null,
    "non-string ids",
  );
  assert.equal(
    parseProgress(
      JSON.stringify({
        v: 1,
        quizId: id(100),
        attemptKey: "k",
        answers: [],
        step: 0,
        savedAt: now,
      }),
      id(100),
      now,
    ),
    null,
  );
  assert.equal(
    parseProgress(
      JSON.stringify({
        v: 1,
        quizId: id(100),
        attemptKey: "k",
        answers: {},
        step: -1,
        savedAt: now,
      }),
      id(100),
      now,
    ),
    null,
  );
});

// --- state machine -----------------------------------------------------------------------------------

function run(
  events: QuizEvent[],
  from: QuizUiState = initialQuizState,
): QuizUiState {
  return events.reduce(quizReducer, from);
}
const failure = (code: string, extra: Record<string, unknown> = {}) =>
  quizApiErrorFrom(409, { error: { code, ...extra } });

test("loading, load_error and the server-driven views", () => {
  assert.equal(quizView(initialQuizState), "loading");
  const failed = run([
    { type: "load_failed", error: failure("quiz_storage_unavailable") },
  ]);
  assert.equal(quizView(failed), "load_error");
  const retry = run([{ type: "load_started" }], failed);
  assert.equal(quizView(retry), "loading");
  assert.equal(retry.error, null);

  const view = (s: Partial<QuizState>) =>
    quizView(run([{ type: "loaded", server: server(s) }]));
  assert.equal(
    view({
      status: "not_ready",
      quiz: null,
      not_ready_reason: "plan_not_confirmed",
    }),
    "not_ready",
  );
  assert.equal(view({ status: "generating", quiz: null }), "generating");
  assert.equal(view({ status: "none", quiz: null }), "none");
  assert.equal(
    view({
      status: "none",
      quiz: null,
      generate_blocked: "limit",
      can_generate: false,
    }),
    "limit_reached",
  );
  assert.equal(view({}), "ready_first");
  assert.equal(
    view({
      attempts: [
        {
          attempt_id: id(9),
          quiz_id: id(100),
          quiz_is_current: true,
          status: "graded",
          submitted_at: "2026-10-21T09:20:41Z",
          correct: 2,
          total: 3,
          short_answers_total: 0,
          short_answers_pending: 0,
        },
      ],
    }),
    "ready_again",
  );
  assert.equal(
    view({
      attempts: [
        {
          attempt_id: id(9),
          quiz_id: id(101),
          quiz_is_current: false,
          status: "graded",
          submitted_at: "2026-10-21T09:20:41Z",
          correct: 2,
          total: 3,
          short_answers_total: 0,
          short_answers_pending: 0,
        },
      ],
    }),
    "ready_first",
    "attempts on an earlier set do not count",
  );
  assert.equal(
    view({
      plan: { is_active: false, evidence_current: true, source_version: 1 },
    }),
    "older_version",
  );
  assert.equal(
    view({
      plan: { is_active: true, evidence_current: false, source_version: 1 },
    }),
    "evidence_changed",
  );
  const redacted = server();
  assert.equal(
    quizView(
      run([
        {
          type: "loaded",
          server: {
            ...redacted,
            quiz: redacted.quiz && {
              ...redacted.quiz,
              redacted: true,
              questions: [],
            },
          },
        },
      ]),
    ),
    "redacted",
  );
});

test("regenerating keeps the quiz ready and the poll running", () => {
  const regenerating = server({
    regenerating: true,
    can_generate: false,
    generate_blocked: "generating",
  });
  assert.equal(
    quizView(run([{ type: "loaded", server: regenerating }])),
    "ready_first",
  );
  assert.equal(shouldPoll(regenerating), true);
  assert.equal(shouldPoll(server({ status: "generating", quiz: null })), true);
  assert.equal(shouldPoll(server()), false);
  assert.equal(shouldPoll(null), false);
});

test("generating from none shows the skeleton, a limit error shows the limit view", () => {
  const none = run([
    { type: "loaded", server: server({ status: "none", quiz: null }) },
  ]);
  const requesting = run([{ type: "generate_started" }], none);
  assert.equal(quizView(requesting), "generating");
  const limited = run(
    [
      {
        type: "generate_failed",
        error: quizApiErrorFrom(429, {
          error: { code: "quiz_generation_limit_reached", limit: 3, used: 3 },
        }),
      },
    ],
    requesting,
  );
  assert.equal(limited.requesting, false);
  assert.equal(quizView(limited), "limit_reached");
  const ready = run(
    [{ type: "generate_finished", server: server() }],
    requesting,
  );
  assert.equal(quizView(ready), "ready_first");
  assert.equal(ready.error, null);
  assert.equal(quizView(run([{ type: "error_dismissed" }], limited)), "none");
});

test("taking a quiz moves through questions, the review step and submitting", () => {
  const loaded = run([{ type: "loaded", server: server() }]);
  const started = run(
    [{ type: "attempt_started", attemptKey: "k1", firstAttempt: true }],
    loaded,
  );
  assert.equal(quizView(started), "in_progress");
  assert.equal(started.step, 0);
  const a1 = run(
    [
      { type: "answers_changed", answers: selectSingle({}, id(1), "o1") },
      { type: "step_next" },
      { type: "step_next" },
      { type: "step_next" },
    ],
    started,
  );
  assert.equal(a1.step, 3);
  assert.equal(quizView(a1), "in_progress");
  const review = run([{ type: "step_next" }], a1);
  assert.equal(quizView(review), "review_answers");
  assert.equal(review.step, 4);
  assert.equal(
    quizView(run([{ type: "step_next" }], review)),
    "review_answers",
    "cannot go past the review step",
  );
  const back = run([{ type: "step_back" }], review);
  assert.equal(quizView(back), "in_progress");
  assert.equal(run([{ type: "step_to", step: 1 }], review).step, 1);
  assert.deepEqual(review.answers[id(1)].optionIds, ["o1"], "answers are kept");
  const submitting = run([{ type: "submit_started" }], review);
  assert.equal(quizView(submitting), "submitting");
  const done = run(
    [{ type: "submit_succeeded", result: result() }],
    submitting,
  );
  assert.equal(quizView(done), "results");
  assert.equal(done.justSubmitted, true);
  assert.deepEqual(done.answers, {});
  assert.equal(done.attemptKey, null);
  const updated = result({ score: { correct: 2, total: 3 } });
  assert.equal(
    run([{ type: "result_updated", result: updated }], done).result?.score
      .correct,
    2,
  );
  assert.equal(
    run(
      [{ type: "result_updated", result: { ...updated, attempt_id: id(999) } }],
      done,
    ).result?.score.correct,
    1,
    "another attempt's update is ignored",
  );
  const closed = run([{ type: "closed" }], done);
  assert.equal(quizView(closed), "ready_first");
  assert.equal(closed.result, null);
  const opened = run([{ type: "result_opened", result: result() }], loaded);
  assert.equal(quizView(opened), "results");
  assert.equal(opened.justSubmitted, false);
});

test("a failed submit keeps the answers and the same attempt key", () => {
  const loaded = run([{ type: "loaded", server: server() }]);
  const review = run(
    [
      { type: "attempt_started", attemptKey: "k1", firstAttempt: false },
      { type: "answers_changed", answers: selectSingle({}, id(1), "o1") },
      { type: "step_to", step: 4 },
      { type: "submit_started" },
    ],
    loaded,
  );
  const broken = run(
    [{ type: "submit_failed", error: failure("quiz_storage_unavailable") }],
    review,
  );
  assert.equal(quizView(broken), "submit_error");
  assert.equal(broken.attemptKey, "k1");
  assert.deepEqual(broken.answers[id(1)].optionIds, ["o1"]);
  assert.equal(
    quizView(run([{ type: "submit_started" }], broken)),
    "submitting",
  );
  const changed = run(
    [{ type: "submit_failed", error: failure("quiz_evidence_changed") }],
    review,
  );
  assert.equal(quizView(changed), "evidence_changed_on_submit");
  assert.deepEqual(changed.answers[id(1)].optionIds, ["o1"]);
  assert.equal(quizView(run([{ type: "closed" }], changed)), "ready_first");
});

test("interrupted progress restores to the saved step", () => {
  const loaded = run([{ type: "loaded", server: server() }]);
  const restored = run(
    [
      {
        type: "progress_restored",
        attemptKey: "k9",
        answers: { [id(1)]: { optionIds: ["o2"], text: "" } },
        step: 2,
        firstAttempt: true,
      },
    ],
    loaded,
  );
  assert.equal(quizView(restored), "in_progress");
  assert.equal(restored.step, 2);
  assert.equal(restored.attemptKey, "k9");
  const atReview = run(
    [
      {
        type: "progress_restored",
        attemptKey: "k9",
        answers: {},
        step: 4,
        firstAttempt: true,
      },
    ],
    loaded,
  );
  assert.equal(quizView(atReview), "review_answers");
});

test("a failed background refresh never throws away work in progress", () => {
  const loaded = run([{ type: "loaded", server: server() }]);
  const taking = run(
    [{ type: "attempt_started", attemptKey: "k", firstAttempt: true }],
    loaded,
  );
  assert.equal(
    quizView(
      run(
        [{ type: "load_failed", error: failure("quiz_storage_unavailable") }],
        taking,
      ),
    ),
    "in_progress",
  );
  assert.equal(
    quizView(
      run(
        [{ type: "load_failed", error: failure("quiz_storage_unavailable") }],
        loaded,
      ),
    ),
    "load_error",
  );
  assert.equal(
    quizView(run([{ type: "loaded", server: server() }], taking)),
    "in_progress",
    "polling does not interrupt an attempt",
  );
});

test("blocked generation explains itself in calm words", () => {
  const now = new Date("2026-10-21T10:00:00Z");
  const text = (over: Partial<QuizState>) =>
    generateBlockedText(server(over), { now, timeZone: "UTC" });
  assert.equal(text({}), null);
  assert.equal(text({ generate_blocked: "generating" }), null);
  assert.equal(
    text({ generate_blocked: "disabled" }),
    "Quizzes are turned off for now.",
  );
  assert.equal(
    text({ generate_blocked: "setup" }),
    "Quiz generation isn't set up on this server yet.",
  );
  assert.equal(
    text({ generate_blocked: "not_active" }),
    "Quizzes can only be made for the current version of a path.",
  );
  assert.equal(
    text({ generate_blocked: "not_active", quiz: null, status: "none" }),
    "No quiz was made for this version. Open the current version to make one.",
  );
  assert.match(
    text({ generate_blocked: "evidence_changed" }) ?? "",
    /supporting material/,
  );
  const limited = text({ generate_blocked: "limit" }) ?? "";
  assert.match(limited, /all 3 quiz generations for today/);
  assert.match(limited, /12:00 AM tomorrow \(resets at midnight UTC\)/);
  assert.match(limited, /retake this quiz/);
  assert.ok(
    !(
      text({ generate_blocked: "limit", quiz: null, status: "none" }) ?? ""
    ).includes("retake"),
  );
  assert.deepEqual(generationUsage(server()), { limit: 3, remaining: 2 });
  assert.deepEqual(
    generationUsage(
      server({
        usage: {
          generations_used: 9,
          generations_limit: 3,
          resets_at: "2026-10-22T00:00:00Z",
        },
      }),
    ),
    { limit: 3, remaining: 0 },
  );
});
