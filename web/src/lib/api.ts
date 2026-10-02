import { z } from "zod";
import type { Note } from "../types";
import type { SavedSource } from "./source-client";
import { studyLabel, studyMessage, type StudyRecord } from "./study-note";

export function noteFromSavedSource(
  source: SavedSource,
  study?: StudyRecord,
): Note {
  if (
    study &&
    (study.source_id !== source.id ||
      study.note?.references.some(
        (r) =>
          Array.from(source.captured_text).slice(r.start, r.end).join("") !==
          r.excerpt,
      ))
  ) {
    throw new Error(
      "The saved note's source references could not be verified. Retry loading.",
    );
  }
  return {
    id: source.id,
    title: source.title,
    subtitle: studyLabel(study),
    author: new URL(source.original_url).hostname,
    year: `Captured ${new Date(source.captured_at).toLocaleDateString("en", { dateStyle: "medium" })}`,
    url: source.original_url,
    kind: "Article",
    color: "mint",
    overview: study?.note?.overview.text ?? studyMessage(study),
    concepts:
      study?.note?.concepts.map((c) => ({
        title: c.title,
        text: c.text,
        topic: "",
      })) ?? [],
    recall:
      study?.note?.recall.map((r) => ({
        question: r.question,
        answer: r.answer,
      })) ?? [],
    topics: [],
    evidence: source.captured_text,
    evidenceLabel: source.coverage_detail,
    demo: false,
    addedAt: Date.parse(source.captured_at),
    savedSource: source,
    study,
  };
}

const type = z.enum(["flow", "hierarchy", "network"]);
const resultSchema = z
  .object({
    folder_id: z.string().min(1),
    source_url: z
      .string()
      .url()
      .refine((u) => /^https?:\/\//.test(u)),
    raw_text: z.string(),
    simplified_summary: z.string().min(1),
    diagram_type: type,
    diagram_options: z.array(type).min(1).max(3),
    nodes: z
      .array(
        z.object({ id: z.string().min(1), label: z.string().min(1) }).strict(),
      )
      .min(2)
      .max(16),
    edges: z
      .array(
        z
          .object({
            id: z.string().min(1),
            source: z.string(),
            target: z.string(),
            label: z.string().nullable().optional(),
          })
          .strict(),
      )
      .min(1)
      .max(24),
  })
  .strict()
  .superRefine((r, ctx) => {
    const nodes = new Set(r.nodes.map((n) => n.id));
    if (
      nodes.size !== r.nodes.length ||
      new Set(r.edges.map((e) => e.id)).size !== r.edges.length ||
      r.edges.some((e) => !nodes.has(e.source) || !nodes.has(e.target)) ||
      !r.diagram_options.includes(r.diagram_type) ||
      new Set(r.diagram_options).size !== r.diagram_options.length
    )
      ctx.addIssue({ code: "custom", message: "Invalid graph contract" });
  });
export function noteFromResponse(body: unknown, title: string): Note {
  const r = resultSchema.parse(body);
  const points = r.simplified_summary
    .split("\n")
    .map((p) => p.replace(/^\s*[-*•]\s+/, "").trim())
    .filter(Boolean);
  if (points.length !== 4)
    throw new Error(
      "The API did not return four study points. Try importing again.",
    );
  const topics = r.nodes.map((n) => n.label);
  return {
    id: crypto.randomUUID(),
    title: title.trim() || new URL(r.source_url).hostname,
    subtitle: "Four key ideas from your saved article.",
    author: new URL(r.source_url).hostname,
    year: String(new Date().getFullYear()),
    url: r.source_url,
    kind: "Article",
    color: "mint",
    overview: points[0],
    concepts: points.map((text, i) => ({
      title: `Key idea ${i + 1}`,
      text,
      topic: topics[i % topics.length],
    })),
    recall: points.map((answer, i) => ({
      question: `Explain key idea ${i + 1} in your own words.`,
      answer,
    })),
    topics,
    evidence: r.raw_text,
    evidenceLabel:
      "Captured source text · full extraction, no passage alignment",
    demo: false,
    addedAt: Date.now(),
  };
}
export async function importArticle(
  url: string,
  title: string,
  rawText: string,
): Promise<Note> {
  let response: Response;
  try {
    response = await fetch("/api/v1/process-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        raw_text: rawText || null,
        folder_id: "ai-engineering",
      }),
      signal: AbortSignal.timeout(180_000),
    });
  } catch {
    throw new Error(
      "Could not reach the article service. Start the backend and try again.",
    );
  }
  if (!response.ok)
    throw new Error(
      response.status === 422
        ? "This article could not be read. Try a public URL or paste the article text."
        : "The article service is unavailable. Check the backend connection and try again.",
    );
  const body: unknown = await response.json().catch(() => null);
  try {
    return noteFromResponse(body, title);
  } catch {
    throw new Error(
      "The article service returned an incomplete result. Try again.",
    );
  }
}
