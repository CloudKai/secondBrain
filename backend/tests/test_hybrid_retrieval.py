"""Hybrid evidence retrieval at external HTTP boundaries."""
import asyncio
import hashlib
from uuid import uuid5, UUID
import httpx
import pytest

OWNER='11111111-1111-4111-8111-111111111111'
SOURCE='33333333-3333-4333-8333-333333333333'
GENERATION='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
SHA=hashlib.sha256(b'Saved original evidence.').hexdigest()

def test_hybrid_query_filters_both_rankings_to_current_owned_generations():
    asyncio.run(hybrid_query_check())

async def hybrid_query_check():
    from backend.hybrid_retrieval import HybridRetriever, SearchSource
    requests=[]
    async def external(request):
        requests.append(request)
        if request.url.path=='/v1/embeddings':
            return httpx.Response(200,json={'data':[{'index':0,'embedding':[0.1]*1536}]})
        return httpx.Response(200,json={'status':'ok','result':{'points':[{
            'id':str(uuid5(UUID(GENERATION),'0')),'score':0.7,'payload':{
                'user_id':OWNER,'source_id':SOURCE,'source_version':1,'generation':GENERATION,
                'capture_sha256':SHA,'chunk_policy':'structure_recursive_v1',
                'embedding_model':'text-embedding-3-small','chunk_index':0,
                'start':0,'end':23,'page':None,'start_ms':None,'end_ms':None}}]}})
    async with httpx.AsyncClient(transport=httpx.MockTransport(external)) as client:
        inventory=[SearchSource.model_validate_json(__import__('json').dumps({
            'source_id':SOURCE,'user_id':OWNER,'source_version':1,'scope':'note',
            'generation':GENERATION,'capture_sha256':SHA,'chunks_total':1,
            'study_updated_at':'2026-10-07T00:00:00Z','map_updated_at':None}))]
        hits=await HybridRetriever(client,openai_key='test',qdrant_url='https://qdrant.test',qdrant_key='test').search('What evidence is saved?',UUID(OWNER),inventory)
    assert len(hits)==1 and str(hits[0].source_id)==SOURCE
    import json
    query=json.loads(requests[1].content)
    assert query['query']=={'fusion':'rrf'}
    assert [p['using'] for p in query['prefetch']]==['dense','bm25']
    for prefetch in query['prefetch']:
        assert prefetch['filter']['must'][0]=={'key':'user_id','match':{'value':OWNER}}
        assert prefetch['filter']['must'][1]['should'][0]['must']==[
            {'key':'source_id','match':{'value':SOURCE}},
            {'key':'source_version','match':{'value':1}},
            {'key':'generation','match':{'value':GENERATION}}]
    assert query['prefetch'][1]['params']['idf']=={'corpus':{'must':[{'key':'user_id','match':{'value':OWNER}}]}}

from backend.tests.test_assistant import assistant_client, ask


@pytest.mark.parametrize('change',[
    'article','pdf','video','late_video','semantic_video','literal_article','owner','generation','version','hash','scope','bad_location',
    'embedding_outage','search_outage','source_changed','index_changed','corrupt_note',
    'no_hits','still_indexing','missing_key','rerank_bad_identity'])
