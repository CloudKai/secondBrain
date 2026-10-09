"""Teaching selection through authenticated API and external HTTP responses."""
import hashlib
import json
from uuid import UUID, uuid5

import httpx
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.tests.test_learning import ALICE, BOB, SOURCE, PLAN, PATH, REQUEST, CONTENT, NOTE, TEXT

COLLECTION = "77777777-7777-4777-8777-777777777777"
GENERATION = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
URL = f"/api/v2/learning/collections/{COLLECTION}/plans/{PLAN}/evidence-preview"
HIDDEN = "The checkpoint retains sixteen committed segments after an outage."
CAPTURE = TEXT + "\n\n" + HIDDEN
HEADERS = {"Authorization": "Bearer alice"}


@pytest.fixture
def evidence_client(monkeypatch):
    for name, value in {"SUPABASE_URL": "https://supabase.test", "SUPABASE_PUBLISHABLE_KEY": "public-test",
                        "OPENAI_API_KEY": "model-test", "QDRANT_URL": "https://qdrant.test",
                        "QDRANT_API_KEY": "qdrant-test"}.items():
        monkeypatch.setenv(name, value)
    plan = {"id": PLAN, "path_id": PATH, "request_id": REQUEST, "source_id": SOURCE,
            "source_title": "Checkpoint evidence", "source_version": 1, "goal": "Understand durable checkpoints",
            "difficulty": "foundation", "content": CONTENT, "references": NOTE["references"],
            "confirmed_at": "2026-10-09T00:00:00Z", "active": True, "needs_review": False,
            "model": "gpt-6-luna", "policy_version": "learning_v1", "created_at": "2026-10-09T00:00:00Z"}
    detail = {"user_id": ALICE, "collection": {"id": COLLECTION, "legacy_source_id": SOURCE,
              "title": "Checkpoints", "goal": plan["goal"], "revision": 1, "source_count": 1,
              "path_count": 1, "original_source_available": True, "created_at": "2026-10-09T00:00:00Z",
              "updated_at": "2026-10-09T00:00:00Z"}, "sources": [{"id": SOURCE,
              "title": "Checkpoint evidence", "source_kind": "article", "source_version": 1}],
              "learning": {"user_id": ALICE, "source_id": SOURCE, "plans": [plan], "attempts": [], "activities": []}}
    inventory = [{"source_id": SOURCE, "user_id": ALICE, "source_version": 1, "scope": "note",
                  "generation": GENERATION, "capture_sha256": hashlib.sha256(CAPTURE.encode()).hexdigest(),
                  "chunks_total": 1, "study_updated_at": "2026-10-09T00:00:00Z", "map_updated_at": None}]
    row = {"source_id": SOURCE, "user_id": ALICE, "title": "Checkpoint evidence", "source_version": 1,
           "captured_text": CAPTURE, "document": None, "transcript": None, "note": NOTE,
           "study_updated_at": "2026-10-09T00:00:00Z", "map_updated_at": None, "scope": "note"}
    hit = {"id": str(uuid5(UUID(GENERATION), "0")), "payload": {
           "user_id": ALICE, "source_id": SOURCE, "source_version": 1, "generation": GENERATION,
           "capture_sha256": inventory[0]["capture_sha256"], "chunk_policy": "structure_recursive_v1",
           "embedding_model": "text-embedding-3-small", "chunk_index": 0,
           "start": len(TEXT) + 2, "end": len(CAPTURE), "page": None, "start_ms": None, "end_ms": None}}
    state = {"detail": detail, "inventory": inventory, "rows": [row], "points": [hit],
             "valid": True, "provider_status": 200, "calls": []}

    def external(request):
        state["calls"].append(request.url.path)
        owner = request.headers.get("authorization") == "Bearer alice"
        if request.url.path == "/auth/v1/user":
            return httpx.Response(200, json={"id": ALICE if owner else BOB})
        body = json.loads(request.content)
        if request.url.path.endswith("/get_learning_collection"):
            assert body == {"p_collection_id": COLLECTION}
            return httpx.Response(200, json=detail) if owner else httpx.Response(404, json={"code": "P0002"})
        if request.url.path.endswith("/get_assistant_search_inventory"):
            assert body["p_library"] is False and body["p_topic_id"] is None
            return httpx.Response(200, json=[item for item in state["inventory"] if item["source_id"] == body["p_source_id"]])
        if request.url.path.endswith("/get_hybrid_assistant_context"):
            return httpx.Response(200, json=[item for item in state["rows"] if item["source_id"] == body["p_source_id"]])
        if request.url.path.endswith("/validate_hybrid_assistant_context"):
            return httpx.Response(200, json=state["valid"])
        if request.url.path == "/v1/embeddings":
            assert body["input"] == ["How are committed checkpoint segments retained?"]
            assert len(body["input"]) == 1
            return httpx.Response(state["provider_status"], json={"data": [{"index": 0, "embedding": [0.1] * 1536}]})
        assert request.url.path.endswith("/points/query"), str(request.url)
        assert [p["using"] for p in body["prefetch"]] == ["dense", "bm25"]
        if state.get("change_after_search"):
            plan["needs_review"] = True
        return httpx.Response(200, json={"status": "ok", "result": {"points": state["points"]}})

    original = httpx.AsyncClient
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: original(**{**kw, "transport": httpx.MockTransport(external)}))
    return TestClient(app), state


