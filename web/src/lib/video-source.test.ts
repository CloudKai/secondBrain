import test from "node:test";
import assert from "node:assert/strict";
import { createSourceClient, sourceSchema } from "./source-client";
import { noteFromSavedSource } from "./api";
import { studySchema } from "./study-note";

const text =
  "Algebra uses symbols to express relationships between quantities. A variable represents an unknown quantity, and an equation states that two expressions are equal.";
const source = {
  id: "33333333-3333-4333-8333-333333333333",
  source_kind: "video",
  document: null,
  original_url: "https://youtu.be/aircAruvnKk",
  canonical_url: "https://www.youtube.com/watch?v=aircAruvnKk",
  title: "Algebra",
  captured_text: text,
  captured_at: "2026-10-03T00:00:00Z",
  capture_origin: "upload",
  coverage: "unknown",
  coverage_detail:
    "User-supplied transcript; video completeness is unverified.",
  study_status: "pending",
  transcript: {
    provider: "youtube",
    format: "vtt",
    filename: "lecture.vtt",
    segments: [{ start: 0, end: text.length, start_ms: 30000, end_ms: 40000 }],
  },
};

test("a saved video reopens with its supplied transcript and validates exact cue times", () => {
  const captured = sourceSchema.parse(source);
  const claim = { text: "Algebra uses variables.", citation_ids: ["p0001"] };
  const record = {
    source_id: source.id,
    status: "succeeded",
    attempts: 1,
    max_attempts: 3,
    next_attempt_at: "2026-10-03T00:00:00Z",
    updated_at: "2026-10-03T00:00:00Z",
    error_code: null,
    note: {
      overview: claim,
      concepts: [{ ...claim, title: "Variables" }],
      examples: [],
      equations: [],
      recall: [
        {
          question: "What represents an unknown?",
          answer: "A variable.",
          citation_ids: ["p0001"],
        },
      ],
      references: [
        {
          id: "p0001",
          start: 0,
          end: text.length,
          excerpt: text,
          page: null,
          start_ms: 30000,
          end_ms: 40000,
        },
      ],
    },
  };
  const study = studySchema.parse(record);
  const note = noteFromSavedSource(captured, study);
  assert.equal(note.kind, "Video");
  assert.equal(note.url, source.original_url);
  assert.equal(note.study?.note?.references[0].start_ms, 30000);
  assert.throws(() =>
    noteFromSavedSource(
      captured,
      studySchema.parse({
        ...record,
        note: {
          ...record.note,
          references: [{ ...record.note.references[0], start_ms: 10000 }],
        },
      }),
    ),
  );
});

