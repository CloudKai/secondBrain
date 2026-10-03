"""The browser source contract, separate from the native four-point contract."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field, HttpUrl, TypeAdapter, model_validator

from backend.schemas import StrictModel
from backend.transcript_models import TranscriptDocument
from backend.transcript_capture import video_identity


class CaptureSourceRequest(StrictModel):
    url: HttpUrl
    title: str = Field(default="", max_length=200)
    raw_text: str | None = Field(default=None, max_length=30_000)


class PDFPage(StrictModel):
    page: int = Field(ge=1, le=100)
    start: int = Field(ge=0, le=30_000)
    end: int = Field(ge=0, le=30_000)


class PDFDocument(StrictModel):
    filename: str | None = Field(default=None, min_length=1, max_length=200)
    page_count: int = Field(ge=1, le=100)
    pages: list[PDFPage] = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def ordered_pages(self):
        previous_end = -1
        for index, page in enumerate(self.pages):
            if (
                page.page != index + 1
                or page.end < page.start
                or page.start != previous_end + 1
            ):
                raise ValueError("Invalid PDF page locations")
            previous_end = page.end
        if len(self.pages) > self.page_count:
            raise ValueError("Invalid PDF page count")
        return self


class CapturePDFLinkRequest(StrictModel):
    url: HttpUrl
    title: str = Field(default="", max_length=200)


class CaptureYouTubeRequest(StrictModel):
    url: HttpUrl
    title: str = Field(default="", max_length=200)


class CapturedSource(StrictModel):
    id: UUID
    user_id: UUID = Field(exclude=True)
    original_url: HttpUrl | None
    canonical_url: str = Field(pattern=r"^(https?://|urn:pdf:sha256:[a-f0-9]{64}$)")
    source_kind: Literal["article", "pdf", "video"] = "article"
    document: PDFDocument | None = None
    transcript: TranscriptDocument | None = None
    title: str = Field(min_length=1, max_length=200)
    captured_text: str = Field(min_length=120, max_length=30_000)
    captured_at: datetime
    capture_origin: Literal["direct", "reader", "pasted", "upload"]
    coverage: Literal["complete", "partial", "unknown"]
    coverage_detail: str = Field(min_length=1, max_length=500)
    study_status: Literal["pending"]

    @model_validator(mode="after")
    def document_matches_source(self):
        if self.source_kind == "video":
            if (
                self.coverage == "complete"
                or self.original_url is None
                or self.document is not None
                or self.transcript is None
                or self.capture_origin not in ("pasted", "upload", "direct")
                or (self.capture_origin == "upload")
                != (self.transcript.filename is not None)
                or self.transcript.segments[-1].end != len(self.captured_text)
            ):
                raise ValueError("Invalid supplied transcript identity or locations")
            if self.capture_origin == "direct" and (
                self.transcript.provider != "youtube" or self.transcript.format != "vtt"
            ):
                raise ValueError(
                    "Only YouTube caption retrieval uses direct video capture"
                )
            provider, canonical = video_identity(str(self.original_url))
            if provider != self.transcript.provider or canonical != self.canonical_url:
                raise ValueError(
                    "Transcript provider and canonical recording must match the original URL"
                )
            return self
        if self.transcript is not None:
            raise ValueError("Only video sources have transcript metadata")
        if self.source_kind == "article":
            if (
                self.original_url is None
                or self.document is not None
                or self.capture_origin == "upload"
            ):
                raise ValueError("Invalid article identity")
        elif self.document is None or self.capture_origin not in ("direct", "upload"):
            raise ValueError("PDF page metadata is required")
        elif (self.capture_origin == "upload") != (self.original_url is None):
            raise ValueError("Invalid PDF origin")
        if self.original_url is None and not self.canonical_url.startswith(
            "urn:pdf:sha256:"
        ):
            raise ValueError("Upload identity must be a file digest")
        if self.original_url is not None:
            TypeAdapter(HttpUrl).validate_python(self.canonical_url)
        if (
            self.capture_origin == "upload"
            and self.document
            and not self.document.filename
        ):
            raise ValueError("Uploaded PDFs need a filename")
        if self.document and self.document.pages[-1].end != len(self.captured_text):
            raise ValueError("PDF pages must cover captured text")
        return self


class SourcePage(StrictModel):
    sources: list[CapturedSource]
    next_offset: int | None
