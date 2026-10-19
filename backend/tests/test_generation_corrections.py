"""Validation corrections at the external structured-model HTTP boundary."""
import asyncio
import json
from uuid import UUID
import httpx
import pytest
from backend.tests.test_long_sources import model_response
from backend.tests.test_study_generation import DRAFT, CAPTURE
from backend.study_generation import GenerationFailure, captured_passages
from backend.study_models import StudyNote
from backend.topic_generation import TopicGenerator
from backend.topic_models import TopicDescription
from backend.overview_generation import OverviewGenerator
from backend.overview_models import OverviewInput

USER = UUID('11111111-1111-4111-8111-111111111111')
SOURCE = UUID('33333333-3333-4333-8333-333333333333')
TOPIC = UUID('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')


@pytest.mark.parametrize('known_match', [True, False])
def test_reused_topic_copies_context_from_the_owned_catalog_without_model_text(known_match):
    note = StudyNote(**DRAFT, references=captured_passages(CAPTURE))
    candidate = TopicDescription(id=TOPIC, title='Calculus', context='Mathematics',
                                aliases=[], groups=['Math'], description='Change and accumulation.')
    requests = []
    def respond(request):
        requests.append(request)
        topic = dict(key='calculus', title='Calculus', context=None,
                     aliases=[], groups=['Math'], description='Change and accumulation.',
                     role='main', coverage='substantive', citation_ids=['p0001'],
                     existing_topic_id=str(TOPIC if known_match else SOURCE), uncertain=False,
                     suggested_topic_id=None, placement_reason='Same subject and meaning.')
        return model_response(request, {'topics':[topic], 'relations':[]})
    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
            generator = TopicGenerator(client, api_key='test-key')
            if known_match:
                result = await generator.generate(note, [candidate], USER, SOURCE)
                assert result.topics[0].id == TOPIC
                assert result.topics[0].context == candidate.context
            else:
                with pytest.raises(GenerationFailure, match='invalid_output'):
                    await generator.generate(note, [candidate], USER, SOURCE)
    asyncio.run(run())
    assert len(requests) == (1 if known_match else 2)


def test_schema_repair_identifies_the_bad_topic_without_erasing_new_topic_contexts():
    note = StudyNote(**DRAFT, references=captured_passages(CAPTURE))
    candidate = TopicDescription(id=TOPIC, title='Calculus', context='Mathematics',
                                aliases=[], groups=[], description='Change and accumulation.')
    requests = []
    def respond(request):
        payload = json.loads(json.loads(request.content)['messages'][1]['content'])
        requests.append(payload)
        identified = any(msg.startswith('topics.1:') for msg in payload.get('validation_feedback', []))
        base = dict(key='calculus', title='Calculus', context=None,
                    aliases=[], groups=[], description='Change and accumulation.', role='main',
                    coverage='substantive', citation_ids=['p0001'], existing_topic_id=str(TOPIC),
                    uncertain=False, suggested_topic_id=None, placement_reason='Same mathematical topic.')
        fresh = {**base, 'key':'rates', 'title':'Rates', 'context':'Mathematics' if identified else None,
                 'role':'supporting', 'existing_topic_id':None}
        return model_response(request, {'topics':[base, fresh], 'relations':[]})
    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
            result = await TopicGenerator(client, api_key='test-key').generate(note, [candidate], USER, SOURCE)
            assert len(result.topics) == 2
            assert all(t.context == 'Mathematics' for t in result.topics)
    asyncio.run(run())
    assert len(requests) == 2
    assert 'input_value' not in json.dumps(requests[1]['validation_feedback'])


@pytest.mark.parametrize('proposed_context', ['Mathematics', 'Computer graphics', None])
def test_model_context_cannot_change_a_reused_owned_topic(proposed_context):
    note = StudyNote(**DRAFT, references=captured_passages(CAPTURE))
    candidate = TopicDescription(id=TOPIC, title='Calculus', context='Mathematics',
                                 aliases=[], groups=['Math'], description='Change and accumulation.')
    requests = []
    def respond(request):
        requests.append(request)
        topic = dict(key='calculus', title='Calculus', context=proposed_context,
                     aliases=[], groups=['Math'], description='Change and accumulation.',
                     role='main', coverage='substantive', citation_ids=['p0001'],
                     existing_topic_id=str(TOPIC), uncertain=False, suggested_topic_id=None,
                     placement_reason='Same subject and meaning.')
        return model_response(request, {'topics': [topic], 'relations': []})
    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
            result = await TopicGenerator(client, api_key='test-key').generate(note, [candidate], USER, SOURCE)
            assert result.topics[0].id == TOPIC
            assert result.topics[0].context == candidate.context
    asyncio.run(run())
    assert len(requests) == 1


@pytest.mark.parametrize('correctable', [True, False])
def test_overview_correction_still_requires_independent_source_evidence(correctable):
    from backend.tests.test_assistant import NOTE
    inputs = []
    for sid in [SOURCE, UUID('44444444-4444-4444-8444-444444444444')]:
        note = json.loads(json.dumps(NOTE))
        if sid == SOURCE:
            note['references'].append({**note['references'][0], 'id': 'p0002'})
        inputs.append(OverviewInput.model_validate_json(json.dumps(dict(
            source_id=str(sid), title='RAG', topic_title='RAG', context='AI',
            citation_ids=[p['id'] for p in note['references']], note=note))))
    requests = []
    def respond(request):
        payload = json.loads(json.loads(request.content)['messages'][1]['content'])
        requests.append(payload)
        refs = ['ref1', 'ref3'] if correctable and 'validation_feedback' in payload else ['ref1', 'ref2', 'ref3']
        # Overview covers both sources, but an agreement initially cites only
        # two excerpts belonging to the first source.
        agreement_refs = ['ref1', 'ref3'] if correctable and 'validation_feedback' in payload else ['ref1', 'ref2']
        return model_response(request, dict(overview=dict(text='Retrieval supplies evidence.', reference_ids=refs),
                                           agreements=[dict(text='Sources describe retrieving evidence.', reference_ids=agreement_refs)], differences=[]))
    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
            generator = OverviewGenerator(client, api_key='test-key')
            if correctable:
                result = await generator.generate(inputs, source_count=2)
                refs = {r.id: r.source_id for r in result.references}
                assert len({refs[r] for r in result.agreements[0].reference_ids}) == 2
            else:
                with pytest.raises(GenerationFailure, match='invalid_output'):
                    await generator.generate(inputs, source_count=2)
    asyncio.run(run())
    assert len(requests) == 2
