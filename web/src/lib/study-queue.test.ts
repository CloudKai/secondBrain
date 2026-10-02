import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const alice = "11111111-1111-4111-8111-111111111111";
const sourceId = "33333333-3333-4333-8333-333333333333";
const text =
  "Calculus describes change. Derivatives measure instantaneous rates and integrals accumulate contributions. ".repeat(
    3,
  );

async function database() {
  const db = new PGlite();
  try {
    await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users (id uuid primary key);
    insert into auth.users values ('${alice}');
    create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
    grant usage on schema auth to authenticated, service_role;
  `);
    for (const file of [
      "202610020001_browser_sources.sql",
      "202610030002_source_studies.sql",
    ]) {
      await db.exec(
        await readFile(
          new URL(`../../../supabase/migrations/${file}`, import.meta.url),
          "utf8",
        ),
      );
    }
    await db.exec(
      `set role authenticated; select set_config('request.jwt.claim.sub', '${alice}', false)`,
    );
    await db.query(
      `insert into public.sources
    (id,user_id,original_url,canonical_url,title,captured_text,capture_origin,coverage,coverage_detail)
    values ($1,$2,'https://example.com/calculus','https://example.com/calculus','Calculus',$3,'direct','complete','Readable page text')`,
      [sourceId, alice, text],
    );
    return db;
  } catch (error) {
    await db.close();
    throw error;
  }
}

test("an accepted study request atomically persists one note job and its dispatch", async () => {
  const db = await database();
  try {
    const first = await db.query<{
      study: { status: string; source_id: string };
    }>("select public.request_source_study($1) as study", [sourceId]);
    assert.equal(first.rows[0].study.status, "queued");
    assert.equal(first.rows[0].study.source_id, sourceId);
    await db.query("select public.request_source_study($1)", [sourceId]);
    assert.equal(
      (await db.query("select source_id from public.source_studies")).rows
        .length,
      1,
    );
    await assert.rejects(db.query("select * from public.study_outbox"));
    await db.exec("reset role; set role service_role");
    assert.deepEqual(
      (await db.query("select source_id from public.study_outbox")).rows,
      [{ source_id: sourceId }],
    );
  } finally {
    await db.close();
  }
});

test("a worker claims once and completes a persistent note without duplicate work", async () => {
  const db = await database();
  try {
    await db.query("select public.request_source_study($1)", [sourceId]);
    await db.exec("reset role; set role service_role");
    const due = await db.query(
      "select source_id from public.due_study_dispatches()",
    );
    assert.deepEqual(due.rows, [{ source_id: sourceId }]);
    const claimed = await db.query<{
      claim: { lease_token: string; captured_text: string; attempt: number };
    }>("select public.claim_source_study($1) as claim", [sourceId]);
    assert.equal(claimed.rows[0].claim.captured_text, text);
    assert.equal(claimed.rows[0].claim.attempt, 1);
    assert.equal(
      (
        await db.query<{ claim: null }>(
          "select public.claim_source_study($1) as claim",
          [sourceId],
        )
      ).rows[0].claim,
      null,
    );
    const finished = await db.query<{ accepted: boolean }>(
      "select public.finish_source_study($1,$2,$3::jsonb,null) as accepted",
      [
        sourceId,
        claimed.rows[0].claim.lease_token,
        JSON.stringify({ overview: { text: "Calculus explains change." } }),
      ],
    );
    assert.equal(finished.rows[0].accepted, true);
    await db.exec(
      `reset role; set role authenticated; select set_config('request.jwt.claim.sub','${alice}',false)`,
    );
    const repeated = await db.query<{
      study: { status: string; attempts: number };
    }>("select public.request_source_study($1) as study", [sourceId]);
    assert.equal(repeated.rows[0].study.status, "succeeded");
    assert.equal(repeated.rows[0].study.attempts, 1);
  } finally {
    await db.close();
  }
});

test("failure retries are bounded, explicit retry resets them, and learner writes are denied", async () => {
  const db = await database();
  try {
    await db.query("select public.request_source_study($1)", [sourceId]);
    await assert.rejects(
      db.query("update public.source_studies set status='succeeded'"),
    );
    await assert.rejects(
      db.query("select public.claim_source_study($1)", [sourceId]),
    );
    await db.exec("reset role; set role service_role");
    for (let attempt = 1; attempt <= 3; attempt++) {
      const result = await db.query<{
        claim: { lease_token: string; attempt: number };
      }>("select public.claim_source_study($1) as claim", [sourceId]);
      assert.equal(result.rows[0].claim.attempt, attempt);
      await db.query(
        "select public.finish_source_study($1,$2,null,'provider_unavailable')",
        [sourceId, result.rows[0].claim.lease_token],
      );
      const row = (
        await db.query<{ status: string; note: null }>(
          "select status,note from public.source_studies",
        )
      ).rows[0];
      assert.equal(row.status, attempt === 3 ? "failed" : "queued");
      assert.equal(row.note, null);
      await db.exec(
        "update public.source_studies set next_attempt_at=now(); update public.study_outbox set next_delivery_at=now()",
      );
    }
    assert.equal(
      (await db.query("select * from public.study_outbox")).rows.length,
      0,
    );
    await db.exec(
      `reset role; set role authenticated; select set_config('request.jwt.claim.sub','${alice}',false)`,
    );
    const result = await db.query<{
      study: { status: string; attempts: number };
    }>("select public.request_source_study($1,true) as study", [sourceId]);
    assert.equal(result.rows[0].study.status, "queued");
    assert.equal(result.rows[0].study.attempts, 0);
    await db.exec("reset role; set role service_role");
    assert.equal(
      (await db.query("select * from public.study_outbox")).rows.length,
      1,
    );
  } finally {
    await db.close();
  }
});

test("lost dispatches and expired workers recover while late completions and other owners are fenced", async () => {
  const db = await database();
  try {
    await db.query("select public.request_source_study($1)", [sourceId]);
    await db.exec("reset role; set role service_role");
    await db.query("select public.ack_study_dispatch($1)", [sourceId]);
    await db.exec(
      "update public.study_outbox set next_delivery_at=now()-interval '1 second'",
    );
    assert.equal(
      (await db.query("select * from public.due_study_dispatches()")).rows
        .length,
      1,
    );
    const old = (
      await db.query<{ claim: { lease_token: string } }>(
        "select public.claim_source_study($1) as claim",
        [sourceId],
      )
    ).rows[0].claim;
    await db.exec(
      "update public.source_studies set lease_until=now()-interval '1 second'",
    );
    assert.equal(
      (await db.query("select * from public.due_study_dispatches()")).rows
        .length,
      1,
    );
    const next = (
      await db.query<{ claim: { lease_token: string; attempt: number } }>(
        "select public.claim_source_study($1) as claim",
        [sourceId],
      )
    ).rows[0].claim;
    assert.equal(next.attempt, 2);
    assert.notEqual(next.lease_token, old.lease_token);
    const late = await db.query<{ accepted: boolean }>(
      "select public.finish_source_study($1,$2,null,'timeout') as accepted",
      [sourceId, old.lease_token],
    );
    assert.equal(late.rows[0].accepted, false);
    await db.exec(
      "reset role; set role authenticated; select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false)",
    );
    assert.equal(
      (await db.query("select * from public.source_studies")).rows.length,
      0,
    );
    await assert.rejects(
      db.query("select public.request_source_study($1,true)", [sourceId]),
    );
    await db.exec(
      `select set_config('request.jwt.claim.sub','${alice}',false)`,
    );
    await db.query("delete from public.sources where id=$1", [sourceId]);
    await db.exec("reset role; set role service_role");
    assert.equal(
      (await db.query("select * from public.study_outbox")).rows.length,
      0,
    );
    assert.equal(
      (
        await db.query<{ accepted: boolean }>(
          "select public.finish_source_study($1,$2,null,'timeout') as accepted",
          [sourceId, next.lease_token],
        )
      ).rows[0].accepted,
      false,
    );
  } finally {
    await db.close();
  }
});

test("the study rollback removes jobs and notes while preserving article captures", async () => {
  const db = await database();
  try {
    await db.query("select public.request_source_study($1)", [sourceId]);
    await db.exec("reset role");
    await db.exec(
      await readFile(
        new URL(
          "../../../supabase/rollbacks/202610030002_source_studies.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    assert.equal(
      (await db.query("select id from public.sources")).rows.length,
      1,
    );
    await assert.rejects(db.query("select * from public.source_studies"));
  } finally {
    await db.close();
  }
});
