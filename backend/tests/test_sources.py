"""Owned-source behavior through the browser's HTTP interface."""

from datetime import datetime, timezone
import ipaddress
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient

from backend.main import app


ALICE = "11111111-1111-4111-8111-111111111111"
BOB = "22222222-2222-4222-8222-222222222222"
ARTICLE_TEXT = "Calculus describes how quantities change and accumulate. " * 4


@pytest.fixture
def browser_client(monkeypatch):
    """Stand-ins for Supabase and public article HTTP, not application modules."""
    monkeypatch.setenv("SUPABASE_URL", "https://supabase.test")
    monkeypatch.setenv("SUPABASE_PUBLISHABLE_KEY", "test-public-key")

    def public_dns(host, *args, **kwargs):
        try:
            address = str(ipaddress.ip_address(host))
        except ValueError:
            address = "127.0.0.1" if host == "private.test" else "93.184.216.34"
        return [(2, 1, 6, "", (address, 443))]

    monkeypatch.setattr("socket.getaddrinfo", public_dns)
    rows = []

    def external_http(request):
        if request.url.host != "supabase.test":
            assert "authorization" not in request.headers
            assert "apikey" not in request.headers
            if request.url.path == "/encoded-pdf":
                import gzip

                return httpx.Response(
                    200,
                    headers={
                        "content-type": "application/pdf",
                        "content-encoding": "gzip",
                    },
                    stream=httpx.ByteStream(
                        gzip.compress(b"%PDF-" + b"x" * 10_000_001)
                    ),
                )
            if request.url.path == "/pdf-file":
                from backend.tests.test_pdf_sources import pdf_bytes

                return httpx.Response(
                    200,
                    headers={"content-type": "application/pdf"},
                    content=pdf_bytes(),
                )
            if request.url.path == "/identity":
                return httpx.Response(
                    200,
                    headers={"content-type": "text/plain"},
                    text=f"Query: {request.url.query.decode()}\n{ARTICLE_TEXT}",
                )
            if "blocked" in str(request.url):
                return httpx.Response(403)
            if request.url.path == "/redirect-private":
                return httpx.Response(
                    302, headers={"location": "http://127.0.0.1/private"}
                )
            if request.url.path == "/download":
                return httpx.Response(
                    200,
                    headers={"content-type": "application/pdf"},
                    content=b"%PDF-1.4",
                )
            if request.url.path == "/long":
                return httpx.Response(
                    200,
                    headers={"content-type": "text/plain"},
                    text="Useful text. " * 12000,
                )
            if request.url.path == "/large":
                return httpx.Response(
                    200, headers={"content-type": "text/plain"}, text="x" * 2_000_001
                )
            return httpx.Response(
                200,
                headers={"content-type": "text/html"},
                text=f"<html><main><p>{ARTICLE_TEXT}</p></main></html>",
            )
        user_id = {"Bearer alice": ALICE, "Bearer bob": BOB}.get(
            request.headers.get("authorization")
        )
        if not user_id:
            return httpx.Response(401, json={"message": "Invalid token"})
        if request.url.path == "/auth/v1/user":
            return httpx.Response(200, json={"id": user_id, "is_anonymous": True})
        if request.url.path == "/rest/v1/rpc/find_source_identity":
            import json
            identity = json.loads(request.content)["p_identity"]
            match = next((row for row in rows if row["user_id"] == user_id and row["canonical_url"] == identity), None)
            return httpx.Response(200, text=json.dumps(match), headers={"content-type": "application/json"})
        if request.url.path != "/rest/v1/sources":
            return httpx.Response(404)
        visible = [row for row in rows if row["user_id"] == user_id]
        for key in ("id", "canonical_url", "user_id"):
            value = request.url.params.get(key)
            if value:
                visible = [row for row in visible if str(row[key]) == value[3:]]
        if request.method == "POST":
            import json

            body = json.loads(request.content)
            if body["user_id"] != user_id:
                return httpx.Response(403)
            if any(row["canonical_url"] == body["canonical_url"] for row in visible):
                return httpx.Response(201, json=[])
            row = {
                **body,
                "id": str(uuid4()),
                "captured_at": datetime.now(timezone.utc).isoformat(),
            }
            rows.append(row)
            return httpx.Response(201, json=[row])
        if request.method == "DELETE":
            rows[:] = [row for row in rows if row not in visible]
            return httpx.Response(200, json=visible)
        offset = int(request.url.params.get("offset", 0))
        limit = int(request.url.params.get("limit", 100))
        return httpx.Response(200, json=visible[offset : offset + limit])

    def streaming_external_http(request):
        response = external_http(request)
        if request.url.host != "supabase.test" and response.is_stream_consumed:
            return httpx.Response(
                response.status_code,
                headers=response.headers,
                stream=httpx.ByteStream(response.content),
            )
        return response

    original_client = httpx.AsyncClient
    monkeypatch.setattr(
        httpx,
        "AsyncClient",
        lambda **kwargs: original_client(
            **{**kwargs, "transport": httpx.MockTransport(streaming_external_http)}
        ),
    )
    return TestClient(app)


