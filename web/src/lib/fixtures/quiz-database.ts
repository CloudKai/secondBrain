import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { PGlite } from "@electric-sql/pglite";
import {
  alice,
  bob,
  draftDatabase,
  learner,
  source,
} from "./learning-database";

export { alice, bob, learner, source };

export type QuestionKind =
  "single_choice" | "true_false" | "multi_select" | "short_answer";
export type StoredQuestion = {
  position: number;
  kind: QuestionKind;
  prompt: string;
  options: { id: string; text: string }[];
  outcome_index: number;
  outcome_title: string;
};
export type StoredKey = {
  position: number;
  correct_option_ids: string[] | null;
  explanation: string;
  citation_ids: string[];
  criteria: string[] | null;
  model_answer: string | null;
};
export type StoredQuiz = {
  questions: StoredQuestion[];
  key: StoredKey[];
  outcomes: { index: number; title: string }[];
};
export type ErrorCodeRow = {
  code: string;
  http: number;
  sqlstate: string | null;
  sql_message: string | null;
  extra_sql_messages?: { sqlstate: string; sql_message: string }[];
};
export type ShortAnswerCase = {
  name: string;
  assessments: string[];
  result: string;
  signal: string;
  sql: boolean;
};

const fixtureFolder = new URL(
  "../../../../backend/tests/fixtures/",
  import.meta.url,
);
async function readJson<T>(name: string): Promise<T> {
  return JSON.parse(await readFile(new URL(name, fixtureFolder), "utf8")) as T;
}
export const loadStoredQuiz = () =>
  readJson<StoredQuiz>("quiz_stored_example.json");
export const loadErrorCodes = () =>
  readJson<ErrorCodeRow[]>("quiz_error_codes.json");
export const loadShortAnswerCases = async () =>
  (await readJson<{ short_answer_cases: ShortAnswerCase[] }>("quiz_cases.json"))
    .short_answer_cases;

// Four passages cut from the capture that draftDatabase() stores, so p0001..p0004 exist.
const capture =
  "A source provides evidence for a claim. Similarity by itself does not establish support. Learners can revisit original evidence when checking a conclusion.";
const pieces = [
  "A source provides evidence for a claim.",
  "Similarity by itself does not establish support.",
  "Learners can revisit original evidence",
  "when checking a conclusion.",
];
export const passages = pieces.map((excerpt, index) => {
  const start = capture.indexOf(excerpt);
  return {
    id: `p000${index + 1}`,
    start,
    end: start + excerpt.length,
    excerpt,
    page: null,
    start_ms: null,
    end_ms: null,
  };
});
const claim = (text: string, ...citationIds: string[]) => ({
  text,
  citation_ids: citationIds,
});
const lesson = (
  title: string,
  outcome: string,
  explained: string,
  worked: string,
) => ({
  title,
  outcome,
  explanation: claim(`${title} is explained by a cited passage.`, explained),
  example: null,
  check: {
    kind: "explain",
    question: `Why does ${title.toLowerCase()} matter?`,
    criteria: ["Uses evidence"],
    hint: "Look at the claim.",
    worked_answer: claim(`${title} is checked against the passage.`, worked),
  },
});
// Lesson 0 cites p0001 and p0002; lesson 1 cites p0003 and p0004.
export const planContent = {
  title: "Check support",
  outcomes: ["Explain evidence support", "Revisit original sources"],
  prerequisites: [],
  coverage: "One source supports this explanation.",
  gaps: [],
  background: [],
  lessons: [
    lesson("Support", "Explain evidence support", "p0001", "p0002"),
    lesson("Original sources", "Revisit original sources", "p0003", "p0004"),
  ],
};

export async function asSuperuser(db: PGlite) {
  await db.exec(
    "reset role;select set_config('request.jwt.claim.sub','',false)",
  );
}
export async function asService(db: PGlite) {
  await db.exec(
    "reset role;select set_config('request.jwt.claim.sub','',false);set role service_role",
  );
}
export async function asAnon(db: PGlite) {
  await db.exec(
    "reset role;select set_config('request.jwt.claim.sub','',false);set role anon",
  );
}

/** draftDatabase() plus a study note that carries the four passages p0001..p0004. */
export async function quizDatabase() {
  const db = await draftDatabase();
  try {
    await asSuperuser(db);
    await db.query(
      "update public.source_studies set note=jsonb_set(note,'{references}',$1::jsonb) where source_id=$2",
      [JSON.stringify(passages), source],
    );
    await learner(db);
    return db;
  } catch (error) {
    await db.close();
    throw error;
  }
}

export const bobSource = "44444444-4444-4444-8444-444444444444";
/** A second learner with an equivalent source and study note. */
export async function addBobSource(db: PGlite) {
  await asSuperuser(db);
  await db.query(
    "insert into public.sources(id,user_id,original_url,canonical_url,title,captured_text,capture_origin,coverage,coverage_detail) select $1,$2,'https://example.com/bob','https://example.com/bob','Bob evidence',captured_text,capture_origin,coverage,coverage_detail from public.sources where id=$3",
    [bobSource, bob, source],
  );
  await db.query(
    "insert into public.source_studies(source_id,user_id,source_version,status,note) select $1,$2,source_version,status,note from public.source_studies where source_id=$3",
    [bobSource, bob, source],
  );
  await learner(db);
}

