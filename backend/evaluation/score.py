"""Score a bounded collected report locally using optional DeepEval tooling."""
import argparse
import asyncio
import json
from pathlib import Path
from dotenv import load_dotenv


async def main(report: Path, output: Path, model: str, budget: float, limit: int):
    if not 1 <= limit <= 5:
        raise ValueError('Semantic scoring is limited to 1–5 cases per development run')
    allowed = Path('output/evaluation').resolve()
    if not output.resolve().is_relative_to(allowed):
        raise ValueError('Scores must be saved under ignored output/evaluation/')
    load_dotenv('backend/.env')
    from backend.evaluation.metrics import BudgetJudge, metrics
    from deepeval.test_case import LLMTestCase
    judge = BudgetJudge(model, budget)
    rows = json.loads(report.read_text())['reports']
    scored = []
    for row in rows[:limit]:
        entry = {'id': row['id'], 'metrics': [], 'scored': False}
        if 'error' in row or not row.get('citation_locations_valid') or not row.get('status_matches'):
            entry['excluded'] = 'Failed generation, status or deterministic citation checks'
        elif row.get('actual_status') != 'supported':
            entry['excluded'] = 'Abstention case: deterministic status check only'
        else:
            try:
                case = LLMTestCase(input=row['input'], actual_output=row['actual_output'],
                                   expected_output=row.get('expected_output'), retrieval_context=row['retrieval_context'])
                async with asyncio.timeout(180):
                    for metric in metrics(judge, has_expected_output=bool(row.get('expected_output'))):
                        await metric.a_measure(case)
                        entry['metrics'].append({'name': metric.__class__.__name__, 'score': metric.score, 'reason': metric.reason})
                entry['scored'] = True
            except Exception as exc:
                entry['error'] = type(exc).__name__
        scored.append(entry)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({'schema_version': 1, 'judge_model': model, 'deepeval_version': '4.2.8',
        'mode': 'llm', 'thresholds': None, 'budget_usd': budget, 'judge_calls': judge.calls,
        'sdk_estimated_judge_cost_usd': judge.reported_usd,
        'conservative_reserved_cost_usd': judge.reserved_usd, 'cases': scored}, indent=2))
    print(f'Scored {sum(c["scored"] for c in scored)}/{len(scored)} cases; judge calls: {judge.calls}. Local report: {output}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--report', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--judge-model', required=True)
    parser.add_argument('--max-cost-usd', type=float, required=True)
    parser.add_argument('--limit', type=int, default=1)
    args = parser.parse_args()
    asyncio.run(main(args.report, args.output, args.judge_model, args.max_cost_usd, args.limit))
