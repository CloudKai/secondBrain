import { z } from 'zod';
export const indexStatusSchema = z.object({
  source_id: z.string().uuid(),
  source_version: z.number().int().min(1).max(20),
  status: z.enum(['queued','processing','ready','failed']),
  chunks_total: z.number().int().min(0).max(2000),
  chunks_completed: z.number().int().min(0).max(2000),
  error_code: z.enum(['provider_unavailable','worker_interrupted']).nullable(),
}).strict().refine(s=>s.chunks_completed<=s.chunks_total &&
  (s.status!=='ready' || s.chunks_total>0 && s.chunks_completed===s.chunks_total));
export type IndexStatus = z.infer<typeof indexStatusSchema>;
