"""Bounded, opt-in classifier evaluation on manually reviewed public evidence."""
import argparse
import asyncio
import hashlib
import importlib.metadata
import json
import math
import re
import time
from pathlib import Path
from typing import Literal
import httpx
from pydantic import Field, HttpUrl, model_validator
from backend.schemas import StrictModel
from backend.evaluation.grounding import LayaClassifier, Verdict, ClassifierFailure, LAYA_CODE, LAYA_WEIGHTS

MINICHECK_CODE = 'b58b9fa69acbd1015ec970fa65dd752413a053d2'
MINICHECK_WEIGHTS = '96eafd01cee2d16cf81aaa2fb226b14f422a37b3'


class Evidence(StrictModel):
    source_url: HttpUrl
    source_kind: Literal['article', 'pdf', 'video']
    capture_sha256: str = Field(pattern=r'^[a-f0-9]{64}$')
    start: int = Field(ge=0)
    end: int = Field(gt=0)
    excerpt: str = Field(min_length=1, max_length=1000)
    page: int | None = Field(default=None, ge=1)
    start_ms: int | None = Field(default=None, ge=0)
    end_ms: int | None = Field(default=None, gt=0)

    @model_validator(mode='after')
    def locator(self):
        if self.end - self.start != len(self.excerpt):
            raise ValueError('Excerpt length differs from recorded original offsets')
        if (self.start_ms is None) != (self.end_ms is None):
            raise ValueError('Incomplete caption time')
        if self.start_ms is not None and (self.end_ms <= self.start_ms or self.page is not None):
            raise ValueError('Invalid caption time')
        if (self.source_kind == 'pdf') != (self.page is not None):
            raise ValueError('PDF evidence requires a page')
        return self


class ClaimCase(StrictModel):
    id: str = Field(min_length=1, max_length=100)
    group: str = Field(min_length=1, max_length=100)
    split: Literal['development']
    claim: str = Field(min_length=1, max_length=2000)
    expected_label: Literal['supported', 'contradicted', 'not_addressed']
    rationale: str = Field(min_length=1, max_length=1000)
    reviewed: bool
    evidence: list[Evidence] = Field(min_length=1, max_length=6)
    origin: 'ClaimOrigin | None' = None

    @model_validator(mode='after')
    def reviewed_text(self):
        if not self.reviewed or not self.claim.strip():
            raise ValueError('Only reviewed nonblank claims can be evaluated')
        return self


class ClaimOrigin(StrictModel):
    report_sha256: str = Field(pattern=r'^[a-f0-9]{64}$')
    answer_id: str = Field(min_length=1, max_length=100)
    claim_index: int = Field(ge=0, le=7)
    reference_ids: list[str] = Field(min_length=1, max_length=10)


ClaimCase.model_rebuild()


class Dataset(StrictModel):
    schema_version: Literal[1]
    purpose: str = Field(min_length=1, max_length=1000)
    cases: list[ClaimCase] = Field(min_length=1, max_length=100)

    @model_validator(mode='after')
    def identities(self):
        if len({c.id for c in self.cases}) != len(self.cases):
            raise ValueError('Duplicate claim IDs')
        return self


class MiniCheckClassifier:
    def __init__(self, cache: Path):
        # Optional dependency stays outside the production environment. Verify
        # installed source and loaded weight identity before scoring any case.
        distribution = importlib.metadata.distribution('minicheck')
        origin = json.loads(distribution.read_text('direct_url.json') or '{}')
        if origin.get('vcs_info', {}).get('commit_id') != MINICHECK_CODE:
            raise ClassifierFailure('install_pinned_minicheck')
        from minicheck.minicheck import MiniCheck
        self.checker = MiniCheck(model_name='flan-t5-large', batch_size=1, cache_dir=str(cache))
        self.revision = getattr(self.checker.model.model.config, '_commit_hash', None)
        if self.revision != MINICHECK_WEIGHTS:
            raise ClassifierFailure('unexpected_model_revision')
        self.device = str(self.checker.model.model.device)

    async def score(self, *, document: str, claim: str):
        # Local synchronous inference; run this CLI in a separate process, never
        # on the app event loop. It has no measured per-call latency guarantee.
        tokenizer = self.checker.model.tokenizer
        encoded = tokenizer('predict: ' + document + tokenizer.eos_token + claim)['input_ids']
        if len(encoded) > 2048:
            raise ClassifierFailure('input_would_truncate')
        labels, scores, _, _ = self.checker.score(docs=[document], claims=[claim])
        if len(labels) != 1 or len(scores) != 1 or labels[0] not in (0, 1):
            raise ClassifierFailure('invalid_response')
        score = float(scores[0])
        if not math.isfinite(score) or not 0 <= score <= 1 or bool(labels[0]) != (score > 0.5):
            raise ClassifierFailure('invalid_response')
        return Verdict(supported=bool(labels[0]), support_probability=score)


