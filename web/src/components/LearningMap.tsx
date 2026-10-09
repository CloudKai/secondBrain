import type {LearningPlan,LearningSnapshot} from '../lib/learning';

export default function LearningMap({data,onChoose}:{data:LearningSnapshot;onChoose:(plan:LearningPlan,lessonIndex:number|null)=>void}){
 if(!data.plans.length)return null;
 return <details className="learning-map" open><summary>Your learning map</summary>
  <p className="micro-copy">Suggested teaching order →. These links guide study; they do not claim a factual relationship. Source relationships use the separate topic graph.</p>
  <div className="learning-map-paths">{data.plans.map(plan=><article key={plan.id} className={`learning-map-path ${plan.confirmed_at?'opened':'suggested'}`}>
   <h4>{plan.content.title}</h4><p>{plan.goal}</p>
   <p className="micro-copy">{plan.difficulty} · {plan.source_members.length||1} saved {plan.source_members.length>1?'sources':'source'}{plan.branch_of_plan_id?' · Goal branch':''}{plan.needs_review?' · Evidence needs review':''}</p>
   <p>{data.activities.filter(item=>item.plan_id===plan.id&&item.kind==='read').length} lessons marked studied · {data.attempts.filter(item=>item.plan_id===plan.id).length} practice attempts</p>
   <ol aria-label={`Suggested teaching order for ${plan.content.title}`}>{plan.content.lessons.map((lesson,index)=><li key={index}>
    {plan.confirmed_at?<button className="text-button" onClick={()=>onChoose(plan,index)}>{index+1}. {lesson.title}</button>:<span>{index+1}. {lesson.title}</span>}
    <small>{lesson.outcome}</small>{index<plan.content.lessons.length-1&&<span className="learning-order-arrow" aria-label="Suggested next lesson">↓</span>}
   </li>)}</ol>
   {!plan.confirmed_at&&<button className="button secondary" disabled={plan.needs_review} onClick={()=>onChoose(plan,null)}>Preview and confirm this path</button>}
  </article>)}</div><p className="micro-copy">Reading, answer revelation and provisional feedback do not establish mastery.</p>
 </details>;
}
