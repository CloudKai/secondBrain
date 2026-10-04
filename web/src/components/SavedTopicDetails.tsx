import { ArrowUpRight, FileText, Network } from "lucide-react";
import type { Note, Topic } from "../types";
import type { SourceClient } from "../lib/source-client";
import type { TopicRecord } from "../lib/topic-library";
import type { OverviewClaim, TopicOverview } from "../lib/topic-overview";
import { useTopicOverview } from "../lib/use-topic-overview";

interface Props {
  topic: Topic; maps: TopicRecord[]; client: SourceClient | null; enabled: boolean;
  topicError: string; placementBusy: boolean; names: Record<string, string>;
  onReloadTopics: () => void; onPlace: (source: string, topic: string, target: string | null) => unknown;
  onOpen: (note: Note) => void; onEvidence: (source: string, passage: string) => void;
}
function CitedClaim({claim, overview, onEvidence}: {claim: OverviewClaim; overview: TopicOverview; onEvidence: Props["onEvidence"]}) {
  return <p>{claim.text} {claim.reference_ids.map(id => {
    const index = overview.references.findIndex(r => r.id === id);
    const ref = overview.references[index];
    return <button className="citation" key={id} title={ref.title} aria-label={`Inspect ${ref.title} passage ${ref.passage.id}`} onClick={() => onEvidence(ref.source_id, ref.passage.id)}>{index + 1}</button>;
  })}</p>;
}
export default function SavedTopicDetails({topic, maps, client, enabled, topicError, placementBusy, names, onReloadTopics, onPlace, onOpen, onEvidence}: Props) {
  const revision = topic.notes.map(n => `${n.id}:${maps.find(m => m.source_id === n.id)?.updated_at}:${n.study?.updated_at}`).sort().join("|");
  const state = useTopicOverview(client, enabled, topic.id, revision);
  const separate = state.data?.view_mode === "separate";
  const record = state.data?.record;
  // The saved note is also checked locally before any citation can be offered.
  const overview = record?.overview;
  const verified = overview && overview.references.every(ref => {
    const note = topic.notes.find(n => n.id === ref.source_id)?.study?.note;
    const assignment = maps.find(m => m.source_id === ref.source_id)?.analysis?.topics.find(t => t.id === topic.id);
    const original = note?.references.find(r => r.id === ref.passage.id);
    return assignment?.citation_ids.includes(ref.passage.id) && original && ["start", "end", "excerpt", "page", "start_ms", "end_ms"].every(field => original[field as keyof typeof original] === ref.passage[field as keyof typeof ref.passage]);
  });
  const canCombine = topic.notes.length >= 2 && !topic.uncertain;
  return <>
    <div className="panel-topic-icon"><Network size={24} aria-hidden="true" /></div>
    <span className="eyebrow">{topic.uncertain ? "SUGGESTED TOPIC" : "SHARED TOPIC"}</span>
    <h2>{topic.title}</h2><p className="panel-description">{topic.description}</p>
    {topicError && <div role="alert"><p>{topicError}</p><button className="text-button" onClick={onReloadTopics}>Reload topics</button></div>}
    <p className="micro-copy">{topic.context} · {(topic.groups ?? []).join(" · ")} · {topic.notes.length} supporting sources. Coverage is not mastery.</p>
    {canCombine && <>
      <p className="overlap-copy">These sources share {topic.title}. Combine their evidence or keep each source as a branch under this topic.</p>
      <div className="segmented" aria-label="Topic view">
        <button aria-pressed={!separate} className={!separate ? "active" : ""} disabled={state.busy || !state.data} onClick={() => void state.choose("combined")}>Combine</button>
        <button aria-pressed={separate} className={separate ? "active" : ""} disabled={state.busy || !state.data} onClick={() => void state.choose("separate")}>Keep separate</button>
      </div>
    </>}
    {state.error && <div role="alert"><p>{state.error}</p><button className="text-button" onClick={state.reload}>Reload overview</button></div>}
    {!state.data && !state.error && <p role="status" className="micro-copy">Loading topic view…</p>}
    {canCombine && !separate && <section className="combined-overview" aria-label="Combined topic overview">
      {verified && overview ? <>
        <h3>Combined overview</h3><CitedClaim claim={overview.overview} overview={overview} onEvidence={onEvidence}/>
        {overview.agreements.length > 0 && <><h3>Where sources agree</h3>{overview.agreements.map((c, i) => <CitedClaim key={i} claim={c} overview={overview} onEvidence={onEvidence}/>)}</>}
        <h3>Differences and qualifications</h3>
        {overview.differences.length ? overview.differences.map((c, i) => <CitedClaim key={i} claim={c} overview={overview} onEvidence={onEvidence}/>) : <p className="micro-copy">No supported differences were identified in these passages. Check the original notes for further context.</p>}
        {overview.partial && <p className="micro-copy">Partial overview: processing limits excluded some sources. All source branches remain available below.</p>}
      </> : <div role="status" className="micro-copy">
        {record?.status === "failed" ? <><p>Synthesis could not complete. Your original notes are preserved.</p><button className="text-button" disabled={state.busy} onClick={() => void state.choose("combined", true)}>Retry overview</button></> :
          record?.status === "queued" || record?.status === "processing" ? <p>Creating the combined overview. Attempt {record.attempts} of {record.max_attempts}; you can reopen this topic later.</p> :
          overview && !verified ? <p>Overview evidence could not be verified against the current notes. Reload topics to check the source passages.</p> :
          <p>{state.data?.needs_refresh ? "Topic sources changed. Choose Combine to refresh the overview with current evidence." : "Choose Combine to create a cited overview from these sources."}</p>}
      </div>}
    </section>}
    <h3 className="branch-heading">{separate ? "Source branches" : "Original source notes"}</h3>
    <p className="micro-copy">Each branch belongs to {topic.title}. Its original note and citations are preserved.</p>
    <div className="source-branches">{topic.notes.map(n => {
      const assignment = maps.find(m => m.source_id === n.id)?.analysis?.topics.find(a => a.id === topic.id);
      const claims = n.study?.note?.concepts.filter(c => c.citation_ids.some(id => assignment?.citation_ids.includes(id))) ?? [];
      return <article className="topic-overview source-branch" key={n.id} aria-label={`Source branch: ${n.title}`}>
        <span className="eyebrow">SOURCE BRANCH</span>
        <button className="source-title" onClick={() => onOpen(n)}><FileText size={15} aria-hidden="true"/>{n.title}<ArrowUpRight size={14} aria-hidden="true"/></button>
        <p className="micro-copy">{assignment?.role} topic · {assignment?.placement_reason}</p>
        {separate && claims.map((c, i) => <p key={i}><strong>{c.title}</strong> — {c.text}</p>)}
        {assignment?.citation_ids.map(id => <button key={id} className="text-button" onClick={() => onEvidence(n.id, id)}>Inspect passage {id}</button>)}
        {assignment?.uncertain && <div className="topic-placement"><p>Suggested placement: {assignment.suggested_topic_id ? names[assignment.suggested_topic_id] ?? "A related saved topic" : "Keep a distinct topic until its scope is clear"}</p>
          {assignment.suggested_topic_id && <button className="text-button" disabled={placementBusy} onClick={() => void onPlace(n.id, topic.id, assignment.suggested_topic_id)}>Use suggested topic</button>}
          <button className="text-button" disabled={placementBusy} onClick={() => void onPlace(n.id, topic.id, null)}>Keep this topic separate</button></div>}
      </article>;
    })}</div>
  </>;
}
