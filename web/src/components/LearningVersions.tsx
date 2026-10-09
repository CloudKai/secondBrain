import type {LearningPlan} from '../lib/learning';
import {learningPlanLabel} from '../lib/learning-continuity';
export default function LearningVersions({plans,onChoose,busy=false}:{plans:LearningPlan[];onChoose:(plan:LearningPlan)=>void;busy?:boolean}){
 const history=plans.filter(plan=>plan.confirmed_at&&!plan.active);
 if(!history.length)return null;
 return <details className="learning-version-history"><summary>Previous plan versions ({history.length})</summary>
  <p>Earlier teaching and answers stay saved. Viewing a version does not make it current.</p>
  {history.map(plan=><article key={plan.id}><h4>{plan.content.title}</h4><p>{learningPlanLabel(plan,plans)}</p><p>{plan.goal}</p>
   {plan.revision&&<p>What changed: {plan.revision.ordering_changes}</p>}
   <button className="text-button" disabled={busy} onClick={()=>onChoose(plan)}>View previous version: {plan.content.title} · {learningPlanLabel(plan,plans)}</button>
  </article>)}
 </details>;
}
