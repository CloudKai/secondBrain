import { useEffect,useState } from 'react';
import type { SourceClient } from './source-client';
import { emptyTopicLibrary } from './topic-library';
import type { TopicLibrary } from './topic-library';
import type { StudyRecord } from './study-note';
import type { Note } from '../types';
export function useTopicLibrary(client:SourceClient|null,enabled:boolean,notes:Note[],studies:Record<string,StudyRecord>){
 const [library,setLibrary]=useState<TopicLibrary>(emptyTopicLibrary),[error,setError]=useState(''),[version,setVersion]=useState(0),[busy,setBusy]=useState(false);
 useEffect(()=>{
  if(!client||!enabled)return;
  let active=true,timer:ReturnType<typeof setTimeout>|undefined;
  async function load(){try{
   const data=await client!.topicLibrary();
   for(const record of data.maps){const note=studies[record.source_id]?.note;if(note&&record.analysis){const ids=new Set(note.references.map(r=>r.id));if([...record.analysis.topics,...record.analysis.relations].some(t=>t.citation_ids.some(id=>!ids.has(id))))throw new Error('Topic evidence could not be verified. Reload topics.');}}
   if(!active)return;setLibrary(data);setError('');
   if(data.maps.some(m=>m.status==='queued'||m.status==='processing'))timer=setTimeout(load,5000);
  }catch(e:unknown){if(active)setError(e instanceof Error?e.message:'Topics could not be loaded. Retry.');}}
  void load();return()=>{active=false;clearTimeout(timer);};
 },[client,enabled,notes,studies,version]);
 async function act(action:()=>Promise<unknown>){if(busy)return;setBusy(true);setError('');try{await action();setVersion(v=>v+1);}catch(e:unknown){setError(e instanceof Error?e.message:'Topic update failed. Retry.');}finally{setBusy(false);}}
 return {library,error,busy,reload:()=>setVersion(v=>v+1),retry:(id:string)=>client&&act(()=>client.mapTopics(id,true)),place:(source:string,topic:string,target:string|null)=>client&&act(()=>client.confirmPlacement(source,topic,target))};
}
