"""Owned capture comparison and explicit version promotion; no model calls here."""

import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, Path
from pydantic import Field, ValidationError

from backend.schemas import StrictModel
from backend.sources import SourceGateway, owned_sources, read_upload_body
from backend.source_models import CapturedSource
from backend.source_capture import capture_article
from backend.pdf_capture import capture_pdf, capture_pdf_link, MAX_PDF_BYTES
from backend.transcript_capture import capture_transcript, MAX_TRANSCRIPT_BYTES
from backend.youtube_capture import capture_youtube, TranscriptUnavailable
from backend.study_models import StudyRecord
from backend.topic_models import TopicAnalysis
from backend.topic_corrections import SourceAssignments

router = APIRouter(prefix="/api/v2/sources", tags=["source versions"])
logger = logging.getLogger(__name__)
WireUUID = Annotated[UUID, Field(strict=False)]


class CheckInput(StrictModel):
    raw_text: str | None = Field(default=None, max_length=30_000)


class RefreshInput(StrictModel):
    candidate_id: WireUUID
    expected_version: int = Field(ge=1, le=20)


class RevisionComparison(StrictModel):
    source_id: UUID
    base_version: int = Field(ge=1, le=20)
    candidate_id: UUID | None
    changed: bool
    current: CapturedSource
    replacement: CapturedSource | None


class VersionSummary(StrictModel):
    version: int = Field(ge=1, le=20)
    captured_at: datetime
    has_note: bool


class VersionHistory(StrictModel):
    source_id: UUID
    current_version: int = Field(ge=1, le=20)
    versions: list[VersionSummary] = Field(max_length=19)
    correction_review: TopicAnalysis | None


class SavedVersion(StrictModel):
    source: CapturedSource
    study: StudyRecord | None


async def rpc(gateway: SourceGateway, name: str, body: dict):
    try:
        response = await gateway.client.post(
            gateway.project_url + "/rest/v1/rpc/" + name,
            headers=gateway.headers,
            json=body,
        )
        if response.is_error:
            code = response.json().get("code")
            if code == "P0002":
                raise HTTPException(
                    404,
                    "Source or comparison no longer available. Check for changes again.",
                )
            if code in ("40001", "23505"):
                raise HTTPException(
                    409,
                    "This source changed or the file belongs to another saved source. Reload and compare again.",
                )
            if code == "54000":
                raise HTTPException(
                    422, "This source has reached its 20-version limit."
                )
            if code == "22023":
                raise HTTPException(
                    422,
                    "Choose valid replacement material and current supporting passages.",
                )
            if code == "42501":
                raise HTTPException(
                    503,
                    "Source comparison is disabled or unavailable. Check the migration and retry.",
                )
            if response.status_code in (401, 403):
                raise HTTPException(
                    401, "Your library session is unavailable. Retry connecting."
                )
        response.raise_for_status()
        return response.json()
    except HTTPException:
        raise
    except (httpx.HTTPError, ValueError, TypeError, AttributeError) as exc:
        logger.warning("Source version storage failed: %s", type(exc).__name__)
        raise HTTPException(
            503, "Source versions are unavailable. Check the migration and retry."
        ) from exc


def validate_owned(value, schema, gateway):
    try:
        result = schema.model_validate_json(json.dumps(value))
        if isinstance(result, CapturedSource) and result.user_id != gateway.user_id:
            raise ValueError("Unowned source")
        if isinstance(result, SavedVersion) and (
            result.source.user_id != gateway.user_id
            or (
                result.study
                and (
                    result.study.user_id != gateway.user_id
                    or result.study.source_id != result.source.id
                    or result.study.source_version != result.source.source_version
                )
            )
        ):
            raise ValueError("Invalid saved version")
        return result
    except (ValueError, TypeError) as exc:
        raise HTTPException(
            503, "The saved version could not be verified. Retry loading."
        ) from exc


