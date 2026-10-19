import type { AssistantReference } from '../lib/assistant-answer';
import ReadingText from './ReadingText';
import PassageLocation from './PassageLocation';

export default function AssistantExcerptCards({references,onCitation}:{references:AssistantReference[];onCitation:(ref:AssistantReference)=>void}) {
  // Keep API reference order and global citation numbers, even across sources.
  const groups:{references:AssistantReference[];first:number}[] = [];
  references.forEach((ref,index) => {
    const previous = groups[groups.length - 1];
    const first = previous?.references[0];
    if (first?.source_id === ref.source_id && first.source_version === ref.source_version) previous.references.push(ref);
    else groups.push({references:[ref],first:index});
  });
  return <div className="assistant-source-cards">{groups.map(group => <article className="source-excerpt-card" key={group.references[0].id}>
    <header><h4>{group.references[0].title}</h4><span>Saved source · version {group.references[0].source_version}</span></header>
    {group.references.map((ref,index) => <section className="source-excerpt" key={ref.id} aria-label={`Source excerpt ${group.first + index + 1}`}>
      <PassageLocation passage={ref.passage}/>
      <ReadingText text={ref.passage.excerpt} source>
        <button className="citation" aria-label={`Inspect citation ${group.first + index + 1}: ${ref.title}, passage ${ref.passage.id}`} onClick={()=>onCitation(ref)}>{group.first + index + 1}</button>
      </ReadingText>
    </section>)}
  </article>)}</div>;
}
