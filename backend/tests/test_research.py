"""Discovery through authenticated API and external Search/Fetch HTTP boundaries."""
import json
import httpx
import pytest
from fastapi.testclient import TestClient
from backend.main import app

HTTPClient = httpx.AsyncClient

ALICE = '11111111-1111-4111-8111-111111111111'

@pytest.fixture
def research_client(monkeypatch):
    monkeypatch.setenv('SUPABASE_URL', 'https://supabase.test')
    monkeypatch.setenv('SUPABASE_PUBLISHABLE_KEY', 'public-test')
    monkeypatch.setenv('TINYFISH_API_KEY', 'search-test')
    monkeypatch.setattr('socket.getaddrinfo', lambda *a, **k: [(2, 1, 6, '', ('93.184.216.34', 443))])
    state = {'calls': [], 'search': [{'title': 'A RAG study', 'url': 'https://arxiv.org/abs/2401.00001', 'snippet': 'A study of retrieval augmented generation.', 'authors': ['A. Learner'], 'year': 2024, 'venue': 'arXiv preprint'}], 'pages': [{'url': 'https://arxiv.org/abs/2401.00001', 'final_url': 'https://arxiv.org/abs/2401.00001', 'title': 'A RAG study', 'text': 'This paper studies retrieval augmented generation with an evaluation of factual answers.', 'author': None, 'published_date': None}], 'status': 200}
    def external(request):
        state['calls'].append(request)
        if request.url.host == 'supabase.test':
            if request.url.path == '/auth/v1/user':
                return httpx.Response(200 if request.headers.get('authorization') == 'Bearer alice' else 401, json={'id': ALICE})
            assert request.method == 'GET', 'Discovery must not mutate the library'
            return httpx.Response(200, json=[])
        assert 'authorization' not in request.headers and 'apikey' not in request.headers
        assert request.headers['x-api-key'] == 'search-test'
        if request.url.host == 'api.search.tinyfish.ai':
            return httpx.Response(state['status'], json={'results': state['search']})
        if request.url.host == 'api.fetch.tinyfish.ai':
            return httpx.Response(200, json={'results': state['pages'], 'errors': []})
        raise AssertionError(str(request.url))
    original = httpx.AsyncClient
    monkeypatch.setattr(httpx, 'AsyncClient', lambda **kw: original(**{**kw, 'transport': httpx.MockTransport(external)}))
    return TestClient(app), state

def discover(client, **body):
    return client.post('/api/v2/research', headers={'Authorization': 'Bearer alice'}, json={'query': 'retrieval augmented generation', **body})

def test_discovery_requires_a_learner_request_and_returns_verified_external_resources(research_client):
    client, state = research_client
    response = discover(client)
    assert response.status_code == 200, response.text
    data = response.json()
    assert data['query'] == 'retrieval augmented generation'
    assert len(data['resources']) == 1
    resource = data['resources'][0]
    assert resource['url'] == 'https://arxiv.org/abs/2401.00001'
    assert resource['title'] == 'A RAG study'
    assert resource['authors'] == ['A. Learner']
    assert resource['date'] == '2024'
    assert resource['metadata_origin'] == 'search_index'
    assert resource['publication_status'] == 'preprint'
    assert resource['capture_kind'] == 'article'
    assert data['resources'][0]['relevance'] == 'A study of retrieval augmented generation.'
    assert client.post('/api/v2/research', json={'query': 'RAG'}).status_code == 401
    assert client.post('/api/v2/research', headers={'Authorization':'Bearer bob'}, json={'query':'RAG'}).status_code == 401
    assert not any(r.url.path.startswith('/rest/v1') for r in state['calls'])

def test_redirects_cannot_turn_a_trusted_result_into_a_different_publisher(research_client):
    client, state = research_client
    state['pages'][0]['final_url'] = 'https://unrelated.test/advertisement'
    response = discover(client)
    assert response.status_code == 200
    assert response.json()['resources'] == []
    assert response.json()['partial'] is True

def test_missing_metadata_is_not_filled_with_invented_authors_or_dates(research_client):
    client, state = research_client
    state['search'] = [{'url':'https://docs.python.org/3/library/asyncio.html','title':'Asyncio docs'}]
    state['pages'] = [{'url':state['search'][0]['url'],'final_url':state['search'][0]['url'],'text':'Official documentation describing Python asynchronous I/O and tasks.'}]
    resource = discover(client).json()['resources'][0]
    assert resource['authors'] == []
    assert resource['date'] is None
    assert resource['organization'] == 'docs.python.org'
    assert resource['kind'] == 'documentation'
    assert resource['publication_status'] == 'unverified'
    assert 'Inspect the original' in resource['relevance']

@pytest.mark.parametrize('url', ['http://127.0.0.1/private','https://user:password@example.com/private','file:///etc/passwd','https://example.com:8443/private'])
def test_unsafe_search_links_never_reach_fetch(research_client, monkeypatch, url):
    client, state = research_client
    state['search'][0]['url'] = url
    monkeypatch.setattr('socket.getaddrinfo', lambda host,*a,**k: [(2,1,6,'',('127.0.0.1' if host == '127.0.0.1' else '93.184.216.34',443))])
    assert discover(client).status_code == 503
    assert not any(r.url.host == 'api.fetch.tinyfish.ai' for r in state['calls'])

