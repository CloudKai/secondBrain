"""Collect authenticated, revision-checked answers and actual retrieval context.

Run with a learner session supplied through EVAL_SESSION_TOKEN, never through
CLI arguments or a committed manifest. Reports contain source excerpts and
belong in an ignored directory. No privileged database key is used here.
"""
import argparse
import asyncio
import hashlib
import json
import os
from pathlib import Path
from time import perf_counter
from uuid import UUID
from typing import Annotated, Literal
import httpx
from dotenv import load_dotenv
from pydantic import Field
from backend.core.schemas import StrictModel
from backend.assistant.models import AssistantQuestion
from backend.assistant.generation import AssistantGenerator
from backend.assistant.answers import answer_saved_question, RetrievalMode
from backend.sources.routes import SourceGateway
from backend.sources.references import reference_matches_source
from backend.assistant.store import AssistantStore
from backend.evaluation.claim_evidence import EvidenceCapture, pair_claims


class EvidenceSource(StrictModel):
    source_id: UUID
    source_version: int = Field(ge=1, le=20)
    capture_sha256: str = Field(pattern='^[a-f0-9]{64}$')


class BaselineCase(StrictModel):
    id: str = Field(min_length=1, max_length=100)
    source_id: UUID
    question: AssistantQuestion
    expected_output: str | None = Field(default=None, max_length=4000)
    expected_status: Literal['supported', 'unsupported']
    expected_evidence: list[Annotated[str, Field(min_length=1, max_length=1000)]] = Field(default_factory=list, max_length=20)
    capture_sha256: str = Field(pattern='^[a-f0-9]{64}$')
    reviewed: bool = False
    evidence_sources: list[EvidenceSource] = Field(default_factory=list, max_length=20)


async def collect(case: BaselineCase, gateway: SourceGateway, generator: AssistantGenerator, *,
                  mode: RetrievalMode = 'configured') -> dict:
    if not case.reviewed:
        raise ValueError('Unreviewed case cannot be scored')
    if case.evidence_sources:
        if len({s.source_id for s in case.evidence_sources}) != len(case.evidence_sources):
            raise ValueError('Duplicate expected source')
        # Validate annotations against the whole selected scope independently of
        # retrieval. A missed source is a scored miss, not an invalid annotation.
        inventory = {s.source_id: s for s in await AssistantStore(gateway).inventory(case.source_id, case.question)}
        captures = []
        for pin in case.evidence_sources:
            snapshot = inventory.get(pin.source_id)
            if snapshot is None or snapshot.source_version != pin.source_version or snapshot.capture_sha256 != pin.capture_sha256:
                raise ValueError('Expected source is outside scope or changed')
            source = await gateway.find(id=f'eq.{pin.source_id}')
            if source is None or source.user_id != gateway.user_id or source.id != pin.source_id or source.source_version != pin.source_version or hashlib.sha256(source.captured_text.encode()).hexdigest() != pin.capture_sha256:
                raise ValueError('Expected capture does not match reviewed evidence')
            captures.append(source.captured_text)
        if any(not any(span in text for text in captures) for span in case.expected_evidence):
            raise ValueError('Expected evidence is absent from reviewed sources')
    def validate_input(rows):
        if hashlib.sha256(rows[0].captured_text.encode()).hexdigest() != case.capture_sha256:
            raise ValueError('Capture does not match reviewed evidence')
        if not case.evidence_sources and any(not any(span in row.captured_text for row in rows) for span in case.expected_evidence):
            raise ValueError('Expected evidence is absent from selected current sources')
    contexts: list[str] = []
    started = perf_counter()
    run = await answer_saved_question(case.source_id, case.question, gateway,
        mode=mode, generator=generator, on_retrieval=contexts.append, validate_input=validate_input)
    answer, rows = run.answer, run.sources
    elapsed = perf_counter() - started
    payload = json.loads(contexts[0]) if contexts else {'sources': []}
    retrieved = [item['excerpt'] for source in payload['sources'] for item in source['evidence']]
    source_rows = {row.source_id: row for row in rows}
    exact = all(reference_matches_source(source_rows[r.source_id].captured_text,
                r.passage, source_rows[r.source_id].document, source_rows[r.source_id].transcript)
                for r in answer.references)
    # Human annotations are exact spans. Semantic recall is scored separately;
    # this deterministic hit rate should not be presented as semantic recall.
    hits = sum(any(span in excerpt for excerpt in retrieved) for span in case.expected_evidence)
    return {
        'id': case.id, 'retrieval_mode': run.retrieval_mode, 'input': case.question.question,
        'actual_output': '\n\n'.join(c.text for c in answer.claims) or answer.gap,
        'expected_output': case.expected_output, 'expected_status': case.expected_status,
        'actual_status': answer.status, 'status_matches': answer.status == case.expected_status,
        'retrieval_context': retrieved, 'expected_evidence': case.expected_evidence,
        'expected_source_ids': [str(s.source_id) for s in case.evidence_sources],
        'selected_source_ids': [str(r.source_id) for r in rows],
        'exact_span_hit_rate': hits / len(case.expected_evidence) if case.expected_evidence else None,
        'citation_locations_valid': exact, 'answer': answer.model_dump(mode='json'),
        'claim_evidence_pairs': pair_claims(answer, [EvidenceCapture(
            source_id=r.source_id, source_version=r.source_version, captured_text=r.captured_text,
            document=r.document, transcript=r.transcript) for r in rows]),
        'scope': {'topic': case.question.topic_id is not None, 'library': case.question.library},
        'source_kinds': ['pdf' if r.document else 'video' if r.transcript else 'article' for r in rows],
        'completion_seconds': elapsed, 'first_verified_streamed_text_seconds': None,
        'generation_model': 'gpt-4o-mini', 'generation_usage': None,
        'generation_cost_usd': None, 'capture_sha256': case.capture_sha256,
    }


