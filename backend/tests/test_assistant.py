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
            for claim in state['draft']['claims']:
                claim.setdefault('comparison_source_keys', [])
            if state.get('cite_each_source'):
                context=json.loads(body['messages'][1]['content'])
                state['draft']['claims'][0]['reference_ids']=[entry['evidence'][0]['id'] for entry in context['sources']]
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
    state['cite_each_source']=True
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

def test_redundant_known_citation_metadata_becomes_badges_without_losing_attribution(assistant_client):
    client,state=assistant_client
    state['draft']['claims'][0]['text']='It retrieves saved evidence (ref1).'
    response=ask(client)
    assert response.status_code==200,response.text
    assert response.json()['claims'][0]['text']=='RAG: “'+TEXT+'”'
    assert response.json()['claims'][0]['reference_ids']==[SOURCE+':p0001']

def test_prior_assistant_claims_do_not_become_followup_model_evidence(assistant_client):
    client,state=assistant_client
    response=ask(client,history=[{'role':'user','text':'Explain evaluation A.'},{'role':'assistant','text':'RAG is universally reliable because of the curated data.'}])
    assert response.status_code==200,response.text
    model=next(r for r in state['calls'] if r.url.path=='/v1/chat/completions')
    payload=json.loads(json.loads(model.content)['messages'][1]['content'])
    assert payload['history']==[{'role':'user','text':'Explain evaluation A.'}]


@pytest.mark.parametrize('end_ms,expected_status',[(18000,200),(16000,503),(19000,503)])
def test_assistant_uses_exact_joined_caption_evidence_and_rejects_fabricated_times(assistant_client,end_ms,expected_status):
    client,state=assistant_client
    first,second='Retrieval 🚀 supplies documents','to support generated answers.'
    remainder='The generator uses this evidence and keeps attribution to the original source.'
    text='\n'.join([first,second,remainder])
    passage={'id':'p0001','start':0,'end':len(first)+1+len(second),'excerpt':first+'\n'+second,'page':None,'start_ms':12000,'end_ms':end_ms}
    row=state['rows'][0]
    row['captured_text']=text
    row['transcript']={'provider':'youtube','format':'vtt','filename':None,'segments':[
        {'start':0,'end':len(first),'start_ms':12000,'end_ms':18000},
        {'start':len(first)+1,'end':len(first)+1+len(second),'start_ms':14000,'end_ms':16000},
        {'start':len(first)+2+len(second),'end':len(text),'start_ms':18000,'end_ms':22000},
    ]}
    row['note']=json.loads(json.dumps(NOTE));row['note']['references']=[passage]
    response=ask(client)
    assert response.status_code==expected_status,response.text
    if expected_status==200:
        assert response.json()['references'][0]['passage']==passage
    else:
        assert not any(r.url.path=='/v1/chat/completions' for r in state['calls'])


def test_uncited_pdf_passage_can_answer_with_its_exact_physical_page(assistant_client):
    client, state = assistant_client
    intro = 'Feed-forward networks transform each position independently. ' * 3
    answer = 'Positional encodings give the Transformer sequence order because the architecture has no recurrence or convolution. ' * 2
    row = state['rows'][0]
    row['captured_text'] = intro + '\n' + answer
    row['document'] = {'filename': 'transformer.pdf', 'page_count': 6,
                      'pages': [{'page': 5, 'start': 0, 'end': len(intro)},
                                {'page': 6, 'start': len(intro) + 1, 'end': len(row['captured_text'])}],
                      'selected_pages': {'start': 5, 'end': 6}}
    row['note'] = json.loads(json.dumps(NOTE))
    row['note']['references'][0].update(start=0, end=len(intro), excerpt=intro, page=5)
    state['draft']['claims'][0]['text'] = 'Positional encodings supply sequence order.'
    response = ask(client, question='Why does the Transformer use positional encodings?')
    assert response.status_code == 200, response.text
    reference = response.json()['references'][0]
    assert reference['passage']['excerpt'] == answer
    assert reference['passage']['page'] == 6
    assert reference['passage']['start'] == len(intro) + 1
    assert reference['id'] != SOURCE + ':p0001'