@pytest.mark.parametrize('change', ['provider_outage','missing_key','blank','too_long','unowned_input','unverified_page','private_redirect'])
def test_discovery_errors_are_bounded_and_do_not_save_sources(research_client,monkeypatch,change):
    client,state=research_client
    payload={};expected=503
    if change=='provider_outage':state['status']=429
    if change=='missing_key':monkeypatch.delenv('TINYFISH_API_KEY')
    if change=='blank':payload={'query':'  '};expected=422
    if change=='too_long':payload={'query':'x'*501};expected=422
    if change=='unowned_input':payload={'user_id':ALICE};expected=422
    if change=='unverified_page':state['pages']=[];expected=200
    if change=='private_redirect':
        state['pages'][0]['final_url']='http://127.0.0.1/private';expected=200
        monkeypatch.setattr('socket.getaddrinfo',lambda host,*a,**k:[(2,1,6,'',('127.0.0.1' if host=='127.0.0.1' else '93.184.216.34',443))])
    response=discover(client,**payload)
    assert response.status_code==expected,response.text
    if expected==200:assert response.json()['resources']==[] and response.json()['partial']
    assert not any(r.url.path.startswith('/rest/v1') for r in state['calls'])

def test_results_are_prioritized_bounded_and_deduplicated_after_verification(research_client):
    client,state=research_client
    urls=['https://blog.test/rag','https://arxiv.org/abs/2401.00001','https://docs.python.org/3/library/asyncio.html','https://mit.edu/lecture.pdf']+[f'https://arxiv.org/abs/2401.0000{i}' for i in range(2,10)]
    state['search']=[{'url':url,'title':'A source about retrieval','snippet':'Retrieval evidence.'} for url in urls]
    state['pages']=[{'url':url,'final_url':url,'text':'This readable source discusses retrieval and learning from source material.'} for url in urls[:4]+urls[4:6]]
    response=discover(client)
    assert response.status_code==200,response.text
    resources=response.json()['resources']
    assert len(resources)==6
    assert resources[0]['url']=='https://docs.python.org/3/library/asyncio.html'
    assert resources[1]['capture_kind']=='pdf'
    assert len({r['url'] for r in resources})==6
    body=json.loads(next(r for r in state['calls'] if r.url.host=='api.fetch.tinyfish.ai').content)
    assert len(body['urls'])==6

def test_oversized_provider_response_returns_retry_without_exposing_provider_content(research_client):
    client,state=research_client
    state['pages'][0]['text']='x'*2_000_001
    response=discover(client)
    assert response.status_code==503
    assert 'No sources were saved' in response.json()['detail']
    assert len(response.text)<500

# Existing source API fixture supplies real capture/persistence behavior at HTTP seams.
from backend.tests.test_sources import browser_client

@pytest.mark.parametrize('pdf',[False,True])
def test_discovered_material_changes_the_owned_library_only_after_explicit_article_or_pdf_save(browser_client,monkeypatch,pdf):
    from backend.tests.test_pdf_sources import pdf_bytes
    monkeypatch.setenv('TINYFISH_API_KEY','search-test')
    url='https://pdf.test/study.pdf' if pdf else 'https://article.test/learning'
    original=HTTPClient.send
    async def external(client,request,**kw):
        if request.url.host=='api.search.tinyfish.ai':
            return httpx.Response(200,json={'results':[{'url':url,'title':'Discovered calculus'}]},request=request)
        if request.url.host=='api.fetch.tinyfish.ai':
            return httpx.Response(200,json={'results':[{'url':url,'final_url':url,'text':'This source describes calculus and how quantities change and accumulate.'}]},request=request)
        if request.url.path=='/study.pdf':
            return httpx.Response(200,headers={'content-type':'application/pdf'},stream=httpx.ByteStream(pdf_bytes()),request=request)
        return await original(client,request,**kw)
    monkeypatch.setattr(HTTPClient,'send',external)
    headers={'Authorization':'Bearer alice'}
    assert browser_client.get('/api/v2/sources',headers=headers).json()['sources']==[]
    found=discover(browser_client,query='Calculus')
    assert found.status_code==200,found.text
    assert found.json()['resources'][0]['capture_kind']==('pdf' if pdf else 'article')
    assert browser_client.get('/api/v2/sources',headers=headers).json()['sources']==[]
    saved=browser_client.post('/api/v2/sources/pdf-link' if pdf else '/api/v2/sources',headers=headers,json={'url':found.json()['resources'][0]['url'],'title':'Discovered calculus'})
    assert saved.status_code==201,saved.text
    source=saved.json()
    assert source['original_url']==url
    assert len(browser_client.get('/api/v2/sources',headers=headers).json()['sources'])==1
    assert browser_client.get('/api/v2/sources/'+source['id'],headers={'Authorization':'Bearer bob'}).status_code==404
    again=browser_client.post('/api/v2/sources/pdf-link' if pdf else '/api/v2/sources',headers=headers,json={'url':url,'title':'Discovered calculus'})
    assert again.json()['id']==source['id']
