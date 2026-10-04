import {useEffect,useRef,useState} from 'react';
import {ArrowUp,BookOpen,Globe2,Network,Sparkles} from 'lucide-react';
import type {SourceClient} from '../lib/source-client';
import type {AssistantAnswer,AssistantReference} from '../lib/assistant-answer';
interface Message {question:string;answer:AssistantAnswer;scope:string;}
export default function SavedAssistant({sourceId,sourceVersion,topics,client,onCitation,onDiscover}:{sourceId:string;sourceVersion:number;topics:{id:string;title:string}[];client:SourceClient;onCitation:(ref:AssistantReference)=>Promise<void>;onDiscover:()=>void}){
 const [input,setInput]=useState(''),[topicScope,setTopicScope]=useState(false),[libraryScope,setLibraryScope]=useState(false),[topicId,setTopicId]=useState(topics[0]?.id??''),[messages,setMessages]=useState<Message[]>([]),[working,setWorking]=useState(false),[error,setError]=useState(''),[pending,setPending]=useState('');
 const mounted=useRef(true),busy=useRef(false);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const selectedTopic=topics.find(t=>t.id===topicId)??topics[0];
 async function ask(question:string){
  if(!question.trim()||busy.current)return;
  const scope=['Current note',...(topicScope&&selectedTopic?[selectedTopic.title]:[]),...(libraryScope?['My library']:[])].join(' + ');
  busy.current=true;setWorking(true);setPending(question);setError('');
  try{
   const history=messages.slice(-2).flatMap(m=>[{role:'user' as const,text:m.question},{role:'assistant' as const,text:m.answer.gap??m.answer.claims.map(c=>c.text).join('\n')}]).map(t=>({...t,text:Array.from(t.text).slice(0,2000).join('')}));
   const answer=await client.ask(sourceId,{question,source_version:sourceVersion,topic_id:topicScope?selectedTopic?.id:null,library:libraryScope,history});
   if(mounted.current){setMessages(m=>[...m,{question,answer,scope}].slice(-10));setInput('');setPending('');}
  }catch(e){if(mounted.current)setError(e instanceof Error?e.message:'Could not answer. Please retry.');}
  finally{busy.current=false;if(mounted.current)setWorking(false);}
 }
 async function cite(ref:AssistantReference){
  setError('');try{await onCitation(ref);}catch(e){if(mounted.current)setError(e instanceof Error?e.message:'This evidence is unavailable. Ask again.');}
 }
 return <section className="assistant" aria-labelledby="saved-assistant-title">
  <div className="assistant-heading"><span className="assistant-icon"><Sparkles size={19} aria-hidden="true"/></span><div><h3 id="saved-assistant-title">A little help connecting the dots</h3><p>Ask questions grounded in your saved material.</p></div><span className="badge">Saved evidence</span></div>
  <p className="micro-copy">Current note is always included. Topic and library context can be selected together. Answers use saved passages; verify the citations.</p>
  <div className="conversation" role="log" aria-live="polite" aria-label="Study conversation" aria-busy={working}>
   {messages.map((m,i)=><div key={i}><div className="message user"><small>YOU · {m.scope}</small><p>{m.question}</p></div><div className="message assistant"><small>SECOND BRAIN · SAVED EVIDENCE</small>
    {m.answer.claims.map((c,j)=><p key={j}>{c.text}{' '}<span className="study-citations">{c.reference_ids.map(id=>{const index=m.answer.references.findIndex(r=>r.id===id);const ref=m.answer.references[index];return <button key={id} className="citation" aria-label={`Inspect citation ${index+1}: ${ref.title}, passage ${ref.passage.id}`} onClick={()=>void cite(ref)}>{index+1}</button>;})}</span></p>)}
    {m.answer.gap&&<><p>{m.answer.gap}</p><button className="text-button" onClick={onDiscover}>Find reliable sources <Globe2 size={14} aria-hidden="true"/></button><p className="micro-copy">Opens a reading-list preview. Live research search is planned.</p></>}
    {m.answer.partial&&<p className="micro-copy">This answer uses selected passages from the retrieved notes. Some saved evidence was omitted to keep the context bounded.</p>}
   </div></div>)}
  </div>
  {working&&<p role="status">Finding saved evidence and preparing your answer…</p>}
  {error&&<div className="study-error" role="alert"><p>{error}</p>{pending&&<button className="text-button" disabled={working} onClick={()=>void ask(pending)}>Retry question</button>}</div>}
  <div className="prompt-chips">{['Summarize the key ideas','Explain a supporting example','What are the limits of this evidence?'].map(p=><button key={p} disabled={working} onClick={()=>void ask(p)}>{p}<span aria-hidden="true">↗</span></button>)}</div>
  <form className="assistant-input" onSubmit={e=>{e.preventDefault();void ask(input);}}>
   <label className="sr-only" htmlFor="saved-assistant-question">Ask about your saved material</label>
   <textarea id="saved-assistant-question" rows={2} placeholder="What would you like to understand better?" maxLength={2000} value={input} disabled={working} onChange={e=>setInput(e.target.value)}/>
   <div className="assistant-input-footer"><div className="scope-buttons"><span><BookOpen size={12} aria-hidden="true"/>Current note</span><button type="button" disabled={working||!topics.length} aria-pressed={topicScope} className={topicScope?'selected':''} onClick={()=>setTopicScope(v=>!v)}><Network size={12} aria-hidden="true"/>Ask this topic</button><button type="button" disabled={working} aria-pressed={libraryScope} className={libraryScope?'selected':''} onClick={()=>setLibraryScope(v=>!v)}><Globe2 size={12} aria-hidden="true"/>Ask my library</button></div><button type="submit" className="send-button" aria-label="Send question" disabled={working||!input.trim()}><ArrowUp size={18} aria-hidden="true"/></button></div>
   {topicScope&&selectedTopic&&<div className="assistant-topic"><label htmlFor="assistant-topic">Topic context</label><select id="assistant-topic" value={selectedTopic.id} disabled={working} onChange={e=>setTopicId(e.target.value)}>{topics.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></div>}
  </form>
  {!topics.length&&<p className="micro-copy">Topic context becomes available after a topic placement is confirmed.</p>}
  <p className="micro-copy">Conversation stays in this tab and clears when you reopen or refresh this note.</p>
 </section>;
}
