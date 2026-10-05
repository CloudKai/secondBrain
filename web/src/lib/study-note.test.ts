import test from "node:test";
import assert from "node:assert/strict";
import { noteFromSavedSource } from "./api";
import { studySchema } from "./study-note";
import { sourceSchema } from "./source-client";

const text = "Calculus 🚀 describes rates of change and accumulation. ".repeat(
  4,
);
const source = sourceSchema.parse({
  id: "33333333-3333-4333-8333-333333333333",
  title: "Calculus",
  original_url: "https://example.com/calculus",
  canonical_url: "https://example.com/calculus",
  captured_text: text,
  captured_at: "2026-10-03T00:00:00Z",
  capture_origin: "direct",
  coverage: "complete",
  coverage_detail: "Page text captured",
  study_status: "pending",
});
const explanation = {
  text: "Calculus describes change.",
  citation_ids: ["p0001"],
};
const rawStudy = {
  source_id: source.id,
  status: "succeeded",
  attempts: 1,
  max_attempts: 3,
  next_attempt_at: "2026-10-03T00:00:00Z",
  updated_at: "2026-10-03T00:00:00Z",
  error_code: null,
  note: {
    overview: explanation,
    concepts: [
      { ...explanation, title: "Change" },
      { ...explanation, title: "Accumulation" },
    ],
    examples: [],
    equations: [],
    recall: [
      {
        question: "What does calculus describe?",
        answer: "Change.",
        citation_ids: ["p0001"],
      },
    ],
    references: [
      { id: "p0001", start: 0, end: Array.from(text).length, excerpt: text },
    ],
  },
};

test("persisted structured notes adapt without invented topic assignments or four-point padding", () => {
  const note = noteFromSavedSource(source, studySchema.parse(rawStudy));
  assert.equal(note.concepts.length, 2);
  assert.equal(note.overview, explanation.text);
  assert.equal(note.study?.note?.references[0].excerpt, text);
  assert.deepEqual(note.topics, []);
});

test("unknown citations, fabricated excerpts and failed notes are rejected", () => {
  assert.throws(() => studySchema.parse({ ...rawStudy, status: "failed" }));
  assert.throws(() =>
    studySchema.parse({
      ...rawStudy,
      note: {
        ...rawStudy.note,
        overview: { ...explanation, citation_ids: ["p9999"] },
      },
    }),
  );
  const changed = studySchema.parse({
    ...rawStudy,
    note: {
      ...rawStudy.note,
      references: [
        { id: "p0001", start: 0, end: 20, excerpt: "invented source text" },
      ],
    },
  });
  assert.throws(() => noteFromSavedSource(source, changed));
  const failed = studySchema.parse({
    ...rawStudy,
    status: "failed",
    note: null,
    error_code: "invalid_output",
    attempts: 3,
  });
  const note = noteFromSavedSource(source, failed);
  assert.equal(note.study?.note, null);
  assert.equal(note.concepts.length, 0);
});
