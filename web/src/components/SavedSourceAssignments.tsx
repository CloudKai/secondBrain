import {useState} from 'react';
import type {Note} from '../types';
import type {TopicLibrary,TopicCorrection} from '../lib/topic-library';

interface Props {note:Note;library:TopicLibrary;busy:boolean;error:string;onSave:(action:TopicCorrection)=>Promise<boolean>;onDone:()=>void}
export default function SavedSourceAssignments({note,library,busy,error,onSave,onDone}:Props){
 const original=library.maps.find(m=>m.source_id===note.id)?.analysis?.topics??[];
 const references=note.study?.note?.references??[];
 const [topics,setTopics]=useState(original.map(t=>t.id));
 const [evidence,setEvidence]=useState([...new Set(original.flatMap(t=>t.citation_ids))].slice(0,10));
 const [submitted,setSubmitted]=useState(false);
 function toggle(values:string[],id:string,checked:boolean){return checked?[...values,id]:values.filter(x=>x!==id);}
 async function save(e:React.FormEvent){e.preventDefault();setSubmitted(true);if(await onSave({action:'assign',source_id:note.id,topic_ids:topics,evidence_ids:evidence}))onDone();}
 return <form onSubmit={save}>
  <p className="modal-intro">Choose the topics this source supports. Its original study note and references stay read-only. Removed assignments remove their connections.</p>
  {submitted&&error&&<p role="alert" className="form-error">{error}</p>}
  <fieldset className="correction-choices" disabled={busy}><legend>Source topics (choose 1–12)</legend>
   <div className="assignment-list">{library.topics.map(t=><label key={t.id}><input type="checkbox" checked={topics.includes(t.id)} disabled={!topics.includes(t.id)&&topics.length>=12} onChange={e=>setTopics(toggle(topics,t.id,e.target.checked))}/>{t.title}<small>{t.context}</small></label>)}</div>
  </fieldset>
  <fieldset className="correction-choices" disabled={busy}><legend>Passages supporting added topics (choose 1–10)</legend>
   <p className="micro-copy">Existing assignments keep their citations. Every added topic uses the selected passages.</p>
   <div className="assignment-list">{references.map(r=><label key={r.id}><input type="checkbox" checked={evidence.includes(r.id)} disabled={!evidence.includes(r.id)&&evidence.length>=10} onChange={e=>setEvidence(toggle(evidence,r.id,e.target.checked))}/><span>{r.id}{r.page?` · PDF page ${r.page}`:''} — {r.excerpt.slice(0,180)}{r.excerpt.length>180?'…':''}</span></label>)}</div>
  </fieldset>
  <div className="modal-footer"><button type="button" className="button secondary" disabled={busy} onClick={onDone}>Cancel</button><button className="button primary" disabled={busy||!topics.length||!evidence.length}>{busy?'Saving…':'Save assignments'}</button></div>
 </form>;
}
