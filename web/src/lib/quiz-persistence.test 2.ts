import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import type { PGlite } from "@electric-sql/pglite";
import {
  addBobSource,
  alice,
  answersFor,
  answersHash,
  asAnon,
  asService,
  asSuperuser,
  bob,
  bobSource,
  charge,
  confirmedPlan,
  correctPick,
  createReadyQuiz,
  finishGeneration,
  gradeAttempt,
  gradeContext,
  gradedAttempt,
  learner,
  loadErrorCodes,
  loadShortAnswerCases,
  loadStoredQuiz,
  passages,
  planContent,
  quizDatabase,
  quizState,
  requestGeneration,
  source,
  submitAttempt,
  type PlanContext,
  type StoredQuiz,
} from "./fixtures/quiz-database";

const migrationFile = new URL(
  "../../../supabase/migrations/202610200023_path_quiz.sql",
  import.meta.url,
);
const rollbackFile = new URL(
  "../../../supabase/rollbacks/202610200023_path_quiz.sql",
  import.meta.url,
);

async function one<T>(db: PGlite, sql: string, params: unknown[] = []) {
  return (await db.query<T>(sql, params)).rows[0];
}
async function usage(db: PGlite, user: string, kind: string) {
  await asSuperuser(db);
  const row = await one<{ n: number }>(
    db,
    "select coalesce(sum(count),0)::int n from public.quiz_usage_counters where user_id=$1 and kind=$2",
    [user, kind],
  );
  return row.n;
}
async function consume(
  db: PGlite,
  user: string | null,
  kind: string,
  limit: number,
  amount = 1,
) {
  await asSuperuser(db);
  return (
    await one<{ v: { allowed: boolean; used: number; resets_at: string } }>(
      db,
      "select public.quiz_consume_usage($1,$2,$3,$4) v",
      [user, kind, limit, amount],
    )
  ).v;
}
async function withQuiz(
  run: (context: {
    db: PGlite;
    plan: PlanContext;
    stored: StoredQuiz;
    quizId: string;
    requestId: string;
  }) => Promise<void>,
) {
  const db = await quizDatabase();
  try {
    const plan = await confirmedPlan(db);
    const stored = await loadStoredQuiz();
    const created = await createReadyQuiz(db, plan, stored);
    await run({
      db,
      plan,
      stored,
      quizId: created.quizId,
      requestId: created.requestId,
    });
  } finally {
    await db.close();
  }
}
const nextMidnight = () => {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  )
    .toISOString()
    .replace(".000Z", "Z");
};

test("SQL error messages match the shared error-code fixture", async () => {
  const sql = await readFile(migrationFile, "utf8");
  const rows = await loadErrorCodes();
  const expected = new Map<string, string>();
  for (const row of rows) {
    if (row.sql_message && row.sqlstate)
      expected.set(row.sql_message, row.sqlstate);
    for (const extra of row.extra_sql_messages ?? [])
      expected.set(extra.sql_message, extra.sqlstate);
  }
  for (const [message, sqlstate] of expected) {
    assert.ok(
      sql.includes(`errcode='${sqlstate}',message='${message}'`),
      `${message} is not raised with ${sqlstate}`,
    );
  }
  const raised = [...sql.matchAll(/errcode='(\w+)',message='(quiz_\w+)'/g)];
  assert.ok(raised.length > 0);
  for (const [, sqlstate, message] of raised)
    assert.equal(
      expected.get(message),
      sqlstate,
      `${message} is not in the fixture`,
    );
});

test("another learner cannot read or reach a quiz, and idempotency keys are scoped to the user", async () => {
  await withQuiz(async ({ db, plan, stored, quizId, requestId }) => {
    const state = await quizState(db, plan);
    const questions = state.quiz?.questions ?? [];
    const answers = answersFor(questions, correctPick(stored));
    const attemptKey = crypto.randomUUID();
    const aliceAttempt = await gradedAttempt(db, plan, stored, quizId, {
      attemptKey,
    });
    await addBobSource(db);
    const bobPlan = await confirmedPlan(db, bob, bobSource);
    await learner(db, bob);
    for (const table of [
      "quizzes",
      "quiz_questions",
      "quiz_attempts",
      "quiz_attempt_answers",
    ])
      assert.deepEqual(
        (await db.query(`select 1 from public.${table}`)).rows,
        [],
        table,
      );
    const calls: [string, unknown[]][] = [
      ["select public.get_quiz_state($1,$2)", [plan.collectionId, plan.planId]],
      [
        "select public.request_quiz_generation($1,$2,$3,false)",
        [plan.collectionId, plan.planId, requestId],
      ],
      [
        "select public.submit_quiz_attempt($1,$2,$3,$4,$5,$6)",
        [
          plan.collectionId,
          plan.planId,
          quizId,
          crypto.randomUUID(),
          "[]",
          answersHash([]),
        ],
      ],
      [
        "select public.claim_quiz_attempt_grading($1,$2,$3)",
        [plan.collectionId, plan.planId, aliceAttempt.attemptId],
      ],
      [
        "select public.get_quiz_attempt($1,$2,$3)",
        [plan.collectionId, plan.planId, aliceAttempt.attemptId],
      ],
      [
        "select public.claim_quiz_short_answer($1,$2,$3,$4)",
        [
          plan.collectionId,
          plan.planId,
          aliceAttempt.attemptId,
          questions[5].id,
        ],
      ],
      [
        "select public.get_quiz_attempt($1,$2,$3)",
        [bobPlan.collectionId, bobPlan.planId, aliceAttempt.attemptId],
      ],
      [
        "select public.get_quiz_state($1,$2)",
        [bobPlan.collectionId, plan.planId],
      ],
    ];
    for (const [sql, params] of calls)
      await assert.rejects(db.query(sql, params), /quiz_not_found/, sql);
    // Bob may use the same request id and attempt key; neither call sees or collides with Alice's rows.
    const bobStored = await loadStoredQuiz();
    const bobQuiz = await createReadyQuiz(db, bobPlan, bobStored, {
      requestId,
    });
    assert.notEqual(bobQuiz.quizId, quizId);
    const bobAttempt = await gradedAttempt(
      db,
      bobPlan,
      bobStored,
      bobQuiz.quizId,
      { attemptKey },
    );
    assert.notEqual(bobAttempt.attemptId, aliceAttempt.attemptId);
    assert.equal(answers.length, bobAttempt.answers.length);
    assert.equal(
      (
        await one<{ n: number }>(
          db,
          "select count(*)::int n from public.quizzes",
        )
      ).n,
      1,
    );
    await learner(db, alice);
    assert.equal(
      (
        await one<{ n: number }>(
          db,
          "select count(*)::int n from public.quiz_attempts",
        )
      ).n,
      1,
    );
    assert.equal((await quizState(db, plan)).attempts.length, 1);
  });
});

