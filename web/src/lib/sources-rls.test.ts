import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";

test("Postgres isolates saved sources between authenticated anonymous learners", async () => {
  const db = new PGlite();
  try {
    // Supabase supplies these auth roles/functions. The real source migration
    // runs unchanged in this local Postgres runtime.
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create table auth.users (id uuid primary key);
      insert into auth.users values ('${alice}'), ('${bob}');
      create function auth.uid() returns uuid language sql stable as
        $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
      grant usage on schema auth to authenticated;
    `);
    await db.exec(await readFile(
      new URL("../../../supabase/migrations/202610020001_browser_sources.sql", import.meta.url),
      "utf8",
    ));
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${alice}', false)`);
    await db.query(`insert into public.sources
      (user_id, original_url, canonical_url, title, captured_text, capture_origin, coverage, coverage_detail)
      values ($1, 'https://example.com/article', 'https://example.com/article', 'Calculus', $2, 'direct', 'complete', 'Readable page text')`,
      [alice, "An article about learning calculus and understanding changes. ".repeat(4)],
    );
    const own = await db.query<{ title: string }>("select title from public.sources");
    assert.deepEqual(own.rows, [{ title: "Calculus" }]);
    await db.exec(`select set_config('request.jwt.claim.sub', '${bob}', false)`);
    assert.deepEqual((await db.query("select title from public.sources")).rows, []);
    await assert.rejects(db.query(`insert into public.sources
      (user_id, original_url, canonical_url, title, captured_text, capture_origin, coverage, coverage_detail)
      values ($1, 'https://example.com/other', 'https://example.com/other', 'Forged source', $2, 'direct', 'complete', 'Text')`,
      [alice, "An attempted source assigned to another learner. ".repeat(4)],
    ));
    assert.deepEqual((await db.query("delete from public.sources returning id")).rows, []);
    await db.exec(`select set_config('request.jwt.claim.sub', '${alice}', false)`);
    await assert.rejects(db.query("update public.sources set title = 'Rewritten capture'"));
    assert.equal((await db.query("delete from public.sources returning id")).rows.length, 1);
    await db.exec("reset role; set role anon");
    await assert.rejects(db.query("select * from public.sources"));
  } finally {
    await db.close();
  }
});