def test_library_question_uses_ranked_original_evidence_omitted_from_note(assistant_client, monkeypatch,change):
    import json
    client,state=assistant_client
    monkeypatch.setenv('ENABLE_HYBRID_RETRIEVAL','true')
    monkeypatch.setenv('QDRANT_URL','https://qdrant.test')
    monkeypatch.setenv('QDRANT_API_KEY','test')
    if change=='missing_key':monkeypatch.delenv('QDRANT_API_KEY')
    other=json.loads(json.dumps(state['rows'][0]))
    other.update(source_id='44444444-4444-4444-8444-444444444444',scope='library')
    hidden='The checkpoint retains sixteen committed segments after an outage.'
    prefix=other['captured_text']+'\n\n'+('Ordinary introductory learning material about general systems. '*10+'\n\n')*12
    if change=='literal_article':
        hidden='Cleanup advice requires propagating CancelledError after releasing resources.'
        prefix=other['captured_text']+'\n\n'+(('Ordinary background material about system internals. '*20)[:895]+'\n\n')*3
    if change in ('late_video','semantic_video'):
        prefix=other['captured_text']+'\n'+''.join(f'Background sentence number {i} describes introductory vocabulary.\n' for i in range(22))
    other['captured_text']=prefix+hidden
    if change=='pdf':
        other['document']={'filename':'Evidence.pdf','page_count':6,'pages':[{'page':6,'start':0,'end':len(other['captured_text'])}],'selected_pages':{'start':6,'end':6}}
        other['note']['references'][0]['page']=6
    if change in ('video','late_video','semantic_video'):
        other['transcript']={'provider':'youtube','format':'srt','filename':None,'segments':[
            {'start':0,'end':len(prefix)-1,'start_ms':0,'end_ms':12000},
            {'start':len(prefix),'end':len(other['captured_text']),'start_ms':13000,'end_ms':18000}], 'selected_time':None}
        other['note']['references'][0].update(start_ms=0,end_ms=12000)
    if change in ('late_video','semantic_video'):
        lines=other['captured_text'].splitlines(keepends=True)
        segments=[];start=0
        for i,line in enumerate(lines):
            end=start+len(line.rstrip('\n'))
            segments.append({'start':start,'end':end,'start_ms':i*1000,'end_ms':i*1000+800});start+=len(line)
        other['transcript']['segments']=segments
        other['note']['references'][0].update(start_ms=0,end_ms=800)
    sha=hashlib.sha256(other['captured_text'].encode()).hexdigest()
    def manifest(row,gen,hash_value):
        return {k:row[k] for k in ('source_id','user_id','source_version','scope','study_updated_at','map_updated_at')}|{'generation':gen,'capture_sha256':hash_value,'chunks_total':1}
    manifests=[manifest(state['rows'][0],None,hashlib.sha256(state['rows'][0]['captured_text'].encode()).hexdigest()),manifest(other,GENERATION,sha)]
    if change=='still_indexing':
        manifests[1].update(generation=None,chunks_total=0)
    model_seen=[]
    original=httpx.AsyncClient.send
    async def external(c,request,**kwargs):
        path=request.url.path
        if path.endswith('/get_assistant_search_inventory'):value=manifests
        elif path.endswith('/get_hybrid_assistant_context'):
            if change=='source_changed':
                return httpx.Response(409,json={'code':'40001'},request=request)
            if change=='corrupt_note':
                other['note']['references'][0]['excerpt']='Forged saved passage.'
            value=[state['rows'][0]] if change in ('no_hits','still_indexing') else [state['rows'][0],other]
        elif path=='/v1/embeddings':
            if change=='embedding_outage':
                return httpx.Response(503,request=request)
            inputs=json.loads(request.content)['input']
            if len(inputs)>1:
                value={'data':[{'index':i,'embedding':([1.0,0.0] if i==0 or hidden in text else [0.0,1.0])+[0.0]*1534} for i,text in enumerate(inputs)]}
                if change=='literal_article':
                    value={'data':[{'index':i,'embedding':([0.1,1.0] if i and hidden in text else [1.0,0.0])+[0.0]*1534} for i,text in enumerate(inputs)]}
                if change=='rerank_bad_identity':value['data'][1]['index']=True
            else:value={'data':[{'index':0,'embedding':[0.1]*1536}]}
        elif path.endswith('/points/query'):
            if change=='search_outage':
                return httpx.Response(503,request=request)
            value={'status':'ok','result':{'points':[{'id':str(uuid5(UUID(GENERATION),'0')),'payload':{
                'user_id':OWNER,'source_id':other['source_id'],'source_version':1,'generation':GENERATION,
                'capture_sha256':sha,'chunk_policy':'structure_recursive_v1','embedding_model':'text-embedding-3-small',
                'chunk_index':0,'start':len(prefix),'end':len(other['captured_text']),'page':None,'start_ms':None, 'end_ms':None}}]}}
            hit=value['result']['points'][0]['payload']
            if change=='pdf':hit['page']=6
            if change=='video':hit.update(start_ms=13000,end_ms=18000)
            if change in ('late_video','semantic_video'):hit.update(start=0,start_ms=0,end_ms=other['transcript']['segments'][-1]['end_ms'])
            if change=='literal_article':hit.update(start=0)
            mutations={'owner':('user_id','22222222-2222-4222-8222-222222222222'),
                'generation':('generation','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
                'version':('source_version',2),'hash':('capture_sha256','0'*64),
                'scope':('source_id','55555555-5555-4555-8555-555555555555'),
                'bad_location':('page',99)}
            if change in mutations:
                field,invalid=mutations[change];hit[field]=invalid
            if change=='no_hits':value['result']['points']=[]
        elif path.endswith('/validate_hybrid_assistant_context'):value=change!='index_changed'
        else:
            if path=='/v1/chat/completions':
                model_seen.append(True)
                context=json.loads(json.loads(request.content)['messages'][1]['content'])
                assert any(e['excerpt']==hidden for s in context['sources'] for e in s['evidence'])
                state['draft']['claims'][0]['reference_ids']=[next(e['id'] for s in context['sources'] for e in s['evidence'] if e['excerpt']==hidden)]
            return await original(c,request,**kwargs)
        return httpx.Response(200,json=value,request=request)
    monkeypatch.setattr(httpx.AsyncClient,'send',external)
    response=ask(client,question='What cleanup is recommended after catching CancelledError?' if change=='literal_article' else 'Which checkpoint segments are retained after an outage?' if change=='late_video' else 'What guarantees durability?',library=True)
    if change in ('owner','generation','version','hash','scope','bad_location','embedding_outage','search_outage','corrupt_note','missing_key','rerank_bad_identity'):
        assert response.status_code==503,response.text
        assert not model_seen
    elif change in ('source_changed','index_changed'):
        assert response.status_code==409,response.text
        if change=='source_changed':assert not model_seen
    elif change in ('no_hits','still_indexing'):
        assert response.status_code==200,response.text
        assert response.json()['status']=='unsupported' and not model_seen
    else:
        assert response.status_code==200,response.text
        ref=response.json()['references'][0]
        assert ref['source_id']==other['source_id']
        assert ref['passage']['excerpt']==hidden
        assert ref['passage']['page']==(6 if change=='pdf' else None)
        assert ref['passage']['start_ms']==(other['transcript']['segments'][-1]['start_ms'] if change in ('late_video','semantic_video') else 13000 if change=='video' else None)
        assert response.json()['partial'] is True
