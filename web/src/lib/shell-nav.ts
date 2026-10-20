import type { Page } from "../types.ts";

export interface ShellTopic {
  id: string;
  title: string;
  sourceCount: number;
}

interface TopicLike {
  id: string;
  title: string;
  notes: ReadonlyArray<{ addedAt: number }>;
}

export const PAGE_LABELS: Record<Page, string> = {
  library: "Home",
  note: "Source note",
  collection: "Learning collections",
  topics: "Topic graph",
  discover: "Reading list",
};

function newestAddedAt(topic: TopicLike): number {
  return topic.notes.reduce(
    (newest, note) => Math.max(newest, note.addedAt),
    Number.NEGATIVE_INFINITY,
  );
}

/** Topics with the most recently added source first; ties and empty topics fall back to title order. */
export function recentTopics(
  topics: ReadonlyArray<TopicLike>,
  limit = 5,
): ShellTopic[] {
  return topics
    .map((topic) => ({ topic, newest: newestAddedAt(topic) }))
    .sort((a, b) =>
      a.newest === b.newest
        ? a.topic.title.localeCompare(b.topic.title)
        : b.newest - a.newest,
    )
    .slice(0, Math.max(0, limit))
    .map(({ topic }) => ({
      id: topic.id,
      title: topic.title,
      sourceCount: topic.notes.length,
    }));
}