test("the answer key and usage counters are private, and RLS still hides them if a grant slips in", async () => {
  await withQuiz(async ({ db }) => {
    for (const asRole of [learner, asAnon]) {
      await asRole(db);
      for (const table of ["quiz_question_keys", "quiz_usage_counters"])
        await assert.rejects(
          db.query(`select * from public.${table}`),
          /permission denied/,
          table,
        );
    }
    await asSuperuser(db);
    assert.ok(
      (
        await one<{ n: number }>(
          db,
          "select count(*)::int n from public.quiz_question_keys",
        )
      ).n > 0,
    );
    await db.exec(
      "grant select on public.quiz_question_keys,public.quiz_usage_counters to authenticated",
    );
    await learner(db);
    for (const table of ["quiz_question_keys", "quiz_usage_counters"])
      assert.deepEqual(
        (await db.query(`select * from public.${table}`)).rows,
        [],
        table,
      );
    const policies = await db.query<{ tablename: string }>(
      "select tablename from pg_policies where schemaname='public' and tablename like 'quiz%' order by tablename",
    );
    assert.deepEqual(
      policies.rows.map((row) => row.tablename),
      ["quiz_attempt_answers", "quiz_attempts", "quiz_questions", "quizzes"],
    );
  });
});

test("authenticated gets permission denied on every write to every quiz table", async () => {
  await withQuiz(async ({ db }) => {
    await learner(db);
    for (const table of [
      "quizzes",
      "quiz_questions",
      "quiz_question_keys",
      "quiz_attempts",
      "quiz_attempt_answers",
      "quiz_usage_counters",
    ]) {
      await assert.rejects(
        db.query(
          `insert into public.${table} select * from public.${table} where false`,
        ),
        /permission denied/,
        `insert ${table}`,
      );
      await assert.rejects(
        db.query(`update public.${table} set user_id=user_id`),
        /permission denied/,
        `update ${table}`,
      );
      await assert.rejects(
        db.query(`delete from public.${table}`),
        /permission denied/,
        `delete ${table}`,
      );
    }
  });
});

test("function privileges: browser roles reach only functions 1 to 6, the backend only 7 to 14", async () => {
  await withQuiz(async ({ db }) => {
    const browser = [
      "get_quiz_state(uuid,uuid,boolean)",
      "request_quiz_generation(uuid,uuid,uuid,boolean)",
      "submit_quiz_attempt(uuid,uuid,uuid,uuid,jsonb,text)",
      "claim_quiz_attempt_grading(uuid,uuid,uuid)",
      "get_quiz_attempt(uuid,uuid,uuid)",
      "claim_quiz_short_answer(uuid,uuid,uuid,uuid)",
    ];
    const backend = [
      "charge_quiz_generation(uuid,uuid,integer)",
      "finish_quiz_generation(uuid,uuid,jsonb,text,boolean,integer,integer)",
      "fail_quiz_generation(uuid,uuid,text,boolean)",
      "get_quiz_grading_context(uuid,uuid)",
      "finish_quiz_attempt(uuid,uuid,jsonb)",
      "get_quiz_short_answer_context(uuid,uuid,uuid)",
      "charge_quiz_grading(uuid,uuid,uuid,integer)",
      "finish_quiz_short_answer(uuid,uuid,uuid,jsonb,text,text,boolean)",
    ];
    const nobody = [
      "quiz_consume_usage(uuid,text,integer,integer)",
      "quiz_release_usage(uuid,date,text,integer)",
      "quiz_lease_attempt(uuid)",
      "quiz_options_valid(text,jsonb)",
    ];
    const can = async (role: string, signature: string) =>
      (
        await one<{ ok: boolean }>(
          db,
          `select has_function_privilege('${role}','public.${signature}','execute') ok`,
        )
      ).ok;
    await asSuperuser(db);
    for (const signature of browser) {
      assert.equal(await can("authenticated", signature), true, signature);
      assert.equal(await can("anon", signature), false, signature);
      assert.equal(await can("service_role", signature), false, signature);
    }
    for (const signature of [...backend, ...nobody]) {
      assert.equal(await can("authenticated", signature), false, signature);
      assert.equal(await can("anon", signature), false, signature);
    }
    for (const signature of backend)
      assert.equal(await can("service_role", signature), true, signature);
    for (const signature of nobody)
      assert.equal(await can("service_role", signature), false, signature);
    // The same facts, observed by calling.
    await learner(db);
    await assert.rejects(
      db.query(
        "select public.charge_quiz_generation(null::uuid,null::uuid,null::integer)",
      ),
      /permission denied for function/,
    );
    await assert.rejects(
      db.query("select public.quiz_consume_usage(null::uuid,'generation',3,1)"),
      /permission denied for function/,
    );
    await asAnon(db);
    await assert.rejects(
      db.query("select public.get_quiz_state(null::uuid,null::uuid,false)"),
      /permission denied for function/,
    );
    await asService(db);
    await assert.rejects(
      db.query("select public.quiz_consume_usage(null::uuid,'generation',3,1)"),
      /permission denied for function/,
    );
    await assert.rejects(
      db.query("select public.quiz_lease_attempt(null::uuid)"),
      /permission denied for function/,
    );
    await assert.rejects(
      db.query("select public.charge_quiz_generation($1,$2,3)", [
        crypto.randomUUID(),
        crypto.randomUUID(),
      ]),
      /quiz_lease_lost/,
    );
  });
});

test("option shape is a database invariant: key fields and wrong shapes violate the CHECK", async () => {
  await withQuiz(async ({ db, quizId }) => {
    await asSuperuser(db);
    const text = (id: string) => ({ id, text: `Option ${id}` });
    const four = ["o1", "o2", "o3", "o4"].map(text);
    const five = [...four, text("o5")];
    const insert = (kind: string, options: unknown) =>
      db.query(
        "insert into public.quiz_questions(quiz_id,user_id,position,kind,prompt,options,outcome_index,outcome_title) values($1,$2,9,$3,'Prompt',$4::jsonb,0,'Title')",
        [quizId, alice, kind, JSON.stringify(options)],
      );
    const rejected: [string, unknown][] = [
      [
        "single_choice",
        four.map((option, index) =>
          index === 0 ? { ...option, is_correct: true } : option,
        ),
      ],
      [
        "single_choice",
        four.map((option, index) =>
          index === 0 ? { id: option.id, correct: true } : option,
        ),
      ],
      ["single_choice", four.slice(0, 3)],
      ["single_choice", five],
      ["single_choice", [text("o1"), text("o1"), text("o3"), text("o4")]],
      ["single_choice", [text("o1"), text("o2"), text("o3"), text("o9")]],
      ["single_choice", [text("true"), text("false"), text("o3"), text("o4")]],
      [
        "true_false",
        [
          { id: "true", text: "Yes" },
          { id: "false", text: "No" },
        ],
      ],
      [
        "true_false",
        [
          { id: "false", text: "False" },
          { id: "true", text: "True" },
        ],
      ],
      ["multi_select", four],
      ["short_answer", [text("o1")]],
      ["short_answer", { id: "o1" }],
    ];
    for (const [kind, options] of rejected)
      await assert.rejects(
        insert(kind, options),
        /check constraint/,
        `${kind} ${JSON.stringify(options)}`,
      );
    for (const [kind, options] of [
      ["single_choice", four],
      ["multi_select", five],
      [
        "true_false",
        [
          { id: "true", text: "True" },
          { id: "false", text: "False" },
        ],
      ],
      ["short_answer", []],
    ] as [string, unknown][]) {
      await insert(kind, options);
      await db.query(
        "delete from public.quiz_questions where quiz_id=$1 and position=9",
        [quizId],
      );
    }
  });
});