def summarize(rows):
    return {'total': len(rows), 'scored': sum('verdict' in r for r in rows),
        'unscored': sum('verdict' not in r for r in rows),
        'false_support': sum(r.get('false_support', False) for r in rows),
        'false_rejection': sum(r.get('false_rejection', False) for r in rows),
        'status_matches': sum(r.get('status_matches', False) for r in rows)}


def claim_groups(claim: str, layout: str) -> list[dict]:
    """Exact sentence spans, not semantic atomization or generated rewrites."""
    if layout not in ('whole', 'sentences') or not claim.strip() or len(claim) > 2000:
        raise ValueError('Invalid claim layout or text')
    boundaries = []
    if layout == 'sentences':
        code = [(m.start(), m.end()) for m in re.finditer(r'(`+).*?\1', claim, re.S)]
        for match in re.finditer(r'[.!?]["”’\')\]]*(?=\s+|$)', claim):
            token = claim[:match.start() + 1].rsplit(None, 1)[-1].lower().lstrip('([{"“‘')
            if (any(a <= match.start() < b for a, b in code)
                or token in {'mr.', 'mrs.', 'ms.', 'dr.', 'prof.', 'e.g.', 'i.e.', 'vs.', 'etc.', 'al.'}
                or re.fullmatch(r'(?:[a-z]\.)+', token)):
                continue
            boundaries.append(match.end())
    groups, start = [], 0
    for end in sorted(set(boundaries + [len(claim)])):
        while start < end and claim[start].isspace():
            start += 1
        while end > start and claim[end - 1].isspace():
            end -= 1
        if start < end:
            text = claim[start:end]
            dependent = re.match(r'(?:this|that|it|they|these|those|such|as a result|therefore|however|specifically|to counteract|for example|by contrast|in contrast)\b', text, re.I)
            if groups and dependent:
                groups[-1]['end'] = end
                groups[-1]['claim'] = claim[groups[-1]['start']:end]
            else:
                groups.append({'start': start, 'end': end, 'claim': text})
        start = end
    return groups


async def check_claim(classifier, *, document: str, claim: str, layout: str) -> dict:
    segments = claim_groups(claim, layout)
    for segment in segments:
        start = time.monotonic()
        try:
            verdict = await classifier.score(document=document, claim=segment['claim'])
            segment['verdict'] = verdict.model_dump()
        except Exception as exc:
            segment['error'] = str(exc) if isinstance(exc, ClassifierFailure) else type(exc).__name__
        segment['seconds'] = time.monotonic() - start
    result = {'segments': segments}
    if any('error' in segment for segment in segments):
        result['error'] = 'incomplete_claim_check'
    elif layout == 'whole':
        result['verdict'] = segments[0]['verdict']
    else:
        # Child probabilities are retained individually. Their minimum is not
        # a calibrated probability for the whole paragraph.
        result['verdict'] = {'supported': all(s['verdict']['supported'] for s in segments),
                             'aggregation': 'all_groups_supported'}
    return result


