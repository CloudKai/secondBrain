import {z} from 'zod';
export type DraftKind='answer'|'question';
export interface DraftSlot {collectionId:string;planId:string;lessonIndex:number;kind:DraftKind}
export interface DraftSave {text:string;expected_revision:number;save_id:string}
export const lessonDraftSchema=z.object({
 collection_id:z.string().uuid(),plan_id:z.string().uuid(),lesson_index:z.number().int().min(0).max(3),kind:z.enum(['answer','question']),scope:z.literal('lesson'),
 source_version:z.number().int().min(1).max(20),evidence_current:z.boolean(),text:z.string(),revision:z.number().int().nonnegative().safe(),save_id:z.string().uuid().nullable(),updated_at:z.string().datetime({offset:true}).nullable(),
}).strict().refine(v=>Array.from(v.text).length<=(v.kind==='answer'?5000:2000)&& (v.revision===0 ? v.text===''&&v.save_id===null&&v.updated_at===null : v.save_id!==null&&v.updated_at!==null));
export type LessonDraft=z.infer<typeof lessonDraftSchema>;
export class DraftConflictError extends Error {constructor(message:string){super(message);this.name='DraftConflictError';}}
export function draftPath(slot:DraftSlot){return `/learning/collections/${encodeURIComponent(slot.collectionId)}/plans/${encodeURIComponent(slot.planId)}/lessons/${slot.lessonIndex}/drafts/${slot.kind}`;}