test("generation requests: replay, single flight, leases and the three-lease limit", async () => {
  const db = await quizDatabase();
  try {
    const plan = await confirmedPlan(db);
    await learner(db);
    for (const params of [
      [crypto.randomUUID(), plan.planId, crypto.randomUUID()],
      [plan.collectionId, crypto.randomUUID(), crypto.randomUUID()],
    ])
      await assert.rejects(
        db.query(
          "select public.request_quiz_generation($1,$2,$3,false)",
          params,
        ),
        /quiz_not_found/,
      );
    const key = crypto.randomUUID();
    const first = await requestGeneration(db, plan, key);
    assert.equal(first.replay, false);
    assert.ok(first.lease_token);
    await assert.rejects(
      requestGeneration(db, plan, crypto.randomUUID()),
      /quiz_generation_in_progress/,
    );
    await assert.rejects(
      requestGeneration(db, plan, key),
      /quiz_generation_in_progress/,
    );
    await assert.rejects(
      requestGeneration(db, plan, key, true),
      /quiz_request_changed/,
    );
    const expire = async () => {
      await asSuperuser(db);
      await db.query(
        "update public.quizzes set lease_until=now()-interval '1 second' where id=$1",
        [first.quiz_id],
      );
    };
    await expire();
    const second = await requestGeneration(db, plan, key);
    assert.equal(second.quiz_id, first.quiz_id);
    assert.notEqual(second.lease_token, first.lease_token);
    await expire();
    const third = await requestGeneration(db, plan, key);
    assert.equal(third.quiz_id, first.quiz_id);
    await expire();
    await assert.rejects(
      requestGeneration(db, plan, key),
      /quiz_request_exhausted/,
    );
    assert.equal(
      (
        await one<{ attempts: number }>(
          db,
          "select attempts from public.quizzes where id=$1",
          [first.quiz_id],
        )
      ).attempts,
      3,
    );
    // A new key finds the abandoned row expired, marks it failed and starts fresh.
    const fresh = await requestGeneration(db, plan, crypto.randomUUID());
    assert.notEqual(fresh.quiz_id, first.quiz_id);
    await asSuperuser(db);
    const old = await one<{ status: string; error_code: string }>(
      db,
      "select status,error_code from public.quizzes where id=$1",
      [first.quiz_id],
    );
    assert.deepEqual(old, { status: "failed", error_code: "lease_expired" });
    // Database-level single flight and single current quiz.
    await assert.rejects(
      db.query(
        "insert into public.quizzes(user_id,request_id,plan_id,status,source_version,lease_token,lease_until) values($1,$2,$3,'generating',1,$4,now()+interval '1 minute')",
        [alice, crypto.randomUUID(), plan.planId, crypto.randomUUID()],
      ),
      /quizzes_one_generating/,
    );
    const indexes = await db.query<{ indexname: string; indexdef: string }>(
      "select indexname,indexdef from pg_indexes where schemaname='public' and indexname in ('quizzes_one_current','quizzes_one_generating')",
    );
    assert.equal(indexes.rows.length, 2);
    assert.ok(
      indexes.rows.every(
        (row) => /UNIQUE/.test(row.indexdef) && /WHERE/.test(row.indexdef),
      ),
    );
  } finally {
    await db.close();
  }
});

test("generation requests: a ready key replays, regenerate:false returns the current quiz, and a superseded or changed plan only blocks new keys", async () => {
  const db = await quizDatabase();
  try {
    const plan = await confirmedPlan(db);
    const stored = await loadStoredQuiz();
    const created = await createReadyQuiz(db, plan, stored);
    const replay = await requestGeneration(db, plan, created.requestId);
    assert.deepEqual(replay, {
      quiz_id: created.quizId,
      lease_token: null,
      replay: true,
    });
    const current = await requestGeneration(
      db,
      plan,
      crypto.randomUUID(),
      false,
    );
    assert.deepEqual(current, {
      quiz_id: created.quizId,
      lease_token: null,
      replay: true,
    });
    assert.equal(
      (
        await one<{ n: number }>(
          db,
          "select count(*)::int n from public.quizzes",
        )
      ).n,
      1,
    );
    // A second revision of the same path becomes the active plan.
    await learner(db);
    const request = crypto.randomUUID();
    const claim = (
      await one<{ v: { lease_token: string } }>(
        db,
        "select public.request_learning_preview($1,1,$2,'Explain evidence','intermediate',$3) v",
        [source, request, plan.pathId],
      )
    ).v;
    await asService(db);
    await db.query(
      "select public.finish_learning_preview($1,$2,$3,'Explain evidence',$4,'gpt-6-luna')",
      [
        request,
        claim.lease_token,
        JSON.stringify({
          suggested_goal: "Explain evidence",
          paths: [planContent],
        }),
        JSON.stringify(passages),
      ],
    );
    await learner(db);
    const revised = (
      await one<{ v: { plans: { id: string; request_id: string }[] } }>(
        db,
        "select public.get_source_learning($1) v",
        [source],
      )
    ).v.plans.find((item) => item.request_id === request);
    await db.query("select public.confirm_learning_plan($1)", [revised?.id]);
    await assert.rejects(
      requestGeneration(db, plan, crypto.randomUUID()),
      /quiz_plan_not_current/,
    );
    assert.equal(
      (await requestGeneration(db, plan, created.requestId)).replay,
      true,
    );
    assert.equal((await quizState(db, plan)).plan.is_active, false);
    // Changed evidence blocks new keys only; the replay still succeeds.
    await asSuperuser(db);
    await db.query("update public.sources set source_version=2 where id=$1", [
      source,
    ]);
    await learner(db);
    await assert.rejects(
      requestGeneration(db, plan, crypto.randomUUID()),
      /quiz_plan_not_current|quiz_evidence_changed/,
    );
    assert.equal(
      (await requestGeneration(db, plan, created.requestId)).replay,
      true,
    );
    assert.equal((await quizState(db, plan)).plan.evidence_current, false);
  } finally {
    await db.close();
  }
});

