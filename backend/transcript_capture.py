"""Local transcript decoding. Video URLs are context only and are never fetched."""

import re
from html import unescape
from pathlib import PurePath
from urllib.parse import parse_qs, urlsplit

MAX_TRANSCRIPT_BYTES = 1_000_000


def cue_time(value: str, format: str) -> int:
    separator = r"\." if format == "vtt" else ","
    pattern = rf"(?:(\d{{2,3}}):)?([0-5]\d):([0-5]\d){separator}(\d{{3}})"
    match = re.fullmatch(pattern, value)
    if not match or (format == "srt" and match[1] is None):
        raise ValueError(
            "Invalid caption time. Use VTT hh:mm:ss.mmm or SRT hh:mm:ss,mmm timestamps."
        )
    hours, minutes, seconds, milliseconds = match.groups()
    result = (int(hours or 0) * 3600 + int(minutes) * 60 + int(seconds)) * 1000 + int(
        milliseconds
    )
    if result > 604_800_000:
        raise ValueError(
            "Caption times must be within seven days of the recording start."
        )
    return result


def cue_text(value: str) -> str:
    # Preserve explicit voice names; discard only caption formatting/timestamp tags.
    value = re.sub(r"<v(?:\.[^\s>]{0,200})?\s+([^>]{1,200})>", r"\1: ", value)
    value = re.sub(
        r"</?(?:b|i|u|c|lang|v|ruby|rt)(?:[.\s][^>]{0,200})?>|<\d{2}:\d{2}(?::\d{2})?\.\d{3}>",
        "",
        value,
    )
    return unescape(value).strip()


def timed_cues(text: str, format: str) -> list[tuple[str, int, int]]:
    blocks = re.split(r"\n[ \t]*\n", text)
    if format == "vtt":
        if not re.match(r"^WEBVTT(?:[ \t]|$)", blocks[0].split("\n", 1)[0]):
            raise ValueError(
                "A VTT transcript must begin with WEBVTT. Export VTT/SRT or paste readable text instead."
            )
        blocks = blocks[1:]
    cues = []
    previous_start = -1
    for block in blocks:
        if not block.strip():
            continue
        if format == "vtt" and re.match(
            r"^(?:NOTE(?:[ \t\n]|$)|STYLE(?:\n|$)|REGION(?:\n|$))", block
        ):
            continue
        lines = block.split("\n")
        timing_index = 0 if "-->" in lines[0] else 1
        if timing_index >= len(lines) or "-->" not in lines[timing_index]:
            raise ValueError(
                "A caption cue is missing its time range. Export valid VTT/SRT or paste plain transcript text."
            )
        if format == "srt" and (timing_index != 1 or not lines[0].strip().isdigit()):
            raise ValueError(
                "SRT captions need a numbered cue before each time range. Export SRT or paste plain text."
            )
        match = re.fullmatch(
            r"([^\s]+)[ \t]+-->[ \t]+([^\s]+)(?:[ \t]+.*)?", lines[timing_index]
        )
        if not match:
            raise ValueError(
                "A caption time range is unreadable. Export valid VTT/SRT or paste plain text."
            )
        start, end = cue_time(match[1], format), cue_time(match[2], format)
        if end <= start or start < previous_start:
            raise ValueError(
                "Caption times must increase in source order and each end must follow its start. Correct the transcript or paste untimed text."
            )
        payload = cue_text("\n".join(lines[timing_index + 1 :]))
        if not payload:
            raise ValueError(
                "A caption cue has no readable text. Export the transcript again or paste its text."
            )
        cues.append((payload, start, end))
        previous_start = start
        if len(cues) > 2_000:
            raise ValueError(
                "Use a transcript with at most 2,000 cues, or paste its readable text without timestamps."
            )
    if not cues:
        raise ValueError(
            "No caption text was found. Export VTT/SRT with captions or paste its text."
        )
    return cues


