"""Indexing behavior observed at the Postgres, embedding and Qdrant HTTP seams."""
import asyncio
import hashlib
import json
import httpx

SOURCE = '33333333-3333-4333-8333-333333333333'
OWNER = '11111111-1111-4111-8111-111111111111'
LEASE = '44444444-4444-4444-8444-444444444444'
GENERATION = '55555555-5555-4555-8555-555555555555'
TEXT = ('Position encodings carry sequence order. '*90)


def test_pdf_index_uses_exact_page_spans_and_both_vectors():
    from backend.retrieval.indexing import index_source
    async def run():
        calls = []
        def external(request):
            body = json.loads(request.content) if request.content else {}
            calls.append((request.url.path, body))
            if request.url.path.endswith('claim_retrieval_index'):
                return httpx.Response(200, json={
                    'source_id': SOURCE, 'user_id': OWNER, 'source_version': 1,
                    'generation': GENERATION, 'lease_token': LEASE, 'action': 'index',
                    'captured_text': TEXT, 'capture_sha256': hashlib.sha256(TEXT.encode()).hexdigest(),
                    'document': {'page_count': 1, 'pages': [{'page': 1, 'start': 0, 'end': len(TEXT)}]},
                    'transcript': None, 'chunks_completed': 0})
            if request.url.path == '/v1/embeddings':
                assert request.headers['authorization'] == 'Bearer model-test'
                return httpx.Response(200, json={'data': [{'index': i, 'embedding': [0.1]*1536} for i in range(len(body['input']))]})
            if request.url.host == 'qdrant.test':
                assert request.headers['api-key'] == 'qdrant-test'
                return httpx.Response(200, json={'result': {'status': 'completed'}, 'status': 'ok'})
            return httpx.Response(200, json=True)
        async with httpx.AsyncClient(transport=httpx.MockTransport(external)) as client:
            await index_source(client, 'https://supabase.test', 'db-test', 'https://qdrant.test', 'qdrant-test', 'model-test', SOURCE)
        points = [p for path,b in calls if path.endswith('/points') for p in b['points']]
        assert len(points) >= 2
        assert all(p['payload']['page'] == 1 for p in points)
        assert all(p['payload']['user_id'] == OWNER and p['payload']['source_version'] == 1 for p in points)
        assert all(p['vector']['bm25']['text'] == TEXT[p['payload']['start']:p['payload']['end']] for p in points)
        assert all(len(p['vector']['dense']) == 1536 for p in points)
        assert all(len(p['vector']['bm25']['text']) <= 3000 for p in points)
        assert calls[-1][0].endswith('finish_retrieval_index')
        assert calls[-1][1]['p_error_code'] is None
    asyncio.run(run())


def test_expired_claim_is_cleaned_without_publishing_ready():
    from backend.retrieval.indexing import index_source
    async def run():
        calls = []
        def external(request):
            body = json.loads(request.content) if request.content else {}
            calls.append((request.url.path,body))
            if request.url.path.endswith('claim_retrieval_index'):
                return httpx.Response(200,json={'source_id': SOURCE, 'user_id': OWNER, 'source_version': 1,
                    'generation': GENERATION, 'lease_token': LEASE, 'action': 'index', 'captured_text': TEXT,
                    'capture_sha256': hashlib.sha256(TEXT.encode()).hexdigest(), 'document': None,
                    'transcript': None, 'chunks_completed': 0})
            if request.url.path.endswith('checkpoint_retrieval_index'):
                return httpx.Response(200,json=False)
            return httpx.Response(200,json={'status':'ok','result':{'status':'completed'}})
        async with httpx.AsyncClient(transport=httpx.MockTransport(external)) as client:
            await index_source(client,'https://supabase.test','db-test','https://qdrant.test','qdrant-test','model-test',SOURCE)
        assert not any(p == '/v1/embeddings' or p.endswith('finish_retrieval_index') for p,b in calls)
        cleanup = calls[-1][1]['filter']['must']
        assert cleanup == [{'key':'user_id','match':{'value':OWNER}},
                           {'key':'source_id','match':{'value':SOURCE}},
                           {'key':'generation','match':{'value':GENERATION}}]
    asyncio.run(run())


def test_indexing_status_requires_learner_auth_and_validates_identity(monkeypatch):
    from fastapi.testclient import TestClient
    from backend.main import app
    monkeypatch.setenv('SUPABASE_URL','https://supabase.test')
    monkeypatch.setenv('SUPABASE_PUBLISHABLE_KEY','public-test')
    def response(request):
        if request.url.path == '/auth/v1/user':
            return httpx.Response(200,json={'id': OWNER},request=request)
        assert request.headers['authorization'] == 'Bearer learner-test'
        assert json.loads(request.content) == {'p_source_id': SOURCE}
        return httpx.Response(200,json={'source_id':SOURCE,'source_version':1,'status':'queued',
            'chunks_total':0,'chunks_completed':0,'error_code':None},request=request)
    async def external(client,request,**kwargs): return response(request)
    monkeypatch.setattr(httpx.AsyncClient,'send',external)
    with TestClient(app) as client:
        path = f'/api/v2/sources/{SOURCE}/index-status'
        assert client.get(path).status_code == 401
        result = client.get(path,headers={'Authorization':'Bearer learner-test'})
        assert result.status_code == 200,result.text
        assert result.json()['status'] == 'queued'


