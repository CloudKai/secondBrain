"""Automatic transcript import at authenticated API and external HTTP seams."""

import io
import json
from urllib.parse import urlsplit

import pytest
import requests

from backend.tests.test_sources import browser_client  # noqa: F401

TEXT = "Algebra uses symbols to express relationships between quantities. A variable represents an unknown quantity, and an equation states that two expressions are equal."


@pytest.fixture
def youtube_http(monkeypatch):
    """Stand in only for YouTube HTTP; the real transcript SDK decodes responses."""
    state = {"status": "OK", "captions": True, "requests": []}

    def send(adapter, request, **kwargs):
        url = urlsplit(request.url)
        state["requests"].append(request.url)
        assert "Authorization" not in request.headers
        assert "apikey" not in request.headers
        assert url.hostname == "www.youtube.com"
        if state.get("mode") == "oversized":
            data = b"x" * 2_000_001
        elif url.path == "/watch":
            data = b'<html>"INNERTUBE_API_KEY":"public-player-key"</html>'
        elif url.path == "/youtubei/v1/player":
            payload = {"playabilityStatus": {"status": state["status"]}}
            if state.get("mode") == "blocked":
                payload["playabilityStatus"] = {
                    "status": "LOGIN_REQUIRED",
                    "reason": "Sign in to confirm you’re not a bot",
                }
            elif state.get("mode") == "restricted":
                payload["playabilityStatus"] = {
                    "status": "LOGIN_REQUIRED",
                    "reason": "This video may be inappropriate for some users.",
                }
            if state["captions"] and state.get("mode") != "missing":
                payload["captions"] = {
                    "playerCaptionsTracklistRenderer": {
                        "captionTracks": [
                            {
                                "baseUrl": "https://www.youtube.com/api/timedtext?v=aircAruvnKk&lang=en",
                                "name": {"runs": [{"text": "English"}]},
                                "languageCode": "en",
                                "isTranslatable": False,
                            }
                        ]
                    }
                }
            if state.get("mode") == "wrong-video":
                payload["captions"]["playerCaptionsTracklistRenderer"]["captionTracks"][
                    0
                ][
                    "baseUrl"
                ] = "https://www.youtube.com/api/timedtext?v=abcdefghijk&lang=en"
            if state.get("mode") == "unsafe":
                payload["captions"]["playerCaptionsTracklistRenderer"]["captionTracks"][
                    0
                ]["baseUrl"] = "http://127.0.0.1/private"
            data = (
                b"{invalid"
                if state.get("mode") == "invalid"
                else json.dumps(payload).encode()
            )
        else:
            assert url.path == "/api/timedtext"
            data = f'<transcript><text start="5.25" dur="15.25">{TEXT}</text><text start="30" dur="10">Calculus studies how quantities change.</text></transcript>'.encode()
        response = requests.Response()
        response.status_code = 200
        response.raw = io.BytesIO(data)
        response.headers["Content-Type"] = (
            "text/xml" if url.path == "/api/timedtext" else "text/html"
        )
        response.encoding = "utf-8"
        response.request = request
        response.url = request.url
        return response

    monkeypatch.setattr(requests.adapters.HTTPAdapter, "send", send)
    return state


def test_youtube_import_saves_owned_real_cue_times_and_reopens(
    browser_client, youtube_http
):
    headers = {"Authorization": "Bearer alice"}
    response = browser_client.post(
        "/api/v2/sources/youtube",
        headers=headers,
        json={"url": "https://youtu.be/aircAruvnKk?t=5", "title": "Algebra"},
    )
    assert response.status_code == 201, response.text
    source = response.json()
    assert source["capture_origin"] == "direct"
    assert source["transcript"]["provider"] == "youtube"
    assert source["transcript"]["format"] == "vtt"
    assert source["transcript"]["filename"] is None
    assert source["coverage"] == "unknown"
    assert "Retrieved" in source["coverage_detail"]
    assert "User-supplied" not in source["coverage_detail"]
    assert [(s["start_ms"], s["end_ms"]) for s in source["transcript"]["segments"]] == [
        (5250, 20500),
        (30000, 40000),
    ]
    assert (
        browser_client.get("/api/v2/sources/" + source["id"], headers=headers).json()
        == source
    )
    assert (
        browser_client.get(
            "/api/v2/sources/" + source["id"], headers={"Authorization": "Bearer bob"}
        ).status_code
        == 404
    )


@pytest.mark.parametrize(
    "mode,expected",
    [
        ("missing", "No accessible English"),
        ("blocked", "blocked anonymous"),
        ("restricted", "restricted access"),
        ("invalid", "could not be retrieved"),
        ("oversized", "exceeds retrieval limits"),
        ("unsafe", "unsupported"),
    ],
)
def test_unavailable_youtube_captions_offer_fallback_without_saving(
    browser_client, youtube_http, mode, expected
):
    youtube_http["mode"] = mode
    response = browser_client.post(
        "/api/v2/sources/youtube",
        headers={"Authorization": "Bearer alice"},
        json={"url": "https://youtu.be/aircAruvnKk", "title": "Algebra"},
    )
    assert response.status_code == 422, response.text
    assert expected in response.json()["detail"]
    assert "Upload" in response.json()["detail"]
    assert (
        browser_client.get(
            "/api/v2/sources", headers={"Authorization": "Bearer alice"}
        ).json()["sources"]
        == []
    )


def test_caption_response_cannot_change_the_requested_video(
    browser_client, youtube_http
):
    youtube_http["mode"] = "wrong-video"
    response = browser_client.post(
        "/api/v2/sources/youtube",
        headers={"Authorization": "Bearer alice"},
        json={"url": "https://youtu.be/aircAruvnKk"},
    )
    assert response.status_code == 422, response.text
    assert not any("/api/timedtext" in url for url in youtube_http["requests"])


def test_import_authentication_and_reuse_happen_before_youtube_access(
    browser_client, youtube_http
):
    payload = {"url": "https://youtu.be/aircAruvnKk"}
    assert (
        browser_client.post("/api/v2/sources/youtube", json=payload).status_code == 401
    )
    assert youtube_http["requests"] == []
    first = browser_client.post(
        "/api/v2/sources/youtube",
        headers={"Authorization": "Bearer alice"},
        json=payload,
    )
    assert first.status_code == 201
    count = len(youtube_http["requests"])
    youtube_http["mode"] = "blocked"
    reused = browser_client.post(
        "/api/v2/sources/youtube",
        headers={"Authorization": "Bearer alice"},
        json={"url": "https://www.youtube.com/watch?v=aircAruvnKk&t=30"},
    )
    assert reused.json()["id"] == first.json()["id"]
    assert len(youtube_http["requests"]) == count
