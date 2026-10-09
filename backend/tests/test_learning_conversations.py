"""Saved tutor exchanges through authenticated API and external HTTP boundaries."""
import json
import httpx
import pytest
from fastapi.testclient import TestClient
from backend.main import app

OWNER='11111111-1111-4111-8111-111111111111'
COLLECTION='77777777-7777-4777-8777-777777777777'
PLAN='55555555-5555-4555-8555-555555555555'
REQUEST='44444444-4444-4444-8444-444444444444'
URL=f'/api/v2/learning/collections/{COLLECTION}/plans/{PLAN}/lessons/0/conversation'

@pytest.fixture
def conversation_client(monkeypatch):
    monkeypatch.setenv('SUPABASE_URL','https://supabase.test')
    monkeypatch.setenv('SUPABASE_PUBLISHABLE_KEY','public-test')
    record={'user_id':OWNER,'collection_id':COLLECTION,'plan_id':PLAN,'lesson_index':0,'scope':'lesson','source_version':1,'evidence_current':True,'revision':0,'exchanges':[]}
    controls={'response':None,'status':200}
    def external(request):
        if request.url.path=='/auth/v1/user':return httpx.Response(200,json={'id':OWNER})
        assert request.headers['authorization']=='Bearer owner-token'
        assert request.url.path.endswith('/get_learning_conversation')
        body=json.loads(request.content);assert body=={'p_collection_id':COLLECTION,'p_plan_id':PLAN,'p_lesson_index':0}
        return httpx.Response(controls['status'],json=controls['response'] or record)
    original=httpx.AsyncClient
    monkeypatch.setattr(httpx,'AsyncClient',lambda **kw:original(**{**kw,'transport':httpx.MockTransport(external)}))
    return TestClient(app),record,controls

def test_saved_conversation_read_requires_auth_and_hides_owner(conversation_client):
    client,record,controls=conversation_client
    assert client.get(URL).status_code==401
    response=client.get(URL,headers={'Authorization':'Bearer owner-token'})
    assert response.status_code==200 and response.json()['exchanges']==[]
    assert 'user_id' not in response.json()


