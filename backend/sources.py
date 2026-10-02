"""Owned browser sources stored through the learner's Supabase token and RLS."""

import json
import logging
import os
import hashlib
import asyncio
from collections.abc import AsyncIterator
from typing import Literal
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Response, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import ValidationError

from backend.source_capture import canonical_source_url, capture_article
from backend.source_models import (
    CapturedSource,
    CaptureSourceRequest,
    CapturePDFLinkRequest,
    SourcePage,
)
from backend.pdf_capture import capture_pdf, capture_pdf_link, MAX_PDF_BYTES

router = APIRouter(prefix="/api/v2/sources", tags=["browser sources"])
bearer = HTTPBearer(auto_error=False)
logger = logging.getLogger(__name__)


class SourceGateway:
    def __init__(self, client: httpx.AsyncClient, project_url: str, public_key: str):
        self.client = client
        self.project_url = project_url.rstrip("/")
        self.public_key = public_key
        self.user_id: UUID | None = None
        self.headers: dict[str, str] = {}

    async def authenticate(self, token: str) -> None:
        self.headers = {"apikey": self.public_key, "Authorization": f"Bearer {token}"}
        response = None
        try:
            response = await self.client.get(
                f"{self.project_url}/auth/v1/user", headers=self.headers
            )
            if response.status_code in (401, 403):
                raise HTTPException(
                    401, "Your session expired. Retry connecting your library."
                )
            response.raise_for_status()
            self.user_id = UUID(response.json()["id"])
        except HTTPException:
            raise
        except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
            logger.warning(
                "Source authentication failed: %s (upstream status=%s)",
                type(exc).__name__,
                response.status_code if response else None,
            )
            raise HTTPException(
                503, "The library session could not be verified. Try again."
            ) from exc

    async def request(
        self, method: str, params: dict, body: dict | None = None
    ) -> list[CapturedSource]:
        response = None
        try:
            response = await self.client.request(
                method,
                f"{self.project_url}/rest/v1/sources",
                headers={
                    **self.headers,
                    "Prefer": "resolution=ignore-duplicates,return=representation",
                },
                params=params
                if method == "POST"
                else {**params, "user_id": f"eq.{self.user_id}"},
                json=body,
            )
            if response.status_code in (401, 403):
                raise HTTPException(
                    401, "Your library session is unavailable. Retry connecting."
                )
            response.raise_for_status()
            values = response.json()
            if not isinstance(values, list):
                raise ValueError("Invalid source list")
            sources = [
                CapturedSource.model_validate_json(json.dumps(value))
                for value in values
            ]
            if any(source.user_id != self.user_id for source in sources):
                raise ValueError("Unowned source returned")
            return sources
        except HTTPException:
            raise
        except (httpx.HTTPError, ValueError, ValidationError) as exc:
            logger.warning(
                "Source storage %s failed: %s (upstream status=%s)",
                method,
                type(exc).__name__,
                response.status_code if response else None,
            )
            raise HTTPException(
                503, "Your sources could not be saved or loaded. Try again."
            ) from exc

    async def find(self, **filters: str) -> CapturedSource | None:
        sources = await self.request("GET", {"select": "*", "limit": "1", **filters})
        return sources[0] if sources else None


