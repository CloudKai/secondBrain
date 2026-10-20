import RetainedLearningDrafts from './RetainedLearningDrafts';
import {useEffect,useRef,useState} from 'react';
import type {CollectionDetail} from '../lib/collections';
import type {SavedSource,SourceClient} from '../lib/source-client';
import type {AssistantReference} from '../lib/assistant-answer';
import {citationMatchesSource} from '../lib/assistant-answer';
import {noteFromSavedSource} from '../lib/api';
import {learningPlanLabel} from '../lib/learning-continuity';
import LearningJourney from './LearningJourney';
import ReadingText from './ReadingText';
import EvidenceDialog from './EvidenceDialog';
import SourceEvidence from './SourceEvidence';

export function CollectionHeading({data}:{data:CollectionDetail}){
 const {collection}=data;
 return <header className="collection-heading"><a className="text-button" href="#library">← Home</a><span className="eyebrow">YOUR LEARNING COLLECTION</span><h1>{collection.title}</h1><p className="collection-goal">{collection.goal||'Choose where to begin with your saved material.'}</p><p className="micro-copy">{collection.path_count} paths · {collection.source_count} saved sources · study activity and practice are separate from mastery.</p></header>;
}
export function CollectionResources({data,onDiscover}:{data:CollectionDetail;onDiscover:(query:string)=>void}){
 const {collection,sources}=data;
 return <details className="collection-resources"><summary>Collection sources & wider context</summary><p>Sources in a plan are a selected subset of this collection. Saving material does not add it to teaching until you preview and confirm its contribution.</p>
   <ul>{sources.map(s=><li key={s.id}><a href={`#note/${s.id}`}>{s.title}</a><small> · {s.source_kind.toUpperCase()} · saved version {s.source_version}</small></li>)}</ul>
   {!collection.original_source_available&&<p role="note">Original source removed. Goals and saved practice stay accessible; missing captured evidence cannot support new teaching.</p>}
   <div className="learning-actions"><a className="button secondary" href="#topics">Topic graph</a><button className="text-button" onClick={()=>onDiscover(`${collection.title}: ${collection.goal}`)}>Find sources for this goal</button></div>
  </details>;
}
export function CollectionOverview({data,onDiscover}:{data:CollectionDetail;onDiscover:(query:string)=>void}){
 return <>
  <CollectionHeading data={data}/>
  <CollectionResources data={data} onDiscover={onDiscover}/>
 </>;
}
export function RetainedCollectionHistory({data,client}:{data:CollectionDetail;client?:SourceClient}){
 return <section className="learning-review" aria-label="Retained collection learning history"><h2>Your retained learning history</h2><p>The original capture is unavailable. These goals and answers remain saved; missing evidence is not presented as current teaching coverage.</p>
  {data.learning.plans.filter(p=>p.confirmed_at).map(plan=><article className="learning-feedback" key={plan.id}><h3>{plan.content.title}</h3><p>{learningPlanLabel(plan,data.learning.plans)}</p><p>{plan.goal}</p><p>{data.learning.activities.filter(a=>a.plan_id===plan.id&&a.kind==='read').length} lessons marked studied</p>
   {data.learning.attempts.filter(a=>a.plan_id===plan.id).map(a=><div key={a.id}><h4>{plan.content.lessons[a.lesson_index].check.question}</h4><p className="micro-copy">{new Date(a.created_at).toLocaleString()} · {a.difficulty} · {a.status.replaceAll('_',' ')}</p><ReadingText text={a.response}/>{a.feedback&&<><p>Provisional AI feedback · needs review</p><ReadingText text={a.feedback.summary}/></>}</div>)}
  </article>)}
  {client&&<RetainedLearningDrafts data={data} client={client}/>}
  {!data.learning.plans.some(p=>p.confirmed_at)&&<p>No path was confirmed. Your collection identity is retained.</p>}
 </section>;
}
export default function CollectionWorkspace({id,client,onDiscover}:{id:string;client:SourceClient;onDiscover:(query:string)=>void}){
 const [loaded,setLoaded]=useState<{data:CollectionDetail;source:SavedSource|null}|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const [evidence,setEvidence]=useState<{source:SavedSource;reference:AssistantReference;full:boolean}|null>(null);
 const origin=useRef<HTMLElement|null>(null),request=useRef({version:0,live:false});
 useEffect(()=>{const refresh=()=>setRetry(v=>v+1);window.addEventListener('learning-updated',refresh);return()=>window.removeEventListener('learning-updated',refresh);},[]);
 useEffect(()=>{let current=true;const state=request.current;state.live=true;
  client.collection(id).then(async data=>{const source=data.collection.original_source_available?await client.get(data.collection.legacy_source_id):null;if(current){setLoaded({data,source});setError('');}}).catch(e=>{if(current)setError(e instanceof Error?e.message:'Could not restore this collection.');});
  return()=>{current=false;state.live=false;state.version++;};
 },[id,client,retry]);
 async function cite(reference:AssistantReference){
  const state=request.current;const token=++state.version;origin.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
  let source=await client.get(reference.source_id);
  if(reference.source_version!==(source.source_version??1))source=(await client.sourceVersion(reference.source_id,reference.source_version)).source;
  if(!state.live||token!==state.version)return;
  if(!citationMatchesSource(reference,source))throw new Error('This source evidence changed. Reload the collection before continuing.');
  setEvidence({source,reference,full:false});
 }
 return <div className="collection-workspace">
  {error&&<div className="study-error" role="alert"><h1>Collection unavailable</h1><p>{error}</p><button className="button secondary" onClick={()=>setRetry(v=>v+1)}>Retry collection</button> <a href="#library">Return to my library</a></div>}
  {!loaded&&!error&&<p role="status">Restoring your collection and saved lesson…</p>}
  {loaded&&(loaded.source?<><CollectionHeading data={loaded.data}/><LearningJourney key={`${id}:${loaded.source.source_version??1}`} source={loaded.source} client={client} enabled={!error} initial={loaded.data.learning} collectionId={id} workspace onCitation={cite} onDiscover={onDiscover} sidePanelExtra={<CollectionResources data={loaded.data} onDiscover={onDiscover}/>}/></>:<><CollectionOverview data={loaded.data} onDiscover={onDiscover}/><RetainedCollectionHistory data={loaded.data} client={client}/></>)}
  {evidence&&<EvidenceDialog origin={origin.current} onClose={()=>setEvidence(null)}><SourceEvidence note={noteFromSavedSource(evidence.source)} passage={evidence.full?undefined:evidence.reference.passage} onFullText={()=>setEvidence(v=>v?{...v,full:true}:null)}/></EvidenceDialog>}
 </div>;
}