def test_layout_reading_keeps_original_equation_citations(assistant_client, monkeypatch):
    client,state=assistant_client
    raw='Constraints for GQA:\nnumber_of_heads_query % number_of_heads_key_value == 0 and,\nnumber_of_heads_key == number_of_heads_value'
    row=state['rows'][0]
    row['captured_text']=raw
    row['note']=json.loads(json.dumps(NOTE))
    row['note']['references'][0].update(start=0,end=len(raw),excerpt=raw)
    state['draft']['claims'][0]['text']='Query heads are divisible by key/value heads; key and value head counts are equal.'
    original=httpx.AsyncClient.send
    async def external(c,request,**kwargs):
        if request.url.path=='/v1/chat/completions':
            content=json.loads(json.loads(request.content)['messages'][1]['content'])
            evidence=content['sources'][0]['evidence'][0]
            assert evidence['reading_text']=='Constraints for GQA: number_of_heads_query % number_of_heads_key_value == 0 and, number_of_heads_key == number_of_heads_value'
            assert evidence['excerpt']==raw
        return await original(c,request,**kwargs)
    monkeypatch.setattr(httpx.AsyncClient,'send',external)
    result=ask(client,question='What are the GQA head-count constraints?')
    assert result.status_code==200,result.text
    assert result.json()['references'][0]['passage']['excerpt']==raw


def test_oversized_model_claim_returns_a_safe_generation_error(assistant_client):
    client, state = assistant_client
    state['draft']['claims'][0]['text'] = 'x' * 601
    result = ask(client)
    assert result.status_code == 503
    assert result.json()['detail'] == 'The assistant could not produce a grounded answer. Check provider setup or retry.'


@pytest.mark.parametrize('cite_both', [True, False])
def test_declared_source_comparison_requires_evidence_from_both_sources(assistant_client, cite_both):
    client, state = assistant_client
    other = json.loads(json.dumps(state['rows'][0]))
    other.update(source_id='44444444-4444-4444-8444-444444444444', scope='library', title='Second source')
    state['rows'].append(other)
    state['draft']['claims'][0].update(comparison_source_keys=['source1', 'source2'])
    state['cite_each_source'] = cite_both
    result = ask(client, question='Compare the two sources.', library=True)
    assert result.status_code == (200 if cite_both else 503)
    if cite_both:
        assert {r['source_id'] for r in result.json()['references']} == {SOURCE, '44444444-4444-4444-8444-444444444444'}
        assert set(result.json()['claims'][0]) == {'text', 'reference_ids'}


def test_model_receives_claim_level_uncertainty_and_comparison_requirements(assistant_client, monkeypatch):
    client, state = assistant_client
    original = httpx.AsyncClient.send
    observed = []
    async def external(c, request, **kwargs):
        if request.url.path == '/v1/chat/completions':
            body = json.loads(request.content)
            observed.append(body)
        return await original(c, request, **kwargs)
    monkeypatch.setattr(httpx.AsyncClient, 'send', external)
    result = ask(client)
    assert result.status_code == 200
    instruction = observed[0]['messages'][0]['content']
    assert 'one independently checkable statement' in instruction
    assert 'authors suspect' in instruction
    assert 'comparison_source_keys' in instruction
    assert 'Do not fill the eight-claim limit' in instruction
    assert 'The authors suspect X causes Y' in instruction
    final_instruction = observed[0]['messages'][-1]
    assert final_instruction['role'] == 'system'
    assert 'Keep may/could/suspect/hypothesize' in final_instruction['content']
    context = json.loads(observed[0]['messages'][1]['content'])
    assert context['sources'][0]['source_key'] == 'source1'
    assert context['sources'][0]['source_kind'] == 'article'


def test_private_source_labels_cannot_leak_into_answer_prose(assistant_client):
    client, state = assistant_client
    state['draft']['claims'][0]['text'] = 'source1 suggests an improvement.'
    assert ask(client).status_code == 503


def test_provider_request_requires_every_claim_field_in_strict_schema(assistant_client):
    client, state = assistant_client
    assert ask(client).status_code == 200
    request = next(r for r in state['calls'] if r.url.path == '/v1/chat/completions')
    function = json.loads(request.content)['tools'][0]['function']
    assert function['strict'] is True
    claim = function['parameters']['properties']['claims']['items']
    assert set(claim['required']) == set(claim['properties'])
    assert 'comparison_source_keys' in claim['required']
    alternatives = claim['properties']['comparison_source_keys']['anyOf']
    assert alternatives[0]['maxItems'] == 0
    assert alternatives[1]['minItems'] == 2


def test_private_source_labels_cannot_leak_into_unsupported_gap(assistant_client):
    client, state = assistant_client
    state['draft'] = {'status': 'unsupported', 'claims': [], 'gap': 'source1 does not give a numerical benchmark.'}
    assert ask(client).status_code == 503


