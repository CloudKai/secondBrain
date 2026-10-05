import asyncio

import httpx
import pytest
from pydantic import ValidationError

from backend import graph
from backend.schemas import GraphEdge, GraphNode, GraphVisualization


def _nodes(*node_ids: str) -> list[GraphNode]:
    return [GraphNode(id=node_id, label=node_id) for node_id in node_ids]


def _edges(*pairs: tuple[str, str]) -> list[GraphEdge]:
    return [
        GraphEdge(id=f"edge-{index}", source=source, target=target)
        for index, (source, target) in enumerate(pairs)
    ]


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
        "diagram_type": "network",
        "diagram_options": ["network"],
        "nodes": [],
        "edges": [],
    }

    result = asyncio.run(
        graph.ingest_node(
            state, {"configurable": {"source_url": source_url}}
        )
    )

    assert result == {"raw_text": shared_text.strip()}


def test_tree_graph_offers_every_diagram_type() -> None:
    nodes = _nodes("root", "left", "right")
    edges = _edges(("root", "left"), ("root", "right"))

    assert graph.compatible_diagram_types(nodes, edges) == [
        "flow",
        "hierarchy",
        "network",
    ]


def test_non_tree_dag_offers_flow_and_network() -> None:
    nodes = _nodes("start", "left", "right", "finish")
    edges = _edges(
        ("start", "left"),
        ("start", "right"),
        ("left", "finish"),
        ("right", "finish"),
    )

    assert graph.compatible_diagram_types(nodes, edges) == ["flow", "network"]
    assert graph.normalize_diagram_type("hierarchy", ["flow", "network"]) == "flow"


def test_cycle_falls_back_to_network() -> None:
    nodes = _nodes("one", "two")
    edges = _edges(("one", "two"), ("two", "one"))
    options = graph.compatible_diagram_types(nodes, edges)

    assert options == ["network"]
    assert graph.normalize_diagram_type("flow", options) == "network"


def test_graph_visualization_rejects_duplicate_node_ids() -> None:
    with pytest.raises(ValidationError, match="Graph node IDs must be unique"):
        GraphVisualization.model_validate(
            {
                "diagram_type": "network",
                "nodes": [
                    {"id": "same", "label": "One"},
                    {"id": "same", "label": "Two"},
                ],
                "edges": [
                    {"id": "edge", "source": "same", "target": "same"}
                ],
            }
        )


def test_graph_visualization_rejects_dangling_edges() -> None:
    with pytest.raises(ValidationError, match="must reference an existing node"):
        GraphVisualization.model_validate(
            {
                "diagram_type": "flow",
                "nodes": [
                    {"id": "one", "label": "One"},
                    {"id": "two", "label": "Two"},
                ],
                "edges": [
                    {"id": "edge", "source": "one", "target": "missing"}
                ],
            }
        )
