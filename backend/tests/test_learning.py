"""Learning journeys through authenticated API and provider HTTP boundaries."""
import json

import httpx
import pytest
from fastapi.testclient import TestClient

from backend.main import app

ALICE = "11111111-1111-4111-8111-111111111111"
BOB = "22222222-2222-4222-8222-222222222222"
SOURCE = "33333333-3333-4333-8333-333333333333"
REQUEST = "44444444-4444-4444-8444-444444444444"
PLAN = "55555555-5555-4555-8555-555555555555"
PATH = "66666666-6666-4666-8666-666666666666"
LEASE = "77777777-7777-4777-8777-777777777777"
TEXT = "Retrieval finds relevant passages before a model generates an answer. Evidence must support the answer; finding similar wording alone does not establish that support."
REFERENCE = {"id": "p0001", "start": 0, "end": len(TEXT), "excerpt": TEXT, "page": None, "start_ms": None, "end_ms": None}
EXPLANATION = {"text": "Retrieval selects passages; generation uses them to answer. Check whether the passages actually support the answer.", "citation_ids": ["p0001"]}
LESSON = {
    "title": "Explain retrieval before generation", "outcome": "Distinguish finding relevant passages from verifying an answer.",
    "explanation": EXPLANATION,
    "example": {"text": "Imagine looking up a recipe before deciding what to cook. Finding a recipe and checking its ingredients are separate steps.", "provenance": "generated_example", "citation_ids": []},
    "check": {"kind": "apply", "question": "A retrieved passage has similar words but does not support an answer. What should happen next?",
              "criteria": ["Distinguishes relevance from support", "Does not accept unsupported answers"],
              "hint": "What does similarity establish?", "worked_answer": EXPLANATION},
}
CONTENT = {"title": "Reason about evidence", "outcomes": [LESSON["outcome"]], "prerequisites": [], "coverage": "This source covers retrieval and support, not implementation.", "gaps": ["No retrieval implementation details"], "background": [], "lessons": [LESSON]}
DRAFT = {"suggested_goal": "Explain how retrieval and evidence support differ.", "paths": [CONTENT]}
SOURCE_ROW = {"id": SOURCE, "user_id": ALICE, "source_version": 1, "original_url": "https://example.com/rag", "canonical_url": "https://example.com/rag", "title": "RAG evidence", "source_kind": "article", "document": None, "transcript": None, "captured_text": TEXT, "captured_at": "2026-10-09T00:00:00Z", "capture_origin": "direct", "coverage": "complete", "coverage_detail": "Captured article text", "study_status": "pending"}
NOTE = {"overview": EXPLANATION, "concepts": [{"title": "Retrieval", **EXPLANATION}], "examples": [], "equations": [], "recall": [{"question": "What is support?", "answer": TEXT, "citation_ids": ["p0001"]}], "references": [REFERENCE]}


