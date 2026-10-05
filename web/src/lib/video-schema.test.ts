import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("a transcript source is owner-isolated and its worker claim preserves real cue times", async () => {
  const db = new PGlite();
  const owner = "11111111-1111-4111-8111-111111111111",
    other = "22222222-2222-4222-8222-222222222222",
    id = "33333333-3333-4333-8333-333333333333";
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users (id uuid primary key);
      insert into auth.users values ('${owner}'),('${other}');
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated,service_role;`);
    for (const file of [
      "202610020001_browser_sources.sql",
      "202610030002_source_studies.sql",
      "202610030003_pdf_sources.sql",
      "202610030004_video_transcripts.sql",
    ])
      await db.exec(
        await readFile(
          new URL(`../../../supabase/migrations/${file}`, import.meta.url),
          "utf8",
        ),
      );
    const articleId = "44444444-4444-4444-8444-444444444444",
      pdfId = "55555555-5555-4555-8555-555555555555";
    const oldText =
      "Existing learner material is preserved during schema changes. ".repeat(
        3,
      );
    await db.query(
      `insert into public.sources (id,user_id,original_url,canonical_url,title,captured_text,capture_origin,coverage,coverage_detail)
      values ($1,$2,'https://example.com/article','https://example.com/article','Existing article',$3,'pasted','unknown','Supplied text')`,
      [articleId, owner, oldText],
    );
    await db.query(
      `insert into public.sources (id,user_id,original_url,canonical_url,title,captured_text,capture_origin,coverage,coverage_detail,source_kind,document)
      values ($1,$2,null,$3,'Existing PDF',$4,'upload','complete','Selectable text','pdf',$5)`,
      [
        pdfId,
        owner,
        `urn:pdf:sha256:${"a".repeat(64)}`,
        oldText,
        JSON.stringify({
          filename: "existing.pdf",
          page_count: 1,
          pages: [{ page: 1, start: 0, end: oldText.length }],
        }),
      ],
    );
    await db.exec(
      `set role authenticated; select set_config('request.jwt.claim.sub','${owner}',false)`,
    );
    const text =
      "Algebra uses variables to express mathematical relationships. ".repeat(
        3,
      );
    const transcript = {
      provider: "youtube",
      format: "vtt",
      filename: "lecture.vtt",
      segments: [{ start: 0, end: text.length, start_ms: 5250, end_ms: 20500 }],
    };
    await db.query(
      `insert into public.sources (id,user_id,original_url,canonical_url,title,captured_text,capture_origin,coverage,coverage_detail,source_kind,transcript)
      values ($1,$2,'https://youtu.be/aircAruvnKk','https://www.youtube.com/watch?v=aircAruvnKk','Algebra',$3,'upload','unknown','User-supplied transcript','video',$4)`,
      [id, owner, text, JSON.stringify(transcript)],
    );
    await db.query("select public.request_source_study($1)", [id]);
    await db.exec(
      `select set_config('request.jwt.claim.sub','${other}',false)`,
    );
    assert.equal(
      (await db.query("select id from public.sources")).rows.length,
      0,
    );
    await assert.rejects(
      db.query("select public.request_source_study($1)", [id]),
    );
    await assert.rejects(
      db.query("select public.claim_source_study($1)", [id]),
    );
    await db.exec("reset role; set role service_role");
    const claim = await db.query<{
      claim: { transcript: typeof transcript; document: null };
    }>("select public.claim_source_study($1) as claim", [id]);
    assert.deepEqual(claim.rows[0].claim.transcript, transcript);
    assert.equal(claim.rows[0].claim.document, null);
    await db.exec("reset role");
    for (const invalid of [
      { ...transcript, segments: [{ ...transcript.segments[0], start: 1 }] },
      {
        ...transcript,
        segments: [{ ...transcript.segments[0], start_ms: 21000 }],
      },
      { ...transcript, format: "text" },
      { ...transcript, segments: [{ ...transcript.segments[0], extra: true }] },
      {
        ...transcript,
        segments: [{ ...transcript.segments[0], start_ms: null }],
      },
    ])
      assert.equal(
        (
          await db.query<{ valid: boolean }>(
            "select public.valid_video_transcript($1,$2) as valid",
            [JSON.stringify(invalid), text],
          )
        ).rows[0].valid,
        false,
      );
    await db.exec(
      await readFile(
        new URL(
          "../../../supabase/migrations/202610030005_youtube_transcripts.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const retrievedId = "66666666-6666-4666-8666-666666666666";
    const retrieved = { ...transcript, filename: null };
    await db.exec(
      `set role authenticated; select set_config('request.jwt.claim.sub','${owner}',false)`,
    );
    await db.query(
      `insert into public.sources (id,user_id,original_url,canonical_url,title,captured_text,capture_origin,coverage,coverage_detail,source_kind,transcript)
      values ($1,$2,'https://youtu.be/dQw4w9WgXcQ','https://www.youtube.com/watch?v=dQw4w9WgXcQ','Retrieved captions',$3,'direct','unknown','Retrieved English YouTube captions','video',$4)`,
      [retrievedId, owner, text, JSON.stringify(retrieved)],
    );
    await db.query("select public.request_source_study($1)", [retrievedId]);
    await db.exec(
      `select set_config('request.jwt.claim.sub','${other}',false)`,
    );
    assert.equal(
      (await db.query("select id from public.sources")).rows.length,
      0,
    );
    await assert.rejects(
      db.query("select public.request_source_study($1)", [retrievedId]),
    );
    await db.exec("reset role; set role service_role");
    const retrievedClaim = await db.query<{
      claim: { transcript: typeof retrieved };
    }>("select public.claim_source_study($1) as claim", [retrievedId]);
    assert.deepEqual(retrievedClaim.rows[0].claim.transcript, retrieved);
    await db.exec("reset role");
    const youtubeRollback = await readFile(
      new URL(
        "../../../supabase/rollbacks/202610030005_youtube_transcripts.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await assert.rejects(db.exec(youtubeRollback));
    await db.exec("rollback");
    await db.query("delete from public.sources where id=$1", [retrievedId]);
    await db.exec(youtubeRollback);
    assert.equal(
      (await db.query("select id from public.sources")).rows.length,
      3,
    );
    const rollback = await readFile(
      new URL(
        "../../../supabase/rollbacks/202610030004_video_transcripts.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await assert.rejects(db.exec(rollback));
    await db.exec("rollback");
    assert.equal(
      (await db.query("select id from public.sources")).rows.length,
      3,
    );
    await db.query("delete from public.sources where id=$1", [id]);
    await db.exec(rollback);
    assert.equal(
      (await db.query("select id from public.sources")).rows.length,
      2,
    );
    assert.equal(
      (
        await db.query<{ page_count: string }>(
          "select document->>'page_count' as page_count from public.sources where id=$1",
          [pdfId],
        )
      ).rows[0].page_count,
      "1",
    );
  } finally {
    await db.close();
  }
});
