import test from "node:test";
import assert from "node:assert/strict";
import { sampleNotes, topicTitles } from "../data";
import { createLibrary, readLibrary, updateLibrary } from "./library";

test("loading owned sources replaces matching examples without claiming generated notes", () => {
  const owned = { ...sampleNotes[0], id: "owned-source", demo: false, title: "My captured article", concepts: [], topics: [], recall: [] };
  const library = updateLibrary(createLibrary(sampleNotes, topicTitles), {
    type: "load-sources", notes: [owned],
  });
  const view = readLibrary(library, "My captured article", "All sources", "recent");
  assert.deepEqual(view.filtered.map((note) => note.id), ["owned-source"]);
  assert.equal(view.notes.filter((note) => note.url === owned.url).length, 1);
  assert.deepEqual(view.filtered[0].topics, []);
});

test("saving a real source replaces its example and clears example recall marks", () => {
  const owned = { ...sampleNotes[0], id: "owned-source", demo: false, topics: [], concepts: [], recall: [] };
  let library = updateLibrary(createLibrary(sampleNotes, topicTitles), {
    type: "toggle-recall", id: `${sampleNotes[0].id}:0`,
  });
  library = updateLibrary(library, { type: "add-sources", notes: [owned] });
  const view = readLibrary(library, "", "All sources", "recent");
  assert.equal(view.notes[0].id, "owned-source");
  assert.equal(view.notes.filter((note) => note.url === owned.url).length, 1);
  assert.deepEqual(view.mastered, []);
});