test("generation caps: 20 ready quizzes, 10 failed rows a day, old failed rows are deleted, a limit failure deletes its row", async () => {
  const db = await quizDatabase();
  try {
    const plan = await confirmedPlan(db);
    await asSuperuser(db);
    const failed = (count: number, age: string) =>
      db.query(
        `insert into public.quizzes(user_id,request_id,plan_id,status,source_version,created_at) select $1,gen_random_uuid(),$2,'failed',1,now()-interval '${age}' from generate_series(1,$3::int)`,
        [alice, plan.planId, count],
      );
    await failed(10, "1 minute");
    await assert.rejects(
      requestGeneration(db, plan),
      /quiz_generation_attempts_capped/,
    );
    await asSuperuser(db);
    await db.query("delete from public.quizzes");
    await failed(9, "1 minute");
    const ok = await requestGeneration(db, plan);
    assert.equal(ok.replay, false);
    await asSuperuser(db);
    await db.query("delete from public.quizzes");
    await failed(3, "3 days");
    await requestGeneration(db, plan);
    await asSuperuser(db);
    assert.equal(
      (
        await one<{ n: number }>(
          db,
          "select count(*)::int n from public.quizzes where status='failed'",
        )
      ).n,
      0,
    );
    // A denied charge removes its own row.
    await db.query("delete from public.quizzes");
    const claim = await requestGeneration(db, plan);
    await asService(db);
    assert.equal(
      (
        await one<{ v: boolean }>(
          db,
          "select public.fail_quiz_generation($1,$2,'limit',false) v",
          [claim.quiz_id, claim.lease_token],
        )
      ).v,
      true,
    );
    await asSuperuser(db);
    assert.equal(
      (
        await one<{ n: number }>(
          db,
          "select count(*)::int n from public.quizzes",
        )
      ).n,
      0,
    );
    // 20 failed rows never raise the ready-quiz cap; only the daily failed-row cap applies.
    await failed(20, "1 minute");
    await assert.rejects(
      requestGeneration(db, plan),
      (error: Error) =>
        /quiz_generation_attempts_capped/.test(error.message) &&
        !/quiz_plan_cap_reached/.test(error.message),
    );
    await asSuperuser(db);
    await db.query("delete from public.quizzes");
    await db.query(
      "insert into public.quizzes(user_id,request_id,plan_id,status,source_version,model,question_count,generated_at) select $1,gen_random_uuid(),$2,'ready',1,'gpt-6-luna',7,now() from generate_series(1,20)",
      [alice, plan.planId],
    );
    await assert.rejects(requestGeneration(db, plan), /quiz_plan_cap_reached/);
  } finally {
    await db.close();
  }
});

test("the daily counter allows up to the limit, never over it, and keeps kinds and users apart", async () => {
  const db = await quizDatabase();
  try {
    const seen = [];
    for (let i = 0; i < 3; i++)
      seen.push(await consume(db, alice, "generation", 3));
    assert.deepEqual(
      seen.map((item) => [item.allowed, item.used]),
      [
        [true, 1],
        [true, 2],
        [true, 3],
      ],
    );
    for (let i = 0; i < 4; i++) {
      const denied = await consume(db, alice, "generation", 3);
      assert.deepEqual([denied.allowed, denied.used], [false, 3]);
    }
    assert.equal(await usage(db, alice, "generation"), 3);
    const tooBig = await consume(db, alice, "grading", 2, 3);
    assert.deepEqual([tooBig.allowed, tooBig.used], [false, 0]);
    assert.equal(await usage(db, alice, "grading"), 0);
    assert.equal((await consume(db, alice, "grading", 2)).used, 1);
    assert.equal((await consume(db, bob, "generation", 3)).used, 1);
    assert.equal(await usage(db, alice, "generation"), 3);
    for (const args of [
      [alice, "generation", 0, 1],
      [alice, "generation", 1001, 1],
      [alice, "generation", 3, 0],
      [alice, "generation", 3, 11],
      [alice, "other", 3, 1],
      [null, "generation", 3, 1],
    ] as [string | null, string, number, number][])
      await assert.rejects(
        consume(db, ...args),
        /quiz_usage_invalid/,
        JSON.stringify(args),
      );
    assert.equal(
      (await consume(db, bob, "grading", 5)).resets_at,
      nextMidnight(),
    );
  } finally {
    await db.close();
  }
});

test("a charge is idempotent within a lease, repeats for a new lease, and a refund releases exactly once", async () => {
  const db = await quizDatabase();
  try {
    const plan = await confirmedPlan(db);
    const key = crypto.randomUUID();
    const first = await requestGeneration(db, plan, key);
    const charged = await charge(db, first.quiz_id, first.lease_token, 3);
    assert.deepEqual(
      [charged.allowed, charged.used, charged.limit],
      [true, 1, 3],
    );
    assert.equal(charged.resets_at, nextMidnight());
    assert.equal(
      (await charge(db, first.quiz_id, first.lease_token, 3)).used,
      1,
    );
    assert.equal(await usage(db, alice, "generation"), 1);
    const fail = async (
      lease: string | null,
      refund: boolean,
      code = "provider",
    ) => {
      await asService(db);
      return one<{ v: boolean }>(
        db,
        "select public.fail_quiz_generation($1,$2,$3,$4) v",
        [first.quiz_id, lease, code, refund],
      );
    };
    assert.equal((await fail(first.lease_token, false)).v, true);
    assert.equal(await usage(db, alice, "generation"), 1);
    const again = await requestGeneration(db, plan, key);
    assert.notEqual(again.lease_token, first.lease_token);
    assert.equal(
      (await charge(db, first.quiz_id, again.lease_token, 3)).used,
      2,
    );
    assert.equal((await fail(again.lease_token, true)).v, true);
    assert.equal(await usage(db, alice, "generation"), 1);
    assert.equal((await fail(again.lease_token, true)).v, true);
    assert.equal(await usage(db, alice, "generation"), 1);
    // A stale lease cannot charge or fail a live generation.
    const third = await requestGeneration(db, plan, key);
    await assert.rejects(
      charge(db, first.quiz_id, again.lease_token, 3),
      /quiz_lease_lost/,
    );
    assert.equal(
      (await charge(db, first.quiz_id, third.lease_token, 1)).allowed,
      false,
    );
    assert.equal(await usage(db, alice, "generation"), 1);
  } finally {
    await db.close();
  }
});

test("single-connection burst: N plus k charges leave the count at the limit, and one attempt key makes one attempt", async () => {
  await withQuiz(async ({ db, plan, stored, quizId }) => {
    const results = [];
    for (let i = 0; i < 10; i++)
      results.push((await consume(db, alice, "grading", 4)).allowed);
    assert.equal(results.filter(Boolean).length, 4);
    assert.equal(await usage(db, alice, "grading"), 4);
    const questions = (await quizState(db, plan)).quiz?.questions ?? [];
    const answers = answersFor(questions, correctPick(stored));
    const key = crypto.randomUUID();
    const first = await submitAttempt(db, plan, quizId, answers, key);
    assert.equal(first.replay, false);
    await assert.rejects(
      submitAttempt(db, plan, quizId, answers, key),
      /quiz_attempt_in_progress/,
    );
    await assert.rejects(
      submitAttempt(db, plan, quizId, answers, key, "0".repeat(64)),
      /quiz_attempt_conflict/,
    );
    await gradeAttempt(db, plan, first.attempt_id, first.lease_token);
    const replay = await submitAttempt(db, plan, quizId, answers, key);
    assert.deepEqual(replay, {
      attempt_id: first.attempt_id,
      lease_token: null,
      replay: true,
    });
    await assert.rejects(
      submitAttempt(db, plan, quizId, answers, key, "f".repeat(64)),
      /quiz_attempt_conflict/,
    );
    await asSuperuser(db);
    assert.equal(
      (
        await one<{ n: number }>(
          db,
          "select count(*)::int n from public.quiz_attempts",
        )
      ).n,
      1,
    );
    assert.equal(
      (
        await one<{ n: number }>(
          db,
          "select count(*)::int n from public.quiz_attempt_answers",
        )
      ).n,
      stored.questions.length,
    );
  });
});

