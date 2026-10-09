import {useEffect,useState} from 'react';
import LearningHistory from './LearningHistory';
import type {LearningGraph} from '../lib/learning';
import type {SourceClient} from '../lib/source-client';

export function LearningGraphIndicators({data,sourceIds,client}:{data:LearningGraph;sourceIds:string[];client?:SourceClient}){
 const items=data.collections.filter(item=>item.source_ids.some(id=>sourceIds.includes(id)));
 return <section className="learning-topic-progress" aria-label="Learning activity for this topic’s sources"><h3>Your learning around this topic</h3>
  <p className="micro-copy">Source counts and relationship lines describe saved-material coverage. The teaching map shows suggested order. Across paths using these sources, activity and provisional checks are separate; they do not establish whole-topic mastery.</p>
  {items.length?items.map(item=><article key={item.source_id}><h4>{item.title}</h4>
   <p>{item.path_count} saved {item.path_count===1?'path':'paths'} · {item.studied_lessons} lessons marked studied · {item.practice_attempts} practice attempts · {item.provisional_checks} provisional checks</p>
   {!!item.flagged_plans&&<p role="note">Evidence needs review in {item.flagged_plans} saved {item.flagged_plans===1?'plan':'plans'}. Earlier answers remain available.</p>}
   {item.source_available?<a href={`#note/${item.source_id}`}>Open learning map and history</a>:client?<LearningHistory client={client} sourceId={item.source_id} onOpen={()=>{}}/>:<a href="#library">Review retained learning history in your library</a>}
  </article>):<p>No confirmed learning path uses these saved sources yet. Open a source to preview where to begin.</p>}
  {data.partial&&<p role="note">Showing the 200 most recent collections. Older learning remains available from its source or library history.</p>}
 </section>;
}
export default function LearningTopicProgress({client,sourceIds}:{client:SourceClient;sourceIds:string[]}){
 const [data,setData]=useState<LearningGraph|null>(null),[error,setError]=useState(''),[reload,setReload]=useState(0);
 useEffect(()=>{
  let current=true;setError('');setData(null);
  client.learningGraph().then(value=>{if(current)setData(value);}).catch(e=>{if(current)setError(e instanceof Error?e.message:'Learning activity could not be loaded.');});
  return()=>{current=false;};
 },[client,reload]);
 return <>{data?<LearningGraphIndicators data={data} sourceIds={sourceIds} client={client}/>:<p role={error?'alert':'status'}>{error||'Loading saved learning activity…'}</p>}<button className="text-button" onClick={()=>setReload(value=>value+1)}>Refresh learning activity</button></>;
}
