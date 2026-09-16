"""The LangGraph Deep Feynman processing pipeline."""

from __future__ import annotations

import os
from functools import lru_cache
from typing import TypedDict

import httpx
from bs4 import BeautifulSoup
from langchain_core.runnables import RunnableConfig
from langchain_openai import ChatOpenAI
from langgraph.graph import END, START, StateGraph

from backend.schemas import FeynmanSummary, GraphEdge, GraphNode, MermaidDiagram

MAX_DOWNLOAD_BYTES = 2_000_000
MAX_MODEL_INPUT_CHARS = 30_000


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


async def ingest_node(
    state: DeepFeynmanState, config: RunnableConfig
) -> dict[str, str]:
    """Download a web page and reduce it to useful, human-readable text."""

    del state  # This first node receives its input through LangGraph config.
    headers = {"User-Agent": "AI-Second-Brain/0.1 (+hackathon prototype)"}
    timeout = httpx.Timeout(15.0, connect=5.0)

    async with httpx.AsyncClient(
        follow_redirects=True, timeout=timeout, headers=headers
    ) as client:
        async with client.stream("GET", _source_url(config)) as response:
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
    document = bytes(body).decode(encoding, errors="replace")
    if "text/html" in content_type:
        soup = BeautifulSoup(document, "html.parser")
        for element in soup(["script", "style", "noscript", "svg", "nav", "footer"]):
            element.decompose()
        raw_text = "\n".join(soup.stripped_strings)
    else:
        raw_text = document.strip()

    if not raw_text:
        raise ValueError("No readable text was found at the URL")
    return {"raw_text": raw_text[:MAX_MODEL_INPUT_CHARS]}


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