test("replay after the source changed returns the stored attempt instead of a conflict", async () => {
  await withQuiz(async ({ db, plan, stored, quizId }) => {
    const key = crypto.randomUUID();
    const done = await gradedAttempt(db, plan, stored, quizId, {
      attemptKey: key,
    });
    await asSuperuser(db);
    await db.query("update public.sources set source_version=2 where id=$1", [
      source,
    ]);
    await learner(db);
    const replay = await submitAttempt(db, plan, quizId, done.answers, key);
    assert.deepEqual(replay, {
      attempt_id: done.attemptId,
      lease_token: null,
      replay: true,
    });
    await assert.rejects(
      submitAttempt(db, plan, quizId, done.answers),
      /quiz_evidence_changed/,
    );
  });
});

test("finish_quiz_generation validates shape, citations and coverage, then flips the current quiz", async () => {
  const db = await quizDatabase();
  try {
    const plan = await confirmedPlan(db);
    const stored = await loadStoredQuiz();
    const claim = await requestGeneration(db, plan);
    const lease = claim.lease_token;
    const mutate = (change: (quiz: StoredQuiz) => void) => {
      const copy = structuredClone(stored);
      change(copy);
      return copy;
    };
    const bad: [string, StoredQuiz][] = [
      [
        "unknown citation",
        mutate((q) => {
          q.key[0].citation_ids = ["p0009"];
        }),
      ],
      [
        "citation from the other lesson",
        mutate((q) => {
          q.key[0].citation_ids = ["p0003"];
        }),
      ],
      [
        "three options on a single choice",
        mutate((q) => {
          q.questions[0].options.pop();
        }),
      ],
      [
        "two correct ids on a single choice",
        mutate((q) => {
          q.key[0].correct_option_ids = ["o1", "o2"];
        }),
      ],
      [
        "four correct ids on a multi-select",
        mutate((q) => {
          q.key[2].correct_option_ids = ["o1", "o2", "o3", "o4"];
        }),
      ],
      [
        "correct id outside the options",
        mutate((q) => {
          q.key[0].correct_option_ids = ["o5"];
        }),
      ],
      [
        "correct ids on a short answer",
        mutate((q) => {
          q.key[5].correct_option_ids = ["o1"];
        }),
      ],
      [
        "criteria on a choice question",
        mutate((q) => {
          q.key[0].criteria = ["a", "b"];
        }),
      ],
      [
        "one criterion on a short answer",
        mutate((q) => {
          q.key[5].criteria = ["only one"];
        }),
      ],
      [
        "no model answer on a short answer",
        mutate((q) => {
          q.key[5].model_answer = null;
        }),
      ],
      [
        "an outcome with fewer than two deterministic questions",
        mutate((q) => {
          q.questions[3].outcome_index = 0;
          q.questions[3].outcome_title = q.outcomes[0].title;
          q.key[3].citation_ids = ["p0001"];
        }),
      ],
      [
        "an answer-key field inside an option",
        mutate((q) => {
          (q.questions[0].options[0] as Record<string, unknown>).is_correct =
            true;
        }),
      ],
      [
        "an extra key on a question",
        mutate((q) => {
          (q.questions[0] as Record<string, unknown>).correct = ["o2"];
        }),
      ],
      [
        "too many questions",
        mutate((q) => {
          for (let i = 7; i < 12; i++) {
            q.questions.push({ ...q.questions[0], position: i });
            q.key.push({ ...q.key[0], position: i });
          }
        }),
      ],
      [
        "too few questions",
        mutate((q) => {
          q.questions = q.questions.slice(0, 3);
          q.key = q.key.slice(0, 3);
        }),
      ],
      [
        "positions that are not contiguous",
        mutate((q) => {
          q.questions[6].position = 8;
          q.key[6].position = 8;
        }),
      ],
      [
        "an outcome index outside the snapshot",
        mutate((q) => {
          q.questions[0].outcome_index = 3;
        }),
      ],
      [
        "more than two short answers",
        mutate((q) => {
          q.questions[0].kind = "short_answer";
          q.questions[0].options = [];
          q.key[0] = { ...q.key[5], position: 0 };
        }),
      ],
    ];
    for (const [name, quiz] of bad)
      await assert.rejects(
        finishGeneration(db, claim.quiz_id, lease, quiz),
        /quiz_invalid_output/,
        name,
      );
    await assert.rejects(
      finishGeneration(db, claim.quiz_id, crypto.randomUUID(), stored),
      /quiz_lease_lost/,
    );
    assert.equal(
      await finishGeneration(db, claim.quiz_id, lease, stored),
      true,
    );
    await asSuperuser(db);
    const row = await one<{
      status: string;
      is_current: boolean;
      question_count: number;
      model: string;
    }>(
      db,
      "select status,is_current,question_count,model from public.quizzes where id=$1",
      [claim.quiz_id],
    );
    assert.deepEqual(row, {
      status: "ready",
      is_current: true,
      question_count: 7,
      model: "gpt-6-luna",
    });
    assert.equal(
      (
        await one<{ n: number }>(
          db,
          "select count(*)::int n from public.quiz_question_keys",
        )
      ).n,
      7,
    );
    // A regenerated quiz becomes current and demotes the earlier one.
    const second = await createReadyQuiz(db, plan, stored, {
      regenerate: true,
    });
    await asSuperuser(db);
    const flags = await db.query<{ id: string; is_current: boolean }>(
      "select id,is_current from public.quizzes order by created_at",
    );
    assert.deepEqual(
      flags.rows.map((item) => item.is_current),
      [false, true],
    );
    assert.equal(flags.rows[1].id, second.quizId);
    // A stale plan is reported as false, not stored.
    await learner(db);
    const stale = await requestGeneration(db, plan, crypto.randomUUID(), true);
    await asSuperuser(db);
    await db.query("update public.sources set source_version=2 where id=$1", [
      source,
    ]);
    assert.equal(
      await finishGeneration(db, stale.quiz_id, stale.lease_token, stored),
      false,
    );
  } finally {
    await db.close();
  }
});