export type PlanContext = {
  owner: string;
  sourceId: string;
  planId: string;
  pathId: string;
  collectionId: string;
};
/** A confirmed two-lesson plan whose references are p0001..p0004. */
export async function confirmedPlan(
  db: PGlite,
  owner = alice,
  sourceId = source,
): Promise<PlanContext> {
  await learner(db, owner);
  const request = crypto.randomUUID();
  const lease = (
    await db.query<{ v: { lease_token: string } }>(
      "select public.request_learning_preview($1,1,$2,$3,$4,$5) v",
      [sourceId, request, "Explain evidence", "foundation", null],
    )
  ).rows[0].v.lease_token;
  await asService(db);
  await db.query("select public.finish_learning_preview($1,$2,$3,$4,$5,$6)", [
    request,
    lease,
    JSON.stringify({
      suggested_goal: "Explain evidence",
      paths: [planContent],
    }),
    "Explain evidence",
    JSON.stringify(passages),
    "gpt-6-luna",
  ]);
  await learner(db, owner);
  const plan = (
    await db.query<{
      v: { plans: { id: string; path_id: string; request_id: string }[] };
    }>("select public.get_source_learning($1) v", [sourceId])
  ).rows[0].v.plans.find((item) => item.request_id === request);
  if (!plan) throw new Error("preview did not create a plan");
  await db.query("select public.confirm_learning_plan($1)", [plan.id]);
  const collectionId = (
    await db.query<{ v: { collection: { id: string } } }>(
      "select public.resolve_source_learning_collection($1) v",
      [sourceId],
    )
  ).rows[0].v.collection.id;
  return {
    owner,
    sourceId,
    planId: plan.id,
    pathId: plan.path_id,
    collectionId,
  };
}

export type StateQuestion = {
  id: string;
  position: number;
  kind: QuestionKind;
  prompt: string | null;
  options: { id: string; text: string }[] | null;
  outcome_index: number;
  outcome_title: string;
  redacted: boolean;
};
export type QuizState = {
  plan: {
    is_active: boolean;
    evidence_current: boolean;
    needs_review: boolean;
    source_version: number;
  };
  generating: boolean;
  quiz: {
    id: string;
    question_count: number;
    redacted: boolean;
    outcomes: { index: number; title: string }[];
    questions: StateQuestion[];
  } | null;
  attempts: {
    attempt_id: string;
    quiz_id: string;
    quiz_is_current: boolean;
    status: string;
    correct: number | null;
    total: number;
    short_answers_total: number;
    short_answers_pending: number;
  }[];
  usage: { generation_used: number; resets_at: string };
  material?: { content: unknown; source_references: unknown };
};
export async function quizState(
  db: PGlite,
  plan: PlanContext,
  includeMaterial = false,
) {
  return (
    await db.query<{ v: QuizState }>(
      "select public.get_quiz_state($1,$2,$3) v",
      [plan.collectionId, plan.planId, includeMaterial],
    )
  ).rows[0].v;
}

export type Claim = {
  quiz_id: string;
  lease_token: string | null;
  replay: boolean;
};
export async function requestGeneration(
  db: PGlite,
  plan: PlanContext,
  requestId: string = crypto.randomUUID(),
  regenerate = false,
) {
  await learner(db, plan.owner);
  return (
    await db.query<{ v: Claim }>(
      "select public.request_quiz_generation($1,$2,$3,$4) v",
      [plan.collectionId, plan.planId, requestId, regenerate],
    )
  ).rows[0].v;
}
export async function charge(
  db: PGlite,
  quizId: string,
  lease: string | null,
  limit = 3,
) {
  await asService(db);
  return (
    await db.query<{
      v: { allowed: boolean; used: number; limit: number; resets_at: string };
    }>("select public.charge_quiz_generation($1,$2,$3) v", [
      quizId,
      lease,
      limit,
    ])
  ).rows[0].v;
}
export async function finishGeneration(
  db: PGlite,
  quizId: string,
  lease: string | null,
  quiz: unknown,
) {
  await asService(db);
  return (
    await db.query<{ v: boolean }>(
      "select public.finish_quiz_generation($1,$2,$3,'gpt-6-luna',false,1200,900) v",
      [quizId, lease, JSON.stringify(quiz)],
    )
  ).rows[0].v;
}

/** Creates a ready quiz through functions 2, 7 and 8 and leaves the session as the plan owner. */
export async function createReadyQuiz(
  db: PGlite,
  plan: PlanContext,
  stored: StoredQuiz,
  options: { requestId?: string; regenerate?: boolean } = {},
) {
  const requestId = options.requestId ?? crypto.randomUUID();
  const claim = await requestGeneration(
    db,
    plan,
    requestId,
    options.regenerate ?? false,
  );
  if (!claim.lease_token) throw new Error("no lease was issued");
  await charge(db, claim.quiz_id, claim.lease_token);
  const finished = await finishGeneration(
    db,
    claim.quiz_id,
    claim.lease_token,
    stored,
  );
  if (!finished) throw new Error("finish_quiz_generation returned false");
  await learner(db, plan.owner);
  return { quizId: claim.quiz_id, requestId, leaseToken: claim.lease_token };
}

