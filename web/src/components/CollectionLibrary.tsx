import {useEffect,useState} from 'react';
import type {SourceClient} from '../lib/source-client';
import type {CollectionList} from '../lib/collections';
export function CollectionLibraryView({data,onMore,busy}:{data:CollectionList;onMore:()=>void;busy:boolean}){
 return <section className="collection-library" aria-label="Your learning collections"><h2>Your learning collections</h2><p>Goals, paths and practice stay together as your sources grow.</p>
  <div className="collection-cards">{data.collections.map(item=><a className="collection-card" href={`#collection/${item.id}`} key={item.id}><span className="eyebrow">LEARNING COLLECTION</span><h3>{item.title}</h3><p>{item.goal||'Choose a goal from your saved material.'}</p><span>{item.path_count} paths · {item.source_count} saved sources</span>{!item.original_source_available&&<p className="micro-copy">Original source removed · learning history retained</p>}<strong>Open collection →</strong></a>)}</div>
  {!data.collections.length&&<p>No learning collections yet. Open a source and preview a path to start.</p>}
  {data.next_offset!==null&&<button className="button secondary" disabled={busy} onClick={onMore}>Load more collections</button>}
 </section>;
}
export default function CollectionLibrary({client}:{client:SourceClient}){
 const [data,setData]=useState<CollectionList|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0),[busy,setBusy]=useState(false);
 useEffect(()=>{const refresh=()=>setRetry(v=>v+1);window.addEventListener('learning-updated',refresh);return()=>window.removeEventListener('learning-updated',refresh);},[]);
 useEffect(()=>{let current=true;client.collections().then(v=>{if(current){setData(v);setError('');}}).catch(e=>{if(current)setError(e instanceof Error?e.message:'Collections could not be loaded.');});return()=>{current=false;};},[client,retry]);
 async function more(){if(data?.next_offset==null||busy)return;setBusy(true);try{const next=await client.collections(data.next_offset);setData(old=>old?{collections:[...old.collections,...next.collections.filter(c=>!old.collections.some(p=>p.id===c.id))],next_offset:next.next_offset}:next);setError('');}catch(e){setError(e instanceof Error?e.message:'Could not load more collections.');}finally{setBusy(false);}}
 return <>{error&&<div role="alert"><p>{error}</p><button className="text-button" onClick={()=>setRetry(v=>v+1)}>Retry collections</button></div>}{data?<CollectionLibraryView data={data} onMore={()=>void more()} busy={busy}/>:!error&&<p role="status">Restoring collections…</p>}</>;
}