test("attempts validate answers against the quiz, grade under a lease and only then reveal the key", async () => {
  await withQuiz(async ({ db, plan, stored, quizId }) => {
    const second = await createReadyQuiz(db, plan, stored, {
      regenerate: true,
    });
    const current = (await quizState(db, plan)).quiz;
    assert.equal(current?.id, second.quizId);
    await asSuperuser(db);
    const oldQuestions = (
      await db.query<{ id: string; kind: string; position: number }>(
        "select id,kind,position from public.quiz_questions where quiz_id=$1 order by position",
        [quizId],
      )
    ).rows;
    const newQuestions = current?.questions ?? [];
    const answer = (
      question: { id: string; kind: string },
      body: Record<string, unknown>,
    ) => ({ question_id: question.id, kind: question.kind, answer: body });
    const invalid: [string, unknown[]][] = [
      ["question of another quiz", [answer(newQuestions[0], {})]],
      [
        "unknown question",
        [
          {
            question_id: crypto.randomUUID(),
            kind: "single_choice",
            answer: {},
          },
        ],
      ],
      [
        "duplicate question",
        [answer(oldQuestions[0], {}), answer(oldQuestions[0], {})],
      ],
      [
        "kind mismatch",
        [{ question_id: oldQuestions[0].id, kind: "true_false", answer: {} }],
      ],
      [
        "option outside the question",
        [answer(oldQuestions[0], { option_ids: ["o9"] })],
      ],
      [
        "two options for a single choice",
        [answer(oldQuestions[0], { option_ids: ["o1", "o2"] })],
      ],
      ["text too long", [answer(oldQuestions[5], { text: "x".repeat(5001) })]],
      ["not an array", {} as unknown as unknown[]],
    ];
    await learner(db);
    for (const [name, answers] of invalid)
      await assert.rejects(
        submitAttempt(db, plan, quizId, answers),
        /quiz_answer_invalid/,
        name,
      );
    // Unknown keys never reach the stored answer; unanswered and omitted questions are stored as {}.
    const claim = await submitAttempt(db, plan, quizId, [
      answer(oldQuestions[0], {
        option_ids: ["o2"],
        is_correct: true,
        junk: 1,
      }),
      answer(oldQuestions[5], { text: "  ", extra: "x" }),
    ]);
    await asSuperuser(db);
    const storedRows = (
      await db.query<{ position: number; answer: unknown }>(
        "select q.position,a.answer from public.quiz_attempt_answers a join public.quiz_questions q on q.id=a.question_id where a.attempt_id=$1 order by q.position",
        [claim.attempt_id],
      )
    ).rows;
    assert.deepEqual(
      storedRows.map((row) => row.answer),
      [{ option_ids: ["o2"] }, {}, {}, {}, {}, {}, {}],
    );
    // Before grading the attempt exposes no result, signal or reveal.
    await learner(db);
    const before = (
      await one<{
        v: {
          attempt: { status: string };
          answers: { result: unknown; signal: unknown; reveal: unknown }[];
        };
      }>(db, "select public.get_quiz_attempt($1,$2,$3) v", [
        plan.collectionId,
        plan.planId,
        claim.attempt_id,
      ])
    ).v;
    assert.equal(before.attempt.status, "grading");
    assert.ok(
      before.answers.every(
        (row) =>
          row.result === null && row.signal === null && row.reveal === null,
      ),
    );
    // The key is released only to the backend, under a live lease for a stored attempt.
    await assert.rejects(
      db.query("select public.get_quiz_grading_context($1,$2)", [
        claim.attempt_id,
        claim.lease_token,
      ]),
      /permission denied/,
    );
    await asService(db);
    for (const lease of [null, crypto.randomUUID()])
      await assert.rejects(
        db.query("select public.get_quiz_grading_context($1,$2)", [
          claim.attempt_id,
          lease,
        ]),
        /quiz_lease_lost/,
      );
    await asSuperuser(db);
    await db.query(
      "update public.quiz_attempts set lease_until=now()-interval '1 second' where id=$1",
      [claim.attempt_id],
    );
    await asService(db);
    await assert.rejects(
      db.query("select public.get_quiz_grading_context($1,$2)", [
        claim.attempt_id,
        claim.lease_token,
      ]),
      /quiz_lease_lost/,
    );
    // An expired lease is reclaimed through the learner call.
    await learner(db);
    const healed = (
      await one<{ v: { lease_token: string; replay: boolean } }>(
        db,
        "select public.claim_quiz_attempt_grading($1,$2,$3) v",
        [plan.collectionId, plan.planId, claim.attempt_id],
      )
    ).v;
    assert.equal(healed.replay, false);
    assert.notEqual(healed.lease_token, claim.lease_token);
    await asService(db);
    const context = (
      await one<{
        v: {
          questions: {
            correct_option_ids: string[] | null;
            kind: string;
            answer: { option_ids?: string[]; text?: string };
          }[];
        };
      }>(db, "select public.get_quiz_grading_context($1,$2) v", [
        claim.attempt_id,
        healed.lease_token,
      ])
    ).v;
    assert.equal(context.questions.length, 7);
    assert.deepEqual(context.questions[0].correct_option_ids, ["o2"]);
    // finish_quiz_attempt checks the supplied count against the rows.
    const graded = gradeContext(context.questions as never);
    assert.equal(graded.correct_count, 1);
    await assert.rejects(
      db.query("select public.finish_quiz_attempt($1,$2,$3)", [
        claim.attempt_id,
        healed.lease_token,
        JSON.stringify({ ...graded, correct_count: 2 }),
      ]),
      /quiz_invalid_output/,
    );
    await assert.rejects(
      db.query("select public.finish_quiz_attempt($1,$2,$3)", [
        claim.attempt_id,
        healed.lease_token,
        JSON.stringify({ ...graded, results: graded.results.slice(1) }),
      ]),
      /quiz_invalid_output/,
    );
    await db.query("select public.finish_quiz_attempt($1,$2,$3)", [
      claim.attempt_id,
      healed.lease_token,
      JSON.stringify(graded),
    ]);
    await learner(db);
    const after = (
      await one<{
        v: {
          attempt: { status: string; correct: number };
          answers: {
            result: string;
            signal: string;
            reveal: { explanation: string } | null;
            grading_state: string;
            position: number;
          }[];
        };
      }>(db, "select public.get_quiz_attempt($1,$2,$3) v", [
        plan.collectionId,
        plan.planId,
        claim.attempt_id,
      ])
    ).v;
    assert.deepEqual(
      [after.attempt.status, after.attempt.correct],
      ["graded", 1],
    );
    assert.deepEqual(
      after.answers.map((row) => row.position),
      [0, 1, 2, 3, 4, 5, 6],
    );
    assert.equal(after.answers[0].result, "correct");
    assert.ok(
      after.answers.every((row) => row.reveal && row.reveal.explanation),
    );
    // A blank short answer is unanswered, negative and never sent to the model.
    const blank = after.answers[5];
    assert.deepEqual(
      [blank.result, blank.signal, blank.grading_state],
      ["unanswered", "negative", "not_applicable"],
    );
    await assert.rejects(
      db.query("select public.claim_quiz_short_answer($1,$2,$3,$4)", [
        plan.collectionId,
        plan.planId,
        claim.attempt_id,
        oldQuestions[5].id,
      ]),
      /quiz_answer_invalid/,
    );
    // Composite foreign keys keep an answer inside its own quiz.
    await asSuperuser(db);
    await assert.rejects(
      db.query(
        "insert into public.quiz_attempt_answers(attempt_id,question_id,user_id,quiz_id,kind,outcome_index,answer) values($1,$2,$3,$4,'single_choice',0,'{}')",
        [claim.attempt_id, newQuestions[0].id, alice, quizId],
      ),
      /foreign key/,
    );
  });
});

test("the twenty-first attempt on a quiz is refused", async () => {
  await withQuiz(async ({ db, plan, quizId }) => {
    for (let i = 0; i < 20; i++) await submitAttempt(db, plan, quizId, []);
    await assert.rejects(
      submitAttempt(db, plan, quizId, []),
      /quiz_attempt_limit_reached/,
    );
    const other = await createReadyQuiz(db, plan, await loadStoredQuiz(), {
      regenerate: true,
    });
    assert.equal(
      (await submitAttempt(db, plan, other.quizId, [])).replay,
      false,
    );
  });
});