def preview(client, **body):
    return client.post(URL, headers=HEADERS, json={"query": "How are committed checkpoint segments retained?", **body})


def test_preview_finds_exact_material_absent_from_note_without_generating_a_lesson(evidence_client):
    client, state = evidence_client
    response = preview(client)
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["policy_version"] == "teaching_evidence_v1"
    assert result["references"][0]["passage"]["excerpt"] == HIDDEN
    assert result["references"][0]["passage"]["start"] == len(TEXT) + 2
    assert result["references"][0]["source_id"] == SOURCE
    assert result["collection_source_count"] == result["plan_source_count"] == 1
    assert result["sources"][0]["selected_passages"] == 1
    assert result["gap"] is None and result["limitations"]
    assert "user_id" not in result
    assert not any("finish_" in call or call == "/v1/responses" for call in state["calls"])


@pytest.mark.parametrize("kind", ["pdf", "video"])
def test_full_capture_preview_preserves_physical_page_and_original_caption_time(evidence_client, kind):
    client, state = evidence_client
    row = state["rows"][0]
    hit = state["points"][0]["payload"]
    if kind == "pdf":
        row["document"] = {"filename": "Checkpoint.pdf", "page_count": 6, "selected_pages": {"start": 6, "end": 6},
                           "pages": [{"page": 6, "start": 0, "end": len(CAPTURE)}]}
        hit["page"] = 6
    else:
        row["captured_text"] = TEXT + "\n" + HIDDEN
        state["inventory"][0]["capture_sha256"] = hashlib.sha256(row["captured_text"].encode()).hexdigest()
        row["transcript"] = {"provider": "youtube", "format": "vtt", "filename": None, "selected_time": None,
                             "segments": [{"start": 0, "end": len(TEXT), "start_ms": 0, "end_ms": 10000},
                                          {"start": len(TEXT) + 1, "end": len(row["captured_text"]), "start_ms": 13000, "end_ms": 18000}]}
        hit.update(start_ms=13000, end_ms=18000, start=len(TEXT)+1, end=len(row["captured_text"]),
                   capture_sha256=state["inventory"][0]["capture_sha256"])
    response = preview(client)
    assert response.status_code == 200, response.text
    passage = response.json()["references"][0]["passage"]
    assert passage["excerpt"] == HIDDEN
    assert passage["page"] == (6 if kind == "pdf" else None)
    assert passage["start_ms"] == (13000 if kind == "video" else None)
    assert passage["end_ms"] == (18000 if kind == "video" else None)


@pytest.mark.parametrize("change, expected", [
    ("owner", 503), ("generation", 503), ("version", 503), ("hash", 503), ("location", 503),
    ("stale_capture", 409), ("stale_index", 409), ("stale_plan", 409), ("unconfirmed", 404),
    ("unrelated", 404), ("outage", 503), ("indexing", 409),
])
def test_preview_rejects_unowned_stale_unready_or_invalid_evidence(evidence_client, change, expected):
    client, state = evidence_client
    hit = state["points"][0]["payload"]
    if change in ("owner", "generation", "version", "hash", "location"):
        field, value = {"owner": ("user_id", BOB), "generation": ("generation", COLLECTION),
                        "version": ("source_version", 2), "hash": ("capture_sha256", "0" * 64),
                        "location": ("page", 99)}[change]
        hit[field] = value
    elif change == "stale_capture":
        state["rows"][0]["captured_text"] += " Changed while retrieving."
    elif change == "stale_index":
        state["valid"] = False
    elif change == "stale_plan":
        state["detail"]["learning"]["plans"][0]["needs_review"] = True
    elif change == "unconfirmed":
        state["detail"]["learning"]["plans"][0]["confirmed_at"] = None
        state["detail"]["learning"]["plans"][0]["active"] = False
        state["detail"]["collection"]["path_count"] = 0
    elif change == "unrelated":
        state["detail"]["learning"]["plans"][0]["id"] = PATH
    elif change == "outage":
        state["provider_status"] = 503
    else:
        state["inventory"][0].update(generation=None, chunks_total=0)
    response = preview(client)
    assert response.status_code == expected, response.text
    assert not any("finish_" in call or call == "/v1/responses" for call in state["calls"])


