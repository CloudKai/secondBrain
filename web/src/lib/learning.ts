import {z} from 'zod';
import {referenceSchema} from './study-note';

const text=(max:number)=>z.string().refine(value=>Array.from(value).length>=1&&Array.from(value).length<=max);
const ids=z.array(text(16)).min(1).max(10);
const explanation=z.object({text:text(2000),citation_ids:ids}).strict();
const difficulty=z.enum(['foundation','intermediate','advanced']);
const example=z.object({text:text(2000),provenance:z.enum(['source_backed','generated_example']),citation_ids:z.array(text(16)).max(10)}).strict()
  .refine(value=>(value.provenance==='source_backed')===!!value.citation_ids.length);
const check=z.object({kind:z.enum(['explain','apply','quick_question']),question:text(1000),criteria:z.array(text(500)).min(1).max(5),hint:text(1000),worked_answer:explanation}).strict();
const lesson=z.object({title:text(160),outcome:text(500),explanation,example:example.nullable(),check}).strict();
const content=z.object({title:text(160),outcomes:z.array(text(500)).min(1).max(5),prerequisites:z.array(text(500)).max(5),coverage:text(1000),gaps:z.array(text(500)).max(5),
  background:z.array(z.object({title:text(160),purpose:text(500),text:text(2000)}).strict()).max(3),lessons:z.array(lesson).min(1).max(4)}).strict();
const evidence=z.object({id:text(16),source_id:z.string().uuid(),source_version:z.number().int().min(1).max(20),title:text(200),passage:referenceSchema}).strict();
const member=z.object({source_id:z.string().uuid(),source_version:z.number().int().min(1).max(20),title:text(200),topic_fingerprint:z.string().length(32)}).strict();
const revision=z.object({contributions:z.array(explanation).min(1).max(5),ordering_changes:text(1000),disagreements:z.array(explanation).max(5)}).strict();
const teaching=z.object({selector_policy:z.literal('teaching_evidence_v1'),source_id:z.string().uuid(),source_version:z.number().int().min(1).max(20),capture_sha256:z.string().regex(/^[a-f0-9]{64}$/),index_generation:z.string().uuid(),manifest:z.object({policy_version:z.literal('teaching_manifest_v1'),coverage:text(1000),gaps:z.array(text(500)).max(5),entries:z.array(z.object({kind:z.enum(['concept','prerequisite','example','qualification']),text:text(500),citation_ids:ids}).strict()).min(1).max(24)}).strict()}).strict();
const plan=z.object({id:z.string().uuid(),path_id:z.string().uuid(),request_id:z.string().uuid(),source_id:z.string().uuid().nullable(),source_title:text(200),source_version:z.number().int().min(1).max(20),goal:text(500),difficulty,content,
  references:z.array(referenceSchema).max(100),teaching:teaching.nullable().optional(),evidence:z.array(evidence).max(100).default([]),source_members:z.array(member).max(8).default([]),revision:revision.nullable().default(null),base_plan_id:z.string().uuid().nullable().default(null),branch_of_plan_id:z.string().uuid().nullable().default(null),confirmed_at:z.string().datetime({offset:true}).nullable(),active:z.boolean(),needs_review:z.boolean(),model:z.enum(['gpt-6-luna','gpt-6.1-sol']),policy_version:z.literal('learning_v1'),created_at:z.string().datetime({offset:true})}).strict().superRefine((value,ctx)=>{
  const historical=value.needs_review&&!value.references.length&&(value.source_id===null||!!value.source_members.length);
  if(!value.references.length&&!historical)ctx.addIssue({code:'custom',message:'Current teaching requires evidence'});
  if(value.evidence.length&&(value.evidence.length!==value.references.length||value.evidence.some((item,index)=>JSON.stringify({...item.passage,id:item.id})!==JSON.stringify(value.references[index]))))ctx.addIssue({code:'custom',message:'Invalid original passage mapping'});
  const refs=new Set(value.references.map(ref=>ref.id));
  if(value.teaching&&(value.teaching.source_id!==value.source_id||value.teaching.source_version!==value.source_version||value.teaching.manifest.entries.some(entry=>entry.citation_ids.some(id=>!refs.has(id)))))ctx.addIssue({code:'custom',message:'Invalid teaching manifest'});
  if(value.revision&&!historical&&[...value.revision.contributions,...value.revision.disagreements].some(claim=>claim.citation_ids.some(id=>!refs.has(id))))ctx.addIssue({code:'custom',message:'Unknown revision evidence'});
  if(refs.size!==value.references.length||value.active&&!value.confirmed_at||!historical&&value.content.lessons.some(item=>[item.explanation,item.check.worked_answer,...(item.example?[item.example]:[])].some(claim=>claim.citation_ids.some(id=>!refs.has(id)))))
    ctx.addIssue({code:'custom',message:'Invalid teaching attribution'});
});
const feedback=z.object({summary:text(2000),criteria:z.array(z.object({criterion_index:z.number().int().min(0).max(4),observation:text(1000),assessment:z.enum(['addressed','try_again','uncertain']),citation_ids:ids}).strict()).min(1).max(5),next_hint:text(1000)}).strict();
const attempt=z.object({id:z.string().uuid(),plan_id:z.string().uuid(),lesson_index:z.number().int().min(0).max(3),response:text(5000),difficulty,status:z.enum(['pending','needs_review','failed']),feedback:feedback.nullable(),created_at:z.string().datetime({offset:true})}).strict().refine(value=>(value.status==='needs_review')===(value.feedback!==null));
const activity=z.object({plan_id:z.string().uuid(),lesson_index:z.number().int().min(0).max(3),kind:z.enum(['read','hint','reveal','background_opened'])}).strict();
export const learningSnapshotSchema=z.object({source_id:z.string().uuid(),selected_plan_id:z.string().uuid().nullable().default(null),selected_lesson_index:z.number().int().min(0).max(3).default(0),selected_place_revision:z.number().int().nonnegative().optional(),plans:z.array(plan).max(60),attempts:z.array(attempt).max(1000),activities:z.array(activity).max(1000)}).strict().superRefine((value,ctx)=>{
  const plans=new Map(value.plans.map(item=>[item.id,item]));
  if(plans.size!==value.plans.length||value.plans.some(item=>item.source_id!==value.source_id&&!(item.source_id===null&&item.needs_review))||new Set(value.attempts.map(item=>item.id)).size!==value.attempts.length)
    ctx.addIssue({code:'custom',message:'Unexpected learning collection'});
  if(value.selected_plan_id!==null){const selected=plans.get(value.selected_plan_id);if(!selected?.confirmed_at||value.selected_lesson_index>=selected.content.lessons.length)ctx.addIssue({code:'custom',message:'Unexpected learning place'});}
  for(const item of value.attempts){
    const selected=plans.get(item.plan_id),lesson=selected?.content.lessons[item.lesson_index];
    if(!selected||!lesson||item.difficulty!==selected.difficulty||item.feedback&&(item.feedback.criteria.length!==lesson.check.criteria.length||new Set(item.feedback.criteria.map(c=>c.criterion_index)).size!==lesson.check.criteria.length||item.feedback.criteria.some(c=>c.criterion_index>=lesson.check.criteria.length||!(selected.needs_review&&!selected.references.length)&&c.citation_ids.some(id=>!selected.references.some(ref=>ref.id===id)))))
      ctx.addIssue({code:'custom',message:'Unexpected practice feedback'});
  }
  for(const item of value.activities){
    const selected=plans.get(item.plan_id);
    if(!selected||item.lesson_index>=(item.kind==='background_opened'?selected.content.background.length:selected.content.lessons.length))
      ctx.addIssue({code:'custom',message:'Unexpected learning activity'});
  }
});
export type LearningSnapshot=z.infer<typeof learningSnapshotSchema>;
export type LearningPlan=z.infer<typeof plan>;
export type LearningDifficulty=z.infer<typeof difficulty>;
export type LearningActivity=z.infer<typeof activity>;
export interface LearningPreviewInput {request_id:string;source_version:number;goal:string;difficulty:LearningDifficulty;path_id:string|null;evidence_mode?:'note'|'capture'}
export interface LearningAttemptInput {request_id:string;lesson_index:number;response:string}
export const learningTutorSchema=z.object({text:text(2000),citation_ids:z.array(text(16)).max(10),gap:text(500).nullable()}).strict().refine(value=>!!value.citation_ids.length||!!value.gap);
export type LearningTutorReply=z.infer<typeof learningTutorSchema>;
export interface LearningTutorQuestion {lesson_index:number;question:string;history:{role:'user'|'assistant';text:string}[]}