test("the public state never contains answer-key text", async () => {
  await withQuiz(async ({ db, plan, stored }) => {
    const secrets = stored.key
      .flatMap((key) => [
        key.explanation,
        key.model_answer,
        ...(key.criteria ?? []),
      ])
      .filter((item): item is string => Boolean(item));
    assert.ok(secrets.length >= 9);
    const texts = [
      (
        await one<{ t: string }>(
          db,
          "select public.get_quiz_state($1,$2)::text t",
          [plan.collectionId, plan.planId],
        )
      ).t,
      (
        await one<{ t: string }>(
          db,
          "select public.get_quiz_state($1,$2,true)::text t",
          [plan.collectionId, plan.planId],
        )
      ).t,
      JSON.stringify(
        (await db.query("select to_jsonb(q) j from public.quiz_questions q"))
          .rows,
      ),
      JSON.stringify(
        (await db.query("select to_jsonb(z) j from public.quizzes z")).rows,
      ),
    ];
    for (const text of texts)
      for (const secret of secrets) assert.ok(!text.includes(secret), secret);
    // The plan material legitimately has its own lesson fields, so field names are checked on the public rows only.
    for (const text of [texts[0], texts[2], texts[3]])
      for (const field of [
        "correct_option_ids",
        "is_correct",
        "model_answer",
        "criteria",
      ])
        assert.ok(!text.includes(field), field);
  });
});

test("removing the source deletes keys and question text but keeps scores and results", async () => {
  await withQuiz(async ({ db, plan, stored, quizId }) => {
    const done = await gradedAttempt(db, plan, stored, quizId);
    await learner(db);
    await db.query("delete from public.sources where id=$1", [source]);
    await asSuperuser(db);
    assert.equal(
      (
        await one<{ n: number }>(
          db,
          "select count(*)::int n from public.quiz_question_keys",
        )
      ).n,
      0,
    );
    const questions = (
      await db.query<{
        prompt: string | null;
        options: unknown;
        redacted: boolean;
      }>("select prompt,options,redacted from public.quiz_questions")
    ).rows;
    assert.ok(
      questions.length === 7 &&
        questions.every(
          (row) => row.prompt === null && row.options === null && row.redacted,
        ),
    );
    const answers = (
      await db.query<{
        reveal: unknown;
        feedback: unknown;
        redacted: boolean;
        result: string | null;
      }>(
        "select reveal,feedback,redacted,result from public.quiz_attempt_answers",
      )
    ).rows;
    assert.ok(
      answers.every(
        (row) => row.reveal === null && row.feedback === null && row.redacted,
      ),
    );
    assert.equal(answers.filter((row) => row.result === "correct").length, 5);
    assert.equal(
      (
        await one<{ correct_count: number }>(
          db,
          "select correct_count from public.quiz_attempts where id=$1",
          [done.attemptId],
        )
      ).correct_count,
      5,
    );
    assert.notEqual(
      (
        await one<{ redacted_at: string | null }>(
          db,
          "select redacted_at from public.quizzes where id=$1",
          [quizId],
        )
      ).redacted_at,
      null,
    );
    await learner(db);
    const state = await quizState(db, plan);
    assert.deepEqual(
      [state.quiz?.redacted, state.plan.evidence_current],
      [true, false],
    );
    const attempt = (
      await one<{
        v: {
          attempt: { correct: number };
          answers: {
            redacted: boolean;
            prompt: string | null;
            reveal: unknown;
            result: string | null;
          }[];
        };
      }>(db, "select public.get_quiz_attempt($1,$2,$3) v", [
        plan.collectionId,
        plan.planId,
        done.attemptId,
      ])
    ).v;
    assert.equal(attempt.attempt.correct, 5);
    assert.ok(
      attempt.answers.every(
        (row) => row.redacted && row.prompt === null && row.reveal === null,
      ),
    );
    assert.equal(
      attempt.answers.filter((row) => row.result === "correct").length,
      5,
    );
    await assert.rejects(
      submitAttempt(db, plan, quizId, []),
      /quiz_evidence_changed/,
    );
  });
});

test("rollback refuses while attempts exist, then removes every quiz object and the migration re-applies", async () => {
  await withQuiz(async ({ db, plan, stored, quizId }) => {
    await gradedAttempt(db, plan, stored, quizId);
    const rollback = await readFile(rollbackFile, "utf8");
    await asSuperuser(db);
    await assert.rejects(
      db.exec(rollback),
      /Export quiz attempts before rollback/,
    );
    await db.exec("rollback");
    assert.equal(
      (
        await one<{ n: number }>(
          db,
          "select count(*)::int n from public.quizzes",
        )
      ).n,
      1,
    );
    await db.exec("delete from public.quiz_attempts");
    await db.exec(rollback);
    const left = await one<{
      functions: number;
      tables: number;
      triggers: number;
    }>(
      db,
      "select (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like '%quiz%')::int functions,(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname like 'quiz%')::int tables,(select count(*) from pg_trigger where tgname='quiz_source_removed')::int triggers",
    );
    assert.deepEqual(left, { functions: 0, tables: 0, triggers: 0 });
    await db.exec(await readFile(migrationFile, "utf8"));
    const again = await one<{ functions: number }>(
      db,
      "select count(*)::int functions from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like '%quiz%'",
    );
    assert.equal(again.functions, 19);
    assert.equal(
      (
        await one<{ n: number }>(
          db,
          "select count(*)::int n from public.quizzes",
        )
      ).n,
      0,
    );
  });
});

test("size limits: a 5,000-emoji answer and a CJK key round-trip, and 5,001 characters are refused", async () => {
  const db = await quizDatabase();
  try {
    const plan = await confirmedPlan(db);
    const stored = await loadStoredQuiz();
    stored.key[5].explanation = "漢".repeat(800);
    stored.key[5].model_answer = "漢".repeat(800);
    stored.key[5].criteria = [1, 2, 3, 4].map(() => "漢".repeat(300));
    const created = await createReadyQuiz(db, plan, stored);
    const questions = (await quizState(db, plan)).quiz?.questions ?? [];
    const pick = correctPick(stored, "😀".repeat(5000));
    const claim = await submitAttempt(
      db,
      plan,
      created.quizId,
      answersFor(questions, pick),
    );
    await asSuperuser(db);
    const length = await one<{ n: number }>(
      db,
      "select char_length(answer->>'text')::int n from public.quiz_attempt_answers where attempt_id=$1 and kind='short_answer' and answer<>'{}'::jsonb limit 1",
      [claim.attempt_id],
    );
    assert.equal(length.n, 5000);
    await gradeAttempt(db, plan, claim.attempt_id, claim.lease_token);
    await learner(db);
    await assert.rejects(
      submitAttempt(
        db,
        plan,
        created.quizId,
        answersFor(questions, correctPick(stored, "😀".repeat(5001))),
      ),
      /quiz_answer_invalid/,
    );
  } finally {
    await db.close();
  }
});

