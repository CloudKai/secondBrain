"""Evaluation collection uses the same authenticated HTTP/revision boundaries."""
import asyncio
import hashlib
from uuid import UUID
import httpx
import pytest
from backend.tests.test_assistant import assistant_client, SOURCE, TEXT  # noqa: F401
from backend.assistant.generation import AssistantGenerator
from backend.sources.routes import SourceGateway
from backend.assistant.models import AssistantQuestion
from backend.evaluation.collect import BaselineCase, collect
from backend.studies.store import StudyStorageError


def test_evaluation_retains_actual_retrieval_and_rejects_stale_answers(assistant_client):
    _, state = assistant_client
    async def run():
        async with httpx.AsyncClient() as client:
            gateway = SourceGateway(client, 'https://supabase.test', 'public-test')
            await gateway.authenticate('alice')
            case = BaselineCase(id='rag-evidence', source_id=UUID(SOURCE),
                question=AssistantQuestion(question='What does RAG retrieve?', source_version=1),
                expected_output='Saved evidence.', expected_status='supported', expected_evidence=[TEXT],
                capture_sha256=hashlib.sha256(state['rows'][0]['captured_text'].encode()).hexdigest(), reviewed=True)
            generator = AssistantGenerator(client, api_key='test-key')
            report = await collect(case, gateway, generator)
            assert TEXT in report['retrieval_context']
            assert report['exact_span_hit_rate'] == 1
            assert report['citation_locations_valid']
            assert report['first_verified_streamed_text_seconds'] is None
            assert report['claim_evidence_pairs'] == [{
                'claim_index': 0,
                'claim': 'RAG: “Retrieval augmented generation retrieves saved evidence before generating an answer.”',
                'reference_ids': [SOURCE + ':p0001'],
                'evidence': [{
                    'reference_id': SOURCE + ':p0001', 'source_id': SOURCE, 'source_version': 1,
                    'capture_sha256': '802561b537722bae3cc3b4edd823ead289f2280d1c3014fa7c1b2958016d3e91',
                    'passage': {'id': 'p0001', 'start': 0, 'end': 84,
                        'excerpt': 'Retrieval augmented generation retrieves saved evidence before generating an answer.',
                        'page': None, 'start_ms': None, 'end_ms': None},
                }],
            }]
            state['valid'] = False
            with pytest.raises(StudyStorageError, match='stale'):
                await collect(case, gateway, generator)
            case.reviewed = False
            with pytest.raises(ValueError, match='Unreviewed'):
                await collect(case, gateway, generator)
    asyncio.run(run())


def test_uncited_retrieved_source_does_not_enter_claim_evidence(assistant_client):
    import copy
    _, state = assistant_client
    other = copy.deepcopy(state['rows'][0])
    other.update(source_id='44444444-4444-4444-8444-444444444444', scope='library', title='Another source')
    other['captured_text'] = 'A separate source discusses algebra.' + ' More captured material.' * 4
    other['note']['references'][0].update(excerpt='A separate source discusses algebra.', end=36)
    state['rows'].append(other)
    async def run():
        async with httpx.AsyncClient() as client:
            gateway = SourceGateway(client, 'https://supabase.test', 'public-test')
            await gateway.authenticate('alice')
            case = BaselineCase(id='per-claim-evidence', source_id=UUID(SOURCE),
                question=AssistantQuestion(question='What does RAG retrieve?', source_version=1, library=True),
                expected_status='supported', capture_sha256='802561b537722bae3cc3b4edd823ead289f2280d1c3014fa7c1b2958016d3e91', reviewed=True)
            report = await collect(case, gateway, AssistantGenerator(client, api_key='test-key'), mode='legacy')
            assert 'A separate source discusses algebra.' in report['retrieval_context']
            assert [e['source_id'] for e in report['claim_evidence_pairs'][0]['evidence']] == [SOURCE]
    asyncio.run(run())


