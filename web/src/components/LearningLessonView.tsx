import ReadingText from './ReadingText';
import {Button,Callout,Card} from './ui';
import {StudyCitations} from './StructuredStudy';
import type {LearningPlan} from '../lib/learning';
import {QUIZ_COPY} from '../lib/quiz-copy';

export default function LearningLessonView({plan,lessonIndex,onCitation,emphasis=false,onOpenQuiz}:{plan:LearningPlan;lessonIndex:number;onCitation:(id:string)=>void;emphasis?:boolean;onOpenQuiz?:()=>void}) {
  const lesson=plan.content.lessons[lessonIndex];
  if(!lesson)return null;
  const outcome=<><span className="eyebrow">YOUR LEARNING OUTCOME</span><p className="learning-outcome">{lesson.outcome}</p></>;
  return <section className="learning-teaching" aria-label="Lesson explanation">
    {emphasis?<Callout variant="focus">{outcome}</Callout>:outcome}
    <h4>{lesson.title}</h4>
    <ReadingText text={lesson.explanation.text}><StudyCitations references={plan.teaching?plan.references:undefined} ids={lesson.explanation.citation_ids} onCitation={onCitation}/></ReadingText>
    {lesson.example&&<div className="learning-example">
      <span className="eyebrow">{lesson.example.provenance==='generated_example'?'Generated teaching example':'Source-backed worked example'}</span>
      <ReadingText text={lesson.example.text}><StudyCitations references={plan.teaching?plan.references:undefined} ids={lesson.example.citation_ids} onCitation={onCitation}/></ReadingText>
    </div>}
    <p className="micro-copy">AI-generated teaching. Inspect the cited passages to check its support.</p>
    {onOpenQuiz&&<Card tone="quiet" padding="md" className="quiz-end-prompt"><h5 className="quiz-end-prompt__title">{QUIZ_COPY.endOfPath.title}</h5><p>{QUIZ_COPY.endOfPath.body}</p><div><Button variant="secondary" onClick={onOpenQuiz}>{QUIZ_COPY.endOfPath.action}</Button></div></Card>}
  </section>;
}
