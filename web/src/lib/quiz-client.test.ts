import assert from "node:assert/strict";
import test from "node:test";
import { createSourceClient } from "./source-client";
import { QuizApiError } from "./quiz-logic";

const owner = "11111111-1111-4111-8111-111111111111";
const collection = "77777777-7777-4777-8777-777777777777";
const plan = "55555555-5555-4555-8555-555555555555";
const quizId = "66666666-6666-4666-8666-666666666666";
const attemptId = "99999999-9999-4999-8999-999999999999";
const questionId = "88888888-8888-4888-8888-888888888888";
const base = `/api/v2/learning/collections/${collection}/plans/${plan}/quiz`;
const when = "2026-10-21T09:14:03Z";

const state = {
  status: "none",
  regenerating: false,
  not_ready_reason: null,
  plan: { is_active: true, evidence_current: true, source_version: 1 },
  quiz: null,
  attempts: [],
  usage: {
    generations_used: 0,
    generations_limit: 3,
    resets_at: "2026-10-22T00:00:00Z",
  },
  can_generate: true,
  generate_blocked: null,
  can_take: false,
};
const short = {
  kind: "short_answer",
  question_id: questionId,
  position: 3,
  prompt: "Explain.",
  outcome_index: 1,
  explanation: "Because.",
  citation_ids: ["p0002"],
  answer_text: "words",
  result: null,
  signal: "neutral",
  grading_state: "pending",
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
};
const choice = (n: number, position: number) => ({
  kind: "true_false",
  question_id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  position,
  prompt: "True?",
  outcome_index: 0,
  explanation: "Because.",
  citation_ids: ["p0001"],
  options: [
    { id: "true", text: "True" },
    { id: "false", text: "False" },
  ],
  selected_option_ids: ["true"],
  correct_option_ids: ["true"],
  result: "correct",
  signal: "positive",
});
const attempt = {
  attempt_id: attemptId,
  quiz_id: quizId,
  plan_id: plan,
  quiz_is_current: true,
  submitted_at: when,
  score: { correct: 2, total: 2 },
  outcomes: [],
  review_first: [],
  short_answers: { total: 1, pending: 1, unavailable: 0 },
  grading_usage: { used: 0, limit: 20, resets_at: "2026-10-22T00:00:00Z" },
  questions: [choice(1, 0), choice(2, 1), short],
};

interface Call {
  method: string;
  url: string;
  body: unknown;
  signal: AbortSignal | null | undefined;
}

function harness(respond: (call: Call) => Response) {
  const values = new Map<string, string>();
  const calls: Call[] = [];
  const token = `${Buffer.from('{"alg":"HS256"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub: owner, exp: 2000000000 })).toString("base64url")}.signature`;
  const client = createSourceClient(
    { url: "https://supabase.test", publicKey: "public-test" },
    {
      storage: {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => {
          values.set(key, value);
        },
        removeItem: (key) => {
          values.delete(key);
        },
      },
      fetch: async (input, init) => {
        const url = String(input);
        if (url.includes("/auth/v1/signup"))
          return Response.json({
            access_token: token,
            refresh_token: "refresh",
            token_type: "bearer",
            expires_in: 3600,
            user: { id: owner, aud: "authenticated", role: "authenticated" },
          });
        assert.equal(
          new Headers(init?.headers).get("Authorization"),
          `Bearer ${token}`,
        );
        const call: Call = {
          method: init?.method ?? "GET",
          url,
          body: init?.body ? JSON.parse(String(init.body)) : null,
          signal: init?.signal,
        };
        calls.push(call);
        return respond(call);
      },
    },
  );
  return { client, calls };
}

test("quiz state is read from the plan's quiz path", async () => {
  const { client, calls } = harness(() => Response.json(state));
  assert.equal((await client.quizState(collection, plan)).status, "none");
  assert.equal(calls[0].url, base);
  assert.equal(calls[0].method, "GET");
});

test("a 429 becomes a typed error with code, limit, used and resetsAt", async () => {
  const { client } = harness(() =>
    Response.json(
      {
        detail: "You've used all 3.",
        error: {
          code: "quiz_generation_limit_reached",
          message: "You've used all 3.",
          retryable: false,
          limit: 3,
          used: 3,
          resets_at: "2026-10-22T00:00:00Z",
        },
      },
      { status: 429, headers: { "Retry-After": "3600" } },
    ),
  );
  await assert.rejects(
    client.generateQuiz(collection, plan, {
      request_id: quizId,
      regenerate: false,
    }),
    (error: unknown) => {
      assert.ok(error instanceof QuizApiError);
      assert.equal(error.status, 429);
      assert.equal(error.code, "quiz_generation_limit_reached");
      assert.equal(error.limit, 3);
      assert.equal(error.used, 3);
      assert.equal(error.resetsAt, "2026-10-22T00:00:00Z");
      return true;
    },
  );
});

test("a body with only `detail`, a FastAPI 422 and an unknown code still give a typed error", async () => {
  for (const [status, body, code] of [
    [500, { detail: "Something broke" }, "quiz_unknown"],
    [422, { detail: [{ msg: "bad" }] }, "quiz_request_invalid"],
    [400, { detail: "x", error: { code: "totally_new" } }, "quiz_unknown"],
    [404, { detail: "x", error: { code: "quiz_not_found" } }, "quiz_not_found"],
  ] as const) {
    const { client } = harness(() => Response.json(body, { status }));
    await assert.rejects(
      client.quizState(collection, plan),
      (error: unknown) => {
        assert.ok(error instanceof QuizApiError);
        assert.equal(error.code, code);
        assert.ok(error.message.length > 5);
        assert.ok(!error.message.includes("Something broke"));
        return true;
      },
    );
  }
  const html = harness(
    () => new Response("<html>bad gateway</html>", { status: 502 }),
  );
  await assert.rejects(
    html.client.quizState(collection, plan),
    (error: unknown) =>
      error instanceof QuizApiError && error.code === "quiz_unknown",
  );
});

