"""Grounded questions through learner, database and model HTTP boundaries."""
import json
import httpx
import pytest
from fastapi.testclient import TestClient
from backend.main import app

ALICE='11111111-1111-4111-8111-111111111111'
SOURCE='33333333-3333-4333-8333-333333333333'
TEXT='Retrieval augmented generation retrieves saved evidence before generating an answer.'
NOTE={'overview':{'text':TEXT,'citation_ids':['p0001']},'concepts':[{'title':'RAG','text':TEXT,'citation_ids':['p0001']}],'examples':[],'equations':[],'recall':[{'question':'What is retrieved?','answer':'Saved evidence.','citation_ids':['p0001']}],'references':[{'id':'p0001','start':0,'end':len(TEXT),'excerpt':TEXT,'page':None,'start_ms':None,'end_ms':None}]}

@pytest.fixture
def assistant_client(monkeypatch):
    monkeypatch.setenv('SUPABASE_URL','https://supabase.test')
    monkeypatch.setenv('SUPABASE_PUBLISHABLE_KEY','public-test')
    monkeypatch.setenv('OPENAI_API_KEY','test-key')
    state={'rows':[{'source_id':SOURCE,'user_id':ALICE,'title':'RAG','source_version':1,'captured_text':TEXT+' More captured material.'*4,'document':None,'transcript':None,'note':NOTE,'study_updated_at':'2026-10-04T00:00:00Z','map_updated_at':None,'scope':'note'}], 'draft':{'status':'supported','claims':[{'text':'It retrieves saved evidence before generating an answer.','reference_ids':['ref1']}],'gap':None},'valid':True,'calls':[]}
    async def external(client,request,**kwargs):
        state['calls'].append(request)
        path=request.url.path
        if path=='/auth/v1/user': value={'id':ALICE}
        elif path.endswith('/get_assistant_context'): value=state['rows']
        elif path.endswith('/validate_assistant_context'): value=state['valid']
        elif path=='/v1/chat/completions':
            body=json.loads(request.content)
            value={'id':'test','model':'gpt-4o-mini','object':'chat.completion','choices':[{'index':0,'finish_reason':'tool_calls','message':{'role':'assistant','content':None,'tool_calls':[{'id':'test','type':'function','function':{'name':body['tools'][0]['function']['name'],'arguments':json.dumps(state['draft'])}}]}}]}
        else: raise AssertionError(str(request.url))
        return httpx.Response(200,json=value,request=request)
    monkeypatch.setattr(httpx.AsyncClient,'send',external)
    return TestClient(app),state

def ask(client,**payload):
    return client.post(f'/api/v2/sources/{SOURCE}/ask',headers={'Authorization':'Bearer alice'},json={'question':'What does RAG retrieve?','source_version':1,**payload})

def test_current_note_question_has_exact_evidence_and_authenticated_scope(assistant_client):
    client,state=assistant_client
    response=ask(client)
    assert response.status_code==200,response.text
    answer=response.json()
    assert answer['claims'][0]['reference_ids']==[SOURCE+':p0001']
    assert answer['references'][0]['passage']['excerpt']==TEXT
    assert answer['references'][0]['source_version']==1
    retrieval=next(r for r in state['calls'] if r.url.path.endswith('get_assistant_context'))
    assert json.loads(retrieval.content)=={'p_source_id':SOURCE,'p_source_version':1,'p_question':'What does RAG retrieve?','p_topic_id':None,'p_library':False}
    assert client.post(f'/api/v2/sources/{SOURCE}/ask',json={'question':'RAG?','source_version':1}).status_code==401

def test_fabricated_pdf_location_is_rejected_before_the_model(assistant_client):
    client,state=assistant_client
    state['rows'][0]['note']=json.loads(json.dumps(NOTE))
    state['rows'][0]['note']['references'][0]['page']=3
    assert ask(client).status_code==503
    assert not any(r.url.path=='/v1/chat/completions' for r in state['calls'])

def test_private_citation_labels_cannot_leak_into_answer_prose(assistant_client):
    client,state=assistant_client
    state['draft']['claims'][0]['text']='It retrieves evidence ref1.'
    assert ask(client).status_code==503

