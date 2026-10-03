import { z } from 'zod';
const text=(max:number)=>z.string().refine(s=>Array.from(s).length>0&&Array.from(s).length<=max);
const uuid=z.string().uuid();
const description={id:uuid,title:text(100),context:text(100),aliases:z.array(text(100)).max(500),groups:z.array(text(100)).max(100),description:text(500)};
const assignment=z.object({...description,role:z.enum(['main','supporting']),citation_ids:z.array(text(16)).min(1).max(10),uncertain:z.boolean(),suggested_topic_id:uuid.nullable(),placement_reason:text(500)}).strict();
const relation=z.object({source:uuid,target:uuid,kind:z.enum(['uses','requires','evaluates']),reason:text(500),citation_ids:z.array(text(16)).min(1).max(10)}).strict();
export const topicRecordSchema=z.object({source_id:uuid,status:z.enum(['queued','processing','succeeded','failed']),attempts:z.number().int().min(0).max(3),max_attempts:z.literal(3),next_attempt_at:z.string().datetime({offset:true}),error_code:z.enum(['provider_unavailable','invalid_output','timeout','setup_required','worker_interrupted']).nullable(),analysis:z.object({topics:z.array(assignment).min(1).max(12),relations:z.array(relation).max(24),catalog_partial:z.boolean()}).strict().nullable(),updated_at:z.string().datetime({offset:true})}).strict().superRefine((r,ctx)=>{
 if((r.status==='succeeded')!==(r.analysis!==null))ctx.addIssue({code:'custom',message:'Invalid topic status'});
 if(r.analysis){const ids=new Set(r.analysis.topics.map(t=>t.id));if(ids.size!==r.analysis.topics.length||!r.analysis.topics.some(t=>t.role==='main')||r.analysis.relations.some(t=>t.source===t.target||!ids.has(t.source)||!ids.has(t.target)))ctx.addIssue({code:'custom',message:'Invalid mapped topics'});}
});
export const topicLibrarySchema=z.object({maps:z.array(topicRecordSchema).max(500),topics:z.array(z.object({...description,source_ids:z.array(uuid).min(1).max(500),uncertain:z.boolean()}).strict()).max(6000),connections:z.array(z.object({id:text(120),source:uuid,target:uuid,kind:z.enum(['uses','requires','evaluates']),reason:text(1000),source_ids:z.array(uuid).min(2).max(500),evidence:z.record(uuid,z.array(text(16)).min(1).max(10))}).strict()).max(12000),graph_ready:z.boolean(),partial:z.boolean()}).strict().superRefine((library,ctx)=>{
 const ids=new Set(library.topics.map(t=>t.id));
 if(ids.size!==library.topics.length||library.connections.some(c=>c.source===c.target||!ids.has(c.source)||!ids.has(c.target)||new Set(c.source_ids).size<2))ctx.addIssue({code:'custom',message:'Invalid topic graph'});
});
export type TopicLibrary=z.infer<typeof topicLibrarySchema>;
export type TopicRecord=z.infer<typeof topicRecordSchema>;
export const emptyTopicLibrary:TopicLibrary={maps:[],topics:[],connections:[],graph_ready:false,partial:false};
