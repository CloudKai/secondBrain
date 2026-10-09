import type {LearningPlan,LearningSnapshot} from '../lib/learning';
import ReadingText from './ReadingText';

// Reuse only observable prior context, never copy a check result. Exact outcome,
// level and original supporting passages avoid guessed semantic equivalence.
function support(plan:LearningPlan,index:number){
 const ids=plan.content.lessons[index].explanation.citation_ids;
 return JSON.stringify(ids.map(id=>{
  const evidence=plan.evidence.find(item=>item.id===id);
  return evidence?{source: evidence.source_id,version:evidence.source_version,passage:evidence.passage}
   :{source:plan.source_id,version:plan.source_version,passage:plan.references.find(item=>item.id===id)};
 }).map(item=>JSON.stringify(item)).sort());
}
export default function SharedLearningContext({data,plan,lessonIndex,onReview}:{data:LearningSnapshot;plan:LearningPlan;lessonIndex:number;onReview:(plan:LearningPlan,index:number)=>void}){
 if(!plan.branch_of_plan_id||plan.needs_review)return null;
 const ancestors=new Set<string>();let parent=plan.branch_of_plan_id;
 while(parent&&!ancestors.has(parent)){
  ancestors.add(parent);const previous=data.plans.find(item=>item.id===parent);parent=previous?.base_plan_id??'';
 }
 const lesson=plan.content.lessons[lessonIndex];
 const matches=data.plans.filter(item=>ancestors.has(item.id)&&item.confirmed_at&&!item.needs_review&&item.difficulty===plan.difficulty).flatMap(previous=>previous.content.lessons.flatMap((old,index)=>
  old.outcome===lesson.outcome&&old.check.kind!=='apply'&&support(previous,index)===support(plan,lessonIndex)?[{previous,index}]:[]));
 const prior=matches.find(({previous,index})=>data.activities.some(item=>item.plan_id===previous.id&&item.lesson_index===index&&item.kind==='read')||data.attempts.some(item=>item.plan_id===previous.id&&item.lesson_index===index));
 if(!prior)return null;
 const attempts=data.attempts.filter(item=>item.plan_id===prior.previous.id&&item.lesson_index===prior.index);
 return <aside className="learning-shared" aria-label="Applicable prior learning context"><h4>You have met this concept before</h4>
  <p>The outcome, difficulty and supporting passages match your earlier path. Use that work as context or revisit it before continuing.</p>
  <p className="micro-copy">Prior feedback is provisional. New application checks still need their own attempt; earlier work does not pass this check.</p>
  <details><summary>Review your earlier learning</summary><p>{prior.previous.content.title} · {prior.previous.difficulty}</p>
   {attempts.map(attempt=><div key={attempt.id}><ReadingText text={attempt.response}/><small>{attempt.status.replaceAll('_',' ')} · earlier attempt</small></div>)}
   <button className="text-button" onClick={()=>onReview(prior.previous,prior.index)}>Open the earlier lesson and check</button>
  </details>
 </aside>;
}
