import type { Connection, Note, Topic } from "../types";
import { topicTitles } from "../data";

interface TopicPair {
  source: string;
  target: string;
}

export interface LibraryState {
  notes: Note[];
  names: Record<string, string>;
  rejected: TopicPair[];
  mastered: string[];
}

export type LibraryAction =
  | { type: "add-sources"; notes: Note[] }
  | { type: "load-sources"; notes: Note[] }
  | { type: "show-examples"; notes: Note[] }
  | { type: "rename-topic"; id: string; name: string }
  | { type: "merge-topics"; source: string; target: string }
  | { type: "assign-topic"; noteId: string; topicId: string; assigned: boolean }
  | { type: "reject-connection"; source: string; target: string }
  | { type: "restore-connections" }
  | { type: "remove-source"; id: string }
  | { type: "hide-examples" }
  | { type: "toggle-recall"; id: string };

export function createLibrary(
  notes: Note[],
  names: Record<string, string>,
): LibraryState {
  return { notes: [...notes], names: { ...names }, rejected: [], mastered: [] };
}

function topicExists(state: LibraryState, id: string): boolean {
  return state.notes.some((note) => note.topics.includes(id));
}

function uniquePairs(pairs: TopicPair[]): TopicPair[] {
  const seen = new Set<string>();
  return pairs.filter(({ source, target }) => {
    if (source === target) return false;
    const key = connectionId(source, target);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function connectionId(source: string, target: string): string {
  return JSON.stringify([source, target].sort());
}

function removeSources(state: LibraryState, removed: Note[]): LibraryState {
  const ids = new Set(removed.map((note) => note.id));
  return {
    ...state,
    notes: state.notes.filter((note) => !ids.has(note.id)),
    mastered: state.mastered.filter(
      (card) => !removed.some((note) => card.startsWith(`${note.id}:`)),
    ),
  };
}

function sourceIdentity(note: Note): string {
  return note.savedSource?.original_url === null
    ? note.savedSource.canonical_url
    : canonicalUrl(note.url);
}

export function updateLibrary(
  state: LibraryState,
  action: LibraryAction,
): LibraryState {
  switch (action.type) {
    case "load-sources": {
      const urls = new Set(action.notes.map((note) => sourceIdentity(note)));
      const examples = state.notes.filter(
        (note) => note.demo && !urls.has(sourceIdentity(note)),
      );
      const notes = [...action.notes, ...examples];
      const remainingIds = new Set(notes.map((note) => note.id));
      const removed = state.notes.filter((note) => !remainingIds.has(note.id));
      return { ...removeSources(state, removed), notes };
    }
    case "add-sources":
    case "show-examples": {
      const realUrls = new Set(
        action.notes
          .filter((note) => !note.demo)
          .map((note) => sourceIdentity(note)),
      );
      const base = removeSources(
        state,
        state.notes.filter(
          (note) => note.demo && realUrls.has(sourceIdentity(note)),
        ),
      );
      const urls = new Set(base.notes.map((note) => sourceIdentity(note)));
      const added = action.notes.filter((note) => {
        const url = sourceIdentity(note);
        if (urls.has(url)) return false;
        urls.add(url);
        return true;
      });
      return {
        ...base,
        notes:
          action.type === "show-examples"
            ? [...base.notes, ...added]
            : [...added, ...base.notes],
      };
    }
    case "rename-topic": {
      const name = action.name.trim();
      if (!name || !topicExists(state, action.id)) return state;
      return { ...state, names: { ...state.names, [action.id]: name } };
    }
    case "merge-topics": {
      if (
        action.source === action.target ||
        !topicExists(state, action.source) ||
        !topicExists(state, action.target)
      )
        return state;
      const remap = (id: string) => (id === action.source ? action.target : id);
      const names = { ...state.names };
      delete names[action.source];
      return {
        ...state,
        names,
        notes: state.notes.map((note) => ({
          ...note,
          topics: [...new Set(note.topics.map(remap))],
          concepts: note.concepts.map((concept) => ({
            ...concept,
            topic: remap(concept.topic),
          })),
        })),
        // A learner's rejection survives under the merged topic identity.
        // Rejections that collapse into the topic itself no longer form an edge.
        rejected: uniquePairs(
          state.rejected.map(({ source, target }) => ({
            source: remap(source),
            target: remap(target),
          })),
        ),
      };
    }
    case "assign-topic":
      return {
        ...state,
        notes: state.notes.map((note) =>
          note.id !== action.noteId
            ? note
            : {
                ...note,
                topics: action.assigned
                  ? [...new Set([...note.topics, action.topicId])]
                  : note.topics.filter((id) => id !== action.topicId),
              },
        ),
      };
    case "reject-connection":
      return {
        ...state,
        rejected: uniquePairs([
          ...state.rejected,
          { source: action.source, target: action.target },
        ]),
      };
    case "restore-connections":
      return { ...state, rejected: [] };
    case "remove-source":
      return removeSources(
        state,
        state.notes.filter((note) => note.id === action.id),
      );
    case "hide-examples":
      return removeSources(
        state,
        state.notes.filter((note) => note.demo),
      );
    case "toggle-recall":
      return {
        ...state,
        mastered: state.mastered.includes(action.id)
          ? state.mastered.filter((id) => id !== action.id)
          : [...state.mastered, action.id],
      };
  }
}

export function readLibrary(
  state: LibraryState,
  query: string,
  filter: string,
  sort: string,
) {
  const topics = getTopics(state.notes, state.names);
  return {
    ...state,
    topics,
    connections: getConnections(
      topics,
      state.rejected.map(({ source, target }) => connectionId(source, target)),
    ),
    filtered: findNotes(state.notes, query, filter, state.names).sort((a, b) =>
      sort === "title" ? a.title.localeCompare(b.title) : b.addedAt - a.addedAt,
    ),
    demo: state.notes.some((note) => note.demo),
  };
}
export function getTopics(
  notes: Note[],
  names: Record<string, string>,
): Topic[] {
  const ids = [...new Set(notes.flatMap((n) => n.topics))];
  return ids.map((id) => ({
    id,
    title: names[id] || topicTitles[id] || id,
    notes: notes.filter((n) => n.topics.includes(id)),
  }));
}
export function getConnections(
  topics: Topic[],
  rejected: string[],
): Connection[] {
  const result: Connection[] = [];
  for (let i = 0; i < topics.length; i++)
    for (let j = i + 1; j < topics.length; j++) {
      const a = topics[i],
        b = topics[j];
      const shared = a.notes.filter((n) =>
        b.notes.some((m) => sourceIdentity(m) === sourceIdentity(n)),
      );
      const urls = new Set(shared.map(sourceIdentity));
      const id = connectionId(a.id, b.id);
      if (urls.size < 2 || rejected.includes(id)) continue;
      result.push({
        id,
        source: a.id,
        target: b.id,
        label: "covered together",
        reason: `${shared.map((n) => n.title).join(" and ")} both explain ${a.title.toLowerCase()} and ${b.title.toLowerCase()}. This is shared source coverage, not a mastery score.`,
        noteIds: shared.map((n) => n.id),
      });
    }
  return result;
}
export function findNotes(
  notes: Note[],
  query: string,
  filter: string,
  names: Record<string, string> = topicTitles,
): Note[] {
  const normalized = query.trim().toLowerCase();
  return notes.filter(
    (n) =>
      (filter === "All sources" || n.kind === filter) &&
      `${n.title} ${n.author} ${n.topics.map((t) => names[t] || topicTitles[t] || t).join(" ")}`
        .toLowerCase()
        .includes(normalized),
  );
}
export function canonicalUrl(value: string): string {
  const url = new URL(value);
  if (!["https:", "http:"].includes(url.protocol))
    throw new Error("Enter a public http or https article URL.");
  url.hash = "";
  if (url.hostname === "arxiv.org" && url.pathname.startsWith("/pdf/"))
    url.pathname = url.pathname.replace("/pdf/", "/abs/").replace(/\.pdf$/, "");
  return url.href;
}
