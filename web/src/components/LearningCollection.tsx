import {useEffect,useState} from 'react';
import type {LearningCandidates,LearningPlan} from '../lib/learning';
import type {SourceClient} from '../lib/source-client';
import ReadingText from './ReadingText';
import {StudyCitations} from './StructuredStudy';

export function LearningRevisionSummary({plan,onCitation}:{plan:LearningPlan;onCitation:(id:string)=>void}){
 const revision=plan.revision;
 if(!revision)return null;
 return <section className="learning-revision" aria-label="Proposed learning plan changes">
  <h4>What this revision adds</h4>{revision.contributions.map((item,index)=><ReadingText key={index} text={item.text}><StudyCitations ids={item.citation_ids} onCitation={onCitation}/></ReadingText>)}
  <h4>Changes to teaching order</h4><ReadingText text={revision.ordering_changes}/>
  <h4>Different source perspectives</h4>{revision.disagreements.length?revision.disagreements.map((item,index)=><ReadingText key={index} text={item.text}><StudyCitations ids={item.citation_ids} onCitation={onCitation}/></ReadingText>):<p>No substantive disagreement was identified in the selected passages. This does not establish agreement across the whole topic.</p>}
  <p className="micro-copy">{plan.branch_of_plan_id?'Your earlier goal stays on its original path. This preview opens a separate goal branch.':'Your goal stays the same.'} Earlier lessons and answers are retained; new checks begin without earlier completion.</p>
 </section>;
}

export default function LearningCollection({sourceId,plan,client,enabled,busy,onAdd,onDiscover}:{sourceId:string;plan:LearningPlan;client:SourceClient;enabled:boolean;busy:boolean;onAdd:(candidate:LearningCandidates['candidates'][number])=>void;onDiscover:()=>void}){
 const [data,setData]=useState<LearningCandidates|null>(null),[error,setError]=useState(''),[reload,setReload]=useState(0),[loading,setLoading]=useState(false);
 useEffect(()=>{
  let live=true;
  if(enabled&&plan.active){setLoading(true);setError('');client.learningCandidates(sourceId,plan.id).then(result=>{if(live)setData(result);}).catch(e=>{if(live)setError(e instanceof Error?e.message:'Could not check related sources.');}).finally(()=>{if(live)setLoading(false);});}
  return()=>{live=false;};
 },[client,enabled,plan.id,plan.active,sourceId,reload]);
 const members=plan.source_members.length?plan.source_members:[{source_id:sourceId,title:plan.source_title,source_version:plan.source_version}];
 return <section className="learning-collection" aria-label="Sources supporting this learning collection">
  <h4>Your supporting sources</h4><p className="micro-copy">Original notes stay separate. This path brings their selected evidence into a teaching sequence.</p>
  <ul>{members.map(item=><li key={item.source_id}><a href={`#note/${item.source_id}`}>{item.title}</a> <small>· saved version {item.source_version}</small></li>)}</ul>
  {plan.active&&enabled&&<><h4>Expand this path</h4>{loading&&<p role="status">Checking related saved sources…</p>}{error&&<p role="alert">{error}</p>}
   {data?.candidates.map(candidate=><article className="learning-path" key={candidate.source_id}><h5>{candidate.title}</h5><p className="micro-copy">Related through {candidate.shared_topics.join(', ')}. Saved source version {candidate.source_version}.</p><button className="button secondary" disabled={busy||loading||members.length>=8} onClick={()=>onAdd(candidate)}>Preview what this source adds</button> <a href={`#note/${candidate.source_id}`}>Read its original note</a></article>)}
   {data&&!data.candidates.length&&<p>No additional clearly related saved sources are ready. Find material for this goal, save it, then check again.</p>}
   {members.length>=8&&<p>This path has reached its eight-source limit. Explore another path to focus on additional material.</p>}
   <div className="learning-actions"><button className="text-button" disabled={busy||loading} onClick={()=>setReload(value=>value+1)}>Check for newly saved sources</button><button className="text-button" onClick={onDiscover}>Find sources for this goal</button></div>
   <p className="micro-copy">Saving a source does not change your plan. Preview and confirm a revision before its lessons open.</p>
  </>}
 </section>;
}
