import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("the PDF migration preserves articles, owns page captures and supplies worker page metadata", async () => {
  const db = new PGlite();
  const owner = "11111111-1111-4111-8111-111111111111";
  const other = "22222222-2222-4222-8222-222222222222";
  const id = "33333333-3333-4333-8333-333333333333";
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users (id uuid primary key);
      insert into auth.users values ('${owner}'),('${other}');
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated,service_role;`);
    for (const filename of [
      "202610020001_browser_sources.sql",
      "202610030002_source_studies.sql",
      "202610030003_pdf_sources.sql",
    ])
      await db.exec(
        await readFile(
          new URL(`../../../supabase/migrations/${filename}`, import.meta.url),
          "utf8",
        ),
      );
    await db.exec(
      `set role authenticated; select set_config('request.jwt.claim.sub','${owner}',false)`,
    );
    const text = "Algebra describes symbols and relationships. ".repeat(4);
    const document = {
      filename: "algebra.pdf",
      page_count: 1,
      pages: [{ page: 1, start: 0, end: text.length }],
    };
    await db.query(
      `insert into public.sources (id,user_id,original_url,canonical_url,title,captured_text,capture_origin,coverage,coverage_detail,source_kind,document) values ($1,$2,null,$3,'Algebra',$4,'upload','complete','Selectable text','pdf',$5)`,
      [
        id,
        owner,
        `urn:pdf:sha256:${"a".repeat(64)}`,
        text,
        JSON.stringify(document),
      ],
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
    await db.exec("reset role; set role service_role");
    const claim = await db.query<{ claim: { document: typeof document } }>(
      "select public.claim_source_study($1) as claim",
      [id],
    );
    assert.deepEqual(claim.rows[0].claim.document, document);
    await db.exec("reset role");
    assert.equal(
      (
        await db.query<{ valid: boolean }>(
          "select public.valid_pdf_document($1,$2) as valid",
          [
            JSON.stringify({
              ...document,
              pages: [{ page: 2, start: 0, end: text.length }],
            }),
            text,
          ],
        )
      ).rows[0].valid,
      false,
    );
    await assert.rejects(
      db.exec(
        await readFile(
          new URL(
            "../../../supabase/rollbacks/202610030003_pdf_sources.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      ),
    );
    await db.exec("rollback");
    assert.equal(
      (await db.query("select id from public.sources")).rows.length,
      1,
    );
    await db.query("delete from public.sources where id=$1", [id]);
    await db.exec(
      await readFile(
        new URL(
          "../../../supabase/rollbacks/202610030003_pdf_sources.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    assert.equal(
      (await db.query("select id from public.sources")).rows.length,
      0,
    );
  } finally {
    await db.close();
  }
});
