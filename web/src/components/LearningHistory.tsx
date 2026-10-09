import {useEffect,useState} from 'react';
import type {SourceClient} from '../lib/source-client';
import type {LearningHistory as History,LearningSnapshot} from '../lib/learning';
import ReadingText from './ReadingText';
import Modal from './Modal';

export default function LearningHistory({client,onOpen,sourceId}:{client:SourceClient;onOpen:(sourceId:string)=>void;sourceId?:string}){
 const [open,setOpen]=useState(false),[index,setIndex]=useState<History|null>(null),[data,setData]=useState<LearningSnapshot|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{
  if(!open)return;
  let current=true;
  setBusy(true);setError('');
  (sourceId?client.learning(sourceId).then(value=>{if(current)setData(value);}):client.learningHistory().then(value=>{if(current)setIndex(value);})).catch(e=>{if(current)setError(e instanceof Error?e.message:'Could not load history.');}).finally(()=>{if(current)setBusy(false);});
  return()=>{current=false;};
 },[client,open,sourceId]);
 async function select(sourceId:string){
  setBusy(true);setError('');
  try{setData(await client.learning(sourceId));}catch(e){setError(e instanceof Error?e.message:'Could not load history.');}finally{setBusy(false);}
 }
 async function more(){
  if(index?.next_offset==null)return;
  setBusy(true);setError('');
  try{const page=await client.learningHistory(index.next_offset);setIndex(previous=>({collections:[...(previous?.collections??[]),...page.collections],next_offset:page.next_offset}));}catch(e){setError(e instanceof Error?e.message:'Could not load more history.');}finally{setBusy(false);}
 }
 return <>
  <button className="text-button" onClick={()=>{setData(null);setOpen(true);}}>{sourceId?'Review retained learning history':'Review learning history'}</button>
  {open&&<Modal title="Learning history" className="learning-history" onClose={()=>setOpen(false)}>
   <p>Revisit your goals, difficulty levels and saved practice. Studying or attempting a question does not establish mastery.</p>
   {busy&&<p role="status">Loading saved learning…</p>}{error&&<p role="alert">{error}</p>}
   {!data?<div className="learning-paths">
    {index?.collections.map(item=><button className="learning-path-card" disabled={busy} key={item.source_id} onClick={()=>void select(item.source_id)}>{item.title}<span>{item.source_available?'Saved source':'Source removed · history retained'}</span></button>)}
    {index&&!index.collections.length&&<p>No saved learning paths yet. Open a source to start.</p>}
    {index?.next_offset!=null&&<button className="button secondary" disabled={busy} onClick={()=>void more()}>Load more history</button>}
   </div>:<>
    {!sourceId&&<button className="text-button" disabled={busy} onClick={()=>setData(null)}>All collections</button>}
    {data.plans.some(plan=>plan.source_id!==null)&&<button className="button secondary" onClick={()=>{setOpen(false);onOpen(data.source_id);}}>Open source and learning path</button>}
    {data.plans.filter(plan=>plan.confirmed_at).map(plan=><article className="learning-feedback" key={plan.id}>
     <h3>{plan.content.title}</h3><p>{plan.difficulty} · {plan.goal}</p>
     {plan.needs_review&&<p role="note">{plan.source_id===null?'Source removed: supporting passages are unavailable.':'Source changed: earlier learning needs review against current evidence.'}</p>}
     <p>{data.activities.filter(a=>a.plan_id===plan.id&&a.kind==='read').length} lessons marked studied</p>
     {data.attempts.filter(attempt=>attempt.plan_id===plan.id).map(attempt=><div key={attempt.id}>
      <h4>{plan.content.lessons[attempt.lesson_index].check.question}</h4><ReadingText text={attempt.response}/>
      {attempt.feedback?<><p>Provisional AI feedback · needs review</p><ReadingText text={attempt.feedback.summary}/></>:<p>Feedback {attempt.status==='failed'?'unavailable':'pending'}. Your answer is saved.</p>}
     </div>)}
    </article>)}
    {!data.plans.some(plan=>plan.confirmed_at)&&<p>These paths were previewed but not started.</p>}
   </>}
  </Modal>}
 </>;
}
