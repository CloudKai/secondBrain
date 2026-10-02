import test from "node:test";
import assert from "node:assert/strict";
import { createSourceClient } from "./source-client";

const userId = "11111111-1111-4111-8111-111111111111";
const source = {
  id: "33333333-3333-4333-8333-333333333333",
  original_url: "https://example.com/article#intro",
  canonical_url: "https://example.com/article",
  title: "Calculus",
  captured_text: "Calculus explains changes in quantities and how they accumulate. ".repeat(4),
  captured_at: "2026-10-02T10:00:00+00:00",
  capture_origin: "direct",
  coverage: "complete",
  coverage_detail: "Captured the readable page text.",
  study_status: "pending",
};

test("an anonymous browser reopens its owned source using the persisted session", async () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
  let saved = false;
  const token = `${Buffer.from('{"alg":"HS256"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub: userId, exp: 2000000000 })).toString("base64url")}.signature`;
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("/auth/v1/signup")) {
      return Response.json({ access_token: token, refresh_token: "refresh", token_type: "bearer", expires_in: 3600, user: { id: userId, is_anonymous: true, app_metadata: {}, user_metadata: {} } });
    }
    const headers = new Headers(init?.headers);
    if (headers.get("Authorization") !== `Bearer ${token}`) return Response.json({}, { status: 401 });
    if (init?.method === "POST") {
      saved = true;
      return Response.json(source, { status: 201 });
    }
    return Response.json({ sources: saved ? [source] : [], next_offset: null });
  };
  const settings = { url: "https://project.supabase.co", publicKey: "public-test-key" };
  const first = createSourceClient(settings, { fetch: fetcher, storage });
  await first.ready();
  await first.save({ url: source.original_url, title: source.title, raw_text: null });
  const afterReload = createSourceClient(settings, { fetch: fetcher, storage });
  await afterReload.ready();
  assert.deepEqual(await afterReload.list(), [source]);
});
