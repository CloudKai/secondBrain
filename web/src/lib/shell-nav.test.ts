import assert from "node:assert/strict";
import test from "node:test";
import { PAGE_LABELS, recentTopics } from "./shell-nav.ts";

function topic(id: string, title: string, addedAt: number[]) {
  return { id, title, notes: addedAt.map((value) => ({ addedAt: value })) };
}

test("labels the library route as Home", () => {
  assert.equal(PAGE_LABELS.library, "Home");
  assert.equal(PAGE_LABELS.note, "Source note");
  assert.equal(PAGE_LABELS.collection, "Learning collections");
  assert.equal(PAGE_LABELS.topics, "Topic graph");
  assert.equal(PAGE_LABELS.discover, "Reading list");
});

test("caps recent topics at five by default", () => {
  const topics = Array.from({ length: 8 }, (_, index) =>
    topic(`t${index}`, `Topic ${index}`, [index]),
  );
  assert.equal(recentTopics(topics).length, 5);
  assert.equal(recentTopics(topics, 2).length, 2);
  assert.equal(recentTopics(topics, 0).length, 0);
});

test("orders by the newest source added, then reports source counts", () => {
  const result = recentTopics([
    topic("old", "Old", [1, 2]),
    topic("new", "New", [3, 9, 4]),
    topic("mid", "Mid", [5]),
  ]);
  assert.deepEqual(result, [
    { id: "new", title: "New", sourceCount: 3 },
    { id: "mid", title: "Mid", sourceCount: 1 },
    { id: "old", title: "Old", sourceCount: 2 },
  ]);
});

test("breaks ties by title", () => {
  const result = recentTopics([
    topic("b", "Beta", [4]),
    topic("a", "Alpha", [4]),
    topic("c", "Gamma", [4]),
  ]);
  assert.deepEqual(
    result.map((item) => item.id),
    ["a", "b", "c"],
  );
});

test("returns an empty list for no topics", () => {
  assert.deepEqual(recentTopics([]), []);
});

test("topics without sources sort last, by title", () => {
  const result = recentTopics([
    topic("z", "Zeta", []),
    topic("a", "Alpha", []),
    topic("s", "Sourced", [1]),
  ]);
  assert.deepEqual(
    result.map((item) => item.id),
    ["s", "a", "z"],
  );
  assert.equal(result[1].sourceCount, 0);
});

test("does not change the input order", () => {
  const input = [topic("a", "A", [1]), topic("b", "B", [2])];
  recentTopics(input);
  assert.deepEqual(
    input.map((item) => item.id),
    ["a", "b"],
  );
});
