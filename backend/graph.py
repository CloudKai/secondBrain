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

from backend.schemas import FeynmanSummary, GraphEdge, GraphNode, MermaidDiagram

MAX_DOWNLOAD_BYTES = 2_000_000
MAX_MODEL_INPUT_CHARS = 30_000
MIN_USEFUL_TEXT_CHARS = 120
READER_BASE_URL = "https://r.jina.ai/"


class DeepFeynmanState(TypedDict):
    """Values passed between every node in the graph."""

    raw_text: str
    simplified_summary: str
    mermaid_code: str
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


async def mermaid_visualizer_node(state: DeepFeynmanState) -> dict[str, object]:
    """Turn the explanation into Mermaid plus a typed interactive graph."""

    structured_model = _model().with_structured_output(MermaidDiagram)
    result = await structured_model.ainvoke(
        [
            (
                "system",
                "Convert the summary into valid Mermaid.js flowchart syntax. The "
                "first line must be exactly 'graph TD'. Use simple node IDs, concise "
                "labels, and directional edges. Also return the same graph as typed "
                "nodes and edges: every edge needs a unique ID and must reference "
                "existing node IDs. Do not include Markdown fences or styling.",
            ),
            ("human", f"Summary:\n\n{state['simplified_summary']}"),
        ]
    )
    return {
        "mermaid_code": result.mermaid_code,
        "nodes": result.nodes,
        "edges": result.edges,
    }


def build_graph():
    builder = StateGraph(DeepFeynmanState)
    builder.add_node("ingest", ingest_node)
    builder.add_node("feynman_simplifier", feynman_simplifier_node)
    builder.add_node("mermaid_visualizer", mermaid_visualizer_node)
    builder.add_edge(START, "ingest")
    builder.add_edge("ingest", "feynman_simplifier")
    builder.add_edge("feynman_simplifier", "mermaid_visualizer")
    builder.add_edge("mermaid_visualizer", END)
    return builder.compile()


deep_feynman_graph = build_graph()
