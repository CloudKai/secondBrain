/** Display-only blocks. Original capture locations never use the formatted text. */
export interface ReadingBlock { kind: 'prose' | 'literal'; text: string; }

function literalLayout(text: string): boolean {
  const lines = text.split(/\r?\n/);
  return /(^[\t ]+\S)|(^\s*(?:[-*•]|\d+[.)])\s)|[=<>∑∫√≈≤≥±^\\|{}]|\S[\t ]{2,}\S/m.test(text)
    || lines.some((line, index) => line.trim().length < 60 && !/[.!?;,:]$/.test(line.trim())
      && /^[A-Z]/.test(lines[index + 1]?.trim() ?? ''));
}

export function readingBlocks(text: string, reflow = true): ReadingBlock[] {
  // Fences can contain blank lines. Keep the whole ambiguous block intact.
  if (/^\s*(?:```|~~~)/m.test(text)) return [{kind:'literal', text}];
  return text.split(/\r?\n[\t ]*\r?\n/).filter(part => part.trim()).map(part => {
    const literal = literalLayout(part);
    return {kind:literal ? 'literal' : 'prose',
      text: reflow && !literal ? part.trim().replace(/\s+/g, ' ') : part};
  });
}

export interface TranscriptCue { start:number; end:number; start_ms:number|null; end_ms:number|null; }
export interface TranscriptReadingGroup extends TranscriptCue { text:string; cues:TranscriptCue[]; }

export function transcriptReadingGroups(text:string, cues:TranscriptCue[]):TranscriptReadingGroup[] {
  const characters = Array.from(text);
  const groups:TranscriptReadingGroup[] = [];
  for (const cue of cues) {
    const previous = groups[groups.length - 1];
    if (previous && previous.start_ms != null && previous.end_ms != null && cue.start_ms != null && cue.end_ms != null
      && characters.slice(previous.end,cue.start).join('') === '\n'
      && cue.start_ms - previous.end_ms <= 1500
      && Math.max(previous.end_ms,cue.end_ms) - previous.start_ms <= 45000
      && cue.end - previous.start <= 900) {
      previous.end = cue.end;
      previous.end_ms = Math.max(previous.end_ms,cue.end_ms);
      previous.text = characters.slice(previous.start,cue.end).join('');
      previous.cues.push(cue);
    } else {
      groups.push({...cue,text:characters.slice(cue.start,cue.end).join(''),cues:[cue]});
    }
  }
  return groups;
}