test("HTTP 401 on a quiz path means the session expired", async () => {
  const { client } = harness(() =>
    Response.json({ detail: "Invalid token" }, { status: 401 }),
  );
  await assert.rejects(
    client.quizState(collection, plan),
    (error: unknown) =>
      error instanceof QuizApiError && error.code === "quiz_session_expired",
  );
});

test("non-quiz paths keep their plain-Error behaviour", async () => {
  const { client } = harness(() =>
    Response.json({ detail: "Plain failure" }, { status: 500 }),
  );
  await assert.rejects(
    client.learningSummary(),
    (error: unknown) =>
      error instanceof Error &&
      !(error instanceof QuizApiError) &&
      error.message === "Plain failure",
  );
});

test("generation posts the request id and regenerate flag with a 130 second signal", async () => {
  const { client, calls } = harness(() =>
    Response.json(
      {
        ...state,
        status: "ready",
        quiz: {
          id: quizId,
          generated_at: when,
          question_count: 4,
          outcomes: [{ index: 0, title: "A" }],
          redacted: false,
          source_version: 1,
          questions: [
            {
              kind: "true_false",
              id: questionId,
              position: 0,
              outcome_index: 0,
              outcome_title: "A",
              prompt: "True?",
              options: [
                { id: "true", text: "True" },
                { id: "false", text: "False" },
              ],
            },
            {
              kind: "true_false",
              id: owner,
              position: 1,
              outcome_index: 0,
              outcome_title: "A",
              prompt: "True?",
              options: [
                { id: "true", text: "True" },
                { id: "false", text: "False" },
              ],
            },
            {
              kind: "true_false",
              id: collection,
              position: 2,
              outcome_index: 0,
              outcome_title: "A",
              prompt: "True?",
              options: [
                { id: "true", text: "True" },
                { id: "false", text: "False" },
              ],
            },
            {
              kind: "true_false",
              id: plan,
              position: 3,
              outcome_index: 0,
              outcome_title: "A",
              prompt: "True?",
              options: [
                { id: "true", text: "True" },
                { id: "false", text: "False" },
              ],
            },
          ],
        },
        can_take: true,
      },
      { status: 201 },
    ),
  );
  const result = await client.generateQuiz(collection, plan, {
    request_id: quizId,
    regenerate: true,
  });
  assert.equal(result.status, "ready");
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].url, base);
  assert.deepEqual(calls[0].body, { request_id: quizId, regenerate: true });
  assert.ok(calls[0].signal, "an explicit timeout signal is passed");
});

test("submit sends the same attempt key on retry and checks the identity of the result", async () => {
  let attempts = 0;
  const { client, calls } = harness(() => {
    attempts += 1;
    return attempts === 1
      ? Response.json(
          { detail: "x", error: { code: "quiz_storage_unavailable" } },
          { status: 503 },
        )
      : Response.json(attempt, { status: 200 });
  });
  const body = {
    attempt_key: attemptId,
    quiz_id: quizId,
    answers: [
      { question_id: questionId, kind: "short_answer" as const, text: "words" },
    ],
  };
  await assert.rejects(
    client.submitQuizAttempt(collection, plan, body),
    (error: unknown) =>
      error instanceof QuizApiError &&
      error.code === "quiz_storage_unavailable",
  );
  const result = await client.submitQuizAttempt(collection, plan, body);
  assert.equal(result.attempt_id, attemptId);
  assert.equal(calls.length, 2);
  assert.equal(
    (calls[0].body as { attempt_key: string }).attempt_key,
    attemptId,
  );
  assert.equal(
    (calls[1].body as { attempt_key: string }).attempt_key,
    attemptId,
  );
  assert.equal(calls[1].url, `${base}/attempts`);
  const other = harness(() =>
    Response.json({ ...attempt, quiz_id: attemptId }),
  );
  await assert.rejects(other.client.submitQuizAttempt(collection, plan, body));
});

test("attempt reads and feedback requests use their own paths and verify the attempt", async () => {
  const { client, calls } = harness(() => Response.json(attempt));
  assert.equal(
    (await client.quizAttempt(collection, plan, attemptId)).attempt_id,
    attemptId,
  );
  assert.equal(
    (
      await client.quizShortAnswerFeedback(
        collection,
        plan,
        attemptId,
        questionId,
      )
    ).attempt_id,
    attemptId,
  );
  assert.equal(calls[0].url, `${base}/attempts/${attemptId}`);
  assert.equal(
    calls[1].url,
    `${base}/attempts/${attemptId}/feedback/${questionId}`,
  );
  assert.equal(calls[1].method, "POST");
  const wrong = harness(() =>
    Response.json({ ...attempt, attempt_id: questionId }),
  );
  await assert.rejects(wrong.client.quizAttempt(collection, plan, attemptId));
});

test("retaking issues no generation request: only the attempt path is used", async () => {
  const { client, calls } = harness(() => Response.json(attempt));
  await client.submitQuizAttempt(collection, plan, {
    attempt_key: attemptId,
    quiz_id: quizId,
    answers: [],
  });
  assert.ok(
    calls.every((call) => !(call.method === "POST" && call.url === base)),
  );
});