def test_evaluation_records_the_enabled_hybrid_answer_path(assistant_client,monkeypatch):
    import json
    from uuid import uuid5
    _,state=assistant_client
    monkeypatch.setenv('ENABLE_HYBRID_RETRIEVAL','true')
    monkeypatch.setenv('QDRANT_URL','https://qdrant.test')
    monkeypatch.setenv('QDRANT_API_KEY','test')
    row=state['rows'][0]
    generation='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    sha=hashlib.sha256(row['captured_text'].encode()).hexdigest()
    snapshot={k:row[k] for k in ('source_id','user_id','source_version','scope','study_updated_at','map_updated_at')}|{'generation':generation,'capture_sha256':sha,'chunks_total':1}
    upstream=httpx.AsyncClient.send
    hybrid_requests=[]
    async def external(c,request,**kwargs):
        path=request.url.path
        if path.endswith('/get_assistant_search_inventory'):value=[snapshot]
        elif path.endswith('/get_hybrid_assistant_context'):value=[row]
        elif path.endswith('/validate_hybrid_assistant_context'):value=state['valid']
        elif path=='/v1/embeddings':value={'data':[{'index':i,'embedding':[0.1]*1536} for i,_ in enumerate(json.loads(request.content)['input'])]}
        elif path.endswith('/points/query'):
            hybrid_requests.append(request)
            value={'status':'ok','result':{'points':[{'id':str(uuid5(UUID(generation),'0')),'payload':{
                'source_id':SOURCE,'user_id':row['user_id'],'source_version':1,'generation':generation,
                'capture_sha256':sha,'chunk_policy':'structure_recursive_v1','embedding_model':'text-embedding-3-small',
                'chunk_index':0,'start':0,'end':len(row['captured_text']),'page':None,'start_ms':None,'end_ms':None}}]}}
        else:return await upstream(c,request,**kwargs)
        return httpx.Response(200,json=value,request=request)
    monkeypatch.setattr(httpx.AsyncClient,'send',external)
    async def run():
        async with httpx.AsyncClient() as client:
            gateway=SourceGateway(client,'https://supabase.test','public-test');await gateway.authenticate('alice')
            case=BaselineCase(id='hybrid-mode',source_id=UUID(SOURCE),question=AssistantQuestion(question='What does RAG retrieve?',source_version=1),expected_status='supported',expected_output='Saved evidence.',expected_evidence=[TEXT],capture_sha256=sha,reviewed=True)
            report=await collect(case,gateway,AssistantGenerator(client,api_key='test-key'))
            assert report['retrieval_mode']=='hybrid'
            assert hybrid_requests and any(TEXT in excerpt for excerpt in report['retrieval_context'])
    asyncio.run(run())


def test_missing_expected_library_passage_counts_as_retrieval_miss(assistant_client,monkeypatch):
    import json
    _,state=assistant_client
    other='44444444-4444-4444-8444-444444444444'
    evidence='A durable checkpoint resumes only the uncommitted segments after an outage.'
    capture=evidence+' Additional reviewed public fixture evidence.'*4
    source={k:v for k,v in state['rows'][0].items() if k in ('user_id','captured_text','title','source_version','document','transcript')}
    source.update(id=other,captured_text=capture,original_url='https://example.org/evaluation',canonical_url='https://example.org/evaluation',captured_at='2026-10-08T00:00:00Z',capture_origin='pasted',coverage='unknown',coverage_detail='Synthetic boundary fixture.',source_kind='article',study_status='pending')
    upstream=httpx.AsyncClient.send
    async def external(c,request,**kwargs):
        if request.url.path=='/rest/v1/sources':return httpx.Response(200,json=[source],request=request)
        if request.url.path.endswith('/get_assistant_search_inventory'):
            items=[]
            for sid,text,scope in [(SOURCE,state['rows'][0]['captured_text'],'note'),(other,capture,'library')]:
                items.append({'source_id':sid,'user_id':source['user_id'],'source_version':1,'scope':scope,'generation':None,'capture_sha256':hashlib.sha256(text.encode()).hexdigest(),'chunks_total':0,'study_updated_at':'2026-10-04T00:00:00Z','map_updated_at':None})
            return httpx.Response(200,json=items,request=request)
        return await upstream(c,request,**kwargs)
    monkeypatch.setattr(httpx.AsyncClient,'send',external)
    async def run():
        async with httpx.AsyncClient() as client:
            gateway=SourceGateway(client,'https://supabase.test','public-test');await gateway.authenticate('alice')
            case=BaselineCase.model_validate_json(json.dumps({'id':'miss','source_id':SOURCE,'question':{'question':'How is work recovered?','source_version':1,'library':True},'expected_status':'supported','expected_output':'Resume uncommitted segments.','expected_evidence':[evidence],'evidence_sources':[{'source_id':other,'source_version':1,'capture_sha256':hashlib.sha256(capture.encode()).hexdigest()}],'capture_sha256':hashlib.sha256(state['rows'][0]['captured_text'].encode()).hexdigest(),'reviewed':True}))
            report=await collect(case,gateway,AssistantGenerator(client,api_key='test-key'),mode='legacy')
            assert report['exact_span_hit_rate']==0
            assert report['expected_source_ids']==[other]
    asyncio.run(run())