@pytest.fixture
def learning_client(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://supabase.test")
    monkeypatch.setenv("SUPABASE_PUBLISHABLE_KEY", "public-test")
    monkeypatch.setenv("OPENAI_API_KEY", "model-test-key")
    monkeypatch.setenv("SUPABASE_SECRET_KEY", "server-test-key")
    state = {"source_id": SOURCE, "user_id": ALICE, "plans": [], "attempts": [], "activities": []}
    provider = {"draft": DRAFT, "models": [], "status": 200, "source_version": 1}

    def external(request):
        owner = request.headers.get("authorization") == "Bearer alice"
        if request.url.path == "/auth/v1/user":
            return httpx.Response(200, json={"id": ALICE if owner else BOB})
        if request.url.path == "/rest/v1/rpc/get_learning_history":
            return httpx.Response(200, json={"user_id": ALICE if owner else BOB, "collections": [{"source_id": SOURCE, "title": "RAG evidence", "source_available": True}] if owner else [], "next_offset": None})
        if request.url.path == "/rest/v1/rpc/get_learning_summary":
            return httpx.Response(200, json=provider.get("summary", {"user_id": ALICE if owner else BOB, "resume": None, "studied_lessons": 0, "practice_attempts": 0, "provisional_checks": 0, "pending_feedback": 0, "failed_feedback": 0}))
        if request.url.path == "/rest/v1/rpc/get_learning_collection":
            return httpx.Response(200, json=provider["collection"]) if owner else httpx.Response(404, json={"code": "P0002"})
        if request.url.path == "/rest/v1/rpc/list_learning_collections":
            return httpx.Response(200, json={"user_id": ALICE if owner else BOB, "collections": [provider["collection"]["collection"]] if owner else [], "next_offset": None})
        if request.url.path == "/rest/v1/rpc/resolve_source_learning_collection":
            assert json.loads(request.content) == {"p_source_id": SOURCE}
            return httpx.Response(200, json=provider["collection"]) if owner else httpx.Response(404, json={"code": "P0002"})
        if request.url.path == "/rest/v1/rpc/select_learning_collection_lesson":
            body = json.loads(request.content)
            if not owner or body["p_collection_id"] != provider["collection"]["collection"]["id"]:
                return httpx.Response(404, json={"code": "P0002"})
            if body["p_expected_revision"] != state.get("selected_place_revision", 0):
                return httpx.Response(409, json={"code": "40001"})
            state.update(selected_plan_id=body["p_plan_id"], selected_lesson_index=body["p_lesson_index"], selected_place_revision=state.get("selected_place_revision", 0)+1)
            return httpx.Response(200, json=provider["collection"])
        if request.url.path == "/rest/v1/rpc/get_learning_graph":
            return httpx.Response(200, json={"user_id": ALICE if owner else BOB, "partial": False, "collections": [{"source_id": SOURCE, "title": "RAG evidence", "source_available": True, "source_ids": [SOURCE], "path_count": 1, "studied_lessons": 1, "practice_attempts": 1, "provisional_checks": 1, "flagged_plans": 0}] if owner else []})
        if request.url.path == "/rest/v1/rpc/get_source_learning":
            assert json.loads(request.content) == {"p_source_id": SOURCE}
            return httpx.Response(200, json=state) if owner else httpx.Response(404, json={"code": "P0002"})
        if request.url.path == "/rest/v1/rpc/select_learning_lesson_checked":
            body = json.loads(request.content)
            if not owner:
                return httpx.Response(404, json={"code": "P0002"})
            if body["p_expected_revision"] != state.get("selected_place_revision", 0):
                return httpx.Response(409, json={"code": "40001"})
            state.update(selected_plan_id=body["p_plan_id"], selected_lesson_index=body["p_lesson_index"], selected_place_revision=state.get("selected_place_revision", 0)+1)
            return httpx.Response(200, json=state)
        if request.url.path == "/rest/v1/rpc/select_learning_lesson":
            body = json.loads(request.content)
            if not owner or not any(plan["id"] == body["p_plan_id"] and plan["confirmed_at"] for plan in state["plans"]):
                return httpx.Response(404, json={"code": "P0002"})
            if body["p_lesson_index"] != 0:
                return httpx.Response(400, json={"code": "22023"})
            state.update(selected_plan_id=body["p_plan_id"], selected_lesson_index=body["p_lesson_index"])
            return httpx.Response(200, json=state)
        if request.url.path == "/rest/v1/rpc/get_learning_candidates":
            return httpx.Response(200, json={"user_id": ALICE, "source_id": SOURCE, "plan_id": PLAN, "candidates": [{"source_id": REQUEST, "source_version": 1, "title": "Evaluating evidence", "shared_topics": ["Evidence"]}]}) if owner else httpx.Response(404, json={"code": "P0002"})
        if request.url.path == "/rest/v1/rpc/request_learning_revision":
            if not owner:
                return httpx.Response(404, json={"code": "P0002"})
            body = json.loads(request.content)
            provider["revision_goal"] = body.get("p_goal")
            other = {**SOURCE_ROW, "id": REQUEST, "title": "Evaluating evidence"}
            return httpx.Response(200, json={"user_id": ALICE, "source_id": SOURCE, "request_id": body["p_request_id"], "lease_token": LEASE, "base_plan": state["plans"][0], "mode": "goal_branch" if body.get("p_goal") else "add_source" if body["p_source_id"] else "difficulty", "goal": body.get("p_goal"), "difficulty": body.get("p_difficulty") or "foundation", "sources": provider.get("revision_sources", [{"source": SOURCE_ROW, "note": NOTE}, {"source": other, "note": NOTE}])})
        if request.url.path == "/rest/v1/rpc/finish_learning_revision":
            assert request.headers["apikey"] == "server-test-key"
            body = json.loads(request.content)
            provider["saved_revision"] = body
            if body["p_draft"]:
                state["plans"].append({**state["plans"][0], "id": LEASE, "request_id": body["p_request_id"], "content": body["p_draft"]["path"], "revision": {key: value for key, value in body["p_draft"].items() if key != "path"}, "base_plan_id": PLAN, "branch_of_plan_id": PLAN if provider.get("revision_goal") else None, "goal": provider.get("revision_goal") or state["plans"][0]["goal"], "evidence": body["p_evidence"], "references": [{**r["passage"], "id": r["id"]} for r in body["p_evidence"]], "confirmed_at": None, "active": False})
            return httpx.Response(200, json=True)
        if request.url.path == "/rest/v1/rpc/request_learning_preview":
            if provider.get("rpc_error"):
                return httpx.Response(400, json={"code": provider["rpc_error"]})
            if not owner:
                return httpx.Response(404, json={"code": "P0002"})
            body = json.loads(request.content)
            if body["p_source_version"] != provider["source_version"]:
                return httpx.Response(409, json={"code": "40001"})
            return httpx.Response(200, json={"user_id": ALICE, "request_id": body["p_request_id"], "source": provider.get("source", SOURCE_ROW), "note": provider.get("note", NOTE), "path_direction": CONTENT if body["p_path_id"] else None, "lease_token": None if any(p["request_id"]==body["p_request_id"] for p in state["plans"]) else LEASE})
        if request.url.path == "/v1/responses":
            body = json.loads(request.content)
            provider["models"].append(body["model"])
            provider["last_input"] = json.loads(body["input"])
            provider["input_length"] = len(body["input"]) + len(body["instructions"])
            assert body["reasoning"] == {"effort": "medium"}
            assert body["text"]["format"]["strict"] is True
            assert request.headers["authorization"] == "Bearer model-test-key"
            if provider["status"] != 200:
                return httpx.Response(provider["status"], json={"error": {"message": "Unavailable"}})
            return httpx.Response(200, json={"status": "completed", "output": [{"type": "message", "content": [{"type": "output_text", "text": json.dumps(provider["draft"])}]}]})
        if request.url.path == "/rest/v1/rpc/finish_learning_preview":
            assert request.headers["apikey"] == "server-test-key"
            body = json.loads(request.content)
            if body["p_draft"]:
                state["plans"] = [{"id": PLAN, "path_id": PATH, "request_id": REQUEST, "source_id": SOURCE, "source_title": "RAG evidence", "source_version": 1, "goal": body["p_goal"], "difficulty": "foundation", "content": body["p_draft"]["paths"][0], "references": body["p_references"], "confirmed_at": None, "active": False, "needs_review": False, "model": body["p_model"], "policy_version": "learning_v1", "created_at": "2026-10-09T00:00:00Z"}]
            return httpx.Response(200, json=True)
        if request.url.path in ("/rest/v1/rpc/confirm_learning_plan", "/rest/v1/rpc/submit_learning_attempt", "/rest/v1/rpc/record_learning_activity"):
            if not owner:
                return httpx.Response(404, json={"code": "P0002"})
            body = json.loads(request.content)
            if provider["source_version"] != 1:
                return httpx.Response(409, json={"code": "40001"})
            plan = state["plans"][0]
            if request.url.path.endswith("confirm_learning_plan"):
                plan.update(confirmed_at="2026-10-09T00:00:00Z", active=True)
            elif request.url.path.endswith("submit_learning_attempt"):
                if not plan["confirmed_at"]:
                    return httpx.Response(409, json={"code": "40001"})
                if not state["attempts"]:
                    state["attempts"].append({"id": body["p_request_id"], "plan_id": PLAN, "lesson_index": 0,
                                              "response": body["p_response"], "difficulty": "foundation", "status": "pending",
                                              "feedback": None, "created_at": "2026-10-09T00:00:00Z"})
            else:
                state["activities"] = [{"plan_id": PLAN, "lesson_index": body["p_lesson_index"], "kind": body["p_kind"]}]
            return httpx.Response(200, json=state)
        if request.url.path == "/rest/v1/rpc/claim_learning_feedback":
            body = json.loads(request.content)
            attempt = next(a for a in state["attempts"] if a["id"] == body["p_attempt_id"])
            return httpx.Response(200, json={"user_id": ALICE, "source_id": SOURCE, "attempt_id": attempt["id"], "plan_id": PLAN,
                                            "lesson_index": 0, "response": attempt["response"], "lease_token": LEASE if attempt["status"] != "needs_review" else None})
        if request.url.path == "/rest/v1/rpc/finish_learning_feedback":
            assert request.headers["apikey"] == "server-test-key"
            body = json.loads(request.content)
            attempt = state["attempts"][0]
            attempt.update(feedback=body["p_feedback"], status="needs_review" if body["p_feedback"] else "failed")
            return httpx.Response(200, json=True)
        raise AssertionError(str(request.url))

    original = httpx.AsyncClient
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: original(**{**kw, "transport": httpx.MockTransport(external)}))
    return TestClient(app), state, provider