@pytest.mark.parametrize('change',['unknown_citation','unowned','stale','unsupported','blank','too_long'])
def test_answer_rejects_invalid_context_or_explains_the_evidence_gap(assistant_client,change):
    client,state=assistant_client
    expected=503
    payload={}
    if change=='unknown_citation': state['draft']['claims'][0]['reference_ids']=['ref99']
    if change=='unowned': state['rows'][0]['user_id']='22222222-2222-4222-8222-222222222222'
    if change=='stale': state['valid']=False;expected=409
    if change=='unsupported':
        state['draft']={'status':'unsupported','claims':[],'gap':'These passages do not contain a numerical benchmark.'};expected=200
    if change=='blank': payload['question']='  ';expected=422
    if change=='too_long': payload['question']='x'*2001;expected=422
    response=ask(client,**payload)
    assert response.status_code==expected,response.text
    if change=='unsupported': assert response.json()['references']==[]


def test_topic_and_library_together_keep_source_identity_and_locations(assistant_client):
    client,state=assistant_client
    other=json.loads(json.dumps(state['rows'][0]))
    other.update(source_id='44444444-4444-4444-8444-444444444444',scope='topic',map_updated_at='2026-10-04T00:00:00Z')
    other['document']={'filename':'RAG.pdf','page_count':3,'pages':[{'page':3,'start':0,'end':len(other['captured_text'])}],'selected_pages':{'start':3,'end':3}}
    other['note']['references'][0]['page']=3
    state['rows'].append(other)
    third=json.loads(json.dumps(state['rows'][0]));third.update(source_id='55555555-5555-4555-8555-555555555555',scope='library')
    third['transcript']={'provider':'youtube','format':'srt','filename':None,'segments':[{'start':0,'end':len(third['captured_text']),'start_ms':24000,'end_ms':42000}],'selected_time':None}
    third['note']['references'][0].update(start_ms=24000,end_ms=42000)
    state['rows'].append(third)
    state['draft']['claims'][0]['reference_ids']=['ref1','ref2','ref3']
    response=ask(client,topic_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',library=True)
    assert response.status_code==200,response.text
    refs=response.json()['references']
    assert refs[1]['passage']['page']==3
    assert refs[2]['passage']['start_ms']==24000
    request=next(r for r in state['calls'] if r.url.path.endswith('/get_assistant_context'))
    assert json.loads(request.content)['p_library'] is True

def test_followups_send_bounded_untrusted_recent_conversation(assistant_client):
    client,state=assistant_client
    response=ask(client,history=[{'role':'user','text':'Explain RAG.'},{'role':'assistant','text':'It retrieves saved evidence.'}])
    assert response.status_code==200,response.text
    model=next(r for r in state['calls'] if r.url.path=='/v1/chat/completions')
    payload=json.loads(json.loads(model.content)['messages'][1]['content'])
    assert payload['history'][0]['text']=='Explain RAG.'
    assert len(json.loads(model.content)['messages'][1]['content'])<=30000

def test_unsupported_answer_cannot_invent_a_research_link(assistant_client):
    client,state=assistant_client
    state['draft']={'status':'unsupported','claims':[],'gap':'Read https://invented.example/paper for the answer.'}
    assert ask(client).status_code==503

@pytest.mark.parametrize('failure',['timeout','provider'])
def test_model_http_failures_return_actionable_errors(assistant_client,monkeypatch,failure):
    client,_=assistant_client
    original=httpx.AsyncClient.send
    async def fail(client,request,**kw):
        if request.url.path=='/v1/chat/completions':
            if failure=='timeout':raise httpx.ReadTimeout('timeout',request=request)
            return httpx.Response(503,json={'error':{'message':'unavailable'}},request=request)
        return await original(client,request,**kw)
    monkeypatch.setattr(httpx.AsyncClient,'send',fail)
    assert ask(client).status_code==503

def test_long_library_context_is_bounded_and_discloses_omitted_passages(assistant_client):
    client,state=assistant_client
    rows=[]
    for i in range(9):
        row=json.loads(json.dumps(state['rows'][0]))
        row['source_id']=SOURCE if i==0 else f'{i:08d}-4444-4444-8444-444444444444'
        row['scope']='note' if i==0 else 'topic' if i<=4 else 'library'
        row['captured_text']='Evidence about retrieval. '*4000
        row['note']['references']=[{'id':f'p{j+1:04d}','start':j*1000,'end':(j+1)*1000,'excerpt':row['captured_text'][j*1000:(j+1)*1000],'page':None,'start_ms':None,'end_ms':None} for j in range(100)]
        rows.append(row)
    state['rows']=rows
    response=ask(client,topic_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',library=True,history=[{'role':'user','text':'Explain retrieval. '*100}]*4)
    assert response.status_code==200,response.text
    assert response.json()['partial'] is True
    model=next(r for r in state['calls'] if r.url.path=='/v1/chat/completions')
    assert len(json.loads(model.content)['messages'][1]['content'])<=30000