def test_collection_setup_refuses_incompatible_existing_vectors():
    from backend.retrieval.indexing import ensure_collection, IndexProviderError
    import pytest
    async def run():
        def external(request):
            assert request.method == 'GET'
            return httpx.Response(200,json={'status':'ok','result':{'config':{'params':{
                'vectors':{'dense':{'size':384,'distance':'Cosine'}},
                'sparse_vectors':{'bm25':{'modifier':'idf'}}}}}})
        async with httpx.AsyncClient(transport=httpx.MockTransport(external)) as client:
            with pytest.raises(IndexProviderError):
                await ensure_collection(client,'https://qdrant.test','key')
    asyncio.run(run())


def test_dispatch_is_opt_in_and_only_enqueues_stable_source_ids():
    from backend.workers.study import dispatch_pending_indexes
    async def run():
        dispatched=[]
        class Redis:
            async def enqueue_job(self,name,*args,**kwargs): dispatched.append((name,args,kwargs))
        def external(request):
            assert request.url.path.endswith('due_retrieval_indexes')
            return httpx.Response(200,json=[SOURCE])
        async with httpx.AsyncClient(transport=httpx.MockTransport(external)) as client:
            ctx={'storage_client':client,'retrieval_config':{'SUPABASE_URL':'https://supabase.test',
                 'SUPABASE_SECRET_KEY':'db-test'},'redis':Redis(),'retrieval_enabled':False}
            await dispatch_pending_indexes(ctx)
            assert dispatched==[]
            ctx['retrieval_enabled']=True
            await dispatch_pending_indexes(ctx)
        assert dispatched==[('build_source_index',(SOURCE,),{'_job_id':'index:'+SOURCE})]
    asyncio.run(run())


def test_timed_captions_keep_real_cue_locations_on_index_points():
    from backend.retrieval.indexing import index_source
    async def run():
        cue1 = 'First speaker explains retrieval. '*50
        cue2 = 'Second speaker explains generation. '*50
        text = cue1+'\n'+cue2
        written=[]
        def external(request):
            body=json.loads(request.content) if request.content else {}
            if request.url.path.endswith('claim_retrieval_index'):
                return httpx.Response(200,json={'source_id':SOURCE,'user_id':OWNER,'source_version':1,
                    'generation':GENERATION,'lease_token':LEASE,'action':'index','captured_text':text,
                    'capture_sha256':hashlib.sha256(text.encode()).hexdigest(),'document':None,'chunks_completed':0,
                    'transcript':{'provider':'youtube','format':'vtt','segments':[
                        {'start':0,'end':len(cue1),'start_ms':10000,'end_ms':15000},
                        {'start':len(cue1)+1,'end':len(text),'start_ms':30000,'end_ms':35000}]}})
            if request.url.path == '/v1/embeddings':
                return httpx.Response(200,json={'data':[{'index':i,'embedding':[0.2]*1536} for i in range(len(body['input']))]})
            if request.url.host == 'qdrant.test':
                written.extend(body.get('points',[]))
                return httpx.Response(200,json={'status':'ok','result':{'status':'completed'}})
            return httpx.Response(200,json=True)
        async with httpx.AsyncClient(transport=httpx.MockTransport(external)) as client:
            await index_source(client,'https://supabase.test','db','https://qdrant.test','key','model',SOURCE)
        assert [(p['payload']['start_ms'],p['payload']['end_ms']) for p in written]==[(10000,15000),(30000,35000)]
        assert all(p['payload']['page'] is None for p in written)
        assert [p['vector']['bm25']['text'] for p in written]==[cue1,cue2]
    asyncio.run(run())


def test_embedding_outage_records_retry_without_a_qdrant_write():
    from backend.retrieval.indexing import index_source
    async def run():
        calls=[]
        def external(request):
            body=json.loads(request.content) if request.content else {}
            calls.append((request.url.host,request.url.path,body))
            if request.url.path.endswith('claim_retrieval_index'):
                return httpx.Response(200,json={'source_id':SOURCE,'user_id':OWNER,'source_version':1,
                    'generation':GENERATION,'lease_token':LEASE,'action':'index','captured_text':TEXT,
                    'capture_sha256':hashlib.sha256(TEXT.encode()).hexdigest(),'document':None,
                    'transcript':None,'chunks_completed':0})
            if request.url.path == '/v1/embeddings': return httpx.Response(503)
            return httpx.Response(200,json=True)
        async with httpx.AsyncClient(transport=httpx.MockTransport(external)) as client:
            await index_source(client,'https://supabase.test','db','https://qdrant.test','key','model',SOURCE)
        assert not any(host=='qdrant.test' for host,path,body in calls)
        assert calls[-1][1].endswith('finish_retrieval_index')
        assert calls[-1][2]['p_error_code']=='provider_unavailable'
    asyncio.run(run())


def test_standalone_worker_exports_required_arq_lifecycle_configuration():
    """ARQ reads only declared settings; inherited callbacks are not exported."""
    from arq.worker import get_kwargs
    from backend.workers.retrieval import RetrievalWorkerSettings
    config = get_kwargs(RetrievalWorkerSettings)
    assert callable(config.get('on_startup')), 'ARQ must initialize server clients before dispatch'
    assert callable(config.get('on_shutdown')), 'ARQ must close server clients on shutdown'
    assert config.get('job_timeout') == 1500
    assert config.get('max_tries') == 1
    assert config.get('retry_jobs') is False
    assert config.get('keep_result') == 0
    assert config['queue_name'] == 'arq:retrieval'
