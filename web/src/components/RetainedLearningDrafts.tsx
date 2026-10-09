import {useId,useState} from 'react';
import type {SourceClient} from '../lib/source-client';
import type {CollectionDetail} from '../lib/collections';
import {useLearningDraft} from '../lib/draft-workspace';
import LearningDraftStatus from './LearningDraftStatus';

function DraftFields({client,collectionId,planId,lessonIndex}:{client:SourceClient;collectionId:string;planId:string;lessonIndex:number}){
 const answer=useLearningDraft(client,{collectionId,planId,lessonIndex,kind:'answer'}),question=useLearningDraft(client,{collectionId,planId,lessonIndex,kind:'question'}),id=useId();
 return <>{([{draft:answer,kind:'answer',label:'Unfinished practice answer',limit:5000},{draft:question,kind:'question',label:'Unsent tutor question',limit:2000}] as const).map(({draft,kind,label,limit})=><div key={kind} className="draft-history-editor"><label htmlFor={`${id}-${kind}`}>{label}</label><textarea id={`${id}-${kind}`} rows={4} maxLength={limit*2} value={draft.state.text} disabled={draft.state.status==='loading'||draft.state.status==='signedout'} onChange={event=>draft.edit(event.target.value)}/><LearningDraftStatus draft={draft}/></div>)}</>;
}
export default function RetainedLearningDrafts({data,client}:{data:CollectionDetail;client:SourceClient}){
 const plans=data.learning.plans.filter(plan=>plan.confirmed_at);
 const [open,setOpen]=useState(false),[planId,setPlanId]=useState(data.learning.selected_plan_id??plans[0]?.id??''),[lessonIndex,setLessonIndex]=useState(data.learning.selected_lesson_index),id=useId();
 const plan=plans.find(p=>p.id===planId)??plans[0];
 if(!plan)return null;
 return <details onToggle={event=>setOpen(event.currentTarget.open)}><summary>Recover unfinished learning drafts</summary><p>Your own writing is retained separately from submitted attempts. Removed source evidence cannot support new teaching.</p>{open&&<><label htmlFor={`${id}-plan`}>Saved plan version</label><select id={`${id}-plan`} value={plan.id} onChange={event=>{setPlanId(event.target.value);setLessonIndex(0);}}>{plans.map(p=><option key={p.id} value={p.id}>{p.content.title} · {p.difficulty} · {new Date(p.created_at).toLocaleString()}</option>)}</select><label htmlFor={`${id}-lesson`}>Lesson</label><select id={`${id}-lesson`} value={lessonIndex} onChange={event=>setLessonIndex(Number(event.target.value))}>{plan.content.lessons.map((lesson,index)=><option key={index} value={index}>{lesson.title}</option>)}</select><DraftFields key={`${plan.id}:${lessonIndex}`} client={client} collectionId={data.collection.id} planId={plan.id} lessonIndex={lessonIndex}/></>}</details>;
}
