"""Refresh ownership and bounded captures through authenticated HTTP."""

import json
import httpx
from fastapi.testclient import TestClient
from backend.main import app

ALICE = "11111111-1111-4111-8111-111111111111"
SOURCE = "33333333-3333-4333-8333-333333333333"
CANDIDATE = "44444444-4444-4444-8444-444444444444"
TEXT = (
    "Calculus describes change. Derivatives measure instantaneous rates and integrals accumulate contributions. "
    * 3
)


def test_owned_article_compare_stages_actual_pasted_input_without_replacing_source(
    monkeypatch,
):
    monkeypatch.setenv("SUPABASE_URL", "https://supabase.test")
    monkeypatch.setenv("SUPABASE_PUBLISHABLE_KEY", "public-test")
    monkeypatch.setattr(
        "socket.getaddrinfo",
        lambda *args, **kwargs: [(2, 1, 6, "", ("93.184.216.34", 443))],
    )
    source = {
        "id": SOURCE,
        "user_id": ALICE,
        "original_url": "https://example.com/calculus",
        "canonical_url": "https://example.com/calculus",
        "source_kind": "article",
        "document": None,
        "transcript": None,
        "title": "Calculus",
        "captured_text": TEXT.strip(),
        "captured_at": "2026-10-04T00:00:00Z",
        "capture_origin": "pasted",
        "coverage": "unknown",
        "coverage_detail": "Supplied original",
        "study_status": "pending",
        "source_version": 1,
    }
    staged = []

    def external(request):
        if request.url.path == "/auth/v1/user":
            return httpx.Response(200, json={"id": ALICE})
        if request.url.path == "/rest/v1/sources":
            return httpx.Response(
                200,
                json=(
                    [] if request.headers["authorization"] == "Bearer bob" else [source]
                ),
            )
        if request.url.path == "/rest/v1/rpc/compare_source_capture":
            body = json.loads(request.content)
            staged.append(body)
            return httpx.Response(
                200,
                json={
                    "source_id": SOURCE,
                    "base_version": 1,
                    "candidate_id": CANDIDATE,
                    "changed": True,
                },
            )
        raise AssertionError(str(request.url))

    original = httpx.AsyncClient
    monkeypatch.setattr(
        httpx,
        "AsyncClient",
        lambda **kw: original(**{**kw, "transport": httpx.MockTransport(external)}),
    )
    with TestClient(app) as client:
        endpoint = f"/api/v2/sources/{SOURCE}/revision-check"
        new = TEXT + "Updated evaluation."
        result = client.post(
            endpoint, json={"raw_text": new}, headers={"Authorization": "Bearer alice"}
        )
        assert result.status_code == 200, result.text
        assert result.json()["candidate_id"] == CANDIDATE
        assert staged[0]["p_capture"]["captured_text"] == new.strip()
        assert (
            client.post(
                endpoint, json={}, headers={"Authorization": "Bearer bob"}
            ).status_code
            == 404
        )
        assert client.post(endpoint, json={}).status_code == 401
        assert (
            client.post(
                endpoint,
                json={"user_id": ALICE},
                headers={"Authorization": "Bearer alice"},
            ).status_code
            == 422
        )


def test_revised_pdf_upload_digest_reopens_the_same_owned_source(monkeypatch):
    from backend.tests.test_pdf_sources import pdf_bytes

    monkeypatch.setenv("SUPABASE_URL", "https://supabase.test")
    monkeypatch.setenv("SUPABASE_PUBLISHABLE_KEY", "public-test")
    source = {
        "id": SOURCE,
        "user_id": ALICE,
        "original_url": None,
        "canonical_url": "urn:pdf:sha256:" + "a" * 64,
        "source_kind": "pdf",
        "document": {
            "filename": "saved.pdf",
            "page_count": 1,
            "pages": [{"page": 1, "start": 0, "end": len(TEXT)}],
        },
        "transcript": None,
        "title": "Calculus",
        "captured_text": TEXT,
        "captured_at": "2026-10-04T00:00:00Z",
        "capture_origin": "upload",
        "coverage": "complete",
        "coverage_detail": "Selectable pages",
        "study_status": "pending",
        "source_version": 2,
    }

    def external(request):
        if request.url.path == "/auth/v1/user":
            return httpx.Response(200, json={"id": ALICE})
        if request.url.path == "/rest/v1/sources":
            return httpx.Response(200, json=[])
        assert request.url.path == "/rest/v1/rpc/find_source_identity"
        return httpx.Response(200, json=source)

    original = httpx.AsyncClient
    monkeypatch.setattr(
        httpx,
        "AsyncClient",
        lambda **kw: original(**{**kw, "transport": httpx.MockTransport(external)}),
    )
    with TestClient(app) as client:
        response = client.post(
            "/api/v2/sources/pdf?filename=revised.pdf",
            content=pdf_bytes(),
            headers={
                "Authorization": "Bearer alice",
                "Content-Type": "application/pdf",
            },
        )
        assert response.status_code == 201, response.text
        assert (
            response.json()["id"] == SOURCE and response.json()["source_version"] == 2
        )


