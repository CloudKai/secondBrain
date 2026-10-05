"""Exact source evidence: bounded readable passages and location verification.

Policy implementations are immutable: a saved section's pNNNN IDs depend on
these rules. Introduce a new policy for later changes, keeping old jobs stable.
"""

import re
from typing import Literal

from backend.capture_limits import MAX_CAPTURE_CHARS
from backend.source_models import PDFDocument
from backend.study_models import SourceReference
from backend.transcript_models import TranscriptDocument

PassagePolicy = Literal['legacy', 'thought_v1']
MAX_PASSAGE_CHARS = 900
_SENTENCE = re.compile(r'[.!?][\"”’\')\]]*(?:\s+|$)')
_PARAGRAPH = re.compile(r'\n[ \t]*\n+')
# Capture preserves VTT voice labels of up to 200 characters, including
# lowercase and Unicode names. Require label punctuation, not name casing.
_SPEAKER = re.compile(r'^\s*(?:[-–]\s*)?([^\n]{1,200}?):(?=\s)')
_ABBREVIATIONS = {'mr.', 'mrs.', 'ms.', 'dr.', 'prof.', 'e.g.', 'i.e.', 'vs.', 'etc.', 'al.'}


def _sentence_ends(text: str, start: int, end: int) -> list[int]:
    endings = []
    for match in _SENTENCE.finditer(text, start, end):
        token = text[start:match.start() + 1].rsplit(None, 1)[-1].lower()
        if token in _ABBREVIATIONS or re.fullmatch(r'(?:[a-z]\.)+', token):
            continue
        endings.append(match.end())
    return endings


def _text_spans(text: str, first: int, last: int, policy: PassagePolicy):
    start = first
    while start < last:
        end = min(start + MAX_PASSAGE_CHARS, last)
        if policy == 'legacy':
            if end < last:
                boundary = max(text.rfind('\n', start + 450, end), text.rfind(' ', start + 450, end))
                if boundary >= 0:
                    end = boundary + 1
        else:
            # Single newlines may be PDF wraps or inline HTML fragments. Only
            # blank lines are reliable paragraph separators in captured text.
            paragraphs = [m.end() for m in _PARAGRAPH.finditer(text, start, end)]
            if paragraphs and text[start:paragraphs[-1]].strip():
                end = paragraphs[-1]
            elif end < last:
                sentences = _sentence_ends(text, start, end)
                if sentences:
                    end = sentences[-1]
                else:
                    spaces = list(re.finditer(r'\s+', text[start:end]))
                    if spaces:
                        end = start + spaces[-1].end()
        yield start, end
        start = end


def _cue_spans(text: str, transcript: TranscriptDocument):
    group = []
    for cue in transcript.segments:
        if group:
            first, previous = group[0], group[-1]
            current_speaker = _SPEAKER.match(text[cue.start:cue.end])
            known_speakers = [m.group(1) for s in group if (m := _SPEAKER.match(text[s.start:s.end]))]
            final_sentence = _sentence_ends(text, previous.start, previous.end)
            closed = final_sentence and not text[final_sentence[-1]:previous.end].strip()
            latest_end = max(s.end_ms for s in group)
            if (closed or cue.start_ms - latest_end > 1500
                or max(latest_end, cue.end_ms) - first.start_ms > 45_000
                or cue.end - first.start > MAX_PASSAGE_CHARS
                or (current_speaker and known_speakers and current_speaker.group(1) != known_speakers[-1])):
                yield first.start, previous.end, None, first.start_ms, latest_end
                group = []
        group.append(cue)
    if group:
        yield group[0].start, group[-1].end, None, group[0].start_ms, max(s.end_ms for s in group)


def source_passages(text: str, document: PDFDocument | None = None,
                    transcript: TranscriptDocument | None = None, *,
                    policy: PassagePolicy = 'thought_v1') -> list[SourceReference]:
    if policy not in ('legacy', 'thought_v1') or not 120 <= len(text) <= MAX_CAPTURE_CHARS:
        raise ValueError('Invalid passage input')
    if document and document.pages[-1].end != len(text):
        raise ValueError('Invalid page coverage')
    if transcript and (document or transcript.segments[-1].end != len(text)):
        raise ValueError('Invalid transcript coverage')
    if document:
        spans = [(p.start, p.end, p.page, None, None) for p in document.pages]
    elif transcript:
        spans = (list(_cue_spans(text, transcript)) if policy == 'thought_v1' and transcript.format != 'text'
                 else [(s.start, s.end, None, s.start_ms, s.end_ms) for s in transcript.segments])
    else:
        spans = [(0, len(text), None, None, None)]
    passages = []
    for first, last, page, start_ms, end_ms in spans:
        # Joined cues already form one bounded thought. Splitting that group
        # again at an embedded paragraph could attach unrelated cue times.
        timed_group = transcript and transcript.format != 'text' and policy == 'thought_v1'
        offsets = ([(first, last)] if timed_group and last - first <= MAX_PASSAGE_CHARS
                   else _text_spans(text, first, last, policy))
        for start, end in offsets:
            passages.append(SourceReference(id=f'p{len(passages) + 1:04d}', start=start, end=end,
                excerpt=text[start:end], page=page, start_ms=start_ms, end_ms=end_ms))
    return passages


def reference_matches_source(text: str, passage: SourceReference,
                             document: PDFDocument | None = None,
                             transcript: TranscriptDocument | None = None) -> bool:
    if not (0 <= passage.start < passage.end <= len(text)) or text[passage.start:passage.end] != passage.excerpt:
        return False
    if document:
        return passage.start_ms is None and passage.end_ms is None and any(
            p.page == passage.page and p.start <= passage.start < passage.end <= p.end for p in document.pages)
    if transcript:
        cues = [s for s in transcript.segments if s.start < passage.end and s.end > passage.start]
        return bool(cues) and passage.page is None and (
            cues[0].start <= passage.start < cues[0].end
            and cues[-1].start < passage.end <= cues[-1].end
            and all(text[a.end:b.start] == '\n' for a, b in zip(cues, cues[1:]))
            and passage.start_ms == cues[0].start_ms
            and passage.end_ms == (max(s.end_ms for s in cues) if cues[0].end_ms is not None else None))
    return passage.page is None and passage.start_ms is None and passage.end_ms is None
