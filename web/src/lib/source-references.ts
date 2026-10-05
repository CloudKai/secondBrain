import type { z } from 'zod';
import type { SavedSource } from './source-client';
import type { referenceSchema } from './study-note';

type SourceReference = z.infer<typeof referenceSchema>;

/** Verify stored evidence against original locations, independent of grouping policy. */
export function referenceMatchesSource(passage: SourceReference, source: SavedSource): boolean {
  const text = Array.from(source.captured_text);
  const { start, end, page, start_ms: startMs, end_ms: endMs } = passage;
  if (start < 0 || start >= end || end > text.length || text.slice(start, end).join('') !== passage.excerpt) return false;
  if (source.document) {
    return startMs == null && endMs == null && source.document.pages.some(p =>
      p.page === page && p.start <= start && end <= p.end);
  }
  if (source.transcript) {
    const cues = source.transcript.segments.filter(c => c.start < end && c.end > start);
    if (!cues.length || page != null) return false;
    const first = cues[0], last = cues[cues.length - 1];
    const latestEnd = first.end_ms == null ? null : Math.max(...cues.map(c => c.end_ms!));
    return first.start <= start && start < first.end && last.start < end && end <= last.end &&
      cues.every((cue, i) => i === 0 || text.slice(cues[i - 1].end, cue.start).join('') === '\n') &&
      (startMs ?? null) === first.start_ms && (endMs ?? null) === latestEnd;
  }
  return page == null && startMs == null && endMs == null;
}