def test_learning_collection_is_owned_and_does_not_activate_without_confirmation(learning_client):
    client, _, _ = learning_client
    url = f"/api/v2/sources/{SOURCE}/learning"
    response = client.get(url, headers={"Authorization": "Bearer alice"})
    assert response.status_code == 200, response.text
    assert response.json() == {"source_id": SOURCE, "selected_plan_id": None, "selected_lesson_index": 0, "selected_place_revision": 0, "plans": [], "attempts": [], "activities": []}
    assert client.get(url, headers={"Authorization": "Bearer bob"}).status_code == 404
    assert client.get(url).status_code == 401


def test_learning_rejects_unowned_storage_response(learning_client):
    client, state, _ = learning_client
    state["user_id"] = BOB
    assert client.get(f"/api/v2/sources/{SOURCE}/learning", headers={"Authorization": "Bearer alice"}).status_code == 503


def test_one_source_teaching_preview_uses_request_model_and_retains_exact_evidence(learning_client):
    client, _, provider = learning_client
    url = f"/api/v2/sources/{SOURCE}/learning/preview"
    payload = {"request_id": REQUEST, "source_version": 1, "goal": "Understand evidence", "difficulty": "foundation", "path_id": None}
    response = client.post(url, json=payload, headers={"Authorization": "Bearer alice"})
    assert response.status_code == 200, response.text
    plan = response.json()["plans"][0]
    assert plan["goal"] == "Understand evidence"
    assert plan["references"] == [REFERENCE]
    assert plan["content"]["lessons"][0]["check"]["criteria"] == LESSON["check"]["criteria"]
    assert plan["confirmed_at"] is None and plan["active"] is False
    assert provider["models"] == ["gpt-6-luna"]
    assert client.post(url, json=payload, headers={"Authorization": "Bearer alice"}).json() == response.json()
    assert provider["models"] == ["gpt-6-luna"]
    assert client.post(url, json=payload, headers={"Authorization": "Bearer bob"}).status_code == 404


def create_preview(client):
    response = client.post(f"/api/v2/sources/{SOURCE}/learning/preview", json={"request_id": REQUEST, "source_version": 1}, headers={"Authorization": "Bearer alice"})
    assert response.status_code == 200, response.text


def test_confirmed_path_saves_attempt_before_feedback_and_reopening_restores_it(learning_client):
    client, _, provider = learning_client
    create_preview(client)
    base = f"/api/v2/sources/{SOURCE}/learning/plans/{PLAN}"
    answer = {"request_id": LEASE, "lesson_index": 0, "response": "Find evidence that supports the answer, instead of relying only on similar words."}
    assert client.post(base + "/attempts", json=answer, headers={"Authorization": "Bearer alice"}).status_code == 409
    response = client.post(base + "/confirm", headers={"Authorization": "Bearer alice"})
    assert response.status_code == 200, response.text
    assert response.json()["plans"][0]["active"] is True
    response = client.post(base + "/attempts", json=answer, headers={"Authorization": "Bearer alice"})
    assert response.status_code == 202, response.text
    assert response.json()["attempts"][0]["response"] == answer["response"]
    assert response.json()["attempts"][0]["status"] == "pending"
    assert provider["models"] == ["gpt-6-luna"]
    client.post(base + "/attempts", json=answer, headers={"Authorization": "Bearer alice"})
    restored = client.get(f"/api/v2/sources/{SOURCE}/learning", headers={"Authorization": "Bearer alice"}).json()
    assert len(restored["attempts"]) == 1
    assert restored["attempts"][0]["difficulty"] == "foundation"
    assert client.post(base + "/confirm", headers={"Authorization": "Bearer bob"}).status_code == 404


