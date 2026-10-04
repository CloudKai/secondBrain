"""Saved-library corrections through the authenticated HTTP boundary."""

import json
import httpx
from fastapi.testclient import TestClient
from backend.main import app

ALICE = "11111111-1111-4111-8111-111111111111"
TOPIC = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"


def test_owned_rename_delegates_only_valid_correction_and_rejects_forged_owner(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://supabase.test")
    monkeypatch.setenv("SUPABASE_PUBLISHABLE_KEY", "public-test")
    sent = []

    def external(request):
        if request.url.path == "/auth/v1/user":
            return httpx.Response(200, json={"id": ALICE})
        assert request.url.path == "/rest/v1/rpc/correct_topic_library"
        sent.append(json.loads(request.content))
        if request.headers["authorization"] == "Bearer bob":
            return httpx.Response(404, json={"code": "P0002"})
        return httpx.Response(200, json=True)

    original = httpx.AsyncClient
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: original(**{**kw, "transport": httpx.MockTransport(external)}))
    with TestClient(app) as client:
        action = {"action": "rename", "topic_id": TOPIC, "title": "Retrieval grounded generation"}
        url = "/api/v2/topic-corrections"
        assert client.post(url, json=action, headers={"Authorization": "Bearer alice"}).status_code == 204
        assert sent == [{"p_action": action}]
        assert client.post(url, json=action, headers={"Authorization": "Bearer bob"}).status_code == 404
        assert client.post(url, json=action).status_code == 401
        for invalid in [{**action, "user_id": ALICE}, {**action, "title": "  "}, {**action, "topic_id": "wrong"}]:
            assert client.post(url, json=invalid, headers={"Authorization": "Bearer alice"}).status_code == 422
        for correction in [
            {"action": "assign", "source_id": "33333333-3333-4333-8333-333333333333", "topic_ids": [TOPIC], "evidence_ids": ["p0001"]},
            {"action": "merge", "topic_id": TOPIC, "target_id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"},
            {"action": "connection", "source": TOPIC, "target": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "state": "rejected"},
        ]:
            assert client.post(url, json=correction, headers={"Authorization": "Bearer alice"}).status_code == 204
            assert sent[-1] == {"p_action": correction}
        for evidence in ["", "x" * 17]:
            invalid = {"action": "assign", "source_id": "33333333-3333-4333-8333-333333333333", "topic_ids": [TOPIC], "evidence_ids": [evidence]}
            assert client.post(url, json=invalid, headers={"Authorization": "Bearer alice"}).status_code == 422
