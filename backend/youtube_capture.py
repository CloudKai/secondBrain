"""Bounded, anonymous public-caption retrieval with an explicit text fallback."""

import asyncio
from decimal import Decimal, ROUND_HALF_UP, DecimalException
import logging
import time
from urllib.parse import urlsplit, parse_qs

import requests
from youtube_transcript_api import (
    YouTubeTranscriptApi,
    AgeRestricted,
    RequestBlocked,
    IpBlocked,
    TranscriptsDisabled,
    NoTranscriptFound,
    YouTubeTranscriptApiException,
)

from backend.transcript_capture import capture_transcript, video_identity

logger = logging.getLogger(__name__)
retrieval_slots = asyncio.Semaphore(4)


class TranscriptUnavailable(ValueError):
    """Safe actionable failure; no source is saved on an unsuccessful retrieval."""


class BoundedYouTubeSession(requests.Session):
    def __init__(self, video_id: str):
        super().__init__()
        self.trust_env = False
        self.video_id = video_id
        self.deadline = time.monotonic() + 30
        self.downloaded = 0
        self.requests_sent = 0

    def request(self, method, url, **kwargs):
        parsed = urlsplit(url)
        if (
            parsed.scheme != "https"
            or parsed.hostname != "www.youtube.com"
            or parsed.username
            or parsed.password
            or parsed.port not in (None, 443)
            or parsed.path not in ("/watch", "/youtubei/v1/player", "/api/timedtext")
        ):
            raise TranscriptUnavailable(
                "The caption access path is unsupported. Upload or paste the transcript instead."
            )
        if self.cookies or kwargs.get("cookies"):
            raise TranscriptUnavailable(
                "YouTube requires cookie access. Upload or paste the transcript instead."
            )
        if parsed.path in ("/watch", "/api/timedtext") and parse_qs(parsed.query).get(
            "v"
        ) != [self.video_id]:
            raise TranscriptUnavailable(
                "The caption response does not match this video. Upload or paste the transcript instead."
            )
        remaining = self.deadline - time.monotonic()
        self.requests_sent += 1
        if remaining <= 0 or self.requests_sent > 4:
            raise TranscriptUnavailable(
                "YouTube transcript retrieval timed out. Upload or paste the transcript instead."
            )
        kwargs.update(timeout=min(8, remaining), stream=True, allow_redirects=False)
        response = super().request(method, url, **kwargs)
        try:
            if 300 <= response.status_code < 400:
                raise TranscriptUnavailable(
                    "YouTube redirected transcript access. Upload or paste the transcript instead."
                )
            data = bytearray()
            for chunk in response.iter_content(65536):
                self.downloaded += len(chunk)
                if time.monotonic() > self.deadline:
                    raise TranscriptUnavailable(
                        "YouTube transcript retrieval timed out. Upload or paste the transcript instead."
                    )
                if len(data) + len(chunk) > 2_000_000 or self.downloaded > 4_000_000:
                    raise TranscriptUnavailable(
                        "YouTube transcript data exceeds retrieval limits. Upload or paste the transcript instead."
                    )
                data.extend(chunk)
            response._content = bytes(data)
            response._content_consumed = True
            return response
        finally:
            response.close()


def vtt_time(milliseconds: int) -> str:
    seconds, fraction = divmod(milliseconds, 1000)
    hours, seconds = divmod(seconds, 3600)
    minutes, seconds = divmod(seconds, 60)
    return f"{hours:02}:{minutes:02}:{seconds:02}.{fraction:03}"


def retrieve_youtube(url: str) -> dict:
    provider, identity = video_identity(url)
    if provider != "youtube":
        raise ValueError(
            "Automatic import supports YouTube videos. Upload or paste the transcript for other recording platforms."
        )
    video_id = identity.rsplit("=", 1)[1]
    try:
        with BoundedYouTubeSession(video_id) as session:
            transcript = YouTubeTranscriptApi(http_client=session).fetch(
                video_id, languages=["en", "en-US", "en-GB"]
            )
        if len(transcript) > 2000:
            raise TranscriptUnavailable(
                "The transcript exceeds 2,000 cues. Upload a shorter transcript or paste its text."
            )
        cues = ["WEBVTT"]
        for snippet in transcript:
            start = Decimal(str(snippet.start)) * 1000
            end = (Decimal(str(snippet.start)) + Decimal(str(snippet.duration))) * 1000
            if (
                not start.is_finite()
                or not end.is_finite()
                or start < 0
                or end <= start
                or end > 604800000
            ):
                raise TranscriptUnavailable(
                    "YouTube caption times are unreadable. Upload valid VTT/SRT or paste untimed text."
                )
            start_ms = int(start.quantize(Decimal("1"), rounding=ROUND_HALF_UP))
            end_ms = int(end.quantize(Decimal("1"), rounding=ROUND_HALF_UP))
            text = " ".join(snippet.text.split())
            if not text:
                continue
            cues.append(f"{vtt_time(start_ms)} --> {vtt_time(end_ms)}\n{text}")
        data = "\n\n".join(cues).encode("utf-8")
        capture = capture_transcript(data, url, "captions.vtt")
        capture["capture_origin"] = "direct"
        capture["transcript"]["filename"] = None
        kind = "auto-generated" if transcript.is_generated else "publisher-provided"
        capture["coverage_detail"] = (
            f"Retrieved English YouTube {kind} captions. "
            + (
                "Captured the first 30,000 characters; later text was omitted. "
                if capture["coverage"] == "partial"
                else "Captured the accessible transcript. "
            )
            + "No audio/video was downloaded or watched. Video completeness is unverified. Times come from retrieved caption cues."
        )
        return capture
    except TranscriptUnavailable:
        raise
    except (RequestBlocked, IpBlocked) as exc:
        raise TranscriptUnavailable(
            "YouTube blocked anonymous transcript access. Upload or paste the transcript instead."
        ) from exc
    except AgeRestricted as exc:
        raise TranscriptUnavailable(
            "This video requires restricted access. Upload or paste an accessible transcript instead."
        ) from exc
    except (TranscriptsDisabled, NoTranscriptFound) as exc:
        raise TranscriptUnavailable(
            "No accessible English transcript was found. Upload or paste the transcript instead."
        ) from exc
    except (
        YouTubeTranscriptApiException,
        requests.RequestException,
        ValueError,
        DecimalException,
        KeyError,
        TypeError,
        AttributeError,
        IndexError,
    ) as exc:
        logger.warning("YouTube transcript retrieval failed: %s", type(exc).__name__)
        raise TranscriptUnavailable(
            "The YouTube transcript could not be retrieved. Upload or paste it instead."
        ) from exc


async def capture_youtube(url: str) -> dict:
    async with asyncio.timeout(35), retrieval_slots:
        return await asyncio.to_thread(retrieve_youtube, url)
