import {useId} from 'react';
import type {SourceClient} from '../lib/source-client';
import type {LearningPlan} from '../lib/learning';
import {useLessonConversation} from '../lib/conversation-workspace';
import {useLearningDraft} from '../lib/draft-workspace';
import LearningDraftStatus from './LearningDraftStatus';
import SavedLessonConversation from './SavedLessonConversation';

export default function SavedLearningTutor({collectionId,plan,lessonIndex,client,enabled,onCitation,onDiscover}:{collectionId:string;plan:LearningPlan;lessonIndex:number;client:SourceClient;enabled:boolean;onCitation:(id:string)=>void;onDiscover:()=>void}){
 const conversation=useLessonConversation(client,{collectionId,planId:plan.id,lessonIndex}),draft=useLearningDraft(client,{collectionId,planId:plan.id,lessonIndex,kind:'question'}),id=useId();
 const locked=!enabled||conversation.state.status==='busy'||conversation.state.status==='loading'||conversation.state.status==='signedout'||!conversation.state.conversation?.evidence_current||!!conversation.state.pending||!!draft.state.conflict||draft.state.status==='loading'||draft.state.status==='signedout';
 const ask=(question:string)=>{if(!locked&&question.trim()){draft.edit(question);void conversation.send(question);}};
 return <section className="learning-tutor" aria-labelledby={`${id}-title`}><h4 id={`${id}-title`}>Your lesson tutor</h4><p className="micro-copy">Ask for an explanation, hint or help applying this lesson. AI-generated replies use this lesson’s saved evidence. Your conversation and question draft are saved separately; recent discussion provides context, not evidence.</p><SavedLessonConversation references={plan.teaching?plan.references:undefined} conversation={conversation} onCitation={onCitation} onDiscover={onDiscover}/><div className="prompt-chips">{['Explain this differently','Give me a smaller hint','Help me apply this concept'].map(question=><button key={question} disabled={locked} onClick={()=>ask(question)}>{question}</button>)}</div><form onSubmit={event=>{event.preventDefault();ask(draft.state.text);}}><label htmlFor={`${id}-question`}>Ask about this lesson</label><textarea id={`${id}-question`} rows={2} maxLength={4000} value={draft.state.text} disabled={draft.state.status==='loading'||draft.state.status==='signedout'} onChange={event=>draft.edit(event.target.value)}/><button className="button secondary" disabled={locked||!draft.state.text.trim()}>Ask lesson tutor</button></form><LearningDraftStatus draft={draft}/></section>;
}