@pytest.mark.parametrize('mode',['success','failed','stale','repair'])
def test_send_uses_saved_bounded_context_records_provenance_and_replays_without_model(monkeypatch,mode):
    from backend.tests.test_learning import ALICE,SOURCE,PATH,CONTENT,REFERENCE
    for name,value in {'SUPABASE_URL':'https://supabase.test','SUPABASE_PUBLISHABLE_KEY':'public-test','SUPABASE_SECRET_KEY':'server-test','OPENAI_API_KEY':'model-test'}.items():monkeypatch.setenv(name,value)
    plan={'id':PLAN,'path_id':PATH,'request_id':REQUEST,'source_id':SOURCE,'source_title':'Evidence','source_version':1,'goal':'Explain evidence','difficulty':'foundation','content':CONTENT,'references':[REFERENCE],'confirmed_at':'2026-10-09T00:00:00Z','active':True,'needs_review':False,'model':'gpt-6-luna','policy_version':'learning_v1','created_at':'2026-10-09T00:00:00Z'}
    question='Can you explain that?'
    reply={'text':'Inspect whether the passage supports the answer.','citation_ids':['p0001'],'gap':None}
    prior=[{'id':f'88888888-8888-4888-8888-88888888888{i}','question':f'Earlier {i}','status':'completed','reply':{**reply,'text':f'Context {i}'},'redacted':False,'model':'gpt-6-luna','policy_version':'learning_v1','created_at':f'2026-10-09T00:00:0{i}Z','completed_at':f'2026-10-09T00:00:0{i}Z'} for i in range(3)]
    conversation={'user_id':ALICE,'collection_id':COLLECTION,'plan_id':PLAN,'lesson_index':0,'scope':'lesson','source_version':1,'evidence_current':True,'revision':3,'exchanges':prior}
    calls=[]
    def external(request):
        path=request.url.path
        if path=='/auth/v1/user':return httpx.Response(200,json={'id':ALICE})
        body=json.loads(request.content)
        if path.endswith('/request_learning_conversation'):
            assert body['p_question']==question and body['p_expected_revision']==3
            token=None if any(e['id']==REQUEST for e in conversation['exchanges']) else COLLECTION
            if token:conversation['exchanges'].append({'id':REQUEST,'question':question,'status':'processing','reply':None,'redacted':False,'model':None,'policy_version':'learning_v1','created_at':'2026-10-10T00:00:00Z','completed_at':None})
            return httpx.Response(200,json={'conversation':conversation,'lease_token':token})
        if path.endswith('/get_learning_collection'):
            return httpx.Response(200,json={'user_id':ALICE,'collection':{'id':COLLECTION,'legacy_source_id':SOURCE,'title':'Evidence','goal':'Explain evidence','revision':1,'source_count':0,'path_count':1,'original_source_available':True,'created_at':'2026-10-09T00:00:00Z','updated_at':'2026-10-09T00:00:00Z'},'sources':[],'learning':{'user_id':ALICE,'source_id':SOURCE,'plans':[plan],'attempts':[],'activities':[]}})
        if path=='/v1/responses':
            calls.append(body);assert body['model']==('gpt-6.1-sol' if len(calls)==2 else 'gpt-6-luna') and body['reasoning']=={'effort':'medium'}
            data=json.loads(body['input']);assert data['conversation_context']==[{'role':'user','text':'Earlier 1'},{'role':'assistant','text':'Context 1'},{'role':'user','text':'Earlier 2'},{'role':'assistant','text':'Context 2'}]
            if mode=='failed':return httpx.Response(503,json={'error':'Unavailable'})
            generated={**reply,'citation_ids':['unavailable']} if mode=='repair' and len(calls)==1 else reply
            return httpx.Response(200,json={'status':'completed','output':[{'type':'message','content':[{'type':'output_text','text':json.dumps(generated)}]}]})
        if path.endswith('/finish_learning_conversation'):
            assert request.headers['apikey']=='server-test'
            if body['p_reply'] is None:
                conversation['exchanges'][-1].update(status='failed');return httpx.Response(200,json=True)
            if mode=='stale':return httpx.Response(200,json=False)
            assert body['p_model']==('gpt-6.1-sol' if mode=='repair' else 'gpt-6-luna')
            conversation['exchanges'][-1].update(status='completed',reply=body['p_reply'],model=body['p_model'],completed_at='2026-10-10T00:00:01Z');conversation['revision']=4
            return httpx.Response(200,json=True)
        assert path.endswith('/get_learning_conversation');return httpx.Response(200,json=conversation)
    original=httpx.AsyncClient
    monkeypatch.setattr(httpx,'AsyncClient',lambda **kw:original(**{**kw,'transport':httpx.MockTransport(external)}))
    client=TestClient(app);body={'request_id':REQUEST,'question':question,'expected_revision':3};headers={'Authorization':'Bearer owner-token'}
    first=client.post(URL,headers=headers,json=body)
    if mode in ('failed','stale'):
        assert first.status_code==(503 if mode=='failed' else 409),first.text
        assert conversation['exchanges'][-1]['status']=='failed' and conversation['revision']==3
        return
    assert first.status_code==200,first.text
    assert first.json()['exchanges'][-1]['reply']==reply and first.json()['revision']==4
    assert client.post(URL,headers=headers,json=body).json()==first.json()
    assert len(calls)==(2 if mode=='repair' else 1)

@pytest.mark.parametrize('changes',[{'user_id':COLLECTION},{'collection_id':PLAN},{'lesson_index':1},{'scope':'library'},{'revision':True},{'exchanges':[{'id':REQUEST}]},{'unknown':'value'}])
def test_unrelated_or_malformed_conversations_are_not_returned(conversation_client,changes):
    client,record,controls=conversation_client;controls['response']={**record,**changes}
    assert client.get(URL,headers={'Authorization':'Bearer owner-token'}).status_code==503


def test_send_input_rejects_untrusted_context_owner_and_invalid_limits(conversation_client):
    client,record,controls=conversation_client;headers={'Authorization':'Bearer owner-token'}
    for changes in [{'question':'x'*2001},{'question':''},{'expected_revision':True},{'history':[]},{'user_id':OWNER},{'request_id':'bad'}]:
        assert client.post(URL,headers=headers,json={'request_id':REQUEST,'question':'Why?','expected_revision':0,**changes}).status_code==422
    assert client.post(URL,json={'request_id':REQUEST,'question':'Why?','expected_revision':0}).status_code==401