async def run(args):
    if not 1 <= args.limit <= 20:
        raise ValueError('Development run is limited to 1–20 claims')
    if args.dataset.stat().st_size > 150_000:
        raise ValueError('Dataset exceeds size bound')
    raw = args.dataset.read_text()
    dataset = Dataset.model_validate_json(raw)
    if not 0 <= args.offset < len(dataset.cases):
        raise ValueError('Offset is outside dataset')
    cases = dataset.cases[args.offset:args.offset + args.limit]
    planned_calls = sum(len(claim_groups(c.claim, args.claim_layout)) for c in cases)
    if planned_calls > 20:
        raise ValueError('Run would exceed 20 classifier calls; reduce --limit')
    if args.dry_run:
        print(json.dumps({'validated_cases': len(cases), 'planned_classifier_calls': planned_calls, 'provider_called': False}))
        return 0
    allowed = Path('output/evaluation').resolve()
    if not args.output or not args.output.resolve().is_relative_to(allowed):
        raise ValueError('Reports must be saved under ignored output/evaluation/')
    if args.provider == 'minicheck' and not args.allow_model_download:
        raise ValueError('MiniCheck requires explicit --allow-model-download; checkpoint is about 3.13 GB')
    report = {'schema_version': 1, 'dataset_sha256': hashlib.sha256(raw.encode()).hexdigest(),
        'provider': args.provider, 'model': 'convaiinnovations/laya' if args.provider == 'laya' else 'lytang/MiniCheck-Flan-T5-Large',
        'scope': 'development regressions, not held-out calibration or production acceptance',
        'binary_support_only': True, 'threshold_calibrated': False, 'evidence_layout': args.evidence_layout,
        'claim_layout': args.claim_layout, 'offset': args.offset,
        'laya_max_tokens': args.laya_max_tokens if args.provider == 'laya' else None,
        'requested_cases': len(cases), 'planned_classifier_calls': planned_calls, 'rows': []}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    def save():
        report['summary'] = {**summarize(report['rows']), 'unattempted': len(cases) - len(report['rows'])}
        args.output.write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n')
    async with httpx.AsyncClient(trust_env=False, follow_redirects=False) as client:
        try:
            start = time.monotonic()
            classifier = (LayaClassifier(client, max_tokens=args.laya_max_tokens)
                if args.provider == 'laya' else MiniCheckClassifier(allowed / 'minicheck-cache'))
            if args.provider == 'laya':
                health = await classifier.ready()
                report.update(code_revision=LAYA_CODE, weight_revision=LAYA_WEIGHTS,
                    local_server_health=health, cost_note='Local inference; hosting cost not measured.')
            report['setup_seconds'] = time.monotonic() - start
            if args.provider == 'minicheck':
                report.update(code_revision=MINICHECK_CODE, weight_revision=classifier.revision,
                              device=classifier.device, package_version=importlib.metadata.version('minicheck'),
                              runtime_versions={name: importlib.metadata.version(name) for name in
                                  ['torch', 'transformers', 'accelerate', 'sentencepiece', 'numpy']})
            for case in cases:
                row = {'id': case.id, 'group': case.group, 'expected_label': case.expected_label,
                    'claim': case.claim, 'evidence': [e.model_dump(mode='json') for e in case.evidence],
                    'origin': case.origin.model_dump(mode='json') if case.origin else None}
                document = '\n\n'.join(e.excerpt for e in case.evidence)
                if args.evidence_layout == 'compact':
                    document = ' '.join(document.split())
                row['classifier_document'] = document
                start = time.monotonic()
                try:
                    row.update(await check_claim(classifier, document=document, claim=case.claim, layout=args.claim_layout))
                    if 'verdict' in row:
                        expected = case.expected_label == 'supported'
                        supported = row['verdict']['supported']
                        row.update(status_matches=supported == expected,
                            false_support=supported and not expected, false_rejection=expected and not supported)
                except Exception as exc:
                    row['error'] = str(exc) if isinstance(exc, ClassifierFailure) else type(exc).__name__
                row['seconds'] = time.monotonic() - start
                report['rows'].append(row)
                if args.provider == 'laya':
                    report.update(provider_calls=classifier.calls, reported_input_tokens=classifier.input_tokens,
                        reported_output_tokens=classifier.output_tokens)
                save()
        except Exception as exc:
            report['setup_error'] = str(exc) if isinstance(exc, ClassifierFailure) else type(exc).__name__
        save()
    print(json.dumps({'provider': args.provider, **report['summary'], 'setup_error': report.get('setup_error')}))
    return 2 if report.get('setup_error') else 3 if report['summary']['unscored'] else 0


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--dataset', type=Path, default=Path('docs/evaluation/grounding-claims.json'))
    parser.add_argument('--provider', choices=['laya', 'minicheck'], required=True)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--limit', type=int, default=20)
    parser.add_argument('--offset', type=int, default=0)
    parser.add_argument('--claim-layout', choices=['whole', 'sentences'], default='whole')
    parser.add_argument('--laya-max-tokens', type=int, choices=[512, 1024], default=512)
    parser.add_argument('--evidence-layout', choices=['original', 'compact'], default='original')
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--allow-model-download', action='store_true')
    raise SystemExit(asyncio.run(run(parser.parse_args())))