def test_feedback_is_criteria_specific_and_inconclusive_without_calibrated_grading(learning_client):
    client, _, provider = learning_client
    create_preview(client)
    base = f"/api/v2/sources/{SOURCE}/learning"
    client.post(base + f"/plans/{PLAN}/confirm", headers={"Authorization": "Bearer alice"})
    client.post(base + f"/plans/{PLAN}/attempts", json={"request_id": LEASE, "lesson_index": 0, "response": "Similar is not the same as supported."}, headers={"Authorization": "Bearer alice"})
    provider["draft"] = {"summary": "You distinguish similarity from support. Explain what you would do next.", "criteria": [
        {"criterion_index": 0, "observation": "You identify the distinction.", "assessment": "addressed", "citation_ids": ["p0001"]},
        {"criterion_index": 1, "observation": "Add how to handle the unsupported answer.", "assessment": "try_again", "citation_ids": ["p0001"]}],
        "next_hint": "Would you accept, revise or find additional evidence?"}
    response = client.post(base + f"/attempts/{LEASE}/feedback", headers={"Authorization": "Bearer alice"})
    assert response.status_code == 200, response.text
    attempt = response.json()["attempts"][0]
    assert attempt["status"] == "needs_review"
    assert attempt["feedback"]["criteria"][1]["assessment"] == "try_again"
    assert attempt["response"] == "Similar is not the same as supported."
    assert provider["models"] == ["gpt-6-luna", "gpt-6-luna"]
    client.post(base + f"/attempts/{LEASE}/feedback", headers={"Authorization": "Bearer alice"})
    assert provider["models"] == ["gpt-6-luna", "gpt-6-luna"]


def test_lesson_tutor_uses_current_owned_evidence_and_rejects_unknown_citations(learning_client):
    client, _, provider = learning_client
    create_preview(client)
    base = f"/api/v2/sources/{SOURCE}/learning/plans/{PLAN}"
    client.post(base + "/confirm", headers={"Authorization": "Bearer alice"})
    provider["draft"] = {"text": "Similarity finds candidate passages. Support requires evidence for the answer.", "citation_ids": ["p0001"], "gap": None}
    response = client.post(base + "/tutor", json={"lesson_index": 0, "question": "Explain the difference again.", "history": []}, headers={"Authorization": "Bearer alice"})
    assert response.status_code == 200, response.text
    assert response.json()["citation_ids"] == ["p0001"]
    assert provider["models"][-1] == "gpt-6-luna"
    assert client.post(base + "/tutor", json={"lesson_index": 0, "question": "Explain", "history": []}, headers={"Authorization": "Bearer bob"}).status_code == 404


def test_invalid_attribution_has_one_bounded_sol_repair_and_never_saves_unknown_citations(learning_client):
    client, state, provider = learning_client
    provider["draft"] = json.loads(json.dumps(DRAFT))
    provider["draft"]["paths"][0]["lessons"][0]["explanation"]["citation_ids"] = ["missing"]
    response = client.post(f"/api/v2/sources/{SOURCE}/learning/preview", json={"request_id": REQUEST, "source_version": 1}, headers={"Authorization": "Bearer alice"})
    assert response.status_code == 503
    assert provider["models"] == ["gpt-6-luna", "gpt-6.1-sol"]
    assert state["plans"] == []


def test_provider_failure_keeps_the_saved_answer_and_does_not_escalate(learning_client):
    client, _, provider = learning_client
    create_preview(client)
    base = f"/api/v2/sources/{SOURCE}/learning"
    client.post(base + f"/plans/{PLAN}/confirm", headers={"Authorization": "Bearer alice"})
    client.post(base + f"/plans/{PLAN}/attempts", json={"request_id": LEASE, "lesson_index": 0, "response": "My saved explanation"}, headers={"Authorization": "Bearer alice"})
    provider["status"] = 503
    result = client.post(base + f"/attempts/{LEASE}/feedback", headers={"Authorization": "Bearer alice"})
    assert result.status_code == 200, result.text
    assert result.json()["attempts"][0]["status"] == "failed"
    assert result.json()["attempts"][0]["response"] == "My saved explanation"
    assert provider["models"] == ["gpt-6-luna", "gpt-6-luna"]


def test_source_change_blocks_new_activity_and_tutor_before_provider_calls(learning_client):
    client, state, provider = learning_client
    create_preview(client)
    base = f"/api/v2/sources/{SOURCE}/learning/plans/{PLAN}"
    client.post(base + "/confirm", headers={"Authorization": "Bearer alice"})
    state["plans"][0]["needs_review"] = True
    provider["source_version"] = 2
    assert client.post(base + "/activity", json={"lesson_index": 0, "kind": "read"}, headers={"Authorization": "Bearer alice"}).status_code == 409
    assert client.post(base + "/tutor", json={"lesson_index": 0, "question": "Help", "history": []}, headers={"Authorization": "Bearer alice"}).status_code == 409
    assert provider["models"] == ["gpt-6-luna"]


