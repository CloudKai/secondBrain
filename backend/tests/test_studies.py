"""Owned study endpoints across real HTTP adapters and strict response models."""

import json

import httpx
import pytest
from fastapi.testclient import TestClient

from backend.main import app

ALICE = "11111111-1111-4111-8111-111111111111"
SOURCE = "33333333-3333-4333-8333-333333333333"
ROW = {
    "sections_total": 0,
    "sections_completed": 0,
    "source_id": SOURCE,
    "source_version": 1,
    "user_id": ALICE,
    "status": "queued",
    "attempts": 0,
    "max_attempts": 3,
    "next_attempt_at": "2026-10-03T00:00:00Z",
    "error_code": None,
    "note": None,
    "updated_at": "2026-10-03T00:00:00Z",
}


@pytest.fixture
def studies_client(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://supabase.test")
    monkeypatch.setenv("SUPABASE_PUBLISHABLE_KEY", "test-public")
    requests = []

    def external(request):
        requests.append(request)
        assert request.headers["apikey"] == "test-public"
        token = request.headers.get("authorization")
        if request.url.path == "/auth/v1/user":
            return httpx.Response(
                200,
                json={
                    "id": ALICE
                    if token == "Bearer alice"
                    else "22222222-2222-4222-8222-222222222222"
                },
            )
        if request.url.path == "/rest/v1/rpc/request_source_study":
            body = json.loads(request.content)
            assert set(body) == {"p_source_id", "p_retry"}
            if token != "Bearer alice" or body["p_source_id"] != SOURCE:
                return httpx.Response(
                    400, json={"code": "P0002", "message": "Source not found"}
                )
            return httpx.Response(200, json=ROW)
        if request.url.path == "/rest/v1/source_studies":
            assert request.url.params["user_id"].startswith("eq.")
            return httpx.Response(200, json=[ROW] if token == "Bearer alice" else [])
        raise AssertionError(str(request.url))

    original = httpx.AsyncClient
    monkeypatch.setattr(
        httpx,
        "AsyncClient",
        lambda **kw: original(**{**kw, "transport": httpx.MockTransport(external)}),
    )
    return TestClient(app), requests


def test_generation_acceptance_is_owned_and_returns_durable_status_without_note(
    studies_client,
):
    client, requests = studies_client
    for _ in range(2):
        response = client.post(
            f"/api/v2/sources/{SOURCE}/study",
            headers={"Authorization": "Bearer alice"},
            json={},
        )
        assert response.status_code == 202
        assert response.json() == {k: v for k, v in ROW.items() if k != "user_id"}
    assert (
        len([r for r in requests if r.url.path.endswith("request_source_study")]) == 2
    )
    assert (
        client.get("/api/v2/studies", headers={"Authorization": "Bearer alice"}).json()[
            "studies"
        ][0]["source_id"]
        == SOURCE
    )


def test_other_owner_unknown_fields_and_missing_session_cannot_generate(studies_client):
    client, _ = studies_client
    assert (
        client.post(
            f"/api/v2/sources/{SOURCE}/study",
            headers={"Authorization": "Bearer bob"},
            json={},
        ).status_code
        == 404
    )
    assert (
        client.post(
            f"/api/v2/sources/{SOURCE}/study",
            headers={"Authorization": "Bearer alice"},
            json={"user_id": ALICE},
        ).status_code
        == 422
    )
    assert client.post(f"/api/v2/sources/{SOURCE}/study", json={}).status_code == 401
    assert (
        client.get("/api/v2/studies", headers={"Authorization": "Bearer bob"}).json()[
            "studies"
        ]
        == []
    )
