import type {SourceClient} from '../lib/source-client';
import type {LearningSummary} from '../lib/learning';
import {useLearningSummary} from '../lib/use-learning-summary';

export function LearningSummaryView({data,onOpen}:{data:LearningSummary;onOpen:(id:string)=>void;client:SourceClient|null}){
 const place=data.resume;
 return <section aria-label="Saved learning activity" className="library-learning">
  <div className="learning-progress"><span>{data.studied_lessons} lessons marked studied</span><span>{data.practice_attempts} practice attempts</span><span>{data.provisional_checks} checks need review</span>
   {data.pending_feedback>0&&<span>{data.pending_feedback} feedback pending</span>}{data.failed_feedback>0&&<span>{data.failed_feedback} feedback unavailable</span>}
  </div><p className="micro-copy">Saved activity across plan versions. Studying and provisional feedback do not establish mastery.</p>
  {place?<section className="resume-card"><div className="resume-content"><span className="eyebrow">CONTINUE YOUR LEARNING</span><h2>{place.plan_title}</h2><p>{place.goal}</p>
   <p>Lesson {place.lesson_index+1}: {place.lesson_title}</p><p className="micro-copy">Started from {place.source_title}</p>
   {place.needs_review&&<p role="note">Supporting evidence needs review. Your learning history stays saved.</p>}
   {!place.source_available&&<p>The original source was removed; your collection history stays accessible.</p>}
   <button className="button primary" onClick={()=>onOpen(place.source_id)}>Continue this lesson</button>
  </div></section>:<p>No timestamped learning place is saved yet. Open a saved path to choose where to continue.</p>}
 </section>;
}
export default function LibraryLearning({client,onOpen}:{client:SourceClient;onOpen:(id:string)=>void}){
 const {data,error,retry}=useLearningSummary(client);
 if(error)return <section role="alert"><p>Saved learning activity is unavailable. {error}</p><button className="text-button" onClick={retry}>Retry learning activity</button><p>Your source library is still available below.</p></section>;
 if(!data)return <p role="status">Restoring your learning place…</p>;
 return <LearningSummaryView data={data} client={client} onOpen={onOpen}/>;
}