export type StoredAnswer = {
  question_id: string;
  kind: QuestionKind;
  answer: Record<string, unknown>;
};
/** One answer per question; `pick` returns the answer object or undefined to omit the question. */
export function answersFor(
  questions: StateQuestion[],
  pick: (question: StateQuestion) => Record<string, unknown> | undefined,
) {
  const answers: StoredAnswer[] = [];
  for (const question of questions) {
    const answer = pick(question);
    if (answer) {
      answers.push({ question_id: question.id, kind: question.kind, answer });
    }
  }
  return answers;
}
/** The correct choice answers and a short text for every short answer. */
export function correctPick(
  stored: StoredQuiz,
  text = "Evidence has to be checked.",
) {
  return (question: StateQuestion) => {
    if (question.kind === "short_answer") return { text };
    const key = stored.key.find((item) => item.position === question.position);
    return { option_ids: key?.correct_option_ids ?? [] };
  };
}
export const answersHash = (answers: unknown) =>
  createHash("sha256").update(JSON.stringify(answers)).digest("hex");

export type AttemptClaim = {
  attempt_id: string;
  lease_token: string | null;
  replay: boolean;
};
export async function submitAttempt(
  db: PGlite,
  plan: PlanContext,
  quizId: string,
  answers: unknown,
  attemptKey: string = crypto.randomUUID(),
  hash = answersHash(answers),
) {
  await learner(db, plan.owner);
  return (
    await db.query<{ v: AttemptClaim }>(
      "select public.submit_quiz_attempt($1,$2,$3,$4,$5,$6) v",
      [
        plan.collectionId,
        plan.planId,
        quizId,
        attemptKey,
        JSON.stringify(answers),
        hash,
      ],
    )
  ).rows[0].v;
}

type ContextQuestion = {
  question_id: string;
  position: number;
  kind: QuestionKind;
  answer: { option_ids?: string[]; text?: string };
  correct_option_ids: string[] | null;
  explanation: string;
  citation_ids: string[];
  criteria: string[] | null;
  model_answer: string | null;
};
/** Deterministic grading in the shape finish_quiz_attempt stores. */
export function gradeContext(questions: ContextQuestion[]) {
  let correct = 0;
  const results = questions.map((question) => {
    const reveal: Record<string, unknown> = {
      explanation: question.explanation,
      citation_ids: question.citation_ids,
    };
    if (question.kind === "short_answer") {
      reveal.criteria = question.criteria;
      reveal.model_answer = question.model_answer;
      const blank = !question.answer.text;
      return {
        question_id: question.question_id,
        result: blank ? "unanswered" : null,
        signal: blank ? "negative" : "neutral",
        reveal,
      };
    }
    reveal.correct_option_ids = question.correct_option_ids;
    const chosen = new Set(question.answer.option_ids ?? []);
    const key = new Set(question.correct_option_ids ?? []);
    const inKey = [...chosen].filter((id) => key.has(id)).length;
    let result = "incorrect";
    if (chosen.size === 0) result = "unanswered";
    else if (chosen.size === key.size && inKey === key.size) result = "correct";
    else if (
      question.kind === "multi_select" &&
      inKey === chosen.size &&
      chosen.size < key.size
    ) {
      result = "partly_correct";
    }
    if (result === "correct") correct += 1;
    return {
      question_id: question.question_id,
      result,
      signal: result === "correct" ? "positive" : "negative",
      reveal,
    };
  });
  return { correct_count: correct, results };
}
export async function gradeAttempt(
  db: PGlite,
  plan: PlanContext,
  attemptId: string,
  lease: string | null,
) {
  await asService(db);
  const context = (
    await db.query<{ v: { questions: ContextQuestion[] } }>(
      "select public.get_quiz_grading_context($1,$2) v",
      [attemptId, lease],
    )
  ).rows[0].v;
  const graded = gradeContext(context.questions);
  await db.query("select public.finish_quiz_attempt($1,$2,$3)", [
    attemptId,
    lease,
    JSON.stringify(graded),
  ]);
  await learner(db, plan.owner);
  return graded;
}
/** Submits correct answers for every question and grades the attempt. */
export async function gradedAttempt(
  db: PGlite,
  plan: PlanContext,
  stored: StoredQuiz,
  quizId: string,
  options: { text?: string; attemptKey?: string } = {},
) {
  const state = await quizState(db, plan);
  const questions = state.quiz?.questions ?? [];
  const answers = answersFor(questions, correctPick(stored, options.text));
  const claim = await submitAttempt(
    db,
    plan,
    quizId,
    answers,
    options.attemptKey,
  );
  const graded = await gradeAttempt(
    db,
    plan,
    claim.attempt_id,
    claim.lease_token,
  );
  return { attemptId: claim.attempt_id, questions, answers, graded };
}