@pytest.mark.parametrize("field,value", [("outcomes", ""), ("prerequisites", "x" * 501), ("gaps", "")])
def test_invalid_path_strings_are_rejected_before_persistence(learning_client, field, value):
    client, state, provider = learning_client
    provider["draft"] = json.loads(json.dumps(DRAFT))
    provider["draft"]["paths"][0][field] = [value]
    response = client.post(f"/api/v2/sources/{SOURCE}/learning/preview", json={"request_id": REQUEST, "source_version": 1}, headers={"Authorization": "Bearer alice"})
    assert response.status_code == 503
    assert state["plans"] == []


@pytest.mark.parametrize("code,status,description", [("55P03", 409, "still running"), ("54000", 429, "limit")])
def test_busy_and_exhausted_requests_have_actionable_recovery(learning_client, code, status, description):
    client, _, provider = learning_client
    provider["rpc_error"] = code
    response = client.post(f"/api/v2/sources/{SOURCE}/learning/preview", json={"request_id": REQUEST, "source_version": 1}, headers={"Authorization": "Bearer alice"})
    assert response.status_code == status
    assert description in response.json()["detail"]


def test_difficulty_generation_preserves_chosen_path_direction(learning_client):
    client, state, provider = learning_client
    url = f"/api/v2/sources/{SOURCE}/learning/preview"
    client.post(url, json={"request_id": REQUEST, "source_version": 1}, headers={"Authorization": "Bearer alice"})
    provider["draft"] = json.loads(json.dumps(DRAFT))
    provider["draft"]["paths"][0]["title"] = "A different learning direction"
    response = client.post(url, json={"request_id": "88888888-8888-4888-8888-888888888888", "source_version": 1, "path_id": PATH, "goal": DRAFT["suggested_goal"], "difficulty": "advanced"}, headers={"Authorization": "Bearer alice"})
    assert response.status_code == 503
    assert provider["last_input"]["chosen_path_direction"] == CONTENT
    assert state["plans"][0]["content"]["title"] == CONTENT["title"]
    assert provider["models"] == ["gpt-6-luna", "gpt-6-luna", "gpt-6.1-sol"]


@pytest.mark.parametrize("kind", ["pdf", "video"])
def test_learning_preserves_original_page_and_caption_locations(learning_client, kind):
    client, _, provider = learning_client
    source = dict(SOURCE_ROW)
    reference = dict(REFERENCE)
    if kind == "pdf":
        source.update(source_kind="pdf", document={"filename": None, "page_count": 1, "pages": [{"page": 1, "start": 0, "end": len(TEXT)}]})
        reference["page"] = 1
    else:
        url = "https://www.youtube.com/watch?v=abcdefghijk"
        source.update(source_kind="video", original_url=url, canonical_url=url, capture_origin="pasted", coverage="unknown", transcript={"provider": "youtube", "format": "vtt", "filename": None, "segments": [{"start": 0, "end": len(TEXT), "start_ms": 1000, "end_ms": 12000}]})
        reference.update(start_ms=1000, end_ms=12000)
    provider["source"] = source
    provider["note"] = {**NOTE, "references": [reference]}
    response = client.post(f"/api/v2/sources/{SOURCE}/learning/preview", json={"request_id": REQUEST, "source_version": 1}, headers={"Authorization": "Bearer alice"})
    assert response.status_code == 200, response.text
    assert response.json()["plans"][0]["references"] == [reference]
    assert provider["last_input"]["evidence"] == [reference]


def test_learning_history_requires_a_session_and_retains_owner_boundary(learning_client):
    client, _, _ = learning_client
    assert client.get("/api/v2/learning/history").status_code == 401
    assert client.get("/api/v2/learning/history?offset=-1", headers={"Authorization": "Bearer alice"}).status_code == 422
    assert client.get("/api/v2/learning/history", headers={"Authorization": "Bearer alice"}).json() == {"collections": [{"source_id": SOURCE, "title": "RAG evidence", "source_available": True}], "next_offset": None}
    assert client.get("/api/v2/learning/history", headers={"Authorization": "Bearer bob"}).json() == {"collections": [], "next_offset": None}


def test_related_source_candidates_are_owned_and_do_not_change_saved_progress(learning_client):
    client, state, provider = learning_client
    create_preview(client)
    client.post(f"/api/v2/sources/{SOURCE}/learning/plans/{PLAN}/confirm", headers={"Authorization": "Bearer alice"})
    before = json.loads(json.dumps(state))
    url = f"/api/v2/sources/{SOURCE}/learning/plans/{PLAN}/candidates"
    result = client.get(url, headers={"Authorization": "Bearer alice"})
    assert result.status_code == 200, result.text
    assert result.json()["candidates"][0]["shared_topics"] == ["Evidence"]
    assert state == before
    assert provider["models"] == ["gpt-6-luna"]
    assert client.get(url, headers={"Authorization": "Bearer bob"}).status_code == 404


