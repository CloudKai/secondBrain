import asyncio

import httpx

from backend import graph


def test_fetch_source_text_uses_reader_after_source_403(monkeypatch) -> None:
    source_url = "https://medium.com/example-article"
    calls: list[str] = []

    async def fake_download(client, url: str, **kwargs) -> tuple[str, str]:
        del client
        del kwargs
        calls.append(url)
        if url == source_url:
            request = httpx.Request("GET", source_url)
            response = httpx.Response(403, request=request)
            raise httpx.HTTPStatusError(
                "Source denied the request", request=request, response=response
            )
        return ("A browser-rendered article body that can be summarized.", "text/plain")

    monkeypatch.setattr(graph, "_download_text", fake_download)

    result = asyncio.run(graph._fetch_source_text(source_url))

    assert result == "A browser-rendered article body that can be summarized."
    assert calls == [source_url, f"https://r.jina.ai/{source_url}"]


def test_fetch_source_text_keeps_useful_direct_content(monkeypatch) -> None:
    source_url = "https://example.com/article"
    direct_content = "Useful article text. " * 12
    calls: list[str] = []

    async def fake_download(client, url: str, **kwargs) -> tuple[str, str]:
        del client
        del kwargs
        calls.append(url)
        return direct_content, "text/plain"

    monkeypatch.setattr(graph, "_download_text", fake_download)

    result = asyncio.run(graph._fetch_source_text(source_url))

    assert result == direct_content.strip()
    assert calls == [source_url]


def test_extract_readable_text_removes_page_chrome() -> None:
    document = """
    <html><body>
      <header>Site navigation</header>
      <main><h1>Clear title</h1><p>Useful explanation.</p></main>
      <footer>Copyright</footer>
      <script>ignored()</script>
    </body></html>
    """

    assert graph._extract_readable_text(document, "text/html") == (
        "Clear title\nUseful explanation."
    )


def test_ingest_uses_meaningful_shared_text_when_fetching_fails(monkeypatch) -> None:
    source_url = "https://example.com/article"
    shared_text = (
        "A shared article excerpt with enough meaningful detail to explain the "
        "topic even when the publisher blocks automated retrieval. " * 2
    )

    async def failed_fetch(url: str) -> str:
        request = httpx.Request("GET", url)
        response = httpx.Response(403, request=request)
        raise httpx.HTTPStatusError(
            "Source denied the request", request=request, response=response
        )

    monkeypatch.setattr(graph, "_fetch_source_text", failed_fetch)
    state: graph.DeepFeynmanState = {
        "raw_text": shared_text,
        "simplified_summary": "",
        "mermaid_code": "",
        "nodes": [],
        "edges": [],
    }

    result = asyncio.run(
        graph.ingest_node(
            state, {"configurable": {"source_url": source_url}}
        )
    )

    assert result == {"raw_text": shared_text.strip()}