async def main(manifest: Path, output: Path, limit: int, mode: RetrievalMode = 'configured'):
    allowed = Path('output/evaluation').resolve()
    if not output.resolve().is_relative_to(allowed):
        raise ValueError('Reports must be saved under ignored output/evaluation/')
    load_dotenv('backend/.env')
    values = json.loads(manifest.read_text())
    if not isinstance(values, list) or not 1 <= len(values) <= 50:
        raise ValueError('Expected 1–50 annotated cases')
    cases = [BaselineCase.model_validate_json(json.dumps(value)) for value in values]
    if len({c.id for c in cases}) != len(cases):
        raise ValueError('Duplicate case identity')
    if not 1 <= limit <= 50:
        raise ValueError('Limit must be 1–50')
    if os.environ.get('EVAL_SESSION_TOKEN', '') in ('', 'replace-me'):
        raise ValueError('Set EVAL_SESSION_TOKEN to the dedicated learner session')
    reports = []
    async with httpx.AsyncClient(timeout=70, trust_env=False) as client:
        gateway = SourceGateway(client, os.environ['SUPABASE_URL'], os.environ['SUPABASE_PUBLISHABLE_KEY'])
        await gateway.authenticate(os.environ['EVAL_SESSION_TOKEN'])
        generator = AssistantGenerator(client, api_key=os.environ['OPENAI_API_KEY'])
        for case in cases[:limit]:
            try:
                reports.append(await collect(case, gateway, generator, mode=mode))
            except Exception as exc:
                # Provider exceptions may include credentials or source text.
                # Keep only a safe exception category in local failure records.
                reports.append({'id': case.id, 'error': type(exc).__name__, 'scored': False})
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({'schema_version': 1, 'reports': reports}, indent=2))
    print(f'Collected {len(reports)} cases; {sum("error" in r for r in reports)} errors. Report: {output}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--manifest', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--retrieval', choices=['configured', 'legacy', 'hybrid'], default='configured')
    parser.add_argument('--limit', type=int, default=1)
    args = parser.parse_args()
    asyncio.run(main(args.manifest, args.output, args.limit, args.retrieval))