test("short-answer budget: limit denials keep the tries, three provider tries exhaust, a refund returns the try", async () => {
  await withQuiz(async ({ db, plan, stored, quizId }) => {
    const done = await gradedAttempt(db, plan, stored, quizId);
    const question = done.questions[5].id;
    const claim = async () => {
      await learner(db);
      return (
        await one<{ v: { lease_token: string | null; grading_state: string } }>(
          db,
          "select public.claim_quiz_short_answer($1,$2,$3,$4) v",
          [plan.collectionId, plan.planId, done.attemptId, question],
        )
      ).v;
    };
    const chargeGrading = async (lease: string | null, limit = 20) => {
      await asService(db);
      return (
        await one<{ v: { allowed: boolean; used: number } }>(
          db,
          "select public.charge_quiz_grading($1,$2,$3,$4) v",
          [done.attemptId, question, lease, limit],
        )
      ).v;
    };
    const finish = async (
      lease: string | null,
      reason: string,
      refund = false,
    ) => {
      await asService(db);
      return (
        await one<{ v: boolean }>(
          db,
          "select public.finish_quiz_short_answer($1,$2,$3,null,null,$4,$5) v",
          [done.attemptId, question, lease, reason, refund],
        )
      ).v;
    };
    const row = async () => {
      await asSuperuser(db);
      return one<{
        grading_state: string;
        unavailable_reason: string | null;
        grading_attempts: number;
      }>(
        db,
        "select grading_state,unavailable_reason,grading_attempts from public.quiz_attempt_answers where attempt_id=$1 and question_id=$2",
        [done.attemptId, question],
      );
    };
    assert.equal((await claim()).grading_state, "pending");
    await asSuperuser(db);
    await db.query(
      "update public.quiz_attempt_answers set grading_lease_until=null,grading_lease_token=null where attempt_id=$1 and question_id=$2",
      [done.attemptId, question],
    );
    // Three limit denials never use up a try.
    await consume(db, alice, "grading", 1);
    for (let i = 0; i < 3; i++) {
      const lease = (await claim()).lease_token;
      assert.equal((await chargeGrading(lease, 1)).allowed, false);
      assert.equal(await finish(lease, "limit"), true);
      assert.deepEqual(await row(), {
        grading_state: "unavailable",
        unavailable_reason: "limit",
        grading_attempts: 0,
      });
    }
    // After the reset the same answer is admitted and charged.
    await asSuperuser(db);
    await db.query(
      "delete from public.quiz_usage_counters where kind='grading'",
    );
    for (let tries = 1; tries <= 3; tries++) {
      const lease = (await claim()).lease_token;
      assert.equal((await chargeGrading(lease)).allowed, true);
      assert.equal((await row()).grading_attempts, tries);
      assert.equal(await finish(lease, "provider"), true);
    }
    await assert.rejects(claim(), /quiz_grading_exhausted/);
    // A refunded charge returns the try and the counter unit.
    const other = await gradedAttempt(db, plan, stored, quizId);
    const otherQuestion = other.questions[5].id;
    await learner(db);
    const lease = (
      await one<{ v: { lease_token: string } }>(
        db,
        "select public.claim_quiz_short_answer($1,$2,$3,$4) v",
        [plan.collectionId, plan.planId, other.attemptId, otherQuestion],
      )
    ).v.lease_token;
    const before = await usage(db, alice, "grading");
    await asService(db);
    await db.query("select public.charge_quiz_grading($1,$2,$3,20)", [
      other.attemptId,
      otherQuestion,
      lease,
    ]);
    assert.equal(await usage(db, alice, "grading"), before + 1);
    await asService(db);
    await db.query(
      "select public.finish_quiz_short_answer($1,$2,$3,null,null,'provider',true)",
      [other.attemptId, otherQuestion, lease],
    );
    assert.equal(await usage(db, alice, "grading"), before);
    await asSuperuser(db);
    assert.equal(
      (
        await one<{ grading_attempts: number }>(
          db,
          "select grading_attempts from public.quiz_attempt_answers where attempt_id=$1 and question_id=$2",
          [other.attemptId, otherQuestion],
        )
      ).grading_attempts,
      0,
    );
  });
});

test("finish_quiz_short_answer accepts exactly the shared short-answer cases and rejects mismatches", async () => {
  await withQuiz(async ({ db, plan, stored, quizId }) => {
    const cases = (await loadShortAnswerCases()).filter((item) => item.sql);
    assert.ok(cases.length >= 8);
    for (const item of cases) {
      const done = await gradedAttempt(db, plan, stored, quizId);
      const target = done.questions[item.assessments.length === 2 ? 5 : 6];
      const citation = item.assessments.length === 2 ? "p0002" : "p0003";
      await learner(db);
      const lease = (
        await one<{ v: { lease_token: string } }>(
          db,
          "select public.claim_quiz_short_answer($1,$2,$3,$4) v",
          [plan.collectionId, plan.planId, done.attemptId, target.id],
        )
      ).v.lease_token;
      const feedback = (
        result: string,
        signal: string,
        assessments = item.assessments,
      ) => ({
        summary: "A short summary.",
        next_hint: "A hint.",
        criteria: assessments.map((assessment, index) => ({
          criterion_index: index,
          assessment,
          observation: "An observation.",
          citation_ids: [citation],
        })),
        result,
        signal,
      });
      const finish = async (body: unknown) => {
        await asService(db);
        return db.query(
          "select public.finish_quiz_short_answer($1,$2,$3,$4,'gpt-6-luna',null,false)",
          [done.attemptId, target.id, lease, JSON.stringify(body)],
        );
      };
      const otherResult =
        item.result === "addressed" ? "needs_review" : "addressed";
      await assert.rejects(
        finish(feedback(otherResult, item.signal)),
        /quiz_invalid_output/,
        item.name,
      );
      await assert.rejects(
        finish(
          feedback(
            item.result,
            item.signal === "neutral" ? "positive" : "neutral",
          ),
        ),
        /quiz_invalid_output/,
        item.name,
      );
      await assert.rejects(
        finish(feedback(item.result, item.signal, item.assessments.slice(1))),
        /quiz_invalid_output/,
        item.name,
      );
      await assert.rejects(
        finish({
          ...feedback(item.result, item.signal),
          criteria: feedback(item.result, item.signal).criteria.map(
            (entry) => ({ ...entry, citation_ids: ["p0001"] }),
          ),
        }),
        /quiz_invalid_output/,
        item.name,
      );
      await finish(feedback(item.result, item.signal));
      await asSuperuser(db);
      const storedRow = await one<{
        grading_state: string;
        result: string;
        signal: string;
        grading_source: string;
      }>(
        db,
        "select grading_state,result,signal,grading_source from public.quiz_attempt_answers where attempt_id=$1 and question_id=$2",
        [done.attemptId, target.id],
      );
      assert.deepEqual(
        storedRow,
        {
          grading_state: "graded",
          result: item.result,
          signal: item.signal,
          grading_source: "model",
        },
        item.name,
      );
    }
    await asService(db);
    await assert.rejects(
      db.query(
        "select public.finish_quiz_short_answer($1,$2,$3,null,null,null,false)",
        [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()],
      ),
      /quiz_lease_lost/,
    );
  });
});
