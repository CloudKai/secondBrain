"""Bounded Search → Fetch verification. Discovery never writes saved material."""
import asyncio
import json
from urllib.parse import urlsplit
import httpx
from pydantic import BaseModel, Field, ValidationError
from backend.source_capture import public_source_address, canonical_source_url
from backend.research_models import ResearchResource, ResearchResults

class ResearchFailure(ValueError):
    """A bounded provider diagnostic, safe to log without source/query content."""

class SearchHit(BaseModel):
    url: str = Field(max_length=2048)
    title: str = Field(min_length=1, max_length=1000)
    snippet: str = Field(default='', max_length=5000)
    authors: list[str] = Field(default_factory=list, max_length=20)
    year: int | None = Field(default=None, ge=1000, le=9999)
    venue: str | None = Field(default=None, max_length=1000)

class SearchPage(BaseModel):
    results: list[SearchHit] = Field(max_length=20)

class FetchedPage(BaseModel):
    url: str = Field(max_length=2048)
    final_url: str = Field(max_length=2048)
    title: str | None = Field(default=None, max_length=2000)
    text: str = Field(max_length=1_000_000)
    author: str | None = Field(default=None, max_length=1000)
    published_date: str | None = Field(default=None, max_length=100)

class FetchPage(BaseModel):
    results: list[FetchedPage] = Field(max_length=10)

# Only these known first-party documentation hosts receive that designation.
DOCUMENTATION_HOSTS = {'docs.python.org', 'developer.mozilla.org', 'learn.microsoft.com', 'docs.github.com', 'docs.aws.amazon.com', 'cloud.google.com', 'docs.langchain.com', 'docs.llamaindex.ai', 'platform.openai.com', 'developers.openai.com', 'docs.pytorch.org', 'pytorch.org', 'docs.tinyfish.ai', 'supabase.com'}

def resource_kind(hit: SearchHit, paper: bool) -> str:
    host = (urlsplit(hit.url).hostname or '').lower()
    if host in DOCUMENTATION_HOSTS:
        return 'documentation'
    if host.endswith(('.edu', '.ac.uk', '.edu.au', '.edu.sg')):
        return 'teaching'
    return 'paper' if paper or host in {'arxiv.org', 'proceedings.neurips.cc', 'openreview.net', 'aclanthology.org'} else 'article'

async def safe_url(value: str) -> str:
    if len(value) > 2048:
        raise ValueError('url')
    url = httpx.URL(value)
    await public_source_address(url)
    return canonical_source_url(str(url))

async def provider_json(client: httpx.AsyncClient, method: str, host: str, key: str, **kwargs) -> dict:
    async with client.stream(method, host, headers={'X-API-Key': key, 'Accept-Encoding': 'identity'}, timeout=httpx.Timeout(25, connect=7), **kwargs) as response:
        response.raise_for_status()
        if response.headers.get('content-encoding', 'identity').lower() != 'identity':
            raise ResearchFailure('encoded_response')
        content = bytearray()
        async for chunk in response.aiter_bytes(chunk_size=65536):
            if len(content) + len(chunk) > 2_000_000:
                raise ResearchFailure('response_limit')
            content.extend(chunk)
        value = json.loads(content)
        if not isinstance(value, dict):
            raise ResearchFailure('invalid_response')
        return value

async def discover_resources(client: httpx.AsyncClient, query: str, key: str) -> ResearchResults:
    if not key or key == 'replace-me':
        raise ResearchFailure('configuration')
    try:
        async with asyncio.timeout(60):
            pages = await asyncio.gather(*[
                provider_json(client, 'GET', 'https://api.search.tinyfish.ai', key, params={'query': query if paper else query + ' official documentation university teaching material', 'domain_type': 'research_paper' if paper else 'web', 'language': 'en'})
                for paper in (True, False)
            ], return_exceptions=True)
            candidates: dict[str, tuple[SearchHit, str]] = {}
            partial = any(isinstance(p, Exception) for p in pages)
            for paper, page in zip((True, False), pages):
                if isinstance(page, Exception):
                    continue
                for hit in SearchPage.model_validate(page).results:
                    try:
                        url = await safe_url(hit.url)
                    except (ValueError, httpx.InvalidURL):
                        partial = True
                        continue
                    candidates.setdefault(url, (hit, resource_kind(hit, paper)))
            if not candidates:
                if partial:
                    raise ResearchFailure('search_unavailable')
                return ResearchResults(query=query, resources=[], partial=False)
            priority = {'documentation': 0, 'teaching': 1, 'paper': 2, 'article': 3}
            selected = sorted(candidates, key=lambda url: priority[candidates[url][1]])[:6]
            fetched = FetchPage.model_validate(await provider_json(client, 'POST', 'https://api.fetch.tinyfish.ai', key, json={'urls': selected, 'format': 'markdown', 'ttl': 0, 'per_url_timeout_ms': 15000, 'page_metadata': True}))
            verified = {canonical_source_url(p.url): p for p in fetched.results}
            resources: dict[str, ResearchResource] = {}
            for url in selected:
                page = verified.get(url)
                if not page or len(page.text.strip()) < 40:
                    partial = True
                    continue
                try:
                    final = await safe_url(page.final_url)
                    if (urlsplit(final).hostname or "").removeprefix("www.") != (urlsplit(url).hostname or "").removeprefix("www."):
                        raise ValueError("publisher_changed")
                except (ValueError, httpx.InvalidURL):
                    partial = True
                    continue
                hit, kind = candidates[url]
                source_author = page.author.strip() if page.author else None
                authors = [source_author[:200]] if source_author else [a[:200] for a in hit.authors if a.strip()]
                date = page.published_date or (str(hit.year) if hit.year else None)
                from_source = bool(source_author or page.published_date)
                from_index = bool((not source_author and authors) or (not page.published_date and hit.year))
                host = urlsplit(final).hostname or ''
                preprint = 'preprint' in (hit.venue or '').lower() or host in {'arxiv.org', 'www.arxiv.org', 'biorxiv.org', 'www.biorxiv.org', 'medrxiv.org', 'www.medrxiv.org'}
                resources.setdefault(final, ResearchResource(url=final, title=(page.title or hit.title).strip()[:200] or hit.title[:200], authors=authors, organization=host[:200], date=date, kind=kind, capture_kind='pdf' if urlsplit(final).path.lower().endswith('.pdf') else 'article', publication_status='preprint' if preprint else 'unverified', metadata_origin='mixed' if from_source and from_index else 'source' if from_source else 'search_index', relevance=hit.snippet.strip()[:1000] or f'Returned by search for “{query}”. Inspect the original to judge relevance.'))
            return ResearchResults(query=query, resources=list(resources.values()), partial=partial)
    except ResearchFailure:
        raise
    except (httpx.HTTPError, ValueError, TypeError, ValidationError, TimeoutError) as exc:
        raise ResearchFailure('provider_response') from exc