@router.post("/{source_id}/revision-check", response_model=RevisionComparison)
async def compare_source(
    source_id: UUID,
    request: Request,
    filename: str | None = Query(default=None, min_length=1, max_length=200),
    gateway: SourceGateway = Depends(owned_sources),
):
    source = await gateway.find(id=f"eq.{source_id}")
    if source is None:
        raise HTTPException(404, "Source not found.")
    identity = None
    mime = request.headers.get("content-type", "").split(";")[0]
    try:
        if mime == "application/json":
            data = await read_upload_body(
                request,
                200_000,
                "Comparison input is too large.",
                "Comparison input timed out.",
            )
            payload = CheckInput.model_validate_json(data)
            if source.source_kind == "article":
                capture = await capture_article(
                    str(source.original_url),
                    payload.raw_text,
                    prefer_pasted=payload.raw_text is not None,
                )
            elif payload.raw_text is not None:
                raise ValueError(
                    "Use a PDF file or a supplied transcript for this source."
                )
            elif source.source_kind == "pdf" and source.original_url:
                capture = await capture_pdf_link(str(source.original_url))
            elif (
                source.source_kind == "video"
                and source.transcript.provider == "youtube"
            ):
                capture = await capture_youtube(str(source.original_url))
            else:
                raise ValueError(
                    "Upload the replacement PDF or upload/paste a new recording transcript."
                )
        elif source.source_kind == "pdf" and source.original_url is None:
            data = await read_upload_body(
                request,
                MAX_PDF_BYTES,
                "PDFs must be 10 MB or smaller.",
                "PDF comparison timed out.",
            )
            if not filename:
                raise ValueError("Choose a replacement PDF file.")
            capture = await capture_pdf(data, filename)
            identity = "urn:pdf:sha256:" + hashlib.sha256(data).hexdigest()
        elif source.source_kind == "video":
            data = await read_upload_body(
                request,
                MAX_TRANSCRIPT_BYTES,
                "Transcripts must be 1 MB or smaller.",
                "Transcript comparison timed out.",
            )
            capture = capture_transcript(data, str(source.original_url), filename)
        else:
            raise ValueError("Use the supported comparison input for this source.")
        # Identity/title are inherited; only captured evidence can change.
        fields = {
            key: capture.get(key)
            for key in (
                "captured_text",
                "capture_origin",
                "coverage",
                "coverage_detail",
                "document",
                "transcript",
            )
        }
        replacement = CapturedSource.model_validate_json(
            json.dumps(
                {
                    **source.model_dump(mode="json"),
                    "user_id": str(gateway.user_id),
                    **fields,
                    "source_version": min(source.source_version + 1, 20),
                    "captured_at": datetime.now(timezone.utc).isoformat(),
                }
            )
        )
    except (
        ValueError,
        ValidationError,
        TranscriptUnavailable,
        httpx.HTTPError,
        TimeoutError,
    ) as exc:
        detail = (
            str(exc)
            if isinstance(exc, (ValueError, TranscriptUnavailable))
            and len(str(exc)) <= 500
            else "The replacement could not be captured. Use a supported public source or upload/paste its text."
        )
        raise HTTPException(422, detail) from exc
    value = await rpc(
        gateway,
        "compare_source_capture",
        {
            "p_source_id": str(source_id),
            "p_capture": fields,
            "p_input_identity": identity,
        },
    )
    try:
        result = RevisionComparison.model_validate_json(
            json.dumps(
                {
                    **value,
                    "current": {
                        **source.model_dump(mode="json"),
                        "user_id": str(gateway.user_id),
                    },
                    "replacement": (
                        {
                            **replacement.model_dump(mode="json"),
                            "user_id": str(gateway.user_id),
                        }
                        if value["changed"]
                        else None
                    ),
                }
            )
        )
        if (
            result.source_id != source_id
            or result.base_version != source.source_version
            or result.changed != (result.candidate_id is not None)
        ):
            raise ValueError("Invalid comparison")
        return result
    except (ValueError, TypeError, KeyError) as exc:
        raise HTTPException(
            503, "The comparison could not be verified. Compare again."
        ) from exc


@router.post("/{source_id}/refresh", response_model=CapturedSource, status_code=202)
async def refresh_source(
    source_id: UUID,
    payload: RefreshInput,
    gateway: SourceGateway = Depends(owned_sources),
):
    source = validate_owned(
        await rpc(
            gateway,
            "confirm_source_refresh",
            {
                "p_source_id": str(source_id),
                "p_candidate_id": str(payload.candidate_id),
                "p_expected_version": payload.expected_version,
            },
        ),
        CapturedSource,
        gateway,
    )
    if source.id != source_id or source.source_version != payload.expected_version + 1:
        raise HTTPException(
            503, "The refreshed version could not be verified. Reload your library."
        )
    return source


@router.get("/{source_id}/versions", response_model=VersionHistory)
async def versions(source_id: UUID, gateway: SourceGateway = Depends(owned_sources)):
    result = validate_owned(
        await rpc(gateway, "list_source_versions", {"p_source_id": str(source_id)}),
        VersionHistory,
        gateway,
    )
    if result.source_id != source_id:
        raise HTTPException(503, "The version history could not be verified.")
    return result


@router.get("/{source_id}/versions/{version}", response_model=SavedVersion)
async def saved_version(
    source_id: UUID,
    version: Annotated[int, Path(ge=1, le=19)],
    gateway: SourceGateway = Depends(owned_sources),
):
    result = validate_owned(
        await rpc(
            gateway,
            "get_source_version",
            {"p_source_id": str(source_id), "p_version": version},
        ),
        SavedVersion,
        gateway,
    )
    if result.source.id != source_id or result.source.source_version != version:
        raise HTTPException(503, "The saved version could not be verified.")
    return result


@router.post("/{source_id}/correction-review", status_code=204)
async def review_assignments(
    source_id: UUID,
    payload: SourceAssignments,
    gateway: SourceGateway = Depends(owned_sources),
):
    if payload.source_id != source_id:
        raise HTTPException(422, "Choose this source’s current evidence.")
    result = await rpc(
        gateway,
        "review_source_assignments",
        {
            "p_source_id": str(source_id),
            "p_topic_ids": [str(x) for x in payload.topic_ids],
            "p_evidence_ids": payload.evidence_ids,
        },
    )
    if result is not True:
        raise HTTPException(503, "The correction review could not be saved.")
    return Response(status_code=204)