def test_supplied_video_recheck_compares_actual_timestamps_without_fetching_the_video(
    monkeypatch,
):
    monkeypatch.setenv("SUPABASE_URL", "https://supabase.test")
    monkeypatch.setenv("SUPABASE_PUBLISHABLE_KEY", "public-test")
    url = "https://www.youtube.com/watch?v=ovrv11testA"
    source = {
        "id": SOURCE,
        "user_id": ALICE,
        "original_url": url,
        "canonical_url": url,
        "source_kind": "video",
        "document": None,
        "transcript": {
            "provider": "youtube",
            "format": "text",
            "filename": None,
            "segments": [
                {"start": 0, "end": len(TEXT.strip()), "start_ms": None, "end_ms": None}
            ],
        },
        "title": "Calculus lecture",
        "captured_text": TEXT.strip(),
        "captured_at": "2026-10-04T00:00:00Z",
        "capture_origin": "pasted",
        "coverage": "unknown",
        "coverage_detail": "Supplied original transcript",
        "study_status": "pending",
        "source_version": 1,
    }
    captured = []

    def external(request):
        assert request.url.host == "supabase.test"
        if request.url.path == "/auth/v1/user":
            return httpx.Response(200, json={"id": ALICE})
        if request.url.path == "/rest/v1/sources":
            return httpx.Response(200, json=[source])
        assert request.url.path == "/rest/v1/rpc/compare_source_capture"
        captured.append(json.loads(request.content)["p_capture"])
        return httpx.Response(
            200,
            json={
                "source_id": SOURCE,
                "base_version": 1,
                "candidate_id": CANDIDATE,
                "changed": True,
            },
        )

    original = httpx.AsyncClient
    monkeypatch.setattr(
        httpx,
        "AsyncClient",
        lambda **kw: original(**{**kw, "transport": httpx.MockTransport(external)}),
    )
    with TestClient(app) as client:
        response = client.post(
            f"/api/v2/sources/{SOURCE}/revision-check?filename=lecture.srt",
            content=("1\n00:00:06,000 --> 00:00:12,000\n" + TEXT).encode(),
            headers={
                "Authorization": "Bearer alice",
                "Content-Type": "application/octet-stream",
            },
        )
        assert response.status_code == 200, response.text
        assert captured[0]["transcript"]["segments"][0]["start_ms"] == 6000
        assert captured[0]["transcript"]["segments"][0]["end_ms"] == 12000
        assert response.json()["replacement"]["source_version"] == 2


def test_public_article_recheck_uses_bounded_external_http_without_forwarding_learner_credentials(
    monkeypatch,
):
    monkeypatch.setenv("SUPABASE_URL", "https://supabase.test")
    monkeypatch.setenv("SUPABASE_PUBLISHABLE_KEY", "public-test")
    monkeypatch.setattr(
        "socket.getaddrinfo",
        lambda *args, **kwargs: [(2, 1, 6, "", ("93.184.216.34", 443))],
    )
    source = {
        "id": SOURCE,
        "user_id": ALICE,
        "original_url": "https://example.com/calculus",
        "canonical_url": "https://example.com/calculus",
        "source_kind": "article",
        "document": None,
        "transcript": None,
        "title": "Calculus",
        "captured_text": TEXT.strip(),
        "captured_at": "2026-10-04T00:00:00Z",
        "capture_origin": "direct",
        "coverage": "complete",
        "coverage_detail": "Original readable page",
        "study_status": "pending",
        "source_version": 1,
    }
    replacement = TEXT + " New published material."

    def external(request):
        if request.url.host != "supabase.test":
            assert (
                "authorization" not in request.headers
                and "apikey" not in request.headers
            )
            return httpx.Response(
                200,
                headers={"content-type": "text/plain"},
                stream=httpx.ByteStream(replacement.encode()),
            )
        if request.url.path == "/auth/v1/user":
            return httpx.Response(200, json={"id": ALICE})
        if request.url.path == "/rest/v1/sources":
            return httpx.Response(200, json=[source])
        assert (
            json.loads(request.content)["p_capture"]["captured_text"]
            == replacement.strip()
        )
        return httpx.Response(
            200,
            json={
                "source_id": SOURCE,
                "base_version": 1,
                "candidate_id": CANDIDATE,
                "changed": True,
            },
        )

    original = httpx.AsyncClient
    monkeypatch.setattr(
        httpx,
        "AsyncClient",
        lambda **kw: original(**{**kw, "transport": httpx.MockTransport(external)}),
    )
    with TestClient(app) as client:
        response = client.post(
            f"/api/v2/sources/{SOURCE}/revision-check",
            json={},
            headers={"Authorization": "Bearer alice"},
        )
        assert response.status_code == 200, response.text
        assert response.json()["current"]["captured_text"] == TEXT.strip()
        assert response.json()["replacement"]["captured_text"] == replacement.strip()
