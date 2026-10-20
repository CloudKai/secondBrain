import assert from "node:assert/strict";
import test from "node:test";
import { librarySummary, pickStartHere, plural } from "./home.ts";

function note(id: string, addedAt: number, demo = false) {
  return {
    id,
    title: `Title ${id}`,
    subtitle: `Subtitle ${id}`,
    addedAt,
    demo,
    concepts: [{}, {}],
  };
}

test("start here prefers the newest saved source over a newer example", () => {
  const picked = pickStartHere([
    note("example", 900, true),
    note("older", 100),
    note("newer", 300),
  ]);
  assert.equal(picked?.id, "newer");
});

test("start here falls back to the newest example only when nothing is saved", () => {
  const picked = pickStartHere([
    note("a", 1, true),
    note("b", 5, true),
    note("c", 3, true),
  ]);
  assert.equal(picked?.id, "b");
});

test("start here is null for an empty library", () => {
  assert.equal(pickStartHere([]), null);
});

test("pluralises counts", () => {
  assert.equal(plural(0, "source"), "0 sources");
  assert.equal(plural(1, "source"), "1 source");
  assert.equal(plural(2, "topic"), "2 topics");
});

test("summarises an empty library", () => {
  const summary = librarySummary([], 0);
  assert.deepEqual(
    [summary.sources, summary.examples, summary.topics],
    [0, 0, 0],
  );
  assert.equal(summary.text, "No sources yet");
});

test("summarises one source without examples", () => {
  assert.equal(librarySummary([note("a", 1)], 1).text, "1 source · 1 topic");
});

test("summarises several sources and topics", () => {
  const summary = librarySummary([note("a", 1), note("b", 2), note("c", 3)], 5);
  assert.equal(summary.text, "3 sources · 5 topics");
  assert.equal(summary.sources, 3);
});

test("summarises examples alongside sources", () => {
  const summary = librarySummary(
    [note("a", 1), note("b", 2), note("x", 3, true), note("y", 4, true)],
    6,
  );
  assert.equal(summary.text, "2 sources · 2 examples · 6 topics");
  assert.equal(summary.examples, 2);
});

test("summarises example material alone and omits empty parts", () => {
  assert.equal(librarySummary([note("x", 1, true)], 0).text, "1 example");
});

test("summary wording never claims mastery", () => {
  const texts = [
    librarySummary([], 0).text,
    librarySummary([note("a", 1)], 2).text,
    librarySummary([note("a", 1), note("x", 2, true)], 4).text,
  ];
  for (const text of texts)
    assert.doesNotMatch(text, /master|understood|complete/i);
});