def test_revision_preview_keeps_goal_and_original_passages_without_activating(learning_client):
    client, state, provider = learning_client
    create_preview(client)
    base = f"/api/v2/sources/{SOURCE}/learning/plans/{PLAN}"
    client.post(base + "/confirm", headers={"Authorization": "Bearer alice"})
    revised = json.loads(json.dumps(CONTENT))
    revised["lessons"][0]["explanation"]["citation_ids"] = ["p0001", "p0002"]
    provider["draft"] = {"path": revised, "contributions": [{"text": "The second source explains the same distinction; it adds another explanation, not independent corroboration.", "citation_ids": ["p0002"]}], "ordering_changes": "Retain the current order.", "disagreements": []}
    response = client.post(base + "/revision", json={"request_id": PATH, "source_id": REQUEST, "source_version": 1}, headers={"Authorization": "Bearer alice"})
    assert response.status_code == 200, response.text
    plans = response.json()["plans"]
    assert plans[0]["active"] is True and plans[1]["active"] is False
    assert plans[1]["goal"] == DRAFT["suggested_goal"]
    assert [r["id"] for r in plans[1]["evidence"]] == ["p0001", "p0002"]
    assert [r["passage"]["id"] for r in plans[1]["evidence"]] == ["p0001", "p0001"]
    assert plans[1]["evidence"][1]["source_id"] == REQUEST
    assert provider["last_input"]["goal"] == DRAFT["suggested_goal"]
    assert provider["last_input"]["evidence"][1]["passage"] == REFERENCE
    assert client.post(base + "/revision", json={"request_id": PATH, "source_id": REQUEST, "source_version": 1}, headers={"Authorization": "Bearer bob"}).status_code == 404


def test_collection_difficulty_variant_retains_evidence_and_path_direction(learning_client):
    client, _, provider = learning_client
    create_preview(client)
    base = f"/api/v2/sources/{SOURCE}/learning/plans/{PLAN}"
    client.post(base + "/confirm", headers={"Authorization": "Bearer alice"})
    provider["draft"] = {"path": CONTENT, "contributions": [EXPLANATION], "ordering_changes": "Retain the order; deepen practice.", "disagreements": []}
    response = client.post(base + "/revision", json={"request_id": PATH, "source_id": None, "source_version": None, "difficulty": "advanced"}, headers={"Authorization": "Bearer alice"})
    assert response.status_code == 200, response.text
    assert len(response.json()["plans"][1]["evidence"]) == 2
    assert provider["last_input"]["difficulty"] == "advanced"
    provider["draft"] = {**provider["draft"], "path": {**CONTENT, "title": "A changed direction"}}
    assert client.post(base + "/revision", json={"request_id": PATH, "source_id": None, "source_version": None, "difficulty": "advanced"}, headers={"Authorization": "Bearer alice"}).status_code == 503


def test_disagreement_requires_both_source_perspectives(learning_client):
    client, state, provider = learning_client
    create_preview(client)
    base = f"/api/v2/sources/{SOURCE}/learning/plans/{PLAN}"
    client.post(base + "/confirm", headers={"Authorization": "Bearer alice"})
    provider["draft"] = {"path": CONTENT, "contributions": [{**EXPLANATION, "citation_ids": ["p0002"]}], "ordering_changes": "Keep order.", "disagreements": [{"text": "The sources disagree.", "citation_ids": ["p0001"]}]}
    response = client.post(base + "/revision", json={"request_id": PATH, "source_id": REQUEST, "source_version": 1}, headers={"Authorization": "Bearer alice"})
    assert response.status_code == 503
    assert len(state["plans"]) == 1
    assert provider["models"] == ["gpt-6-luna", "gpt-6-luna", "gpt-6.1-sol"]


def test_complete_revision_input_is_bounded_with_long_existing_teaching_and_unicode(learning_client):
    client, state, provider = learning_client
    create_preview(client)
    base = f"/api/v2/sources/{SOURCE}/learning/plans/{PLAN}"
    client.post(base + "/confirm", headers={"Authorization": "Bearer alice"})
    lesson = json.loads(json.dumps(LESSON))
    lesson["explanation"]["text"] = "α" * 2000
    lesson["check"]["worked_answer"]["text"] = "β" * 2000
    state["plans"][0]["content"]["lessons"] = [lesson] * 4
    text = "α" * 45000
    refs = [{**REFERENCE, "id": f"p{index+1:04d}", "start": index*900, "end": (index+1)*900, "excerpt": "α"*900} for index in range(50)]
    provider["revision_sources"] = [{"source": {**SOURCE_ROW, "id": sid, "captured_text": text}, "note": {**NOTE, "references": refs}} for sid in [SOURCE, REQUEST]]
    provider["draft"] = {"path": CONTENT, "contributions": [{**EXPLANATION, "citation_ids": ["p0002"]}], "ordering_changes": "Keep order.", "disagreements": []}
    response = client.post(base + "/revision", json={"request_id": PATH, "source_id": REQUEST, "source_version": 1}, headers={"Authorization": "Bearer alice"})
    assert response.status_code == 200, response.text
    assert provider["input_length"] <= 30000
    assert {item["source_id"] for item in provider["last_input"]["evidence"]} == {SOURCE, REQUEST}


@pytest.mark.parametrize("kind", ["pdf", "video"])
def test_added_source_citations_keep_exact_page_or_caption_location(learning_client, kind):
    client, _, provider = learning_client
    create_preview(client)
    base = f"/api/v2/sources/{SOURCE}/learning/plans/{PLAN}"
    client.post(base + "/confirm", headers={"Authorization": "Bearer alice"})
    other, ref = {**SOURCE_ROW, "id": REQUEST}, dict(REFERENCE)
    if kind == "pdf":
        other.update(source_kind="pdf", document={"filename": None, "page_count": 1, "pages": [{"page": 1, "start": 0, "end": len(TEXT)}]})
        ref["page"] = 1
    else:
        other.update(source_kind="video", original_url="https://youtu.be/abcdefghijk", canonical_url="https://www.youtube.com/watch?v=abcdefghijk", capture_origin="pasted", coverage="unknown", transcript={"provider": "youtube", "format": "vtt", "filename": None, "segments": [{"start": 0, "end": len(TEXT), "start_ms": 1000, "end_ms": 12000}]})
        ref.update(start_ms=1000, end_ms=12000)
    provider["revision_sources"] = [{"source": SOURCE_ROW, "note": NOTE}, {"source": other, "note": {**NOTE, "references": [ref]}}]
    provider["draft"] = {"path": CONTENT, "contributions": [{**EXPLANATION, "citation_ids": ["p0002"]}], "ordering_changes": "Keep order.", "disagreements": []}
    response = client.post(base + "/revision", json={"request_id": PATH, "source_id": REQUEST, "source_version": 1}, headers={"Authorization": "Bearer alice"})
    assert response.status_code == 200, response.text
    assert response.json()["plans"][1]["evidence"][1]["passage"] == ref