async def owned_sources(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> AsyncIterator[SourceGateway]:
    if credentials is None:
        raise HTTPException(401, "A library session is required.")
    project_url = os.getenv("SUPABASE_URL", "")
    public_key = os.getenv("SUPABASE_PUBLISHABLE_KEY", "")
    if not project_url or not public_key:
        raise HTTPException(503, "Library storage is not configured yet.")
    async with httpx.AsyncClient(timeout=10, trust_env=False) as client:
        gateway = SourceGateway(client, project_url, public_key)
        await gateway.authenticate(credentials.credentials)
        yield gateway


@router.post("", response_model=CapturedSource, status_code=201)
async def save_source(
    payload: CaptureSourceRequest,
    gateway: SourceGateway = Depends(owned_sources),
) -> CapturedSource:
    original_url = str(payload.url)
    canonical_url = canonical_source_url(original_url)
    existing = await gateway.find(canonical_url=f"eq.{canonical_url}")
    if existing:
        return existing
    try:
        capture = await capture_article(original_url, payload.raw_text)
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("Article capture failed: %s", type(exc).__name__)
        raise HTTPException(
            422,
            str(exc)
            if isinstance(exc, ValueError)
            else "The article could not be captured. Use a public article URL or paste its text.",
        ) from exc
    rows = await gateway.request(
        "POST",
        {"select": "*", "on_conflict": "user_id,canonical_url"},
        {
            "user_id": str(gateway.user_id),
            "original_url": original_url,
            "canonical_url": canonical_url,
            "title": payload.title.strip() or payload.url.host,
            "study_status": "pending",
            **capture,
        },
    )
    source = (
        rows[0] if rows else await gateway.find(canonical_url=f"eq.{canonical_url}")
    )
    if source is None:
        raise HTTPException(
            503, "The source could not be confirmed as saved. Try again."
        )
    return source


@router.post("/pdf", response_model=CapturedSource, status_code=201)
async def save_pdf_upload(
    request: Request,
    filename: str = Query(min_length=1, max_length=200),
    title: str = Query(default="", max_length=200),
    gateway: SourceGateway = Depends(owned_sources),
) -> CapturedSource:
    data = bytearray()
    try:
        async with asyncio.timeout(30):
            async for chunk in request.stream():
                if len(data) + len(chunk) > MAX_PDF_BYTES:
                    raise HTTPException(
                        413, "PDFs must be 10 MB or smaller. Export a smaller document."
                    )
                data.extend(chunk)
    except TimeoutError as exc:
        raise HTTPException(
            408, "The PDF upload timed out. Try a smaller file or retry the connection."
        ) from exc
    identity = "urn:pdf:sha256:" + hashlib.sha256(data).hexdigest()
    existing = await gateway.find(canonical_url=f"eq.{identity}")
    if existing:
        return existing
    try:
        capture = await capture_pdf(bytes(data), filename)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    return await persist_pdf(
        gateway, None, identity, title.strip() or filename, capture, "upload"
    )


async def persist_pdf(
    gateway: SourceGateway,
    original_url: str | None,
    identity: str,
    title: str,
    capture: dict,
    origin: Literal["direct", "upload"],
) -> CapturedSource:
    rows = await gateway.request(
        "POST",
        {"select": "*", "on_conflict": "user_id,canonical_url"},
        {
            "user_id": str(gateway.user_id),
            "original_url": original_url,
            "canonical_url": identity,
            "title": title,
            "source_kind": "pdf",
            "capture_origin": origin,
            "study_status": "pending",
            **capture,
        },
    )
    source = rows[0] if rows else await gateway.find(canonical_url=f"eq.{identity}")
    if source is None:
        raise HTTPException(503, "The PDF could not be confirmed as saved. Try again.")
    return source


@router.post("/pdf-link", response_model=CapturedSource, status_code=201)
async def save_pdf_link(
    payload: CapturePDFLinkRequest,
    gateway: SourceGateway = Depends(owned_sources),
) -> CapturedSource:
    original = str(payload.url)
    identity = canonical_source_url(original)
    existing = await gateway.find(canonical_url=f"eq.{identity}")
    if existing:
        return existing
    try:
        capture = await capture_pdf_link(identity)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    return await persist_pdf(
        gateway,
        original,
        identity,
        payload.title.strip() or payload.url.host,
        capture,
        "direct",
    )


@router.get("", response_model=SourcePage)
async def list_sources(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    gateway: SourceGateway = Depends(owned_sources),
) -> SourcePage:
    sources = await gateway.request(
        "GET",
        {
            "select": "*",
            "order": "captured_at.desc,id.desc",
            "limit": str(limit + 1),
            "offset": str(offset),
        },
    )
    return SourcePage(
        sources=sources[:limit],
        next_offset=offset + limit if len(sources) > limit else None,
    )


@router.get("/{source_id}", response_model=CapturedSource)
async def get_source(
    source_id: UUID, gateway: SourceGateway = Depends(owned_sources)
) -> CapturedSource:
    source = await gateway.find(id=f"eq.{source_id}")
    if source is None:
        raise HTTPException(404, "Source not found.")
    return source


@router.delete("/{source_id}", status_code=204)
async def delete_source(
    source_id: UUID, gateway: SourceGateway = Depends(owned_sources)
) -> Response:
    removed = await gateway.request("DELETE", {"id": f"eq.{source_id}", "select": "*"})
    if not removed:
        raise HTTPException(404, "Source not found.")
    return Response(status_code=204)
