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
const plan=z.object({id:z.string().uuid(),path_id:z.string().uuid(),request_id:z.string().uuid(),source_id:z.string().uuid().nullable(),source_title:text(200),source_version:z.number().int().min(1).max(20),goal:text(500),difficulty,content,
  references:z.array(referenceSchema).max(100),confirmed_at:z.string().datetime({offset:true}).nullable(),active:z.boolean(),needs_review:z.boolean(),model:z.enum(['gpt-6-luna','gpt-6.1-sol']),policy_version:z.literal('learning_v1'),created_at:z.string().datetime({offset:true})}).strict().superRefine((value,ctx)=>{
  const historical=value.source_id===null&&value.needs_review&&!value.references.length;
  if(!value.references.length&&!historical)ctx.addIssue({code:'custom',message:'Current teaching requires evidence'});
  const refs=new Set(value.references.map(ref=>ref.id));
  if(refs.size!==value.references.length||value.active&&!value.confirmed_at||!historical&&value.content.lessons.some(item=>[item.explanation,item.check.worked_answer,...(item.example?[item.example]:[])].some(claim=>claim.citation_ids.some(id=>!refs.has(id)))))
    ctx.addIssue({code:'custom',message:'Invalid teaching attribution'});
});
const feedback=z.object({summary:text(2000),criteria:z.array(z.object({criterion_index:z.number().int().min(0).max(4),observation:text(1000),assessment:z.enum(['addressed','try_again','uncertain']),citation_ids:ids}).strict()).min(1).max(5),next_hint:text(1000)}).strict();
const attempt=z.object({id:z.string().uuid(),plan_id:z.string().uuid(),lesson_index:z.number().int().min(0).max(3),response:text(5000),difficulty,status:z.enum(['pending','needs_review','failed']),feedback:feedback.nullable(),created_at:z.string().datetime({offset:true})}).strict().refine(value=>(value.status==='needs_review')===(value.feedback!==null));
const activity=z.object({plan_id:z.string().uuid(),lesson_index:z.number().int().min(0).max(3),kind:z.enum(['read','hint','reveal','background_opened'])}).strict();
export const learningSnapshotSchema=z.object({source_id:z.string().uuid(),plans:z.array(plan).max(60),attempts:z.array(attempt).max(1000),activities:z.array(activity).max(1000)}).strict().superRefine((value,ctx)=>{
  const plans=new Map(value.plans.map(item=>[item.id,item]));
  if(plans.size!==value.plans.length||value.plans.some(item=>item.source_id!==value.source_id&&!(item.source_id===null&&item.needs_review))||new Set(value.attempts.map(item=>item.id)).size!==value.attempts.length)
    ctx.addIssue({code:'custom',message:'Unexpected learning collection'});
  for(const item of value.attempts){
    const selected=plans.get(item.plan_id),lesson=selected?.content.lessons[item.lesson_index];
    if(!selected||!lesson||item.difficulty!==selected.difficulty||item.feedback&&(item.feedback.criteria.length!==lesson.check.criteria.length||new Set(item.feedback.criteria.map(c=>c.criterion_index)).size!==lesson.check.criteria.length||item.feedback.criteria.some(c=>c.criterion_index>=lesson.check.criteria.length||!(selected.source_id===null&&selected.needs_review)&&c.citation_ids.some(id=>!selected.references.some(ref=>ref.id===id)))))
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
export interface LearningPreviewInput {request_id:string;source_version:number;goal:string;difficulty:LearningDifficulty;path_id:string|null}
export interface LearningAttemptInput {request_id:string;lesson_index:number;response:string}
export const learningTutorSchema=z.object({text:text(2000),citation_ids:z.array(text(16)).max(10),gap:text(500).nullable()}).strict().refine(value=>!!value.citation_ids.length||!!value.gap);
export type LearningTutorReply=z.infer<typeof learningTutorSchema>;
export interface LearningTutorQuestion {lesson_index:number;question:string;history:{role:'user'|'assistant';text:string}[]}

export const learningHistorySchema=z.object({collections:z.array(z.object({source_id:z.string().uuid(),title:text(200),source_available:z.boolean()}).strict()).max(50),next_offset:z.number().int().nonnegative().nullable()}).strict();
export type LearningHistory=z.infer<typeof learningHistorySchema>;
