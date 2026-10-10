"""Initial captured teaching through the authenticated API and external HTTP."""
import copy
import hashlib
import json
from uuid import UUID, uuid5

import httpx
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.tests.test_learning import ALICE, BOB, SOURCE, REQUEST, LEASE, PLAN, PATH, SOURCE_ROW, NOTE, DRAFT, TEXT

GENERATION = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
HIDDEN = 'Uncommitted operations require replay after an outage.'
CAPTURE = TEXT + '\n\n' + HIDDEN
URL = f'/api/v2/sources/{SOURCE}/learning/preview'
HEADERS = {'Authorization': 'Bearer alice'}


@pytest.fixture
def capture_client(monkeypatch):
    for name, value in {'SUPABASE_URL':'https://supabase.test','SUPABASE_PUBLISHABLE_KEY':'public-test',
                        'SUPABASE_SECRET_KEY':'server-test','OPENAI_API_KEY':'model-test',
                        'QDRANT_URL':'https://qdrant.test','QDRANT_API_KEY':'qdrant-test'}.items():
        monkeypatch.setenv(name,value)
    row = {**SOURCE_ROW,'captured_text':CAPTURE}
    inventory = [{'source_id':SOURCE,'user_id':ALICE,'source_version':1,'scope':'note','generation':GENERATION,
                  'capture_sha256':hashlib.sha256(CAPTURE.encode()).hexdigest(),'chunks_total':1,
                  'study_updated_at':'2026-10-09T00:00:00Z','map_updated_at':None}]
    point = {'id':str(uuid5(UUID(GENERATION),'0')),'payload':{
        'user_id':ALICE,'source_id':SOURCE,'source_version':1,'generation':GENERATION,
        'capture_sha256':inventory[0]['capture_sha256'],'chunk_policy':'structure_recursive_v1',
        'embedding_model':'text-embedding-3-small','chunk_index':0,'start':len(TEXT)+2,'end':len(CAPTURE),
        'page':None,'start_ms':None,'end_ms':None}}
    state = {'source':row,'inventory':inventory,'points':[point],'valid':True,'calls':[],
             'model_calls':[],'finish':[], 'snapshot':{'source_id':SOURCE,'user_id':ALICE,'plans':[], 'attempts':[],'activities':[]}}

    def external(request):
        state['calls'].append(request.url.path)
        owner = request.headers.get('authorization') == 'Bearer alice'
        if request.url.path == '/auth/v1/user':
            return httpx.Response(200,json={'id':ALICE if owner else BOB})
        body = json.loads(request.content) if request.content else {}
        if request.url.path.endswith('/request_learning_capture_preview'):
            if not owner:return httpx.Response(404,json={'code':'P0002'})
            return httpx.Response(200,json={'user_id':ALICE,'request_id':REQUEST,'source':row,'note':NOTE,
                 'lease_token':None if state.get('replay') else LEASE,'path_direction':None,'evidence_mode':'capture'})
        if request.url.path.endswith('/get_source_learning'):
            return httpx.Response(200,json=state['snapshot'])
        if request.url.path.endswith('/get_assistant_search_inventory'):
            assert body['p_library'] is False and body['p_topic_id'] is None
            return httpx.Response(200,json=inventory)
        if request.url.path.endswith('/get_hybrid_assistant_context'):
            return httpx.Response(200,json=[{'source_id':SOURCE,'user_id':ALICE,'source_version':1,'title':row['title'],
                'captured_text':row['captured_text'],'document':row['document'],'transcript':row['transcript'],'note':NOTE,
                'study_updated_at':inventory[0]['study_updated_at'],'map_updated_at':None,'scope':'note'}])
        if request.url.path.endswith('/validate_hybrid_assistant_context'):
            return httpx.Response(200,json=state['valid'])
        if request.url.path == '/v1/embeddings':
            return httpx.Response(200,json={'data':[{'index':0,'embedding':[.1]*1536}]})
        if request.url.path.endswith('/points/query'):
            return httpx.Response(200,json={'status':'ok','result':{'points':state['points']}})
        if request.url.path == '/v1/responses':
            state['model_calls'].append(body)
            evidence = json.loads(body['input'])['evidence']
            draft = copy.deepcopy(DRAFT)
            for path in draft['paths']:
                for lesson in path['lessons']:
                    for claim in [lesson['explanation'],lesson['check']['worked_answer']]:
                        claim.update(text=HIDDEN,citation_ids=[evidence[0]['id']])
            manifest = {'policy_version':'teaching_manifest_v1','coverage':'A retrieved sample, not the complete source.',
                        'gaps':[],'entries':[{'kind':'concept','text':'Uncommitted recovery','citation_ids':[evidence[0]['id']]}]}
            result = {'draft':draft,'manifest':manifest}
            if state.get('invalid_id'):manifest['entries'][0]['citation_ids']=['unknown']
            if state.get('change_during_generation'):state['valid']=False
            return httpx.Response(state.get('model_status',200),json={'status':'completed','output':[{'type':'message','content':[{'type':'output_text','text':json.dumps(result)}]}]})
        if request.url.path.endswith('/finish_learning_capture_preview'):
            state['finish'].append(body)
            if body['p_draft']:
                state['snapshot']['plans']=[{'id':PLAN,'path_id':PATH,'request_id':REQUEST,'source_id':SOURCE,
                  'source_title':row['title'],'source_version':1,'goal':body['p_goal'],'difficulty':'foundation',
                  'content':body['p_draft']['paths'][0],'references':body['p_references'],'confirmed_at':None,
                  'active':False,'needs_review':False,'model':body['p_model'],'policy_version':'learning_v1',
                  'created_at':'2026-10-10T00:00:00Z','teaching':{'selector_policy':'teaching_evidence_v1',
                  'source_id':SOURCE,'source_version':1,'capture_sha256':inventory[0]['capture_sha256'],
                  'index_generation':GENERATION,'manifest':body['p_manifest']}}]
            return httpx.Response(200,json=True)
        raise AssertionError(str(request.url))
    original=httpx.AsyncClient
    monkeypatch.setattr(httpx,'AsyncClient',lambda **kw:original(**{**kw,'transport':httpx.MockTransport(external)}))
    return TestClient(app),state