test("the video client uploads raw caption bytes with the learner token and preserves actionable errors", async () => {
  const caption = `WEBVTT\n\n00:00:30.000 --> 00:00:40.000\n${text}`;
  let reject = false;
  const values = new Map<string, string>();
  const token = `${Buffer.from('{"alg":"HS256"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub: "11111111-1111-4111-8111-111111111111", exp: 2000000000 })).toString("base64url")}.fixture`;
  const client = createSourceClient(
    { url: "https://supabase.test", publicKey: "public-test-key" },
    {
      storage: {
        getItem: (k) => values.get(k) ?? null,
        setItem: (k, v) => {
          values.set(k, v);
        },
        removeItem: (k) => {
          values.delete(k);
        },
      },
      fetch: async (input, init) => {
        const url = String(input);
        if (url.includes("/auth/v1/signup"))
          return new Response(
            JSON.stringify({
              access_token: token,
              refresh_token: "refresh-token",
              expires_in: 3600,
              token_type: "bearer",
              user: {
                id: "11111111-1111-4111-8111-111111111111",
                is_anonymous: true,
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        if (url.includes("/sources/video?")) {
          assert.equal(
            new Headers(init?.headers).get("Authorization"),
            `Bearer ${token}`,
          );
          assert.equal(
            new Headers(init?.headers).get("X-Video-URL"),
            source.original_url,
          );
          assert.equal(
            new URL(url, "https://app.test").searchParams.has("url"),
            false,
          );
          const body = init?.body;
          assert.ok(body instanceof Blob);
          assert.equal(await body.text(), caption);
          assert.equal(
            new URL(url, "https://app.test").searchParams.get("filename"),
            "lecture.vtt",
          );
          return new Response(
            JSON.stringify(
              reject
                ? {
                    detail:
                      "Invalid caption time. Export VTT or paste its text.",
                  }
                : source,
            ),
            { status: reject ? 422 : 201 },
          );
        }
        throw new Error(`Unexpected HTTP endpoint: ${url}`);
      },
    },
  );
  const file = new File([caption], "lecture.vtt", { type: "text/vtt" });
  assert.equal(
    (
      await client.saveVideo({
        url: source.original_url,
        title: "Algebra",
        file,
      })
    ).id,
    source.id,
  );
  reject = true;
  await assert.rejects(
    client.saveVideo({ url: source.original_url, title: "Algebra", file }),
    /Invalid caption time/,
  );
});

test("saved Panopto identity ignores presentation parameters and rejects claimed complete coverage", () => {
  const panopto = {
    ...source,
    original_url:
      "https://school.hosted.panopto.com/Panopto/Pages/Viewer.aspx?start=30&id=session-id&isLive=false",
    canonical_url:
      "https://school.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=session-id",
    transcript: { ...source.transcript, provider: "panopto" },
  };
  assert.doesNotThrow(() => sourceSchema.parse(panopto));
  assert.throws(() => sourceSchema.parse({ ...panopto, coverage: "complete" }));
});

test("retrieved YouTube captions reopen with distinct origin and real cue citations", () => {
  const retrieved = sourceSchema.parse({
    ...source,
    capture_origin: "direct",
    transcript: { ...source.transcript, filename: null },
    coverage_detail: "Retrieved English YouTube publisher-provided captions.",
  });
  assert.equal(retrieved.capture_origin, "direct");
  assert.equal(noteFromSavedSource(retrieved).kind, "Video");
  assert.throws(() =>
    sourceSchema.parse({ ...source, capture_origin: "direct" }),
  );
});

test("automatic import authenticates, validates retrieved captions, and distinguishes fallback from storage failure", async () => {
  const values = new Map<string, string>();
  const token = `${Buffer.from('{"alg":"HS256"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub: "11111111-1111-4111-8111-111111111111", exp: 2000000000 })).toString("base64url")}.fixture`;
  let status = 201;
  const client = createSourceClient(
    { url: "https://supabase.test", publicKey: "public-test-key" },
    {
      storage: {
        getItem: (k) => values.get(k) ?? null,
        setItem: (k, v) => {
          values.set(k, v);
        },
        removeItem: (k) => {
          values.delete(k);
        },
      },
      fetch: async (input, init) => {
        if (String(input).includes("/auth/v1/signup"))
          return new Response(
            JSON.stringify({
              access_token: token,
              refresh_token: "refresh",
              expires_in: 3600,
              token_type: "bearer",
              user: {
                id: "11111111-1111-4111-8111-111111111111",
                is_anonymous: true,
              },
            }),
          );
        assert.equal(String(input), "/api/v2/sources/youtube");
        assert.equal(
          new Headers(init?.headers).get("Authorization"),
          `Bearer ${token}`,
        );
        assert.deepEqual(JSON.parse(String(init?.body)), {
          url: source.original_url,
          title: "Algebra",
        });
        return new Response(
          JSON.stringify(
            status === 201
              ? {
                  ...source,
                  capture_origin: "direct",
                  transcript: { ...source.transcript, filename: null },
                }
              : {
                  detail:
                    "No accessible English transcript. Upload or paste it instead.",
                },
          ),
          { status },
        );
      },
    },
  );
  assert.equal(
    (await client.importYouTube({ url: source.original_url, title: "Algebra" }))
      .capture_origin,
    "direct",
  );
  status = 422;
  await assert.rejects(
    client.importYouTube({ url: source.original_url, title: "Algebra" }),
    (error) =>
      error instanceof Error &&
      error.name === "TranscriptFallbackError" &&
      /Upload or paste/.test(error.message),
  );
  status = 503;
  await assert.rejects(
    client.importYouTube({ url: source.original_url, title: "Algebra" }),
    (error) =>
      error instanceof Error &&
      error.name !== "TranscriptFallbackError" &&
      /storage is unavailable/.test(error.message),
  );
});
