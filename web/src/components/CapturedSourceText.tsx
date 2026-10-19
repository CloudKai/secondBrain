import type { Note } from '../types';
import { formatVideoTime } from '../lib/transcript';
import { transcriptReadingGroups } from '../lib/reading-format';
import ReadingText from './ReadingText';

export default function CapturedSourceText({note}:{note:Note}) {
  const transcript = note.savedSource?.transcript;
  const characters = Array.from(note.evidence);
  if (transcript && transcript.format !== 'text') {
    return <div className="transcript-cues source-reading-sections">
      {transcriptReadingGroups(note.evidence,transcript.segments).map(group => <section key={group.start}>
        <h3 className="source-section-location">{group.start_ms != null && group.end_ms != null
          ? `${formatVideoTime(group.start_ms)}–${formatVideoTime(group.end_ms)}` : 'Untimed transcript excerpt'}</h3>
        <ReadingText text={group.text} source originalLabel="Original caption cues" original={<ol className="original-cues">
          {group.cues.map(cue => <li key={cue.start}>
            <span>{cue.start_ms != null && cue.end_ms != null ? `${formatVideoTime(cue.start_ms)}–${formatVideoTime(cue.end_ms)}` : 'Untimed cue'}</span>
            <pre>{characters.slice(cue.start,cue.end).join('')}</pre>
          </li>)}
        </ol>}/>
      </section>)}
    </div>;
  }
  const pages = note.savedSource?.document?.pages;
  if (!pages) return <ReadingText text={note.evidence || 'No captured source text is available.'} source={!note.demo}/>;
  return <div className="pdf-pages source-reading-sections">{pages.map(page => <section key={page.page}>
    <h3 className="source-section-location">PDF page {page.page}</h3>
    <ReadingText text={characters.slice(page.start,page.end).join('') || 'No selectable text was captured on this page.'} source/>
  </section>)}</div>;
}