def preview(client,**extra):
    return client.post(URL,headers=HEADERS,json={'request_id':REQUEST,'source_version':1,'goal':'Explain recovery','evidence_mode':'capture',**extra})


def test_new_path_teaches_from_original_passage_absent_from_saved_note(capture_client):
    client,state=capture_client
    response=preview(client)
    assert response.status_code==200,response.text
    plan=response.json()['plans'][0]
    assert plan['references'][0]['excerpt']==HIDDEN
    assert plan['content']['lessons'][0]['explanation']['text']==HIDDEN
    assert plan['teaching']['manifest']['entries'][0]['text']=='Uncommitted recovery'
    assert response.json()['attempts']==[] and response.json()['activities']==[]
    call=state['model_calls'][0]
    assert call['model']=='gpt-6-luna' and call['reasoning']=={'effort':'medium'}
    assert len(call['input'])+len(call['instructions'])+len(json.dumps(call['text']['format'],ensure_ascii=False))<=30000
    assert state['finish'][0]['p_sources'][0]['capture_sha256']==state['inventory'][0]['capture_sha256']
    assert state['finish'][0]['p_sources'][0]['generation']==GENERATION
    assert all('finish_learning_preview' not in path for path in state['calls'])


def test_unready_index_stops_before_generation_and_releases_preview(capture_client):
    client,state=capture_client
    state['inventory'][0].update(generation=None,chunks_total=0)
    response=preview(client)
    assert response.status_code==409 and 'index' in response.text
    assert state['model_calls']==[]
    assert state['finish'][0]['p_draft'] is None
    assert state['snapshot']['plans']==[]


def test_no_matches_does_not_generate_or_escalate(capture_client):
    client,state=capture_client
    state['points']=[]
    assert preview(client).status_code==409
    assert state['model_calls']==[] and state['finish'][0]['p_draft'] is None


def test_capture_change_during_generation_discards_draft(capture_client):
    client,state=capture_client
    state['change_during_generation']=True
    assert preview(client).status_code==409
    assert len(state['model_calls'])==1
    assert state['finish'][0]['p_draft'] is None and state['snapshot']['plans']==[]


def test_manifest_with_unknown_ids_gets_one_bounded_repair_then_fails(capture_client):
    client,state=capture_client
    state['invalid_id']=True
    assert preview(client).status_code==503
    assert [call['model'] for call in state['model_calls']]==['gpt-6-luna','gpt-6.1-sol']
    assert state['finish'][0]['p_draft'] is None


def test_replay_does_not_retrieve_or_generate(capture_client):
    client,state=capture_client
    state['replay']=True
    assert preview(client).status_code==200
    assert state['model_calls']==[] and state['finish']==[]
    assert '/v1/embeddings' not in state['calls']


def test_foreign_owner_cannot_generate_capture_learning(capture_client):
    client,state=capture_client
    body={'request_id':REQUEST,'source_version':1,'evidence_mode':'capture'}
    assert client.post(URL,json=body).status_code==401
    assert client.post(URL,headers={'Authorization':'Bearer bob'},json=body).status_code==404
    assert state['model_calls']==[]


