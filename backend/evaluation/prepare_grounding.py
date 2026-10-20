"""Export unlabelled actual-answer cases for review, without model/network calls."""
import argparse
import hashlib
import json
from pathlib import Path
from backend.assistant.models import AssistantAnswer
from backend.evaluation.claim_evidence import EvidenceCapture, pair_claims


def prepare(reports: list[Path], captures_path: Path) -> dict:
    if not 1 <= len(reports) <= 10 or captures_path.stat().st_size > 2_000_000:
        raise ValueError('Input exceeds evaluation size bound')
    raw_captures = json.loads(captures_path.read_text())
    if not isinstance(raw_captures, list) or not 1 <= len(raw_captures) <= 200:
        raise ValueError('Expected 1–200 captures')
    captures = [EvidenceCapture.model_validate_json(json.dumps({
        'source_id': c['id'], **{k: c[k] for k in
            ('source_version', 'captured_text', 'document', 'transcript')}})) for c in raw_captures]
    urls = {c['id']: c['canonical_url'] for c in raw_captures}
    cases = []
    for path in reports:
        if path.stat().st_size > 2_000_000:
            raise ValueError('Report exceeds evaluation size bound')
        raw = path.read_bytes()
        value = json.loads(raw)
        if value.get('schema_version') != 1 or not isinstance(value.get('reports'), list) or len(value['reports']) > 50:
            raise ValueError('Invalid collection report')
        for report in value['reports']:
            if 'error' in report:
                continue
            answer = AssistantAnswer.model_validate_json(json.dumps(report['answer']))
            for pair in pair_claims(answer, captures):
                evidence = []
                for ref in pair['evidence']:
                    p = ref['passage']
                    evidence.append({'source_url': urls[ref['source_id']],
                        'source_kind': 'pdf' if p['page'] is not None else
                            'video' if next(c for c in captures if str(c.source_id) == ref['source_id']).transcript else 'article',
                        'capture_sha256': ref['capture_sha256'],
                        **{k: p[k] for k in ('start', 'end', 'excerpt', 'page', 'start_ms', 'end_ms')}})
                cases.append({'id': f"actual-{report['id']}-{pair['claim_index'] + 1}",
                    'group': report['id'], 'split': 'development', 'claim': pair['claim'],
                    'expected_label': None, 'rationale': '', 'reviewed': False, 'evidence': evidence,
                    'origin': {'report_sha256': hashlib.sha256(raw).hexdigest(), 'answer_id': report['id'],
                        'claim_index': pair['claim_index'], 'reference_ids': pair['reference_ids']}})
    if not 1 <= len(cases) <= 100 or len({c['id'] for c in cases}) != len(cases):
        raise ValueError('Expected 1–100 uniquely identified claim cases')
    return {'schema_version': 1,
        'purpose': 'Actual app answers; developer review required before scoring. Same development captures, not held-out quality or training data.',
        'cases': cases}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--report', type=Path, action='append', required=True)
    parser.add_argument('--captures', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if not args.output.resolve().is_relative_to(Path('output/evaluation').resolve()):
        raise ValueError('Drafts must be saved under ignored output/evaluation/')
    draft = prepare(args.report, args.captures)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(draft, indent=2, ensure_ascii=False) + '\n')
    print(json.dumps({'draft_cases': len(draft['cases']), 'provider_called': False, 'reviewed': False}))
