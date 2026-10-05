import test from "node:test";
import assert from "node:assert/strict";
import { sampleNotes, topicTitles } from "../data";
import { canonicalUrl, findNotes, getConnections, getTopics } from "./library";
import { noteFromResponse } from "./api";

test("empty and single-source libraries never invent connected outlines", () => {
  assert.deepEqual(getTopics([], {}), []);
  assert.deepEqual(
    getConnections(getTopics([sampleNotes[0]], topicTitles), []),
    [],
  );
});
test("duplicate imports do not count as independent evidence", () => {
  const duplicate = { ...sampleNotes[0], id: "duplicate" };
  assert.deepEqual(
    getConnections(getTopics([sampleNotes[0], duplicate], topicTitles), []),
    [],
  );
});
test("two substantive sources connect; rejection and deletion remove connections", () => {
  const topics = getTopics(sampleNotes, topicTitles);
  const edges = getConnections(topics, []);
  assert.equal(edges.length, 3);
  assert.equal(getConnections(topics, [edges[0].id]).length, 2);
  assert.equal(
    getConnections(
      getTopics(
        sampleNotes.filter((n) => n.id !== "annotated"),
        topicTitles,
      ),
      [],
    ).length,
    0,
  );
});
test("search works with topic labels and type filters", () => {
  assert.equal(
    findNotes(sampleNotes, "self-attention", "All sources").length,
    2,
  );
  assert.equal(findNotes(sampleNotes, "Harvard", "Article")[0].id, "annotated");
  assert.equal(findNotes(sampleNotes, "Harvard", "Paper").length, 0);
});
test("URL identity strips fragments and normalizes arXiv abstract and PDF links", () => {
  assert.equal(
    canonicalUrl("https://arxiv.org/pdf/1706.03762.pdf#page=2"),
    canonicalUrl(sampleNotes[0].url),
  );
  assert.throws(() => canonicalUrl("javascript:alert(1)"));
  assert.equal(canonicalUrl("https://example.com/article?path=/chapter/#intro"), "https://example.com/article?path=/chapter/");
  assert.notEqual(canonicalUrl("https://example.com/article/"), canonicalUrl("https://example.com/article"));
});
const valid = {
  folder_id: "ai-engineering",
  source_url: "https://example.com/article",
  raw_text: "Captured article text",
  simplified_summary:
    "- First idea\n- Second idea\n- Third idea\n- Fourth idea",
  diagram_type: "network",
  diagram_options: ["network"],
  nodes: [
    { id: "a", label: "One" },
    { id: "b", label: "Two" },
  ],
  edges: [{ id: "e", source: "a", target: "b", label: null }],
};
test("v1 adapter preserves evidence and explicitly produces four-point article notes", () => {
  const note = noteFromResponse(valid, "My article");
  assert.equal(note.concepts.length, 4);
  assert.equal(note.evidence, valid.raw_text);
  assert.equal(note.demo, false);
  assert.equal(note.example, undefined);
});
test("network boundary rejects missing nodes, duplicate IDs, unsafe URLs, and incomplete summaries", () => {
  assert.throws(() =>
    noteFromResponse(
      { ...valid, edges: [{ id: "e", source: "a", target: "missing" }] },
      "",
    ),
  );
  assert.throws(() =>
    noteFromResponse({ ...valid, nodes: [valid.nodes[0], valid.nodes[0]] }, ""),
  );
  assert.throws(() =>
    noteFromResponse({ ...valid, source_url: "javascript:alert(1)" }, ""),
  );
  assert.throws(() =>
    noteFromResponse({ ...valid, simplified_summary: "- One idea only" }, ""),
  );
});