def test_redundant_cited_source_marker_becomes_badges_without_changing_the_claim(assistant_client):
    client, state = assistant_client
    state['draft']['claims'][0]['text'] = 'It retrieves saved evidence (source1: ref1).'
    result = ask(client)
    assert result.status_code == 200
    assert result.json()['claims'][0]['text'] == 'RAG: “'+TEXT+'”'
    assert result.json()['claims'][0]['reference_ids'] == [SOURCE + ':p0001']


def test_model_receives_literal_uncertainty_markers_from_captured_evidence(assistant_client):
    client, state = assistant_client
    state['rows'][0]['captured_text'] = TEXT + '\nWe suspect saved evidence may improve answer support, but this is a hypothesis.'
    assert ask(client).status_code == 200
    request = next(r for r in state['calls'] if r.url.path == '/v1/chat/completions')
    context = json.loads(json.loads(request.content)['messages'][1]['content'])
    tentative = next(p for p in context['sources'][0]['evidence'] if 'We suspect' in p['excerpt'])
    assert tentative['uncertainty_terms'] == ['We suspect', 'may']


def test_comma_separated_cited_source_marker_becomes_a_badge(assistant_client):
    client, state = assistant_client
    state['draft']['claims'][0]['text'] = 'It retrieves saved evidence (source1, ref1).'
    result = ask(client)
    assert result.status_code == 200
    assert result.json()['claims'][0]['text'] == 'RAG: “'+TEXT+'”'


def test_unverified_paraphrase_returns_the_complete_cited_wording_with_its_qualifier(assistant_client):
    client, state = assistant_client
    original = 'The authors suspect that larger inputs may reduce the observed gradients. This is a proposed explanation, not a demonstrated training benefit.'
    row = state['rows'][0]
    row['captured_text'] = original
    row['note'] = json.loads(json.dumps(NOTE))
    row['note']['references'][0].update(end=len(original), excerpt=original)
    state['draft']['claims'][0]['text'] = 'Larger inputs ensure effective training and stable performance.'
    result = ask(client, question='Why do the gradients change?')
    assert result.status_code == 200
    answer = result.json()
    assert answer['claims'][0]['text'] == 'RAG: “' + original + '”'
    assert 'ensure effective training' not in answer['claims'][0]['text']
    assert answer['references'][0]['passage']['excerpt'] == original
    assert answer['claims'][0]['reference_ids'] == [SOURCE + ':p0001']


def test_nine_short_source_quotes_fit_the_answer_without_losing_a_compared_source(assistant_client):
    client, state = assistant_client
    for i in range(8):
        row = json.loads(json.dumps(state['rows'][0]))
        row.update(source_id=f'{i+4:08d}-4444-4444-8444-444444444444', scope='topic' if i<4 else 'library', title=f'Library source {i+1}')
        state['rows'].append(row)
    state['cite_each_source'] = True
    state['draft']['claims'][0]['comparison_source_keys'] = [f'source{i}' for i in range(1,10)]
    result = ask(client, question='Compare the nine source explanations.', topic_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', library=True)
    assert result.status_code == 200
    answer = result.json()
    assert len(answer['claims']) <= 8
    assert len(answer['references']) == 9
    assert {r['source_id'] for r in answer['references']} == {r['source_id'] for r in state['rows']}
    assert all(len(c['text']) <= 2000 for c in answer['claims'])


def test_bounded_quotes_explain_when_a_comparison_cannot_include_every_source(assistant_client):
    client, state = assistant_client
    original = ('A detailed explanation with its necessary conditions. ' * 20)[:1000]
    first = state['rows'][0]
    first.update(title='Source title ' * 15, captured_text=original)
    first['note'] = json.loads(json.dumps(NOTE))
    first['note']['references'][0].update(end=len(original), excerpt=original)
    for i in range(8):
        row = json.loads(json.dumps(first))
        row.update(source_id=f'{i+4:08d}-4444-4444-8444-444444444444', scope='topic' if i<4 else 'library')
        state['rows'].append(row)
    state['cite_each_source'] = True
    state['draft']['claims'][0]['comparison_source_keys'] = [f'source{i}' for i in range(1,10)]
    result = ask(client, question='Compare the nine source explanations.', topic_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', library=True)
    assert result.status_code == 200
    answer = result.json()
    assert answer['status'] == 'unsupported'
    assert answer['claims'] == []
    assert answer['references'] == []
    assert 'fewer sources' in answer['gap']
    assert answer['partial'] is True
