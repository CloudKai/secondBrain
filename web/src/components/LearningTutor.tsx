import {useLearningDraft} from '../lib/draft-workspace';
import LearningDraftStatus from './LearningDraftStatus';
import {useEffect,useId,useRef,useState} from 'react';
import type {SourceClient} from '../lib/source-client';
import type {LearningPlan,LearningTutorReply} from '../lib/learning';
import ReadingText from './ReadingText';
import {StudyCitations} from './StructuredStudy';

export default function LearningTutor({sourceId,collectionId,plan,lessonIndex,client,enabled,onCitation,onDiscover}:{sourceId:string;collectionId?:string;plan:LearningPlan;lessonIndex:number;client:SourceClient;enabled:boolean;onCitation:(id:string)=>void;onDiscover:()=>void}){
 const [input,setInput]=useState(''),[messages,setMessages]=useState<{question:string;reply:LearningTutorReply}[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const draft=useLearningDraft(client,collectionId?{collectionId,planId:plan.id,lessonIndex,kind:'question'}:null);
 const questionText=collectionId?draft.state.text:input;
 const editQuestion=(text:string)=>collectionId?draft.edit(text):setInput(text);
 const mounted=useRef(false),working=useRef(false),id=useId();
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 async function ask(question:string){
  if(!enabled||working.current||!question.trim()||draft.state.conflict||(collectionId&&(draft.state.status==='loading'||draft.state.status==='signedout')))return;
  editQuestion(question);working.current=true;setBusy(true);setError('');
  try{
   const history=messages.slice(-2).flatMap(message=>[{role:'user' as const,text:Array.from(message.question).slice(0,1000).join('')},{role:'assistant' as const,text:Array.from(message.reply.text).slice(0,1000).join('')}]);
   const reply=await client.learningTutor(sourceId,plan.id,{lesson_index:lessonIndex,question,history});
   if(reply.citation_ids.some(citation=>!plan.references.some(reference=>reference.id===citation)))throw new Error('The tutor returned unavailable evidence. Retry.');
   if(mounted.current){setMessages(previous=>[...previous,{question,reply}].slice(-10));if(!collectionId)setInput('');}
  }catch(e){if(mounted.current)setError(e instanceof Error?e.message:'The tutor is unavailable. Your question is retained.');}
  finally{working.current=false;if(mounted.current)setBusy(false);}
 }
 return <section className="learning-tutor" aria-labelledby={`${id}-title`}><h4 id={`${id}-title`}>Your lesson tutor</h4><p className="micro-copy">Ask for a different explanation, a hint or help applying this lesson. AI-generated replies use this lesson’s saved evidence; check their citations. {collectionId?'Your question draft saves in this collection. Replies currently stay in this view.':'Conversation stays in this view.'}</p>
  <div className="learning-tutor-log" role="log" aria-live="polite" aria-label="Lesson conversation">{messages.map((message,index)=><div key={index}><p><strong>You:</strong> {message.question}</p><ReadingText text={message.reply.text}><StudyCitations ids={message.reply.citation_ids} onCitation={onCitation}/></ReadingText>{message.reply.gap&&<><p>{message.reply.gap}</p><button className="text-button" onClick={onDiscover}>Find additional sources</button></>}</div>)}</div>
  {busy&&<p role="status">Preparing a source-backed explanation…</p>}{error&&<p role="alert" className="study-error">{error}</p>}
  <div className="prompt-chips">{['Explain this differently','Give me a smaller hint','Help me apply this concept'].map(question=><button key={question} disabled={busy||!enabled||!!draft.state.conflict||(!!collectionId&&(draft.state.status==='loading'||draft.state.status==='signedout'))} onClick={()=>void ask(question)}>{question}</button>)}</div>
  <form onSubmit={event=>{event.preventDefault();void ask(questionText);}}><label htmlFor={`${id}-question`}>Ask about this lesson</label><textarea id={`${id}-question`} rows={2} maxLength={collectionId?4000:2000} value={questionText} disabled={busy||(collectionId?(draft.state.status==='loading'||draft.state.status==='signedout'):!enabled)} onChange={event=>editQuestion(event.target.value)}/><button className="button secondary" disabled={busy||!enabled||!questionText.trim()||!!draft.state.conflict}>Ask lesson tutor</button></form>{collectionId&&<LearningDraftStatus draft={draft}/>}
 </section>;
}
