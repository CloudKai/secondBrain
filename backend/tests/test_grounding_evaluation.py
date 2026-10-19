"""Development classifier checks through the approved external model HTTP seam."""
import asyncio
import json
import httpx
import pytest
from backend.evaluation.grounding import LayaClassifier, ClassifierFailure


def response(*, truncated=False):
    return {'model': 'laya-rl-agent', 'routing': {'model': 'english', 'repo': 'convaiinnovations/laya'},
        'answers': {'support': {'type': 'choice', 'choice': 'unsupported',
            'probabilities': {'supported': 0.1, 'unsupported': 0.9}, 'confidence': 0.531}},
        'usage': {'input_tokens': 318, 'output_tokens': 0, 'truncated': truncated,
                  'state_tokens_dropped': 1 if truncated else 0, 'truncated_questions': ['support'] if truncated else []}}


def test_laya_support_probability_is_not_answer_confidence():
    def respond(request):
        assert request.url == 'http://127.0.0.1:8767/v1/systemone'
        return httpx.Response(200, json=response())
    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
            verdict = await LayaClassifier(client).score(document='This work uses eight parallel heads.', claim='This work uses four heads.')
            assert verdict.support_probability == 0.1
            assert verdict.supported is False
            assert verdict.provider_confidence == 0.531
    asyncio.run(run())


def test_sentence_checks_preserve_qualifiers_and_reject_partly_supported_blocks():
    from backend.evaluation.grounding_compare import check_claim
    claim = 'Sine encodings may help extrapolation. Every model must use eight heads.'
    requests = []
    def respond(request):
        body = json.loads(request.content)
        requests.append(body['state'])
        value = response()
        if body['state']['claim'] == 'Sine encodings may help extrapolation.':
            value['answers']['support'].update(choice='supported', probabilities={'supported': 0.9, 'unsupported': 0.1})
        return httpx.Response(200, json=value)
    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
            result = await check_claim(LayaClassifier(client), document='Sine encodings may help extrapolation. This work uses eight heads.',
                                       claim=claim, layout='sentences')
            assert result['verdict']['supported'] is False
            assert [(s['start'], s['end'], s['claim']) for s in result['segments']] == [
                (0, 38, 'Sine encodings may help extrapolation.'),
                (39, 72, 'Every model must use eight heads.'),
            ]
            assert requests == [
                {'document': 'Sine encodings may help extrapolation. This work uses eight heads.', 'claim': 'Sine encodings may help extrapolation.'},
                {'document': 'Sine encodings may help extrapolation. This work uses eight heads.', 'claim': 'Every model must use eight heads.'},
            ]
    asyncio.run(run())


def test_failed_sentence_check_keeps_entire_claim_unscored():
    from backend.evaluation.grounding_compare import check_claim
    def respond(request):
        body = json.loads(request.content)
        return httpx.Response(200, json=response(truncated=body['state']['claim'].startswith('Every')))
    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
            result = await check_claim(LayaClassifier(client), document='This work uses eight heads.',
                                       claim='Some models use eight heads. Every model must use eight heads.', layout='sentences')
            assert 'verdict' not in result
            assert result['error'] == 'incomplete_claim_check'
            assert result['segments'][1]['error'] == 'truncated_input'
    asyncio.run(run())


@pytest.mark.parametrize('claim', [
    'The value is 0.5, e.g. in this example. This does not imply a guarantee.',
    'The value may help (e.g. in this example). This does not imply a guarantee.',
    'Dr. Lee uses `key. Value` as code. It may fail.',
    'The mask is inverted (e.g., using `mask.logical_not()`). Therefore, True does not mean padding here.',
])
def test_context_dependent_sentences_keep_their_original_antecedent(claim):
    from backend.evaluation.grounding_compare import check_claim
    def respond(request):
        assert json.loads(request.content)['state']['claim'] == claim
        return httpx.Response(200, json=response())
    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
            result = await check_claim(LayaClassifier(client), document='Only this cited passage.', claim=claim, layout='sentences')
            assert len(result['segments']) == 1
    asyncio.run(run())


def test_laya_truncated_support_is_unscored_not_a_verdict():
    def respond(request):
        return httpx.Response(200, json=response(truncated=True))
    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
            with pytest.raises(ClassifierFailure, match='truncated_input'):
                await LayaClassifier(client).score(document='Eight heads.', claim='Four heads.')
    asyncio.run(run())


def test_laya_larger_input_probe_is_explicit_and_bounded():
    def respond(request):
        payload = json.loads(request.content)
        assert payload['max_len'] == 1024
        assert payload['head_max_len'] == 192
        return httpx.Response(200, json=response())
    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
            with pytest.raises(ValueError):
                LayaClassifier(client, max_tokens=8192)
            await LayaClassifier(client, max_tokens=1024).score(document='This work uses eight heads.', claim='Every model uses eight heads.')
    asyncio.run(run())
