import type {LearningPlan} from '../lib/learning';
import ReadingText from './ReadingText';
import {StudyCitations} from './StructuredStudy';

export default function TeachingCoverage({plan,onCitation}:{plan:LearningPlan;onCitation:(id:string)=>void}){
 if(!plan.teaching)return <p className="micro-copy">Saved-note passages inform this plan. Full captured material was not searched for this version.</p>;
 const {manifest}=plan.teaching;
 return <section className="teaching-coverage" aria-label="Sampled teaching evidence">
  <h4>Concepts in the retrieved material</h4>
  <p className="micro-copy">AI-generated map of selected passages, not the entire source or a verified support assessment. Only this source participated. Citations open the original captured wording.</p>
  <ReadingText text={manifest.coverage}/>
  <ul>{manifest.entries.map((entry,index)=><li key={index}><span className="eyebrow">{entry.kind}</span><ReadingText text={entry.text}/><StudyCitations references={plan.teaching?plan.references:undefined} ids={entry.citation_ids} onCitation={onCitation}/></li>)}</ul>
  {manifest.gaps.length>0&&<><h4>What the evidence leaves open</h4><ul>{manifest.gaps.map((gap,index)=><li key={index}>{gap}</li>)}</ul></>}
 </section>;
}
