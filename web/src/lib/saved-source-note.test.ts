import test from "node:test";
import assert from "node:assert/strict";
import { noteFromSavedSource } from "./api";

test("a saved source opens as pending material without invented study-note content", () => {
  const source = {
    id: "33333333-3333-4333-8333-333333333333",
    original_url: "https://example.com/article#intro",
    canonical_url: "https://example.com/article",
    title: "Calculus",
    captured_text: "Calculus explains changes in quantities and how they accumulate. ".repeat(4),
    captured_at: "2026-10-02T10:00:00+00:00",
    capture_origin: "direct" as const,
    coverage: "complete" as const,
    coverage_detail: "Captured readable page text.",
    study_status: "pending" as const,
  };
  const note = noteFromSavedSource(source);
  assert.equal(note.id, source.id);
  assert.equal(note.url, source.original_url);
  assert.equal(note.evidence, source.captured_text);
  assert.deepEqual(note.concepts, []);
  assert.deepEqual(note.topics, []);
  assert.deepEqual(note.recall, []);
  assert.equal(note.savedSource?.study_status, "pending");
});
