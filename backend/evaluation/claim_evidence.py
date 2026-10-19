"""Private evaluation pairs; only exact passages actually cited by each claim."""
import hashlib
from uuid import UUID
from pydantic import Field
from backend.schemas import StrictModel
from backend.assistant_models import AssistantAnswer
from backend.capture_limits import MAX_CAPTURE_CHARS
from backend.source_models import PDFDocument
from backend.transcript_models import TranscriptDocument
from backend.source_references import reference_matches_source


class EvidenceCapture(StrictModel):
    source_id: UUID
    source_version: int = Field(ge=1, le=20)
    captured_text: str = Field(min_length=120, max_length=MAX_CAPTURE_CHARS)
    document: PDFDocument | None
    transcript: TranscriptDocument | None


def pair_claims(answer: AssistantAnswer, captures: list[EvidenceCapture]) -> list[dict]:
    sources = {c.source_id: c for c in captures}
    if len(sources) != len(captures):
        raise ValueError('Duplicate evaluation capture')
    references = {}
    for ref in answer.references:
        capture = sources.get(ref.source_id)
        if (capture is None or capture.source_version != ref.source_version
            or not reference_matches_source(capture.captured_text, ref.passage,
                                             capture.document, capture.transcript)):
            raise ValueError('Cited capture or location has changed')
        references[ref.id] = {
            'reference_id': ref.id, 'source_id': str(ref.source_id),
            'source_version': ref.source_version,
            'capture_sha256': hashlib.sha256(capture.captured_text.encode()).hexdigest(),
            'passage': ref.passage.model_dump(mode='json'),
        }
    return [{'claim_index': i, 'claim': claim.text, 'reference_ids': claim.reference_ids,
             'evidence': [references[rid] for rid in claim.reference_ids]}
            for i, claim in enumerate(answer.claims)]
