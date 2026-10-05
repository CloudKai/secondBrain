"""The LangGraph Deep Feynman processing pipeline."""

from __future__ import annotations

import os
from functools import lru_cache
from typing import TypedDict
from urllib.parse import quote

import httpx
from bs4 import BeautifulSoup
from langchain_core.runnables import RunnableConfig
from langchain_openai import ChatOpenAI
from langgraph.graph import END, START, StateGraph

from backend.schemas import (
    DiagramType,
    FeynmanSummary,
    GraphEdge,
    GraphNode,
    GraphVisualization,
)

MAX_DOWNLOAD_BYTES = 2_000_000
MAX_MODEL_INPUT_CHARS = 30_000
MIN_USEFUL_TEXT_CHARS = 120
READER_BASE_URL = "https://r.jina.ai/"


class DeepFeynmanState(TypedDict):
    """Values passed between every node in the graph."""

    raw_text: str
    simplified_summary: str
    diagram_type: DiagramType
    diagram_options: list[DiagramType]
    nodes: list[GraphNode]
    edges: list[GraphEdge]


@lru_cache(maxsize=1)
def _model() -> ChatOpenAI:
    """Create the model lazily so the API can boot before a key is configured."""

    return ChatOpenAI(
        model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        temperature=0,
        api_key=os.getenv("OPENAI_API_KEY"),
    )


def _source_url(config: RunnableConfig) -> str:
    url = config.get("configurable", {}).get("source_url")
    if not isinstance(url, str) or not url:
        raise ValueError("The graph requires configurable.source_url")
    return url


async def _download_text(
    client: httpx.AsyncClient,
    url: str,
    *,
    headers: dict[str, str] | None = None,
) -> tuple[str, str]:
    """Download a bounded text response and return its body and content type."""

    async with client.stream("GET", url, headers=headers) as response:
        response.raise_for_status()
        content_type = response.headers.get("content-type", "").lower()
        if not any(kind in content_type for kind in ("text/html", "text/plain")):
            raise ValueError(f"Unsupported content type: {content_type or 'unknown'}")

        body = bytearray()
        async for chunk in response.aiter_bytes():
            body.extend(chunk)
            if len(body) > MAX_DOWNLOAD_BYTES:
                raise ValueError("Page exceeds the 2 MB download limit")

    encoding = response.encoding or "utf-8"
    return bytes(body).decode(encoding, errors="replace"), content_type


def _extract_readable_text(document: str, content_type: str) -> str:
    if "text/html" not in content_type:
        return document.strip()

    soup = BeautifulSoup(document, "html.parser")
    for element in soup(
        ["script", "style", "noscript", "svg", "nav", "footer", "header"]
    ):
        element.decompose()
    return "\n".join(soup.stripped_strings)


def _reader_url(source_url: str) -> str:
    """Build Jina Reader's browser-rendered fallback URL without double encoding."""

    return f"{READER_BASE_URL}{quote(source_url, safe=':/?&=%@+,-._~')}"


async def _fetch_source_text(source_url: str) -> str:
    """Fetch directly first, then use a rendered reader for blocked/dynamic pages."""

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/128.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }
    timeout = httpx.Timeout(25.0, connect=7.0)

    async with httpx.AsyncClient(
        follow_redirects=True, timeout=timeout, headers=headers
    ) as client:
        direct_error: Exception | None = None
        try:
            document, content_type = await _download_text(client, source_url)
            readable = _extract_readable_text(document, content_type)
            if len(readable) >= MIN_USEFUL_TEXT_CHARS:
                return readable[:MAX_MODEL_INPUT_CHARS]
        except (httpx.HTTPError, ValueError) as exc:
            direct_error = exc

        try:
            document, content_type = await _download_text(
                client,
                _reader_url(source_url),
                headers={
                    "User-Agent": "AI-Second-Brain/1.0",
                    "Accept": "text/plain",
                },
            )
            readable = _extract_readable_text(document, content_type)
            if readable:
                return readable[:MAX_MODEL_INPUT_CHARS]
        except (httpx.HTTPError, ValueError):
            if direct_error is not None:
                raise direct_error
            raise

    raise ValueError("No readable text was found at the URL")


async def ingest_node(
    state: DeepFeynmanState, config: RunnableConfig
) -> dict[str, str]:
    """Download a web page and reduce it to useful, human-readable text."""

    source_url = _source_url(config)
    try:
        raw_text = await _fetch_source_text(source_url)
    except (httpx.HTTPError, ValueError):
        shared_text = state["raw_text"].strip()
        text_without_url = shared_text.replace(source_url, "").strip()
        if len(text_without_url) < MIN_USEFUL_TEXT_CHARS:
            raise
        raw_text = shared_text[:MAX_MODEL_INPUT_CHARS]
    return {"raw_text": raw_text}


