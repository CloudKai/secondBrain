import {useEffect,useId,useRef,useState} from 'react';
import {BookOpen,ChevronRight,GraduationCap} from 'lucide-react';
import type {SourceClient,SavedSource} from '../lib/source-client';
import type {LearningSnapshot,LearningPlan,LearningDifficulty,LearningActivity,LearningCandidates} from '../lib/learning';
import type {AssistantReference} from '../lib/assistant-answer';
import {referenceMatchesSource} from '../lib/source-references';
import ReadingText from './ReadingText';
import LearningLessonView from './LearningLessonView';
import {StudyCitations} from './StructuredStudy';
import Modal from './Modal';
import LearningTutor from './LearningTutor';
import LearningCollection,{LearningRevisionSummary} from './LearningCollection';

const levels:LearningDifficulty[]=['foundation','intermediate','advanced'];
const levelLabel=(level:LearningDifficulty)=>level[0].toUpperCase()+level.slice(1);
interface Props {source:SavedSource;client:SourceClient;enabled:boolean;topicTitle?:string;onCitation:(reference:AssistantReference)=>Promise<void>;onDiscover:(query:string)=>void}

export default function LearningJourney({source,client,enabled,topicTitle,onCitation,onDiscover}:Props){
 const [data,setData]=useState<LearningSnapshot|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(''),[goal,setGoal]=useState(''),[difficulty,setDifficulty]=useState<LearningDifficulty>('foundation');
 const [selectedId,setSelectedId]=useState(''),[lessonIndex,setLessonIndex]=useState(0),[mode,setMode]=useState<'teach'|'practice'|'review'>('teach'),[preview,setPreview]=useState<LearningPlan|null>(null),[backgroundIndex,setBackgroundIndex]=useState<number|null>(null);
 const [responses,setResponses]=useState<Record<string,string>>({}),[attemptKeys,setAttemptKeys]=useState<Record<string,{answer:string;id:string}>>({});
 const mounted=useRef(false),working=useRef(false),previewKey=useRef<{fingerprint:string;id:string}|null>(null),fieldId=useId();
 const selected=data?.plans.find(plan=>plan.id===selectedId)??data?.plans.find(plan=>plan.active)??null;
 const lesson=selected?.content.lessons[lessonIndex];
 const answerKey=`${selected?.id}:${lessonIndex}`,answer=responses[answerKey]??'';
 const attempts=data?.attempts.filter(attempt=>attempt.plan_id===selected?.id&&attempt.lesson_index===lessonIndex)??[];
 const hasActivity=(kind:LearningActivity['kind'],index=lessonIndex)=>!!data?.activities.some(activity=>activity.plan_id===selected?.id&&activity.lesson_index===index&&activity.kind===kind);
 const valid=(plan:LearningPlan)=>!plan.needs_review&&plan.source_version===(source.source_version??1)&&(plan.evidence.length>0||plan.references.every(ref=>referenceMatchesSource(ref,source)));

 useEffect(()=>{
  mounted.current=true;
  if(enabled)client.learning(source.id).then(value=>{if(mounted.current){setData(value);const active=value.plans.find(plan=>plan.active);if(active){setSelectedId(active.id);setDifficulty(active.difficulty);setGoal(active.goal);}}}).catch(e=>{if(mounted.current)setError(e instanceof Error?e.message:'Could not load learning progress.');});
  return()=>{mounted.current=false;};
 },[client,enabled,source.id]);

 async function run(label:string,action:()=>Promise<LearningSnapshot>,after?:()=>void){
  if(working.current)return;
  working.current=true;setBusy(label);setError('');
  try{const value=await action();if(value.source_id!==source.id)throw new Error('Unexpected learning collection. Reload.');
   if(mounted.current){setData(value);after?.();}
  }catch(e){if(mounted.current){setError(e instanceof Error?e.message:'Your work could not be saved. Retry.');
    // A timed-out feedback request may still have saved the answer. Restore it.
    try{const value=await client.learning(source.id);if(mounted.current)setData(value);}catch{/* Keep the last readable state and the learner input. */}
  }}finally{working.current=false;if(mounted.current)setBusy('');}
 }
 function choose(plan:LearningPlan){setSelectedId(plan.id);setLessonIndex(0);setDifficulty(plan.difficulty);setMode('teach');}
 async function cite(plan:LearningPlan,id:string){
  const evidence=plan.evidence.find(ref=>ref.id===id),passage=evidence?.passage??plan.references.find(ref=>ref.id===id);
  if(!passage){setError('This evidence changed. Reload and preview a new path.');return;}
  try{await onCitation({id:`${evidence?.source_id??source.id}:${passage.id}`,source_id:evidence?.source_id??source.id,source_version:evidence?.source_version??plan.source_version,title:evidence?.title??source.title,passage});}
  catch(e){if(mounted.current)setError(e instanceof Error?e.message:'Evidence is unavailable.');}
 }
 function addSource(candidate:LearningCandidates['candidates'][number]){
  if(!selected)return;
  const input={source_id:candidate.source_id,source_version:candidate.source_version};
  const fingerprint=JSON.stringify({plan_id:selected.id,...input});
  if(previewKey.current?.fingerprint!==fingerprint)previewKey.current={fingerprint,id:crypto.randomUUID()};
  void run('Comparing the source and preparing a plan revision…',()=>client.reviseLearning(source.id,selected.id,{...input,request_id:previewKey.current!.id}));
 }
 function generate(variant?:LearningPlan){
  if(variant?.evidence.length){
   const fingerprint=JSON.stringify({plan_id:variant.id,difficulty});
   if(previewKey.current?.fingerprint!==fingerprint)previewKey.current={fingerprint,id:crypto.randomUUID()};
   void run('Preparing a difficulty change across your supporting sources…',()=>client.reviseLearning(source.id,variant.id,{request_id:previewKey.current!.id,source_id:null,source_version:null,difficulty}));return;
  }
  const input={source_version:source.source_version??1,goal:variant?.goal??goal.trim(),difficulty,path_id:variant?.path_id??null};
  const fingerprint=JSON.stringify(input);
  if(previewKey.current?.fingerprint!==fingerprint)previewKey.current={fingerprint,id:crypto.randomUUID()};
  void run('Preparing explanations, examples and practice…',()=>client.previewLearning(source.id,{...input,request_id:previewKey.current!.id}));
 }
 function activity(kind:LearningActivity['kind'],index=lessonIndex){
  if(!selected)return;
  void run('Saving learning activity…',()=>client.learningActivity(source.id,selected.id,{kind,lesson_index:index}));
 }
 function submit(){
  if(!selected||!answer.trim())return;
  const key=attemptKeys[answerKey]?.answer===answer?attemptKeys[answerKey]:{answer,id:crypto.randomUUID()};
  setAttemptKeys(previous=>({...previous,[answerKey]:key}));
  void run('Saving your answer, then preparing feedback…',async()=>{
   const value=await client.submitLearningAttempt(source.id,selected.id,{request_id:key.id,lesson_index:lessonIndex,response:answer});
   if(mounted.current)setData(value);
   return await client.learningFeedback(source.id,key.id);
  });
 }
 const background=backgroundIndex!==null?selected?.content.background[backgroundIndex]:null;
 const completedRead=data?.activities.filter(item=>item.kind==='read'&&data.plans.find(plan=>plan.id===item.plan_id)?.active).length??0;
 const previewPlans=data?.plans.filter(plan=>!plan.confirmed_at)??[];
 const openedPlans=data?.plans.filter(plan=>plan.confirmed_at)??[];

 return <section className="learning-journey" aria-labelledby={`${fieldId}-heading`} aria-busy={!!busy}>
  <div className="learning-header"><span className="learning-icon"><GraduationCap size={24} aria-hidden="true"/></span><div><span className="eyebrow">YOUR TOPIC COLLECTION</span><h2 id={`${fieldId}-heading`}>Learn {topicTitle??source.title}</h2><p>Turn this source into something you can explain and use.</p></div></div>
  <p className="micro-copy">Start with one saved source. Choose a path, learn through examples, and practise in your own words. Add related sources to strengthen a path through a preview you confirm. Your earlier learning stays saved.</p>
  <div className="learning-progress" aria-label="Learning activity and understanding checks"><span>{completedRead} lessons marked studied</span><span>{data?.attempts.length??0} practice attempts</span><span>{data?.attempts.filter(attempt=>attempt.status==='needs_review').length??0} checks need review</span></div>
  {busy&&<p role="status">{busy} Your saved progress is safe.</p>}
  {error&&<div className="study-error" role="alert"><p>{error}</p><button className="text-button" disabled={!!busy||!enabled} onClick={()=>void run('Restoring progress…',()=>client.learning(source.id))}>Reload learning progress</button></div>}
  {!enabled&&<p role="status">Reconnect your library to save learning progress.</p>}
  <details className="learning-goal" open={!openedPlans.length}>
   <summary>{openedPlans.length?'Explore another goal or path':'Choose where to begin'}</summary>
   <form onSubmit={event=>{event.preventDefault();generate();}}>
    <label htmlFor={`${fieldId}-goal`}>What would you like to understand or do?</label>
    <textarea id={`${fieldId}-goal`} rows={2} maxLength={500} value={goal} disabled={!!busy} onChange={event=>setGoal(event.target.value)} placeholder="For example: understand the method and decide when to use it"/>
    <p className="micro-copy">Leave blank to get a source-informed suggestion. Change this goal when your interests change; existing paths are retained.</p>
    <label htmlFor={`${fieldId}-level`}>Starting difficulty</label><select id={`${fieldId}-level`} value={difficulty} disabled={!!busy} onChange={event=>setDifficulty(event.target.value as LearningDifficulty)}>{levels.map(level=><option key={level} value={level}>{levelLabel(level)}</option>)}</select>
    <button className="button primary" disabled={!!busy||!enabled||!data} type="submit">Suggest learning paths <ChevronRight size={16} aria-hidden="true"/></button>
   </form>
  </details>
  {!!previewPlans.length&&<div className="learning-paths"><h3>Choose your next direction</h3><p className="micro-copy">Suggestions stay closed until you preview and confirm. Teaching order is guidance; you can skip or explore freely.</p>
   {previewPlans.map(plan=><article className="learning-path suggested" key={plan.id}><span className="eyebrow">{plan.needs_review?'EVIDENCE CHANGED':plan.revision?'PLAN REVISION':'SUGGESTED PATH'} · {levelLabel(plan.difficulty)}</span><h4>{plan.content.title}</h4><p>{plan.goal}</p><ol aria-label="Suggested teaching order">{plan.content.lessons.map((item,index)=><li key={index}>{item.title}</li>)}</ol><button className="button secondary" disabled={!!busy||!valid(plan)} onClick={()=>setPreview(plan)}>Preview this path</button></article>)}
  </div>}
  {!!openedPlans.length&&<div className="learning-opened"><label htmlFor={`${fieldId}-path`}>Your saved paths and difficulty history</label><select id={`${fieldId}-path`} value={selected?.confirmed_at?selected.id:''} disabled={!!busy} onChange={event=>{const plan=data?.plans.find(item=>item.id===event.target.value);if(plan)choose(plan);}}>{!selected?.confirmed_at&&<option value="">Choose a saved path</option>}{openedPlans.map(plan=><option key={plan.id} value={plan.id}>{plan.content.title} · {levelLabel(plan.difficulty)}{plan.needs_review?' · Needs review':''}</option>)}</select></div>}
  {selected?.confirmed_at&&lesson&&<>
   <div className="learning-current"><h3 id={`${fieldId}-current-path`} tabIndex={-1}>{selected.content.title}</h3><p>{selected.goal}</p><span className="badge">{levelLabel(selected.difficulty)}</span>
    <div className="learning-difficulty"><label htmlFor={`${fieldId}-difficulty`}>Adjust upcoming difficulty</label><select id={`${fieldId}-difficulty`} value={difficulty} disabled={!!busy} onChange={event=>setDifficulty(event.target.value as LearningDifficulty)}>{levels.map(level=><option key={level} value={level}>{levelLabel(level)}</option>)}</select><button className="text-button" disabled={!!busy||!valid(selected)||difficulty===selected.difficulty||!!selected.evidence.length&&!selected.active} onClick={()=>generate(selected)}>Preview difficulty change</button><p className="micro-copy">Previous lessons and attempts retain their original level. Confirm the new preview before starting it.</p></div>
   </div>
   {!selected.active&&valid(selected)&&<button className="button secondary" disabled={!!busy} onClick={()=>void run('Resuming this saved version…',()=>client.confirmLearning(source.id,selected.id))}>Resume this saved version</button>}
   <LearningCollection key={selected.id} sourceId={source.id} plan={selected} client={client} enabled={enabled&&valid(selected)} busy={!!busy} onAdd={addSource} onDiscover={()=>onDiscover(`${topicTitle??source.title}: ${selected.goal}`)}/>
   {!valid(selected)&&<p className="study-error" role="status">Supporting material changed. This path is retained as history; its teaching and checks need review. Suggest a new path from the current source. Previous activity does not complete revised lessons.</p>}
   <nav className="learning-order" aria-label="Lesson order">{selected.content.lessons.map((item,index)=><button key={index} disabled={!!busy} aria-current={lessonIndex===index?'step':undefined} onClick={()=>{setLessonIndex(index);setMode('teach');}}><span>{index+1}</span>{item.title}</button>)}</nav>
   <div className="segmented" aria-label="Learning mode">{(['teach','practice','review'] as const).map(value=><button key={value} className={mode===value?'active':''} aria-pressed={mode===value} disabled={!!busy} onClick={()=>setMode(value)}>{value==='teach'?'Learn':value==='practice'?'Practise':'Review what I learned'}</button>)}</div>
   {mode==='teach'&&<><LearningLessonView plan={selected} lessonIndex={lessonIndex} onCitation={id=>void cite(selected,id)}/><div className="learning-actions"><button className="button secondary" disabled={!!busy||!valid(selected)||hasActivity('read')} onClick={()=>activity('read')}><BookOpen size={16} aria-hidden="true"/>{hasActivity('read')?'Marked studied':'Mark this lesson studied'}</button><button className="button primary" disabled={!!busy||!valid(selected)} onClick={()=>setMode('practice')}>Try an understanding check</button></div>
    {selected.content.background.map((item,index)=><button className="text-button" key={index} disabled={!!busy||!valid(selected)} onClick={()=>setBackgroundIndex(index)}>Preview optional background: {item.title}</button>)}
   </>}
   {mode==='practice'&&<section className="learning-practice" aria-label="Understanding check"><h4>{lesson.check.question}</h4><p className="micro-copy">{lesson.check.kind.replaceAll('_',' ')} · {levelLabel(selected.difficulty)}</p><p>What your answer should demonstrate:</p><ul>{lesson.check.criteria.map((criterion,index)=><li key={index}>{criterion}</li>)}</ul>
    <form onSubmit={event=>{event.preventDefault();submit();}}><label htmlFor={`${fieldId}-answer`}>Your answer, in your own words</label><textarea id={`${fieldId}-answer`} rows={5} maxLength={5000} value={answer} disabled={!!busy||!valid(selected)} onChange={event=>setResponses(previous=>({...previous,[answerKey]:event.target.value}))}/><button className="button primary" disabled={!!busy||!valid(selected)||!answer.trim()}>Save answer &amp; get feedback</button></form>
    <div className="learning-actions"><button className="text-button" disabled={!!busy||!valid(selected)} onClick={()=>activity('hint')}>Get a hint</button><button className="text-button" disabled={!!busy||!valid(selected)||!hasActivity('hint')} onClick={()=>activity('reveal')}>Show worked answer</button></div>
    {hasActivity('hint')&&<div className="learning-hint"><h5>A starting hint</h5><ReadingText text={lesson.check.hint}/><p className="micro-copy">Try or revise your answer before opening the worked answer.</p></div>}
    {hasActivity('reveal')&&<div className="learning-example"><h5>Worked answer · revealing is not passing</h5><ReadingText text={lesson.check.worked_answer.text}><StudyCitations ids={lesson.check.worked_answer.citation_ids} onCitation={id=>void cite(selected,id)}/></ReadingText></div>}
    {attempts.map((attempt,index)=><article key={attempt.id} className="learning-feedback"><h5>Attempt {index+1} · {levelLabel(attempt.difficulty)} · {attempt.status==='needs_review'?'Needs review':attempt.status==='failed'?'Feedback unavailable':'Answer saved'}</h5><ReadingText text={attempt.response}/>{attempt.feedback?<><p className="micro-copy">Provisional AI feedback; this is not a verified grade or topic mastery.</p><ReadingText text={attempt.feedback.summary}/>{attempt.feedback.criteria.map(item=><div key={item.criterion_index}><h5>{lesson.check.criteria[item.criterion_index]} · {item.assessment.replaceAll('_',' ')}</h5><ReadingText text={item.observation}><StudyCitations ids={item.citation_ids} onCitation={id=>void cite(selected,id)}/></ReadingText></div>)}<h5>Try next</h5><ReadingText text={attempt.feedback.next_hint}/><button className="text-button" disabled={!!busy||!valid(selected)} onClick={()=>{setResponses(previous=>({...previous,[answerKey]:attempt.response}));setAttemptKeys(previous=>{const next={...previous};delete next[answerKey];return next;});document.getElementById(`${fieldId}-answer`)?.focus();}}>Revise in a new attempt</button></>:<><p>Your answer is saved. You can retry feedback or write a new attempt.</p><button className="text-button" disabled={!!busy||!valid(selected)} onClick={()=>void run('Preparing feedback for your saved answer…',()=>client.learningFeedback(source.id,attempt.id))}>Retry feedback</button></>}</article>)}
   </section>}
   {mode==='review'&&<section className="learning-review"><h4>Your learning history</h4><p>Reading is activity. Practice feedback is evidence about an attempt, and currently requires review.</p>{openedPlans.map(plan=><details key={plan.id} open={plan.id===selected.id}><summary>{plan.content.title} · {levelLabel(plan.difficulty)}{plan.needs_review?' · Evidence changed':''}</summary>{plan.content.lessons.map((item,index)=><div key={index}><h5>{item.title}</h5><p>{data?.activities.some(activity=>activity.plan_id===plan.id&&activity.lesson_index===index&&activity.kind==='read')?'Marked studied':'Not marked studied'} · {data?.attempts.filter(attempt=>attempt.plan_id===plan.id&&attempt.lesson_index===index).length??0} attempts</p>{data?.attempts.filter(attempt=>attempt.plan_id===plan.id&&attempt.lesson_index===index).map(attempt=><div key={attempt.id}><small>{new Date(attempt.created_at).toLocaleString()} · {attempt.status.replaceAll('_',' ')}</small><ReadingText text={attempt.response}/>{attempt.feedback&&<ReadingText text={attempt.feedback.summary}/>}</div>)}<button className="text-button" disabled={!!busy} onClick={()=>{choose(plan);setLessonIndex(index);setMode('practice');}}>Revisit this check</button></div>)}</details>)}</section>}
   <LearningTutor key={`${selected.id}:${lessonIndex}`} sourceId={source.id} plan={selected} lessonIndex={lessonIndex} client={client} enabled={enabled&&valid(selected)} onCitation={id=>void cite(selected,id)} onDiscover={()=>onDiscover(`${topicTitle??source.title}: ${selected.goal}`)}/>
   <div className="learning-help"><p>Find more context and strengthen this collection with additional sources.</p><button className="text-button" onClick={()=>onDiscover(`${topicTitle??source.title}: ${selected.goal}`)}>Find sources for this goal</button></div>
  </>}
  {preview&&<Modal title="Preview your learning path" onClose={()=>setPreview(null)} className="learning-preview"><span className="badge">{levelLabel(preview.difficulty)} · {preview.source_members.length||1} saved {preview.source_members.length>1?'sources':'source'}</span><h3>{preview.content.title}</h3><p>{preview.goal}</p><h4>What you’ll be able to do</h4><ul>{preview.content.outcomes.map((outcome,index)=><li key={index}>{outcome}</li>)}</ul><h4>Suggested prerequisites</h4><p>{preview.content.prerequisites.join(' · ')||'No prerequisites identified in this preview.'}</p><LearningRevisionSummary plan={preview} onCitation={id=>void cite(preview,id)}/><h4>Supporting material</h4><ul>{(preview.source_members.length?preview.source_members:[{source_id:source.id,title:source.title}]).map(member=><li key={member.source_id}>{member.title}</li>)}</ul><ReadingText text={preview.content.coverage}/><p className="micro-copy">Selected saved-source passages support this AI-generated teaching. A single source does not establish complete topic coverage.</p>{preview.content.gaps.length>0&&<><h4>Coverage gaps</h4><ul>{preview.content.gaps.map((gap,index)=><li key={index}>{gap}</li>)}</ul></>}{preview.content.background.length>0&&<><h4>Optional generated background</h4><p>Not quoted from your saved source. Each background lesson has its own preview.</p><ul>{preview.content.background.map((item,index)=><li key={index}>{item.title}: {item.purpose}</li>)}</ul></>}<p>Suggested order: {preview.content.lessons.map(item=>item.title).join(' → ')}. You may skip or practise first.</p><div className="learning-actions"><button className="button secondary" onClick={()=>setPreview(null)}>Keep exploring</button><button className="button primary" disabled={!!busy||!valid(preview)} onClick={()=>void run('Starting your chosen path…',()=>client.confirmLearning(source.id,preview.id),()=>{choose(preview);setPreview(null);requestAnimationFrame(()=>document.getElementById(`${fieldId}-current-path`)?.focus());})}>{preview.revision?'Confirm revised plan':'Start this path'}</button></div></Modal>}
  {background&&selected&&backgroundIndex!==null&&<Modal title={`Optional background: ${background.title}`} onClose={()=>setBackgroundIndex(null)}><p>{background.purpose}</p><p className="micro-copy">Generated prerequisite teaching; it is not an excerpt or established coverage from {source.title}.</p>{hasActivity('background_opened',backgroundIndex)?<ReadingText text={background.text}/>:<button className="button primary" disabled={!!busy||!valid(selected)} onClick={()=>activity('background_opened',backgroundIndex)}>Open this background lesson</button>}</Modal>}
 </section>;
}
