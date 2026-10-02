import test from "node:test";
import assert from "node:assert/strict";
import { createSourceClient, sourceSchema } from "./source-client";

const userId = "11111111-1111-4111-8111-111111111111";
const source = {
  id: "33333333-3333-4333-8333-333333333333",
  original_url: "https://example.com/article#intro",
  canonical_url: "https://example.com/article",
  title: "Calculus",
  captured_text:
    "Calculus explains changes in quantities and how they accumulate. ".repeat(
      4,
    ),
  captured_at: "2026-10-02T10:00:00+00:00",
  capture_origin: "direct",
  coverage: "complete",
  coverage_detail: "Captured the readable page text.",
  study_status: "pending",
};
const study = {
  source_id: source.id,
  status: "queued",
  attempts: 0,
  max_attempts: 3,
  note: null,
  error_code: null,
  next_attempt_at: "2026-10-03T00:00:00Z",
  updated_at: "2026-10-03T00:00:00Z",
};

test("valid Unicode captures use the server's character limits", () => {
  const captured = {
    ...source,
    captured_text: "🧠".repeat(30_000),
    title: "🧠".repeat(200),
    coverage_detail: "🧠".repeat(500),
  };
  assert.deepEqual(sourceSchema.parse(captured), captured);
  assert.throws(() =>
    sourceSchema.parse({
      ...captured,
      captured_text: captured.captured_text + "a",
    }),
  );
});

test("an anonymous browser reopens its owned source using the persisted session", async () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
  let saved = false;
  let requested = false;
  const token = `${Buffer.from('{"alg":"HS256"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub: userId, exp: 2000000000 })).toString("base64url")}.signature`;
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("/auth/v1/signup")) {
      return Response.json({
        access_token: token,
        refresh_token: "refresh",
        token_type: "bearer",
        expires_in: 3600,
        user: {
          id: userId,
          is_anonymous: true,
          app_metadata: {},
          user_metadata: {},
        },
      });
    }
    const headers = new Headers(init?.headers);
    if (headers.get("Authorization") !== `Bearer ${token}`)
      return Response.json({}, { status: 401 });
    if (url.endsWith("/study")) {
      assert.deepEqual(JSON.parse(String(init?.body)), { retry: false });
      requested = true;
      return Response.json(study, { status: 202 });
    }
    if (url.startsWith("/api/v2/studies"))
      return Response.json({
        studies: requested ? [study] : [],
        next_offset: null,
      });
    if (init?.method === "POST") {
      saved = true;
      return Response.json(source, { status: 201 });
    }
    return Response.json({ sources: saved ? [source] : [], next_offset: null });
  };
  const settings = {
    url: "https://project.supabase.co",
    publicKey: "public-test-key",
  };
  const first = createSourceClient(settings, { fetch: fetcher, storage });
  await first.ready();
  await first.save({
    url: source.original_url,
    title: source.title,
    raw_text: null,
  });
  assert.deepEqual(await first.generate(source.id), study);
  const afterReload = createSourceClient(settings, { fetch: fetcher, storage });
  await afterReload.ready();
  assert.deepEqual(await afterReload.list(), [source]);
  assert.deepEqual(await afterReload.studies(), [study]);
});
