"""The browser source contract, separate from the native four-point contract."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field, HttpUrl

from backend.schemas import StrictModel


class CaptureSourceRequest(StrictModel):
    url: HttpUrl
    title: str = Field(default="", max_length=200)
    raw_text: str | None = Field(default=None, max_length=30_000)


class CapturedSource(StrictModel):
    id: UUID
    user_id: UUID = Field(exclude=True)
    original_url: HttpUrl
    canonical_url: HttpUrl
    title: str = Field(min_length=1, max_length=200)
    captured_text: str = Field(min_length=120, max_length=30_000)
    captured_at: datetime
    capture_origin: Literal["direct", "reader", "pasted"]
    coverage: Literal["complete", "partial", "unknown"]
    coverage_detail: str = Field(min_length=1, max_length=500)
    study_status: Literal["pending"]


class SourcePage(StrictModel):
    sources: list[CapturedSource]
    next_offset: int | None
