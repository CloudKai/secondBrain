import {z} from 'zod';
import {referenceSchema} from './study-note';
import type {SavedSource} from './source-client';
const text=(max:number)=>z.string().refine(v=>!!v.trim()&&Array.from(v).length<=max);
const claimSchema=z.object({text:text(2000),reference_ids:z.array(text(53)).min(1).max(10)}).strict();
const assistantReferenceSchema=z.object({id:text(53),source_id:z.string().uuid(),source_version:z.number().int().min(1).max(20),title:text(200),passage:referenceSchema}).strict();
export const assistantAnswerSchema=z.object({status:z.enum(['supported','unsupported']),claims:z.array(claimSchema).max(8),gap:text(1000).nullable(),references:z.array(assistantReferenceSchema).max(80),partial:z.boolean(),source_ids:z.array(z.string().uuid()).min(1).max(9)}).strict().superRefine((answer,ctx)=>{
 const ids=new Set(answer.references.map(r=>r.id));const used=new Set(answer.claims.flatMap(c=>c.reference_ids));
 if(ids.size!==answer.references.length||used.size!==ids.size||[...used].some(id=>!ids.has(id))||new Set(answer.source_ids).size!==answer.source_ids.length||answer.references.some(r=>!answer.source_ids.includes(r.source_id)||r.id!==`${r.source_id}:${r.passage.id}`||r.passage.end<=r.passage.start||(r.passage.start_ms==null)!==(r.passage.end_ms==null)||(r.passage.start_ms!=null&&(r.passage.end_ms!<=r.passage.start_ms||r.passage.page!=null)))|| (answer.status==='supported' ? !answer.claims.length||answer.gap!==null : !!answer.claims.length||!answer.gap))ctx.addIssue({code:'custom',message:'Invalid assistant evidence'});
});
export type AssistantAnswer=z.infer<typeof assistantAnswerSchema>;
export type AssistantReference=z.infer<typeof assistantReferenceSchema>;
export interface AssistantQuestion {question:string;source_version:number;topic_id?:string|null;library?:boolean;history?:{role:'user'|'assistant';text:string}[];}

export function citationMatchesSource(ref:AssistantReference,source:SavedSource){
 const p=ref.passage;
 if(ref.source_id!==source.id||ref.source_version!==(source.source_version??1)||Array.from(source.captured_text).slice(p.start,p.end).join('')!==p.excerpt)return false;
 if(source.document)return p.start_ms==null&&source.document.pages.some(page=>page.page===p.page&&page.start<=p.start&&p.end<=page.end);
 if(source.transcript)return p.page==null&&source.transcript.segments.some(c=>c.start<=p.start&&p.end<=c.end&&c.start_ms===p.start_ms&&c.end_ms===p.end_ms);
 return p.page==null&&p.start_ms==null;
}
