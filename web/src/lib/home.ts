import type { Note } from "../types.ts";

/** The slice of a library note that Home reads. */
export type HomeNote = Pick<
  Note,
  "id" | "title" | "subtitle" | "addedAt" | "demo"
> & { concepts: { length: number } };

export interface LibrarySummary {
  sources: number;
  examples: number;
  topics: number;
  text: string;
}

export function plural(
  count: number,
  singular: string,
  pluralForm?: string,
): string {
  return `${count} ${count === 1 ? singular : (pluralForm ?? `${singular}s`)}`;
}

function newest<T extends HomeNote>(notes: ReadonlyArray<T>): T | null {
  let best: T | null = null;
  for (const note of notes) {
    if (best === null || note.addedAt > best.addedAt) best = note;
  }
  return best;
}

/** The newest source the learner added, else the newest example, else nothing. */
export function pickStartHere<T extends HomeNote>(
  notes: ReadonlyArray<T>,
): T | null {
  return (
    newest(notes.filter((note) => !note.demo)) ??
    newest(notes.filter((note) => note.demo))
  );
}

/** Plain counts only: sources, example notes and topics. */
export function librarySummary(
  notes: ReadonlyArray<Pick<HomeNote, "demo">>,
  topicCount: number,
): LibrarySummary {
  const examples = notes.filter((note) => note.demo).length;
  const sources = notes.length - examples;
  const parts: string[] = [];
  if (sources > 0) parts.push(plural(sources, "source"));
  if (examples > 0) parts.push(plural(examples, "example"));
  if (topicCount > 0) parts.push(plural(topicCount, "topic"));
  return {
    sources,
    examples,
    topics: topicCount,
    text: parts.length > 0 ? parts.join(" · ") : "No sources yet",
  };
}
