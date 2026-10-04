import { z } from "zod";

const text = (max: number) =>
  z
    .string()
    .refine(
      (value) =>
        Array.from(value).length >= 1 && Array.from(value).length <= max,
    );
const citations = z.array(text(16)).min(1).max(10);
const explanation = z
  .object({ text: text(2000), citation_ids: citations })
  .strict();
const concept = explanation.extend({ title: text(160) }).strict();
const equation = explanation.extend({ expression: text(500) }).strict();
const recall = z
  .object({ question: text(500), answer: text(2000), citation_ids: citations })
  .strict();
export const referenceSchema = z
  .object({
    id: text(16),
    start: z.number().int().nonnegative(),
    end: z.number().int().positive(),
    excerpt: text(1000),
    page: z.number().int().min(1).max(100).nullish(),
    start_ms: z.number().int().min(0).max(604800000).nullish(),
    end_ms: z.number().int().min(1).max(604800000).nullish(),
  })
  .strict();
const noteSchema = z
  .object({
    overview: explanation,
    concepts: z.array(concept).min(1).max(10),
    examples: z.array(concept).max(6),
    equations: z.array(equation).max(6),
    recall: z.array(recall).min(1).max(10),
    references: z.array(referenceSchema).min(1).max(100),
  })
  .strict()
  .superRefine((note, ctx) => {
    const ids = new Set(note.references.map((r) => r.id));
    const claims = [
      note.overview,
      ...note.concepts,
      ...note.examples,
      ...note.equations,
      ...note.recall,
    ];
    if (
      ids.size !== note.references.length ||
      note.references.some(
        (r) =>
          r.end <= r.start ||
          (r.start_ms == null) !== (r.end_ms == null) ||
          (r.start_ms != null && (r.end_ms! <= r.start_ms || r.page != null)),
      ) ||
      claims.some((c) => c.citation_ids.some((id) => !ids.has(id)))
    ) {
      ctx.addIssue({ code: "custom", message: "Invalid source references" });
    }
  });
export const studySchema = z
  .object({
    source_id: z.string().uuid(),
    status: z.enum(["queued", "processing", "succeeded", "failed"]),
    attempts: z.number().int().min(0).max(3),
    max_attempts: z.literal(3),
    next_attempt_at: z.string().datetime({ offset: true }),
    error_code: z
      .enum([
        "provider_unavailable",
        "invalid_output",
        "timeout",
        "setup_required",
        "worker_interrupted",
      ])
      .nullable(),
    note: noteSchema.nullable(),
    updated_at: z.string().datetime({ offset: true }),
  })
  .strict()
  .superRefine((record, ctx) => {
    if ((record.status === "succeeded") !== (record.note !== null))
      ctx.addIssue({
        code: "custom",
        message: "Only succeeded studies contain notes",
      });
  });
export const studyPageSchema = z
  .object({
    studies: z.array(studySchema),
    next_offset: z.number().int().nonnegative().nullable(),
  })
  .strict();
export type StudyRecord = z.infer<typeof studySchema>;
export type StudyNote = z.infer<typeof noteSchema>;
export type SourceReference = z.infer<typeof referenceSchema>;

export function studyLabel(study?: StudyRecord): string {
  if (!study) return "Study note pending";
  if (study.status === "succeeded") return "Study note ready";
  if (study.status === "failed") return "Study note failed";
  if (study.status === "processing") return "Creating study note";
  return study.attempts ? "Retrying study note" : "Study note queued";
}

export function studyMessage(study?: StudyRecord): string {
  if (!study)
    return "Your source is saved. Generate a structured note from its captured text.";
  if (study.status === "succeeded")
    return "A structured note grounded in your saved source.";
  if (study.status === "processing")
    return `Creating a note from the captured text. Attempt ${study.attempts} of ${study.max_attempts}.`;
  if (study.status === "queued")
    return study.attempts
      ? `The last attempt could not complete. Retrying automatically after ${new Date(study.next_attempt_at).toLocaleTimeString()}; ${study.max_attempts - study.attempts} attempts remain.`
      : "Your note request is saved. Waiting for the study worker; you can leave this page and reopen it later.";
  if (study.error_code === "setup_required")
    return "The study worker needs a valid model key and account access. Ask the app administrator to check the worker configuration, then retry.";
  if (study.error_code === "invalid_output")
    return "The generated note or its citations could not be validated. No note was saved. You can retry generation.";
  return "Generation could not complete within the retry limit. Your captured source is safe. Check the connection or worker, then retry.";
}