def test_goal_branch_uses_the_explicit_new_goal_without_rewriting_original_learning(learning_client):
    client, state, provider = learning_client
    headers = {"Authorization": "Bearer alice"}
    client.post(f"/api/v2/sources/{SOURCE}/learning/preview", headers=headers,
                json={"request_id": REQUEST, "source_version": 1})
    client.post(f"/api/v2/sources/{SOURCE}/learning/plans/{PLAN}/confirm", headers=headers)
    original_goal = state["plans"][0]["goal"]
    provider["revision_sources"] = [{"source": SOURCE_ROW, "note": NOTE}]
    provider["draft"] = {"path": {**CONTENT, "title": "Apply support checking", "lessons": [{**LESSON, "check": {**LESSON["check"], "question": "Choose evidence for a new research claim and explain why."}}]}, "contributions": [EXPLANATION], "ordering_changes": "Apply the shared concept to a new decision.", "disagreements": []}
    goal = "Use evidence checks when evaluating a research claim."
    result = client.post(f"/api/v2/sources/{SOURCE}/learning/plans/{PLAN}/revision", headers=headers,
                         json={"request_id": LEASE, "source_id": None, "source_version": None, "goal": goal})
    assert result.status_code == 200, result.text
    assert provider["last_input"]["goal"] == goal
    assert provider["last_input"]["revision_mode"] == "goal_branch"
    assert result.json()["plans"][0]["goal"] == original_goal
    assert result.json()["plans"][-1]["goal"] == goal
    assert result.json()["plans"][-1]["branch_of_plan_id"] == PLAN
    assert result.json()["plans"][-1]["active"] is False
    assert client.post(f"/api/v2/sources/{SOURCE}/learning/plans/{PLAN}/revision", headers=headers,
                       json={"request_id": LEASE, "goal": " ", "difficulty": "advanced"}).status_code == 422


def test_learning_place_is_owned_and_restored_without_awarding_activity(learning_client):
    client, state, _ = learning_client
    headers = {"Authorization": "Bearer alice"}
    client.post(f"/api/v2/sources/{SOURCE}/learning/preview", headers=headers, json={"request_id": REQUEST, "source_version": 1})
    client.post(f"/api/v2/sources/{SOURCE}/learning/plans/{PLAN}/confirm", headers=headers)
    endpoint = f"/api/v2/sources/{SOURCE}/learning/plans/{PLAN}/place"
    result = client.post(endpoint, headers=headers, json={"lesson_index": 0})
    assert result.status_code == 200, result.text
    assert result.json()["selected_plan_id"] == PLAN
    assert result.json()["activities"] == []
    assert client.get(f"/api/v2/sources/{SOURCE}/learning", headers=headers).json()["selected_plan_id"] == PLAN
    assert client.post(endpoint, headers={"Authorization": "Bearer bob"}, json={"lesson_index": 0}).status_code == 404
    assert client.post(endpoint, headers=headers, json={"lesson_index": 4}).status_code == 422
    assert client.post(endpoint, headers=headers, json={"lesson_index": 0, "user_id": BOB}).status_code == 422


def test_learning_graph_is_authenticated_owned_and_distinguishes_activity_from_checks(learning_client):
    client, _, _ = learning_client
    result = client.get("/api/v2/learning/graph", headers={"Authorization": "Bearer alice"})
    assert result.status_code == 200, result.text
    assert result.json() == {"partial": False, "collections": [{"source_id": SOURCE, "title": "RAG evidence", "source_available": True, "source_ids": [SOURCE], "path_count": 1, "studied_lessons": 1, "practice_attempts": 1, "provisional_checks": 1, "flagged_plans": 0}]}
    assert client.get("/api/v2/learning/graph").status_code == 401
    assert client.get("/api/v2/learning/graph", headers={"Authorization": "Bearer bob"}).json()["collections"] == []


def test_library_summary_resumes_owned_selected_lesson_without_inventing_mastery(learning_client):
    client, _, provider = learning_client
    provider["summary"] = {"user_id": ALICE, "resume": {"source_id": SOURCE, "source_available": True,
        "source_title": "Original PDF", "plan_id": PLAN, "path_id": PATH, "plan_title": "Interpret car velocity",
        "goal": "Explain instantaneous change", "lesson_index": 0, "lesson_title": "Local rate", "needs_review": False,
        "selected_at": "2026-10-09T12:00:00Z", "place_revision": 2},
        "studied_lessons": 3, "practice_attempts": 2, "provisional_checks": 1, "pending_feedback": 1, "failed_feedback": 0}
    response = client.get("/api/v2/learning/summary", headers={"Authorization": "Bearer alice"})
    assert response.status_code == 200
    assert response.json()["resume"]["plan_title"] == "Interpret car velocity"
    assert response.json()["practice_attempts"] == 2
    assert "user_id" not in response.json()
    provider["summary"]["user_id"] = BOB
    assert client.get("/api/v2/learning/summary", headers={"Authorization": "Bearer alice"}).status_code == 503
    assert client.get("/api/v2/learning/summary").status_code == 401


