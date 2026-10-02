import type { SavedSource } from "./lib/source-client";
import type { StudyRecord } from "./lib/study-note";

export type Page = "library" | "note" | "topics" | "discover";
export type PanelTab = "Topic" | "Graph" | "Sources";
export interface Concept {
  title: string;
  text: string;
  topic: string;
}
export interface Recall {
  question: string;
  answer: string;
}
export interface Note {
  savedSource?: SavedSource;
  study?: StudyRecord;
  id: string;
  title: string;
  subtitle: string;
  author: string;
  year: string;
  url: string;
  kind: "Article" | "Paper";
  color: "mint" | "purple" | "peach";
  overview: string;
  concepts: Concept[];
  example?: string;
  equation?: string;
  recall: Recall[];
  topics: string[];
  evidence: string;
  evidenceLabel: string;
  demo: boolean;
  addedAt: number;
}
export interface Topic {
  id: string;
  title: string;
  notes: Note[];
}
export interface Connection {
  id: string;
  source: string;
  target: string;
  label: string;
  reason: string;
  noteIds: string[];
}