export const learningHistorySchema=z.object({collections:z.array(z.object({source_id:z.string().uuid(),title:text(200),source_available:z.boolean()}).strict()).max(50),next_offset:z.number().int().nonnegative().nullable()}).strict();
export type LearningHistory=z.infer<typeof learningHistorySchema>;

export const learningCandidatesSchema=z.object({source_id:z.string().uuid(),plan_id:z.string().uuid(),candidates:z.array(z.object({source_id:z.string().uuid(),source_version:z.number().int().min(1).max(20),title:text(200),shared_topics:z.array(text(500)).min(1).max(10)}).strict()).max(200)}).strict();
export type LearningCandidates=z.infer<typeof learningCandidatesSchema>;
export interface LearningRevisionInput {request_id:string;source_id:string|null;source_version:number|null;difficulty?:LearningDifficulty;goal?:string}


export const learningGraphSchema=z.object({collections:z.array(z.object({source_id:z.string().uuid(),source_available:z.boolean(),title:text(200),source_ids:z.array(z.string().uuid()).min(1).max(321),path_count:z.number().int().min(1).max(40),studied_lessons:z.number().int().min(0).max(1000),practice_attempts:z.number().int().min(0).max(1000),provisional_checks:z.number().int().min(0).max(1000),flagged_plans:z.number().int().min(0).max(60)}).strict()).max(200),partial:z.boolean()}).strict().refine(value=>new Set(value.collections.map(item=>item.source_id)).size===value.collections.length);
export type LearningGraph=z.infer<typeof learningGraphSchema>;

export const learningSummarySchema=z.object({resume:z.object({source_id:z.string().uuid(),source_available:z.boolean(),source_title:text(200),plan_id:z.string().uuid(),path_id:z.string().uuid(),plan_title:text(160),goal:text(500),lesson_index:z.number().int().min(0).max(3),lesson_title:text(160),needs_review:z.boolean(),selected_at:z.string().datetime({offset:true}),place_revision:z.number().int().positive()}).strict().nullable(),studied_lessons:z.number().int().nonnegative(),practice_attempts:z.number().int().nonnegative(),provisional_checks:z.number().int().nonnegative(),pending_feedback:z.number().int().nonnegative(),failed_feedback:z.number().int().nonnegative()}).strict();
export type LearningSummary=z.infer<typeof learningSummarySchema>;
