import {z} from 'zod';
import {learningSnapshotSchema} from './learning';
const text=(max:number)=>z.string().min(1).refine(s=>Array.from(s).length<=max);
const summary=z.object({id:z.string().uuid(),legacy_source_id:z.string().uuid(),title:text(200),goal:z.string().refine(s=>Array.from(s).length<=500),revision:z.number().int().positive(),source_count:z.number().int().nonnegative(),path_count:z.number().int().nonnegative(),original_source_available:z.boolean(),created_at:z.string().datetime({offset:true}),updated_at:z.string().datetime({offset:true})}).strict();
export const collectionListSchema=z.object({collections:z.array(summary).max(50),next_offset:z.number().int().nonnegative().nullable()}).strict().refine(v=>new Set(v.collections.map(c=>c.id)).size===v.collections.length);
export const collectionDetailSchema=z.object({collection:summary,sources:z.array(z.object({id:z.string().uuid(),title:text(200),source_kind:z.enum(['article','pdf','video']),source_version:z.number().int().min(1).max(20)}).strict()).max(200),learning:learningSnapshotSchema}).strict().superRefine((v,ctx)=>{
 if(v.learning.source_id!==v.collection.legacy_source_id||new Set(v.sources.map(s=>s.id)).size!==v.sources.length||v.sources.length!==v.collection.source_count||new Set(v.learning.plans.filter(p=>p.confirmed_at).map(p=>p.path_id)).size!==v.collection.path_count)ctx.addIssue({code:'custom',message:'Unexpected collection identity or membership'});
});
export type CollectionDetail=z.infer<typeof collectionDetailSchema>;
export type CollectionList=z.infer<typeof collectionListSchema>;