def test_learning_place_api_fences_an_older_browser_selection(learning_client):
    client, _, _ = learning_client
    headers = {"Authorization": "Bearer alice"}
    root = f"/api/v2/sources/{SOURCE}/learning"
    preview = client.post(root+"/preview", headers=headers, json={"request_id": REQUEST, "source_version": 1}).json()
    plan = preview["plans"][0]["id"]
    client.post(root+f"/plans/{plan}/confirm", headers=headers)
    url = root+f"/plans/{plan}/place"
    first = client.post(url, headers=headers, json={"lesson_index": 0, "expected_revision": 0})
    assert first.status_code == 200
    assert first.json()["selected_place_revision"] == 1
    assert client.post(url, headers=headers, json={"lesson_index": 0, "expected_revision": 0}).status_code == 409


def test_collection_detail_is_owned_and_keeps_legacy_learning_identity(learning_client):
    client, state, provider = learning_client
    provider["collection"] = {"user_id": ALICE, "collection": {
        "id": REQUEST, "legacy_source_id": SOURCE, "title": "Evidence collection", "goal": "Explain evidence",
        "revision": 1, "source_count": 1, "path_count": 0, "original_source_available": True,
        "created_at": "2026-10-09T00:00:00Z", "updated_at": "2026-10-09T00:00:00Z"},
        "sources": [{"id": SOURCE, "title": "RAG evidence", "source_kind": "article", "source_version": 1}],
        "learning": state}
    url = f"/api/v2/learning/collections/{REQUEST}"
    response = client.get(url, headers={"Authorization": "Bearer alice"})
    assert response.status_code == 200, response.text
    assert response.json()["collection"]["id"] == REQUEST
    assert response.json()["learning"]["source_id"] == SOURCE
    assert "user_id" not in response.json() and "user_id" not in response.json()["learning"]
    assert client.get(url).status_code == 401
    assert client.get(url, headers={"Authorization": "Bearer bob"}).status_code == 404
    provider["collection"]["user_id"] = BOB
    assert client.get(url, headers={"Authorization": "Bearer alice"}).status_code == 503


def test_collection_list_and_source_alias_are_authenticated_and_do_not_change_legacy_routes(learning_client):
    client, state, provider = learning_client
    provider["collection"] = {"user_id": ALICE, "collection": {
        "id": REQUEST, "legacy_source_id": SOURCE, "title": "Evidence collection", "goal": "Explain evidence",
        "revision": 1, "source_count": 0, "path_count": 0, "original_source_available": False,
        "created_at": "2026-10-09T00:00:00Z", "updated_at": "2026-10-09T00:00:00Z"},
        "sources": [], "learning": state}
    headers = {"Authorization": "Bearer alice"}
    listing = client.get("/api/v2/learning/collections", headers=headers)
    assert listing.status_code == 200, listing.text
    assert listing.json()["collections"][0]["id"] == REQUEST
    alias = client.get(f"/api/v2/sources/{SOURCE}/learning/collection", headers=headers)
    assert alias.status_code == 200 and alias.json()["collection"]["id"] == REQUEST
    assert client.get(f"/api/v2/sources/{SOURCE}/learning", headers=headers).json()["source_id"] == SOURCE
    assert client.get("/api/v2/learning/collections").status_code == 401
    assert client.get("/api/v2/learning/collections", headers={"Authorization": "Bearer bob"}).json()["collections"] == []
    assert client.get(f"/api/v2/sources/{SOURCE}/learning/collection", headers={"Authorization": "Bearer bob"}).status_code == 404
    assert client.get("/api/v2/learning/collections?offset=-1", headers=headers).status_code == 422


def test_collection_selection_requires_a_revision_and_preserves_the_source_route_cursor(learning_client):
    client, state, provider = learning_client
    headers = {"Authorization": "Bearer alice"}
    root = f"/api/v2/sources/{SOURCE}/learning"
    client.post(root+"/preview", headers=headers, json={"request_id": REQUEST, "source_version": 1})
    client.post(root+f"/plans/{PLAN}/confirm", headers=headers)
    provider["collection"] = {"user_id": ALICE, "collection": {
        "id": REQUEST, "legacy_source_id": SOURCE, "title": "Evidence collection", "goal": "Explain evidence",
        "revision": 1, "source_count": 0, "path_count": 1, "original_source_available": True,
        "created_at": "2026-10-09T00:00:00Z", "updated_at": "2026-10-09T00:00:00Z"},
        "sources": [], "learning": state}
    url = f"/api/v2/learning/collections/{REQUEST}/plans/{PLAN}/place"
    assert client.post(url, headers=headers, json={"lesson_index": 0}).status_code == 422
    result = client.post(url, headers=headers, json={"lesson_index": 0, "expected_revision": 0})
    assert result.status_code == 200, result.text
    assert result.json()["learning"]["selected_place_revision"] == 1
    assert client.get(root, headers=headers).json()["selected_plan_id"] == PLAN
    assert client.post(url, headers=headers, json={"lesson_index": 0, "expected_revision": 0}).status_code == 409
    assert client.post(url, headers={"Authorization": "Bearer bob"}, json={"lesson_index": 0, "expected_revision": 0}).status_code == 404
    assert client.post(url, headers=headers, json={"lesson_index": 0, "expected_revision": 1, "user_id": BOB}).status_code == 422
