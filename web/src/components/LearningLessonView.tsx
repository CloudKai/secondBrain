import ReadingText from './ReadingText';
import {StudyCitations} from './StructuredStudy';
import type {LearningPlan} from '../lib/learning';

export default function LearningLessonView({plan,lessonIndex,onCitation}:{plan:LearningPlan;lessonIndex:number;onCitation:(id:string)=>void}) {
  const lesson=plan.content.lessons[lessonIndex];
  if(!lesson)return null;
  return <section className="learning-teaching" aria-label="Lesson explanation">
    <span className="eyebrow">YOUR LEARNING OUTCOME</span>
    <p className="learning-outcome">{lesson.outcome}</p>
    <h4>{lesson.title}</h4>
    <ReadingText text={lesson.explanation.text}><StudyCitations ids={lesson.explanation.citation_ids} onCitation={onCitation}/></ReadingText>
    {lesson.example&&<div className="learning-example">
      <span className="eyebrow">{lesson.example.provenance==='generated_example'?'Generated teaching example':'Source-backed worked example'}</span>
      <ReadingText text={lesson.example.text}><StudyCitations ids={lesson.example.citation_ids} onCitation={onCitation}/></ReadingText>
    </div>}
    <p className="micro-copy">AI-generated teaching. Inspect the cited passages to check its support.</p>
  </section>;
}
