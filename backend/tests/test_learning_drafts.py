"""Unfinished work through authenticated API and external Postgres HTTP."""
import json
import httpx
import pytest
from fastapi.testclient import TestClient
from backend.main import app

OWNER='11111111-1111-4111-8111-111111111111'
COLLECTION='77777777-7777-4777-8777-777777777777'
PLAN='55555555-5555-4555-8555-555555555555'
SAVE='44444444-4444-4444-8444-444444444444'
URL=f'/api/v2/learning/collections/{COLLECTION}/plans/{PLAN}/lessons/0/drafts/answer'

@pytest.fixture
def drafts_client(monkeypatch):
    monkeypatch.setenv('SUPABASE_URL','https://supabase.test')
    monkeypatch.setenv('SUPABASE_PUBLISHABLE_KEY','public-test')
    record={'user_id':OWNER,'collection_id':COLLECTION,'plan_id':PLAN,'lesson_index':0,'kind':'answer','scope':'lesson','source_version':1,'evidence_current':True,'text':'','revision':0,'save_id':None,'updated_at':None}
    controls={'response':None,'status':200}
    def external(request):
        if request.url.path=='/auth/v1/user':
            return httpx.Response(200,json={'id':OWNER})
        assert request.headers['authorization']=='Bearer owner-token'
        body=json.loads(request.content)
        assert body['p_collection_id']==COLLECTION and body['p_plan_id']==PLAN
        if controls['status']!=200:return httpx.Response(controls['status'],json={'code':'40001'})
        if request.url.path.endswith('/save_learning_draft'):
            record.update(text=body['p_text'],revision=1,save_id=body['p_save_id'],updated_at='2026-10-09T00:00:00Z')
        else:assert request.url.path.endswith('/get_learning_draft')
        return httpx.Response(200,json=controls['response'] or record)
    original=httpx.AsyncClient
    monkeypatch.setattr(httpx,'AsyncClient',lambda **kw:original(**{**kw,'transport':httpx.MockTransport(external)}))
    return TestClient(app),record,controls

def test_authenticated_draft_saves_are_exact_and_owner_free(drafts_client):
    client,record,controls=drafts_client
    assert client.get(URL).status_code==401
    headers={'Authorization':'Bearer owner-token'}
    first=client.get(URL,headers=headers)
    assert first.status_code==200 and first.json()['revision']==0
    assert 'user_id' not in first.json()
    text='  My reasoning 👩🏽‍💻\n\nx² + β = 3.\n'
    saved=client.put(URL,headers=headers,json={'text':text,'expected_revision':0,'save_id':SAVE})
    assert saved.status_code==200 and saved.json()['text']==text
    assert client.get(URL,headers=headers).json()==saved.json()


@pytest.mark.parametrize('changes', [
    {'user_id':COLLECTION}, {'collection_id':PLAN}, {'plan_id':COLLECTION},
    {'lesson_index':1}, {'kind':'question'}, {'scope':'library'}, {'revision':True},
    {'updated_at':'not-a-date'}, {'extra':'untrusted'}, {'text':'unexpected unsaved text'},
])
def test_draft_reads_reject_malformed_or_unrelated_storage(drafts_client, changes):
    client, record, controls = drafts_client
    controls['response'] = {**record, **changes}
    assert client.get(URL, headers={'Authorization':'Bearer owner-token'}).status_code == 503


def test_draft_input_limits_and_conflicts_are_actionable(drafts_client):
    client, record, controls = drafts_client
    headers = {'Authorization':'Bearer owner-token'}
    for changes in [{'text':'x'*5001}, {'expected_revision':-1}, {'expected_revision':True},
                    {'user_id':OWNER}, {'save_id':'invalid'}]:
        body = {'text':'Draft', 'expected_revision':0, 'save_id':SAVE, **changes}
        assert client.put(URL, headers=headers, json=body).status_code == 422
    assert client.put(URL.replace('/answer','/question'), headers=headers,
                      json={'text':'🧠'*2001,'expected_revision':0,'save_id':SAVE}).status_code == 422
    controls['status'] = 409
    response = client.put(URL, headers=headers, json={'text':'Retained','expected_revision':0,'save_id':SAVE})
    assert response.status_code == 409 and 'another tab' in response.json()['detail']
