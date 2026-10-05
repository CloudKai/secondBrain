"""Bounded, anonymous public-caption retrieval with an explicit text fallback."""

import asyncio
from decimal import Decimal, ROUND_HALF_UP, DecimalException
import logging
import time
from urllib.parse import urlsplit, parse_qs

import requests
import httpx
from xml.etree.ElementTree import ParseError
from defusedxml.common import DefusedXmlException
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
from backend.capture_selection import TimeRange

logger = logging.getLogger(__name__)
retrieval_slots = asyncio.Semaphore(4)


class TranscriptUnavailable(ValueError):
    """Safe actionable failure; no source is saved on an unsuccessful retrieval."""


class BoundedYouTubeSession(requests.Session):
    def __init__(self, video_id: str, loop: asyncio.AbstractEventLoop):
        super().__init__()
        self.trust_env = False
        self.video_id = video_id
        self.loop = loop
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
        if self.cookies.get("CONSENT") or kwargs.get("cookies"):
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
        # SDK calls stay synchronous; network I/O runs on the caller's event loop
        # so the wall-clock timeout can interrupt a slowly arriving response.
        self.cookies.clear()
        pending = asyncio.run_coroutine_threadsafe(
            self.download(method, url, kwargs, remaining), self.loop
        )
        try:
            status, data, encoding = pending.result(timeout=remaining + 1)
        finally:
            pending.cancel()
        response = requests.Response()
        response.status_code = status
        response.url = url
        response.encoding = encoding
        response._content = data
        response._content_consumed = True
        return response

    async def download(self, method, url, kwargs, remaining):
        async with (
            asyncio.timeout(remaining),
            httpx.AsyncClient(
                trust_env=False, follow_redirects=False, timeout=min(8, remaining)
            ) as client,
        ):
            async with client.stream(
                method,
                url,
                json=kwargs.get("json"),
                headers={"User-Agent": self.headers.get("User-Agent", "")},
            ) as response:
                if 300 <= response.status_code < 400:
                    raise TranscriptUnavailable(
                        "YouTube redirected transcript access. Upload or paste the transcript instead."
                    )
                data = bytearray()
                async for chunk in response.aiter_bytes(65536):
                    self.downloaded += len(chunk)
                    if (
                        len(data) + len(chunk) > 2_000_000
                        or self.downloaded > 4_000_000
                    ):
                        raise TranscriptUnavailable(
                            "YouTube transcript data exceeds retrieval limits. Upload or paste the transcript instead."
                        )
                    data.extend(chunk)
                return response.status_code, bytes(data), response.encoding


def vtt_time(milliseconds: int) -> str:
    seconds, fraction = divmod(milliseconds, 1000)
    hours, seconds = divmod(seconds, 3600)
    minutes, seconds = divmod(seconds, 60)
    return f"{hours:02}:{minutes:02}:{seconds:02}.{fraction:03}"


def retrieve_youtube(url: str, loop: asyncio.AbstractEventLoop, times: TimeRange | None = None) -> dict:
    provider, identity = video_identity(url)
    if provider != "youtube":
        raise ValueError(
            "Automatic import supports YouTube videos. Upload or paste the transcript for other recording platforms."
        )
    video_id = identity.rsplit("=", 1)[1]
    try:
        with BoundedYouTubeSession(video_id, loop) as session:
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
        capture = capture_transcript(data, url, "captions.vtt", times=times)
        capture["capture_origin"] = "direct"
        capture["transcript"]["filename"] = None
        kind = "auto-generated" if transcript.is_generated else "publisher-provided"
        capture["coverage_detail"] = capture["coverage_detail"].replace(
            "User-supplied VTT transcript.", f"Retrieved English YouTube {kind} captions."
        ).replace("No video was fetched or watched.", "No audio/video was downloaded or watched.")
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
        ParseError,
        DefusedXmlException,
        requests.RequestException,
        httpx.HTTPError,
        TimeoutError,
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


async def capture_youtube(url: str, *, times: TimeRange | None = None) -> dict:
    async with asyncio.timeout(35):
        await retrieval_slots.acquire()
        loop = asyncio.get_running_loop()
        try:
            work = loop.run_in_executor(None, retrieve_youtube, url, loop, times)
        except BaseException:
            retrieval_slots.release()
            raise

        # Shielding keeps capacity occupied until the actual SDK work stops,
        # even if the request task is cancelled or times out.
        def finished(task):
            retrieval_slots.release()
            if not task.cancelled():
                task.exception()

        work.add_done_callback(finished)
        return await asyncio.shield(work)