def test_capture_cannot_change_existing_path_direction(capture_client):
    client,state=capture_client
    assert preview(client,path_id=PATH).status_code==422
    assert state['model_calls']==[] and state['finish']==[]


def test_escaped_evidence_cannot_exceed_complete_model_input_budget(capture_client):
    client,state=capture_client
    paragraphs=['"'*850 for _ in range(24)]
    capture=TEXT+'\n\n'+'\n\n'.join(paragraphs)
    state['source']['captured_text']=capture
    digest=hashlib.sha256(capture.encode()).hexdigest()
    state['inventory'][0].update(capture_sha256=digest,chunks_total=24)
    template=state['points'][0]['payload']
    points=[]
    start=len(TEXT)+2
    for index,paragraph in enumerate(paragraphs):
        points.append({'id':str(uuid5(UUID(GENERATION),str(index))),'payload':{**template,'capture_sha256':digest,
           'chunk_index':index,'start':start,'end':start+len(paragraph)}})
        start+=len(paragraph)+2
    state['points']=points
    assert preview(client).status_code==503
    assert state['model_calls']==[] and state['finish'][0]['p_draft'] is None


@pytest.mark.parametrize('kind',['pdf','transcript'])
def test_hidden_passage_preserves_exact_pdf_page_or_video_timestamp(capture_client,kind):
    client,state=capture_client
    start=len(TEXT)+2
    if kind=='pdf':
        state['source'].update(source_kind='pdf',capture_origin='direct',document={'filename':'example.pdf','page_count':2,'pages':[{'page':1,'start':0,'end':len(TEXT)+1},{'page':2,'start':start,'end':len(CAPTURE)}]})
        state['points'][0]['payload']['page']=2
    else:
        state['source'].update(source_kind='video',capture_origin='pasted',coverage='partial',original_url='https://zoom.us/rec/share/example',canonical_url='https://zoom.us/rec/share/example',transcript={'provider':'zoom','filename':None,'format':'vtt','segments':[{'start':0,'end':len(TEXT),'start_ms':0,'end_ms':5000},{'start':start,'end':len(CAPTURE),'start_ms':13000,'end_ms':18000}], 'selected_time':None})
        # Transcript captures separate original cues with one newline.
        capture=TEXT+'\n'+HIDDEN
        state['source']['captured_text']=capture
        state['source']['transcript']['segments'][1].update(start=len(TEXT)+1,end=len(capture))
        digest=hashlib.sha256(capture.encode()).hexdigest()
        state['inventory'][0]['capture_sha256']=digest
        state['points'][0]['payload'].update(start=len(TEXT)+1,end=len(capture),start_ms=13000,end_ms=18000,capture_sha256=digest)
    response=preview(client)
    assert response.status_code==200,response.text
    ref=response.json()['plans'][0]['references'][0]
    assert ref['excerpt']==HIDDEN
    if kind=='pdf':assert ref['page']==2 and ref['start_ms'] is None
    else:assert (ref['start_ms'],ref['end_ms'],ref['page'])==(13000,18000,None)


from pathlib import Path
DEVELOPMENT_CASES=json.loads((Path(__file__).resolve().parents[2]/'docs/evaluation/teaching-development-cases.json').read_text())['cases']


@pytest.mark.parametrize('case',DEVELOPMENT_CASES,ids=lambda case:case['id'])
def test_reviewed_fragments_reach_teaching_unchanged_without_sending_evaluation_labels(capture_client,case):
    client,state=capture_client
    excerpt=case['support_excerpt']
    capture=TEXT+'\n\n'+excerpt
    state['source']['captured_text']=capture
    digest=hashlib.sha256(capture.encode()).hexdigest()
    state['inventory'][0]['capture_sha256']=digest
    state['points'][0]['payload'].update(capture_sha256=digest,start=len(TEXT)+2,end=len(capture))
    response=preview(client,goal=case['goal'])
    assert response.status_code==200,response.text
    references=response.json()['plans'][0]['references']
    assert all(capture[ref['start']:ref['end']]==ref['excerpt'] for ref in references)
    # These are transport/attribution tests, not semantic teaching quality scores.
    assert ''.join(''.join(ref['excerpt'].split()) for ref in references)==''.join(excerpt.split())
    data=json.loads(state['model_calls'][0]['input'])
    assert data['goal']==case['goal']
    assert not any(key in data for key in ['expected_concepts','forbidden_claims','answers','assessments'])
