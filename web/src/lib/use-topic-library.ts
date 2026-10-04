import {useCallback,useEffect,useRef,useState} from 'react';
import type {SourceClient} from './source-client';
import {emptyTopicLibrary} from './topic-library';
import type {TopicCorrection,TopicLibrary} from './topic-library';
import type {StudyRecord} from './study-note';
import type {Note} from '../types';

export function useTopicLibrary(client:SourceClient|null,enabled:boolean,notes:Note[],studies:Record<string,StudyRecord>){
 const [library,setLibrary]=useState<TopicLibrary>(emptyTopicLibrary),[error,setError]=useState(''),[actionError,setActionError]=useState(''),[version,setVersion]=useState(0),[busy,setBusy]=useState(false);
 const generation=useRef(0),pending=useRef(false);
 const verify=useCallback((data:TopicLibrary)=>{
  for(const record of data.maps){const note=studies[record.source_id]?.note;if(note&&record.analysis){const ids=new Set(note.references.map(r=>r.id));if([...record.analysis.topics,...record.analysis.relations].some(t=>t.citation_ids.some(id=>!ids.has(id))))throw new Error('Topic evidence could not be verified. Reload topics.');}}
  return data;
 },[studies]);
 useEffect(()=>{
  if(!client||!enabled)return;
  let active=true,timer:ReturnType<typeof setTimeout>|undefined;
  const sequence=++generation.current;
  async function load(){try{
   const data=verify(await client!.topicLibrary());
   if(!active||sequence!==generation.current)return;
   setLibrary(data);setError('');
   if(data.maps.some(m=>m.status==='queued'||m.status==='processing'))timer=setTimeout(load,5000);
  }catch(e:unknown){if(active&&sequence===generation.current)setError(e instanceof Error?e.message:'Topics could not be loaded. Retry.');}}
  void load();return()=>{active=false;clearTimeout(timer);};
 },[client,enabled,notes,verify,version]);
 async function act(action:()=>Promise<unknown>):Promise<boolean>{
  if(pending.current||!client||!enabled)return false;
  pending.current=true;setBusy(true);setActionError('');++generation.current;
  try{await action();setLibrary(verify(await client.topicLibrary()));setVersion(v=>v+1);return true;}
  catch(e:unknown){setActionError(e instanceof Error?e.message:'Topic update failed. Retry.');setVersion(v=>v+1);return false;}
  finally{pending.current=false;setBusy(false);}
 }
 return {library,error:actionError||error,busy,reload:()=>setVersion(v=>v+1),
  correct:(action:TopicCorrection)=>client?act(()=>client.correctTopics(action)):Promise.resolve(false),
  retry:(id:string)=>client&&act(()=>client.mapTopics(id,true)),
  place:(source:string,topic:string,target:string|null)=>client&&act(()=>client.confirmPlacement(source,topic,target))};
}
