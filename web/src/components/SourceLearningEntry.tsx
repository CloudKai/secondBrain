import {useEffect,useState} from 'react';
import type {SourceClient,SavedSource} from '../lib/source-client';
import type {CollectionDetail} from '../lib/collections';
import type {AssistantReference} from '../lib/assistant-answer';
import LearningJourney from './LearningJourney';
export default function SourceLearningEntry(props:{source:SavedSource;client:SourceClient;enabled:boolean;topicTitle?:string;onCitation:(ref:AssistantReference)=>Promise<void>;onDiscover:(query:string)=>void}){
 const [collection,setCollection]=useState<CollectionDetail|null>(null),[loaded,setLoaded]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{const refresh=()=>setRetry(v=>v+1);window.addEventListener('learning-updated',refresh);return()=>window.removeEventListener('learning-updated',refresh);},[]);
 useEffect(()=>{let current=true;if(props.enabled)props.client.sourceCollection(props.source.id).then(v=>{if(current){setCollection(v);setLoaded(true);setError('');}}).catch(e=>{if(current)setError(e instanceof Error?e.message:'Could not find your collection.');});return()=>{current=false;};},[props.client,props.source.id,props.enabled,retry]);
 if(error)return <section role="alert"><p>{error}</p><button className="text-button" onClick={()=>setRetry(v=>v+1)}>Retry learning entry</button><p>Your original source note remains available below.</p></section>;
 if(!props.enabled)return <p role="status">Reconnect your library to restore learning.</p>;
 if(!loaded)return <p role="status">Finding your learning collection…</p>;
 if(collection?.learning.plans.some(p=>p.confirmed_at))return <section className="source-learning-entry"><span className="eyebrow">CONTINUE LEARNING</span><h2>{collection.collection.title}</h2><p>{collection.collection.goal}</p><a className="button primary" href={`#collection/${collection.collection.id}`}>Open learning collection →</a><p className="micro-copy">Your goal, selected lesson and saved practice live together. This source note stays separate.</p></section>;
 return <LearningJourney {...props}/>;
}
