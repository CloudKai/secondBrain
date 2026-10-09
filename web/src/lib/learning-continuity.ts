import type {LearningPlan} from './learning';
import type {Topic} from '../types';

export function noteTopicContext(topics:Topic[],sourceTopics:string[],selected:string,exploring:boolean){
 const chosen=topics.find(topic=>topic.id===selected);
 if(exploring&&chosen)return {topic:chosen,exploring:!sourceTopics.includes(chosen.id)};
 return {topic:topics.find(topic=>topic.id===selected&&sourceTopics.includes(topic.id))??topics.find(topic=>sourceTopics.includes(topic.id)),exploring:false};
}
export function learningPlanLabel(plan:LearningPlan,plans:LearningPlan[]){
 const versions=plans.filter(item=>item.path_id===plan.path_id&&!!item.confirmed_at)
  .sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at)||a.id.localeCompare(b.id));
 const version=versions.findIndex(item=>item.id===plan.id)+1;
 const date=new Date(plan.created_at).toLocaleString('en',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});
 const base=plans.find(item=>item.id===plan.base_plan_id);
 const reason=plan.branch_of_plan_id?'Goal branch':base&&base.difficulty!==plan.difficulty?'Difficulty change':
  base&&JSON.stringify(base.source_members.map(m=>[m.source_id,m.source_version]))!==JSON.stringify(plan.source_members.map(m=>[m.source_id,m.source_version]))?'Source contribution':base?'Plan revision':'Starting plan';
 return `${plan.active?'Current':'Previous version'} · Version ${version||1} · ${plan.difficulty[0].toUpperCase()+plan.difficulty.slice(1)} · ${date} · ${reason}${plan.needs_review?' · Evidence needs review':''}`;
}