def test_anonymous_learner_saves_and_reopens_captured_article(browser_client):
    headers = {"Authorization": "Bearer alice"}
    response = browser_client.post(
        "/api/v2/sources",
        headers=headers,
        json={"url": "https://article.test/learning#introduction", "title": "Calculus"},
    )
    assert response.status_code == 201
    source = response.json()
    assert source["captured_text"] == ARTICLE_TEXT.strip()
    assert source["original_url"] == "https://article.test/learning#introduction"
    assert source["study_status"] == "pending"
    assert source["capture_origin"] == "direct"
    assert source["coverage"] == "complete"
    assert source["captured_at"]
    reopened = browser_client.get(f"/api/v2/sources/{source['id']}", headers=headers)
    assert reopened.status_code == 200
    assert reopened.json() == source
    listing = browser_client.get("/api/v2/sources", headers=headers)
    assert [row["id"] for row in listing.json()["sources"]] == [source["id"]]


def test_learner_cannot_read_or_delete_another_learners_source(browser_client):
    source = browser_client.post(
        "/api/v2/sources",
        headers={"Authorization": "Bearer alice"},
        json={"url": "https://article.test/learning"},
    ).json()
    headers = {"Authorization": "Bearer bob"}
    assert (
        browser_client.get("/api/v2/sources", headers=headers).json()["sources"] == []
    )
    assert (
        browser_client.get(
            f"/api/v2/sources/{source['id']}", headers=headers
        ).status_code
        == 404
    )
    assert (
        browser_client.delete(
            f"/api/v2/sources/{source['id']}", headers=headers
        ).status_code
        == 404
    )
    assert (
        browser_client.get(
            f"/api/v2/sources/{source['id']}",
            headers={"Authorization": "Bearer alice"},
        ).status_code
        == 200
    )


def test_inaccessible_article_can_use_explicitly_labelled_pasted_text(browser_client):
    response = browser_client.post(
        "/api/v2/sources",
        headers={"Authorization": "Bearer alice"},
        json={"url": "https://article.test/blocked", "raw_text": ARTICLE_TEXT},
    )
    assert response.status_code == 201
    source = response.json()
    assert source["capture_origin"] == "pasted"
    assert source["coverage"] == "unknown"
    assert source["captured_text"] == ARTICLE_TEXT.strip()


@pytest.mark.parametrize(
    "url",
    [
        "http://127.0.0.1/private",
        "http://private.test/article",
        "https://article.test/redirect-private",
        "https://article.test/file.pdf",
        "https://article.test/download",
    ],
)
def test_non_public_or_unsupported_sources_are_not_saved(browser_client, url):
    headers = {"Authorization": "Bearer alice"}
    response = browser_client.post(
        "/api/v2/sources", headers=headers, json={"url": url}
    )
    assert response.status_code == 422
    assert (
        browser_client.get("/api/v2/sources", headers=headers).json()["sources"] == []
    )