async def feynman_simplifier_node(state: DeepFeynmanState) -> dict[str, str]:
    """Explain the source as exactly four beginner-friendly bullet points."""

    structured_model = _model().with_structured_output(FeynmanSummary)
    result = await structured_model.ainvoke(
        [
            (
                "system",
                "You are a Feynman-style teacher. Explain the source in plain, "
                "concrete language for a curious beginner. Remove or define jargon. "
                "Return exactly four concise, non-overlapping bullet point ideas.",
            ),
            ("human", f"Source text:\n\n{state['raw_text']}"),
        ]
    )
    return {
        "simplified_summary": "\n".join(
            f"- {bullet}" for bullet in result.bullet_points
        )
    }


def _is_acyclic(nodes: list[GraphNode], edges: list[GraphEdge]) -> bool:
    """Return whether the directed graph can be topologically ordered."""

    adjacency = {node.id: [] for node in nodes}
    indegree = {node.id: 0 for node in nodes}
    for edge in edges:
        adjacency[edge.source].append(edge.target)
        indegree[edge.target] += 1

    queue = sorted(node_id for node_id, degree in indegree.items() if degree == 0)
    visited = 0
    while queue:
        node_id = queue.pop(0)
        visited += 1
        for target in adjacency[node_id]:
            indegree[target] -= 1
            if indegree[target] == 0:
                queue.append(target)
                queue.sort()
    return visited == len(nodes)


def _is_hierarchy(nodes: list[GraphNode], edges: list[GraphEdge]) -> bool:
    """Return whether the graph is one connected, directed rooted tree."""

    if len(edges) != len(nodes) - 1 or not _is_acyclic(nodes, edges):
        return False

    indegree = {node.id: 0 for node in nodes}
    adjacency = {node.id: [] for node in nodes}
    for edge in edges:
        indegree[edge.target] += 1
        adjacency[edge.source].append(edge.target)

    roots = [node_id for node_id, degree in indegree.items() if degree == 0]
    if len(roots) != 1 or any(
        degree != 1 for node_id, degree in indegree.items() if node_id != roots[0]
    ):
        return False

    reachable: set[str] = set()
    pending = [roots[0]]
    while pending:
        node_id = pending.pop()
        if node_id in reachable:
            continue
        reachable.add(node_id)
        pending.extend(adjacency[node_id])
    return len(reachable) == len(nodes)


def compatible_diagram_types(
    nodes: list[GraphNode], edges: list[GraphEdge]
) -> list[DiagramType]:
    """Derive safe presentation choices from validated graph structure."""

    options: list[DiagramType] = []
    if _is_acyclic(nodes, edges):
        options.append("flow")
    if _is_hierarchy(nodes, edges):
        options.append("hierarchy")
    options.append("network")
    return options


def normalize_diagram_type(
    preferred: DiagramType, options: list[DiagramType]
) -> DiagramType:
    if preferred in options:
        return preferred
    if "flow" in options:
        return "flow"
    return "network"


async def graph_visualizer_node(state: DeepFeynmanState) -> dict[str, object]:
    """Turn the explanation into a typed graph with an adaptive presentation."""

    structured_model = _model().with_structured_output(GraphVisualization)
    result = await structured_model.ainvoke(
        [
            (
                "system",
                "Convert the summary into a concise semantic graph with typed nodes "
                "and directional edges. Give every node and edge a unique simple ID, "
                "use short concrete labels, and make every edge reference existing "
                "nodes. Choose diagram_type='flow' for sequences, pipelines, or "
                "cause-and-effect; 'hierarchy' for taxonomies and part-whole trees; "
                "or 'network' for interconnected or cyclic concepts.",
            ),
            ("human", f"Summary:\n\n{state['simplified_summary']}"),
        ]
    )
    options = compatible_diagram_types(result.nodes, result.edges)
    return {
        "diagram_type": normalize_diagram_type(result.diagram_type, options),
        "diagram_options": options,
        "nodes": result.nodes,
        "edges": result.edges,
    }


def build_graph():
    builder = StateGraph(DeepFeynmanState)
    builder.add_node("ingest", ingest_node)
    builder.add_node("feynman_simplifier", feynman_simplifier_node)
    builder.add_node("graph_visualizer", graph_visualizer_node)
    builder.add_edge(START, "ingest")
    builder.add_edge("ingest", "feynman_simplifier")
    builder.add_edge("feynman_simplifier", "graph_visualizer")
    builder.add_edge("graph_visualizer", END)
    return builder.compile()


deep_feynman_graph = build_graph()
