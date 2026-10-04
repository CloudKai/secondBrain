import { z } from "zod";
import { referenceSchema } from "./study-note";

const text = (max: number) => z.string().refine(value => Array.from(value).length >= 1 && Array.from(value).length <= max);
const claim = z.object({ text: text(2000), reference_ids: z.array(text(53)).min(2).max(20) }).strict();
const reference = z.object({ id: text(53), source_id: z.string().uuid(), title: text(200), passage: referenceSchema }).strict();
const overview = z.object({
  overview: claim, agreements: z.array(claim).max(8), differences: z.array(claim).max(8),
  references: z.array(reference).min(2).max(200), source_ids: z.array(z.string().uuid()).min(2).max(20), partial: z.boolean(),
}).strict().superRefine((value, ctx) => {
  const refs = new Map(value.references.map(r => [r.id, r]));
  const sources = new Set(value.source_ids);
  const evidenceSources = new Set(value.references.map(r => r.source_id));
  if (refs.size !== value.references.length || sources.size !== value.source_ids.length || evidenceSources.size !== sources.size ||
      value.references.some(r => !sources.has(r.source_id) || r.id !== `${r.source_id}:${r.passage.id}` || r.passage.end <= r.passage.start ||
        (r.passage.start_ms == null) !== (r.passage.end_ms == null) || (r.passage.start_ms != null && (r.passage.end_ms! <= r.passage.start_ms || r.passage.page != null))) ||
      [value.overview, ...value.agreements, ...value.differences].some(c => c.reference_ids.some(id => !refs.has(id)) || new Set(c.reference_ids.map(id => refs.get(id)?.source_id)).size < 2)) {
    ctx.addIssue({ code: "custom", message: "Invalid overview evidence" });
  }
});
export const overviewSnapshotSchema = z.object({
  topic_id: z.string().uuid(), view_mode: z.enum(["combined", "separate"]), source_ids: z.array(z.string().uuid()).min(1).max(500),
  source_count: z.number().int().positive(), needs_refresh: z.boolean(),
  record: z.object({
    id: z.string().uuid(), topic_id: z.string().uuid(), status: z.enum(["queued", "processing", "succeeded", "failed"]),
    attempts: z.number().int().min(0).max(3), max_attempts: z.literal(3),
    error_code: z.enum(["provider_unavailable", "invalid_output", "timeout", "setup_required", "worker_interrupted"]).nullable(),
    overview: overview.nullable(), updated_at: z.string().datetime({ offset: true }),
  }).strict().nullable(),
}).strict().superRefine((value, ctx) => {
  const record = value.record;
  if (new Set(value.source_ids).size !== value.source_ids.length || value.source_count < value.source_ids.length ||
      (record && (record.topic_id !== value.topic_id || (record.status === "succeeded") !== (record.overview !== null) || record.overview?.source_ids.some(id => !value.source_ids.includes(id))))) {
    ctx.addIssue({ code: "custom", message: "Invalid topic membership" });
  }
});
export type OverviewSnapshot = z.infer<typeof overviewSnapshotSchema>;
export type OverviewClaim = z.infer<typeof claim>;
export type TopicOverview = z.infer<typeof overview>;
