"""FastAPI entry point for the AI Second Brain backend."""

import httpx
from fastapi import FastAPI, HTTPException, status

from backend.graph import DeepFeynmanState, deep_feynman_graph
from backend.schemas import ProcessLinkRequest, ProcessLinkResponse

app = FastAPI(
    title="AI Second Brain API",
    version="0.1.0",
    description="Turns shared links into Feynman summaries and Mermaid diagrams.",
)


@app.get("/health", tags=["system"])
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post(
    "/api/v1/process-link",
    response_model=ProcessLinkResponse,
    status_code=status.HTTP_200_OK,
    tags=["knowledge"],
)
async def process_link(payload: ProcessLinkRequest) -> ProcessLinkResponse:
    initial_state: DeepFeynmanState = {
        "raw_text": payload.raw_text or "",
        "simplified_summary": "",
        "mermaid_code": "",
        "nodes": [],
        "edges": [],
    }

    try:
        result = await deep_feynman_graph.ainvoke(
            initial_state,
            config={"configurable": {"source_url": str(payload.url)}},
        )
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Source URL returned HTTP {exc.response.status_code}",
        ) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The source URL could not be fetched",
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The AI processing pipeline failed",
        ) from exc

    return ProcessLinkResponse(
        folder_id=payload.folder_id,
        source_url=payload.url,
        raw_text=result["raw_text"],
        simplified_summary=result["simplified_summary"],
        mermaid_code=result["mermaid_code"],
        nodes=result["nodes"],
        edges=result["edges"],
    )
