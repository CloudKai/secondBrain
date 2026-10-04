import {useEffect,useRef,useState} from 'react';
import type {Note} from '../types';
import type {SourceClient,RevisionComparison,SavedSource,SavedVersion,VersionHistory} from '../lib/source-client';
import type {SourceReference} from '../lib/study-note';
import {noteFromSavedSource} from '../lib/api';
import {formatVideoTime,videoMomentUrl} from '../lib/transcript';
import StructuredStudy from './StructuredStudy';

interface Props {note:Note;client:SourceClient;initial:RevisionComparison|null;onApplied:(source:SavedSource,active:boolean)=>void;onReviewed:()=>void;onClose:()=>void}
export default function SourceVersions({note,client,initial,onApplied,onReviewed,onClose}:Props){
 const [history,setHistory]=useState<VersionHistory|null>(null),[comparison,setComparison]=useState(initial),[archive,setArchive]=useState<SavedVersion|null>(null),[passage,setPassage]=useState<SourceReference|null>(null);
 const [file,setFile]=useState<File|null>(null),[text,setText]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[reviewTopics,setReviewTopics]=useState<string[]>([]),[evidence,setEvidence]=useState<string[]>([]);
 const pending=useRef(false),mounted=useRef(false);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{let active=true;client.sourceVersions(note.id).then(data=>{if(active){setHistory(data);setReviewTopics(data.correction_review?.topics.map(t=>t.id)??[]);}}).catch((e:unknown)=>{if(active)setError(e instanceof Error?e.message:'Version history is unavailable. Retry loading.');});return()=>{active=false;};},[client,note.id]);
 async function run(action:()=>Promise<void>){if(pending.current)return;pending.current=true;setBusy(true);setError('');try{await action();}catch(e:unknown){setError(e instanceof Error?e.message:'Source versions are unavailable. Retry.');}finally{pending.current=false;setBusy(false);}}
 async function check(e:React.FormEvent){e.preventDefault();await run(async()=>{setArchive(null);setPassage(null);const data=await client.compareSource(note.id,{file:file??undefined,rawText:note.kind==='Article'&&text.trim()?text:undefined,transcriptText:note.kind==='Video'&&!file&&text.trim()?text:undefined});setComparison(data);});}
 async function refresh(){if(!comparison?.candidate_id)return;await run(async()=>{const updated=await client.refreshSource(note.id,comparison.candidate_id!,comparison.base_version);onApplied(updated,mounted.current);if(mounted.current)onClose();});}
 async function openVersion(version:number){await run(async()=>{const saved=await client.sourceVersion(note.id,version);noteFromSavedSource(saved.source,saved.study??undefined);setArchive(saved);setPassage(null);});}
 async function reload(){await run(async()=>{const data=await client.sourceVersions(note.id);setHistory(data);setReviewTopics(data.correction_review?.topics.map(t=>t.id)??[]);});}
 async function review(e:React.FormEvent){e.preventDefault();await run(async()=>{await client.reviewSourceAssignments({action:'assign',source_id:note.id,topic_ids:reviewTopics,evidence_ids:evidence});onReviewed();setHistory(await client.sourceVersions(note.id));});}
 function toggle(values:string[],id:string,checked:boolean){return checked?[...values,id]:values.filter(value=>value!==id);}
 const source=note.savedSource!;
 const references=note.study?.note?.references??[];
 return <div className="source-versions">
  <p className="modal-intro">Refresh this source when its material changes. Earlier captures and notes stay available with their own citations. Versions count as one source in your graph.</p>
  {error&&<p role="alert" className="form-error">{error}</p>}
  <p className="micro-copy">Current saved version {history?.current_version??source.source_version??1} · up to 20 versions per source.</p>
  <form onSubmit={check}>
   {note.kind==='PDF'&&!source.original_url&&<label>Replacement PDF<input type="file" accept=".pdf,application/pdf" disabled={busy} onChange={e=>setFile(e.target.files?.[0]??null)}/></label>}
   {note.kind==='Video'&&<><label>Replacement transcript<input type="file" accept=".txt,.vtt,.srt" disabled={busy} onChange={e=>setFile(e.target.files?.[0]??null)}/></label>{file&&<button className="text-button" type="button" disabled={busy} onClick={()=>setFile(null)}>Use pasted text or accessible captions</button>}<p className="micro-copy">Upload or paste a new transcript. Leave both blank to check accessible YouTube captions.</p></>}
   {(note.kind==='Article'||note.kind==='Video')&&<label>{note.kind==='Article'?'Replacement article text (optional)':'Replacement transcript text (optional)'}<textarea rows={4} value={text} maxLength={note.kind==='Article'?30000:100000} disabled={busy||!!file} onChange={e=>setText(e.target.value)}/></label>}
   <button className="button secondary" disabled={busy||(note.kind==='PDF'&&!source.original_url&&!file)}>{busy?'Working…':'Check for changes'}</button>
  </form>
  {comparison&&<section aria-label="Source comparison" className="version-comparison">
   <h3>{comparison.changed?'Changed material found':'No captured changes found'}</h3>
   <p>{comparison.changed?`Version ${comparison.base_version} stays saved until you confirm. Refresh will queue a new study note and update its topic evidence.`:'Your saved version and note can be reused.'}</p>
   {comparison.replacement&&<div className="version-previews">
    <CapturePreview label="Current" source={comparison.current}/>
    <CapturePreview label="Replacement" source={comparison.replacement}/>
    <p className="micro-copy">{comparison.replacement.document?`${comparison.replacement.document.page_count} PDF pages · `:''}{comparison.replacement.coverage_detail}</p>
   </div>}
   {comparison.changed&&<div className="modal-footer"><button className="button secondary" disabled={busy} onClick={onClose}>Keep current version</button><button className="button primary" disabled={busy} onClick={()=>void refresh()}>Refresh source</button></div>}
  </section>}
  {history?.correction_review&&<form onSubmit={review} className="version-review">
   <h3>Review retained topic assignments</h3><p>The old supporting passages changed. Your corrections are retained; choose current evidence before adding these assignments back to the graph.</p>
   <fieldset className="correction-choices" disabled={busy}><legend>Retained topics</legend>{history.correction_review.topics.map(topic=><label key={topic.id}><input type="checkbox" checked={reviewTopics.includes(topic.id)} onChange={e=>setReviewTopics(toggle(reviewTopics,topic.id,e.target.checked))}/>{topic.title}</label>)}</fieldset>
   <fieldset className="correction-choices" disabled={busy}><legend>Current supporting passages (choose 1–10)</legend>{references.map(ref=><label key={ref.id}><input type="checkbox" checked={evidence.includes(ref.id)} disabled={!evidence.includes(ref.id)&&evidence.length>=10} onChange={e=>setEvidence(toggle(evidence,ref.id,e.target.checked))}/>{ref.id} — {ref.excerpt}</label>)}</fieldset>
   {!references.length&&<p>Reopen this source when its new study note is ready.</p>}
   <button className="button primary" disabled={busy||!reviewTopics.length||!evidence.length}>Confirm current evidence</button>
  </form>}
  <section aria-label="Saved source versions"><h3>Earlier saved versions</h3>
   {history?.versions.length?history.versions.map(version=><button className="button secondary" disabled={busy} key={version.version} onClick={()=>void openVersion(version.version)}>View version {version.version} · {new Date(version.captured_at).toLocaleDateString('en')}{version.has_note?' · study note':' · capture only'}</button>):<p>No earlier versions saved yet.</p>}
   <button className="text-button" disabled={busy} onClick={()=>void reload()}>Reload version history</button>
  </section>
  {archive&&<section aria-label={`Saved version ${archive.source.source_version??1}`} className="archived-note"><h3>Saved version {archive.source.source_version??1} · {archive.source.title}</h3><p className="micro-copy">Read-only archive · captured {new Date(archive.source.captured_at).toLocaleString('en')}</p>
   {archive.study?.note?<StructuredStudy note={archive.study.note} onCitation={id=>setPassage(archive.study!.note!.references.find(ref=>ref.id===id)??null)}/>:<p>No completed study note was saved for this version.</p>}
   {passage&&<aside aria-live="polite" className="version-evidence"><h4>Version {archive.source.source_version??1} · {passage.page?`PDF page ${passage.page}`:passage.start_ms!=null?`${formatVideoTime(passage.start_ms)}–${formatVideoTime(passage.end_ms!)}`:'Source passage'} · {passage.id}</h4><p>{passage.excerpt}</p>{archive.source.original_url&&<a href={passage.start_ms!=null?videoMomentUrl(archive.source.original_url,passage.start_ms):archive.source.original_url} target="_blank" rel="noreferrer">Open original</a>}</aside>}
   <details><summary>Captured source text for this version</summary><pre>{archive.source.captured_text}</pre></details>
  </section>}
 </div>;
}

function CapturePreview({label,source}:{label:string;source:SavedSource}){
 const characters=Array.from(source.captured_text);
 return <details><summary>{label} captured text and locations · {characters.length} characters</summary>
  <pre>{source.captured_text}</pre>
  {source.document&&<><h4>{label} PDF pages</h4><ol className="version-locations">{source.document.pages.map(page=><li key={page.page}>Page {page.page} · characters {page.start}–{page.end}<blockquote>{characters.slice(page.start,page.end).join('')}</blockquote></li>)}</ol></>}
  {source.transcript&&<><h4>{label} transcript locations</h4><ol className="version-locations">{source.transcript.segments.map((cue,index)=><li key={index}>{cue.start_ms!=null?`${formatVideoTime(cue.start_ms)}–${formatVideoTime(cue.end_ms!)}`:'Untimed passage'} · characters {cue.start}–{cue.end}<blockquote>{characters.slice(cue.start,cue.end).join('')}</blockquote></li>)}</ol></>}
 </details>;
}