def test_empty_preview_reports_an_evidence_gap_and_does_not_invent_support(evidence_client):
    client, state = evidence_client
    state["points"] = []
    response = preview(client)
    assert response.status_code == 200, response.text
    assert response.json()["references"] == [] and response.json()["gap"]
    assert response.json()["sources"][0]["selected_passages"] == 0


def test_preview_requires_authentication_and_rejects_client_scope_or_owner(evidence_client):
    client, state = evidence_client
    assert client.post(URL, json={"query": "Explain evidence"}).status_code == 401
    assert client.post(URL, json={"query": "Explain evidence"}, headers={"Authorization": "Bearer bob"}).status_code == 404
    for values in [{"query": " "}, {"query": " leading"}, {"query": "x" * 2001}, {"user_id": ALICE},
                   {"source_ids": [SOURCE]}, {"allow_partial": "true"}]:
        assert preview(client, **values).status_code == 422


def add_supporting_source(state, ready=True):
    other = "88888888-8888-4888-8888-888888888888"
    state["inventory"].append({**state["inventory"][0], "source_id": other,
                               "generation": GENERATION if ready else None, "chunks_total": 1 if ready else 0})
    state["rows"].append({**state["rows"][0], "source_id": other, "title": "Second checkpoint source"})
    detail = state["detail"]
    detail["collection"]["source_count"] = 2
    detail["sources"].append({**detail["sources"][0], "id": other, "title": "Second checkpoint source"})
    detail["learning"]["plans"][0]["source_members"] = [
        {"source_id": sid, "source_version": 1, "title": "Checkpoint evidence", "topic_fingerprint": "0" * 32}
        for sid in (SOURCE, other)]
    return other


def test_unready_sources_require_explicit_partial_choice_and_remain_visible(evidence_client):
    client, state = evidence_client
    other = add_supporting_source(state, ready=False)
    assert preview(client).status_code == 409
    assert "/v1/embeddings" not in state["calls"]
    response = preview(client, allow_partial=True)
    assert response.status_code == 200, response.text
    assert response.json()["indexing_partial"] is True
    assert response.json()["sources"][1] == {"source_id": other, "source_version": 1,
                                            "status": "unavailable", "selected_passages": 0}
    assert any("excluded" in text for text in response.json()["limitations"])
    state["inventory"][0].update(generation=None, chunks_total=0)
    assert preview(client, allow_partial=True).status_code == 409


def test_plan_change_during_retrieval_rejects_the_preview(evidence_client):
    client, state = evidence_client
    state["change_after_search"] = True
    assert preview(client).status_code == 409


def test_multiple_sources_are_bounded_fairly_and_unicode_formula_spans_remain_exact(evidence_client):
    client, state = evidence_client
    other = add_supporting_source(state)
    paragraphs = [f"Qualification {i}: ∫ x² dx = x³/3 + C; " + "preserve the stated assumptions " * 24 for i in range(12)]
    capture = TEXT + "\n\n" + "\n\n".join(paragraphs)
    digest = hashlib.sha256(capture.encode()).hexdigest()
    state["points"] = []
    for sid, row, inventory in zip((SOURCE, other), state["rows"], state["inventory"]):
        row["captured_text"] = capture
        inventory.update(capture_sha256=digest, chunks_total=12)
        start = len(TEXT) + 2
        # Distinct ready generations give each source a distinct Qdrant point identity.
        generation = GENERATION if sid == SOURCE else COLLECTION
        inventory["generation"] = generation
        for index, paragraph in enumerate(paragraphs):
            state["points"].append({"id": str(uuid5(UUID(generation), str(index))), "payload": {
                "user_id": ALICE, "source_id": sid, "source_version": 1, "generation": generation,
                "capture_sha256": digest, "chunk_policy": "structure_recursive_v1",
                "embedding_model": "text-embedding-3-small", "chunk_index": index,
                "start": start, "end": start + len(paragraph), "page": None, "start_ms": None, "end_ms": None}})
            start += len(paragraph) + 2
    response = preview(client)
    assert response.status_code == 200, response.text
    result = response.json()
    assert 0 < len(result["references"]) <= 24
    assert sum(len(item["passage"]["excerpt"]) for item in result["references"]) <= 16000
    counts = [source["selected_passages"] for source in result["sources"]]
    assert min(counts) > 0 and abs(counts[0] - counts[1]) <= 1
    for item in result["references"]:
        passage = item["passage"]
        assert passage["excerpt"] == capture[passage["start"]:passage["end"]]
        assert "∫ x² dx = x³/3 + C" in passage["excerpt"]