def test_partial_capture_is_labelled_and_bounded(browser_client):
    response = browser_client.post(
        "/api/v2/sources",
        headers={"Authorization": "Bearer alice"},
        json={"url": "https://article.test/long"},
    )
    assert response.status_code == 201
    assert response.json()["coverage"] == "partial"
    assert len(response.json()["captured_text"]) == 120_000


def test_oversized_download_uses_reader_with_unconfirmed_coverage(browser_client):
    response = browser_client.post(
        "/api/v2/sources",
        headers={"Authorization": "Bearer alice"},
        json={"url": "https://article.test/large"},
    )
    assert response.status_code == 201
    assert response.json()["capture_origin"] == "reader"
    assert response.json()["coverage"] == "unknown"
    assert response.json()["captured_text"] == ARTICLE_TEXT.strip()


def test_requests_cannot_choose_the_source_owner(browser_client):
    response = browser_client.post(
        "/api/v2/sources",
        headers={"Authorization": "Bearer alice"},
        json={"url": "https://article.test/learning", "user_id": BOB},
    )
    assert response.status_code == 422
    assert browser_client.get("/api/v2/sources").status_code == 401
    assert (
        browser_client.get(
            "/api/v2/sources", headers={"Authorization": "Bearer invalid"}
        ).status_code
        == 401
    )


def test_repeated_urls_reuse_the_captured_source(browser_client):
    headers = {"Authorization": "Bearer alice"}
    first = browser_client.post(
        "/api/v2/sources",
        headers=headers,
        json={"url": "https://article.test/learning#one"},
    ).json()
    repeated = browser_client.post(
        "/api/v2/sources",
        headers=headers,
        json={"url": "https://article.test/learning#two"},
    ).json()
    assert repeated == first
    assert (
        len(browser_client.get("/api/v2/sources", headers=headers).json()["sources"])
        == 1
    )


def test_owner_can_delete_a_source_and_it_stays_removed(browser_client):
    headers = {"Authorization": "Bearer alice"}
    source = browser_client.post(
        "/api/v2/sources",
        headers=headers,
        json={"url": "https://article.test/delete"},
    ).json()
    assert (
        browser_client.delete(
            f"/api/v2/sources/{source['id']}", headers=headers
        ).status_code
        == 204
    )
    assert (
        browser_client.get(
            f"/api/v2/sources/{source['id']}", headers=headers
        ).status_code
        == 404
    )
    assert (
        browser_client.get("/api/v2/sources", headers=headers).json()["sources"] == []
    )


def test_list_sources_paginates_owned_records(browser_client):
    headers = {"Authorization": "Bearer alice"}
    for number in range(3):
        assert (
            browser_client.post(
                "/api/v2/sources",
                headers=headers,
                json={"url": f"https://article.test/page-{number}"},
            ).status_code
            == 201
        )
    first = browser_client.get("/api/v2/sources?limit=2", headers=headers).json()
    assert len(first["sources"]) == 2
    assert first["next_offset"] == 2
    last = browser_client.get(
        "/api/v2/sources?limit=2&offset=2", headers=headers
    ).json()
    assert len(last["sources"]) == 1
    assert last["next_offset"] is None


def test_unconfigured_storage_is_actionable(browser_client, monkeypatch):
    monkeypatch.delenv("SUPABASE_URL")
    response = browser_client.get(
        "/api/v2/sources", headers={"Authorization": "Bearer alice"}
    )
    assert response.status_code == 503
    assert "not configured" in response.json()["detail"]


def test_capture_preserves_query_values_and_keeps_distinct_resource_identity(
    browser_client,
):
    headers = {"Authorization": "Bearer alice"}
    first = browser_client.post(
        "/api/v2/sources",
        headers=headers,
        json={"url": "https://article.test/identity?path=/chapter/#intro"},
    ).json()
    assert first["captured_text"].startswith("Query: path=/chapter/\n")
    assert first["canonical_url"] == "https://article.test/identity?path=/chapter/"
    other = browser_client.post(
        "/api/v2/sources",
        headers=headers,
        json={"url": "https://article.test/identity?path=/chapter"},
    ).json()
    assert other["id"] != first["id"]