def video_identity(url: str) -> tuple[str, str]:
    parsed = urlsplit(url)
    host = (parsed.hostname or "").lower()
    if parsed.scheme != "https" or parsed.username or parsed.password or parsed.port:
        raise ValueError(
            "Use an HTTPS YouTube, Teams, Zoom or Panopto recording link without embedded credentials or custom ports."
        )
    video_id = None
    if host in ("youtube.com", "www.youtube.com", "m.youtube.com"):
        if parsed.path == "/watch":
            video_id = parse_qs(parsed.query).get("v", [""])[0]
        elif re.fullmatch(r"/(?:shorts|live|embed)/[^/]+", parsed.path):
            video_id = parsed.path.rsplit("/", 1)[-1]
    elif host == "youtu.be":
        video_id = parsed.path.strip("/")
    if video_id is not None:
        if not re.fullmatch(r"[A-Za-z0-9_-]{11}", video_id):
            raise ValueError(
                "Use a link to a specific YouTube video, not a channel or playlist."
            )
        return "youtube", f"https://www.youtube.com/watch?v={video_id}"
    if host in ("teams.microsoft.com", "teams.cloud.microsoft") or host.endswith(
        ".sharepoint.com"
    ):
        provider = "teams"
    elif host == "zoom.us" or host.endswith(".zoom.us"):
        if not re.match(r"/rec/(?:share|play)/.+", parsed.path):
            raise ValueError(
                "Use a Zoom recording share or playback link, not a meeting invitation."
            )
        provider = "zoom"
    elif host.endswith((".panopto.com", ".panopto.eu")):
        if not parsed.path.lower().endswith("/viewer.aspx") or not parse_qs(
            parsed.query
        ).get("id"):
            raise ValueError("Use a Panopto session viewer link with its recording ID.")
        provider = "panopto"
    else:
        raise ValueError(
            "Use a YouTube, Teams/SharePoint, Zoom recording or Panopto viewer link. Supply its transcript separately."
        )
    if parsed.path in ("", "/"):
        raise ValueError("Use a link to the recording, not the platform home page.")
    return provider, parsed._replace(fragment="").geturl()


def capture_transcript(data: bytes, url: str, filename: str | None = None) -> dict:
    provider, identity = video_identity(url)
    if len(data) > MAX_TRANSCRIPT_BYTES:
        raise ValueError(
            "Transcripts must be 1 MB or smaller. Export a shorter transcript or paste its text."
        )
    extension = PurePath(filename).suffix.lower() if filename else None
    if filename and extension not in (".txt", ".vtt", ".srt"):
        raise ValueError(
            "Upload UTF-8 TXT, VTT or SRT. For DOCX or other exports, copy and paste the transcript text."
        )
    try:
        text = (
            data.decode("utf-8-sig").replace("\r\n", "\n").replace("\r", "\n").strip()
        )
    except UnicodeDecodeError as exc:
        raise ValueError(
            "The transcript is not UTF-8 text. Export TXT or paste the readable transcript."
        ) from exc
    if "\x00" in text or len(text) < 120:
        raise ValueError(
            "Supply at least 120 readable transcript characters. Paste the transcript or upload a text export."
        )
    if filename is None and len(text) > 100_000:
        raise ValueError(
            "Paste up to 100,000 transcript characters, or upload a file up to 1 MB."
        )
    format = {".txt": "text", ".vtt": "vtt", ".srt": "srt"}.get(extension)
    if format is None:
        format = (
            "vtt"
            if text.startswith("WEBVTT")
            else "srt"
            if re.search(r"(?m)^(?:\d{2,3}:)?\d{2}:\d{2}[.,]\d{3}[ \t]+-->", text)
            else "text"
        )
    cues = [(text, None, None)] if format == "text" else timed_cues(text, format)
    captured_parts = []
    segments = []
    length = 0
    partial = False
    for payload, start_ms, end_ms in cues:
        remaining = 30_000 - length - (1 if captured_parts else 0)
        if remaining <= 0:
            partial = True
            break
        payload_part = payload[:remaining]
        start = length + (1 if captured_parts else 0)
        segments.append(
            {
                "start": start,
                "end": start + len(payload_part),
                "start_ms": start_ms,
                "end_ms": end_ms,
            }
        )
        captured_parts.append(payload_part)
        length = start + len(payload_part)
        if len(payload_part) < len(payload):
            partial = True
            break
    captured = "\n".join(captured_parts)
    if len(captured) < 120:
        raise ValueError(
            "Supply at least 120 readable transcript characters after caption headers and formatting are removed."
        )
    return {
        "canonical_url": identity,
        "source_kind": "video",
        "transcript": {
            "provider": provider,
            "format": format,
            "filename": filename,
            "segments": segments,
        },
        "captured_text": captured,
        "capture_origin": "upload" if filename else "pasted",
        "coverage": "partial" if partial else "unknown",
        "coverage_detail": f"User-supplied {format.upper()} transcript. "
        + (
            "Captured the first 30,000 characters; later text was omitted. "
            if partial
            else "Captured the supplied transcript. "
        )
        + "No video was fetched or watched. Video completeness is unverified. "
        + (
            "Cue times come from the supplied transcript."
            if format != "text"
            else "No timestamps were supplied."
        ),
    }
