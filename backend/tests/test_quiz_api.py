"""Quiz routes through TestClient against an in-memory Supabase and a fake provider."""

import asyncio
import dataclasses
import json
import logging
from types import SimpleNamespace
from uuid import UUID, uuid4

import httpx
import pytest
from fastapi import Response
from fastapi.testclient import TestClient

from backend import quiz
from backend.main import app
from backend.quiz_limits import QuizConfig, get_quiz_config
from backend.quiz_models import QuizGenerateRequest
from backend.quiz_models import QuizSubmitRequest
from backend.quiz_provider import get_quiz_model
from backend.quiz_rules import canonical_answers_hash
from backend.quiz_store import QuizStore
from backend.tests.quiz_fakes import REFERENCES, FakeQuizModel, completed, generated_dict, incomplete, provider_error, refused
from backend.tests.quiz_supabase import COLLECTION, OWNER, PLAN, FakeSupabase, SqlError

OTHER = "99999999-9999-4999-8999-999999999999"
SENTINELS = ("SENTINEL-EXPLANATION", "SENTINEL-CRITERION", "SENTINEL-MODEL")
BASE = f"/api/v2/learning/collections/{COLLECTION}/plans/{PLAN}/quiz"
AUTH = {"Authorization": "Bearer owner-token"}


def sentinel_quiz():
    data = generated_dict()
    for i, q in enumerate(data["questions"]):
        q["explanation"] = f"SENTINEL-EXPLANATION-{i}"
        if q["kind"] == "short_answer":
            q["criteria"] = [f"SENTINEL-CRITERION-{i}-a", f"SENTINEL-CRITERION-{i}-b"]
            q["model_answer"] += " SENTINEL-MODEL"
    return data


class Api:
    def __init__(self, client, fake):
        self.client, self.fake = client, fake
        self.config = QuizConfig()
        self.provider = FakeQuizModel([], events=fake.events)

    def script(self, *items):
        self.provider = FakeQuizModel(items, events=self.fake.events)

    def get(self, path="", **kw):
        return self.client.get(BASE + path, headers=AUTH, **kw)

    def post(self, path="", body=None, **kw):
        return self.client.post(BASE + path, headers=AUTH, json=body, **kw)

    def generate(self, *script, request_id=None, regenerate=False):
        if script:
            self.script(*script)
        return self.post("", {"request_id": request_id or str(uuid4()), "regenerate": regenerate})

    def ready(self):
        response = self.generate(completed(sentinel_quiz()))
        assert response.status_code == 201, response.text
        return response.json()["quiz"]["id"]

    def answers(self, quiz_id, *, right=True, text="Looking alike is not enough; check what the passage says."):
        stored, out = self.fake.quizzes[quiz_id], []
        for q in stored["questions"]:
            key = stored["keys"][q["id"]]["correct_option_ids"] or []
            if q["kind"] == "short_answer":
                out.append({"question_id": q["id"], "kind": "short_answer", "text": text})
                continue
            pick = key if right else [o["id"] for o in q["options"] if o["id"] not in key][:1]
            if q["kind"] == "multi_select":
                out.append({"question_id": q["id"], "kind": "multi_select", "option_ids": pick})
            else:
                out.append({"question_id": q["id"], "kind": q["kind"], "option_id": pick[0]})
        return out

    def submit(self, quiz_id, answers=None, key=None):
        body = {"attempt_key": key or str(uuid4()), "quiz_id": quiz_id, "answers": self.answers(quiz_id) if answers is None else answers}
        return self.post("/attempts", body), body

    def short_ids(self, attempt):
        return [q["question_id"] for q in attempt["questions"] if q["kind"] == "short_answer"]

    def feedback(self, attempt_id, question_id):
        return self.post(f"/attempts/{attempt_id}/feedback/{question_id}")

    def short_feedback(self, attempt_id, question_id, *marks):
        row = self.fake.attempts[attempt_id]["answers"][question_id]
        count = len(row["reveal"]["criteria"])
        marks = marks or ("addressed",) * count
        return completed({"summary": "Good start.", "next_hint": "Compare it with the passage.", "criteria": [
            {"criterion_index": i, "assessment": marks[i], "observation": "Noted.", "citation_ids": []} for i in range(count)]})

    def graded(self, **submit):
        quiz_id = self.ready()
        response, body = self.submit(quiz_id, **submit)
        assert response.status_code == 201, response.text
        return quiz_id, response.json(), body

    def count(self, name):
        return self.fake.events.count(name)


@pytest.fixture
def api(monkeypatch):
    for name, value in {"SUPABASE_URL": "https://supabase.test", "SUPABASE_PUBLISHABLE_KEY": "public-test",
                        "SUPABASE_SECRET_KEY": "server-test", "OPENAI_API_KEY": "sk-test"}.items():
        monkeypatch.setenv(name, value)
    fake = FakeSupabase()
    original = httpx.AsyncClient
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: original(**{**kw, "transport": httpx.MockTransport(fake.handler)}))
    holder = Api(TestClient(app), fake)
    app.dependency_overrides[get_quiz_config] = lambda: holder.config
    app.dependency_overrides[get_quiz_model] = lambda: holder.provider
    yield holder
    app.dependency_overrides.clear()


def error(response):
    body = response.json()
    assert set(body) == {"detail", "error"} and body["detail"] == body["error"]["message"]
    return body["error"]


# --- 1-2. auth and state ------------------------------------------------------------------


def test_every_route_needs_a_bearer_token_and_never_returns_the_owner(api):
    attempt = f"{BASE}/attempts/{uuid4()}"
    for method, url in (("get", BASE), ("post", BASE), ("post", BASE + "/attempts"), ("get", attempt), ("post", f"{attempt}/feedback/{uuid4()}")):
        assert getattr(api.client, method)(url).status_code == 401, (method, url)
    response = api.get()
    assert response.status_code == 200 and OWNER not in response.text and "user_id" not in response.text
    assert response.headers["cache-control"] == "no-store"


def test_a_fresh_plan_is_none_with_usage_and_a_generate_button(api):
    state = api.get().json()
    assert (state["status"], state["regenerating"], state["quiz"], state["not_ready_reason"]) == ("none", False, None, None)
    assert state["usage"] == {"generations_used": 0, "generations_limit": 3, "resets_at": "2026-10-22T00:00:00Z"}
    assert (state["can_generate"], state["generate_blocked"], state["can_take"]) == (True, None, False)
    assert api.fake.events == ["get_quiz_state"]  # one cheap RPC; no collection read, no provider


def test_not_ready_reasons(api):
    api.fake.references = REFERENCES[:2]
    assert api.get().json()["not_ready_reason"] == "not_enough_cited_material"
    assert api.get().json()["generate_blocked"] == "not_enough_cited_material"
    api.fake.references = []
    assert api.get().json()["not_ready_reason"] == "evidence_changed"
    api.fake.references = REFERENCES
    api.fake.current = False
    assert api.get().json()["not_ready_reason"] == "evidence_changed"


def test_a_generating_plan_reports_generating_and_polls_without_material(api):
    api.fake.fn_request_quiz_generation(COLLECTION, PLAN, str(uuid4()), False)
    state = api.get().json()
    assert (state["status"], state["generate_blocked"], state["can_generate"]) == ("generating", "generating", False)


def test_status_stays_ready_while_regenerating(api):
    api.ready()
    api.fake.fn_request_quiz_generation(COLLECTION, PLAN, str(uuid4()), True)
    state = api.get().json()
    assert (state["status"], state["regenerating"], state["can_generate"], state["generate_blocked"]) == ("ready", True, False, "generating")
    assert state["quiz"] is not None and state["can_take"] is True


@pytest.mark.parametrize("setup,blocked", [
    (lambda a: setattr(a, "config", dataclasses.replace(a.config, enabled=False)), "disabled"),
    (lambda a: setattr(a.fake, "active", False), "not_active"),
    (lambda a: setattr(a.fake, "current", False), "evidence_changed"),
    (lambda a: a.fake.used.update(generation=3), "limit"),
])
def test_generate_blocked_reasons_on_a_ready_quiz(api, setup, blocked):
    api.ready()
    api.fake.used["generation"] = 0 if blocked != "limit" else 3
    setup(api)
    state = api.get().json()
    assert (state["can_generate"], state["generate_blocked"]) == (False, blocked)


def test_setup_blocks_generate_but_get_still_works_without_the_secret_key(api, monkeypatch):
    monkeypatch.delenv("SUPABASE_SECRET_KEY")
    response = api.get()
    assert response.status_code == 200 and response.json()["generate_blocked"] == "setup"
    monkeypatch.setenv("SUPABASE_SECRET_KEY", "server-test")
    monkeypatch.setenv("OPENAI_API_KEY", "YOUR_KEY")
    assert api.get().json()["generate_blocked"] == "setup"


def test_disabled_without_a_quiz_is_not_ready_with_that_reason(api):
    api.config = dataclasses.replace(api.config, enabled=False)
    state = api.get().json()
    assert (state["status"], state["not_ready_reason"], state["generate_blocked"]) == ("not_ready", "disabled", "disabled")


def test_the_public_payload_has_no_key_fields_or_sentinels(api):
    quiz_id = api.ready()
    for text in (api.get().text, api.generate(request_id=api.fake.quizzes[quiz_id]["request_id"]).text):
        assert not any(s in text for s in SENTINELS)
        for name in ("correct_option_ids", "explanation", "citation_ids", "criteria", "model_answer", "is_correct", "reveal"):
            assert f'"{name}"' not in text


# --- 3. generation ----------------------------------------------------------------------------


def test_generate_happy_path_orders_the_calls_and_replays_without_a_charge(api):
    request_id = str(uuid4())
    response = api.generate(completed(sentinel_quiz()), request_id=request_id)
    assert response.status_code == 201 and response.json()["status"] == "ready" and len(response.json()["quiz"]["questions"]) == 6
    assert api.fake.events == ["request_quiz_generation", "get_quiz_state", "charge_quiz_generation", "provider", "finish_quiz_generation", "get_quiz_state"]
    assert response.json()["usage"]["generations_used"] == 1
    again = api.generate(request_id=request_id)
    assert again.status_code == 200 and api.count("charge_quiz_generation") == 1 and len(api.provider.calls) == 1


def test_regenerate_false_with_an_existing_quiz_creates_no_row(api):
    api.ready()
    response = api.generate(request_id=str(uuid4()))
    assert response.status_code == 200 and len(api.fake.quizzes) == 1 and api.count("charge_quiz_generation") == 1


def test_regenerate_true_creates_a_new_current_quiz(api):
    first = api.ready()
    response = api.generate(completed(sentinel_quiz()), regenerate=True)
    assert response.status_code == 201 and response.json()["quiz"]["id"] != first and len(api.fake.quizzes) == 2


def test_a_denied_charge_is_a_429_with_reset_details_and_the_provider_is_never_called(api):
    api.fake.used["generation"] = 3
    response = api.generate(completed(sentinel_quiz()))
    body = error(response)
    assert response.status_code == 429 and body["code"] == "quiz_generation_limit_reached"
    assert (body["limit"], body["used"], body["resets_at"], body["retryable"]) == (3, 3, "2026-10-22T00:00:00Z", False)
    assert int(response.headers["retry-after"]) > 0 and "3" in body["message"]
    assert api.provider.calls == [] and api.fake.quizzes == {}
    assert ("fail_quiz_generation", ) == tuple(c[0] for c in api.fake.calls[-1:])
    assert api.fake.calls[-1][1]["p_error_code"] == "limit" and api.fake.calls[-1][1]["p_refund"] is False


@pytest.mark.parametrize("script,reason,charged,used", [
    ([provider_error("setup_required", None)], "setup_required", False, 0),
    ([provider_error("provider_unavailable", "ConnectError")], "provider_unavailable", False, 0),
    ([provider_error("setup_required", "http", 401)], "setup_required", False, 0),
    ([provider_error("provider_unavailable", "http", 400)], "provider_unavailable", False, 0),
    ([provider_error("provider_unavailable", "http", 429, "invalid_request_error")], "provider_unavailable", False, 0),
    ([provider_error("provider_unavailable", "http", 429, "insufficient_quota")], "provider_unavailable", False, 0),
    ([provider_error("timeout", "ReadTimeout")], "timeout", True, 1),
    ([provider_error("provider_unavailable", "http", 429, "rate_limit_exceeded")], "provider_unavailable", True, 1),
    ([provider_error("provider_unavailable", "http", 503)], "provider_unavailable", True, 1),
    ([provider_error("provider_unavailable", "RemoteProtocolError")], "provider_unavailable", True, 1),
    ([completed({"questions": []})] * 3, "invalid_output", True, 1),
    ([incomplete()], "truncated", True, 1),
    ([refused()], "refused", True, 1),
])
def test_refund_table_rows(api, script, reason, charged, used):
    response = api.generate(*script)
    body = error(response)
    assert response.status_code == 503 and body["code"] == "quiz_generation_unavailable"
    assert (body["reason"], body["charged"], body["retryable"]) == (reason, charged, True)
    assert api.fake.used["generation"] == used
    calls = [c for c in api.fake.calls if c[0] == "fail_quiz_generation"]
    assert len(calls) == 1 and calls[0][1]["p_refund"] is (not charged)
    assert body["message"] and "sk-" not in response.text


def test_a_stale_finish_is_a_409_and_is_not_refunded(api):
    api.fake.stale_on_finish = True
    response = api.generate(completed(sentinel_quiz()))
    assert response.status_code == 409 and error(response)["code"] == "quiz_evidence_changed"
    assert api.fake.used["generation"] == 1
    assert api.fake.calls[-1][0] == "fail_quiz_generation" and api.fake.calls[-1][1]["p_refund"] is False


def test_a_timeout_loop_cannot_spend_for_free(api):
    for _ in range(3):
        assert api.generate(provider_error("timeout", "ReadTimeout")).status_code == 503
    response = api.generate(provider_error("timeout", "ReadTimeout"))
    assert response.status_code == 429 and error(response)["code"] == "quiz_generation_limit_reached" and api.provider.calls == []


def test_charge_failures_fail_closed_and_never_look_like_an_expired_session(api, monkeypatch):
    api.fake.failures["charge_quiz_generation"] = (500, {"message": "boom"})
    response = api.generate(completed(sentinel_quiz()))
    assert response.status_code == 503 and error(response)["code"] == "quiz_storage_unavailable" and api.provider.calls == []
    api.fake.expire_leases()
    monkeypatch.setenv("SUPABASE_SECRET_KEY", "wrong-key")
    response = api.generate(completed(sentinel_quiz()))
    assert response.status_code == 503 and error(response)["code"] == "quiz_storage_unavailable" and api.provider.calls == []
    api.fake.expire_leases()
    monkeypatch.delenv("SUPABASE_SECRET_KEY")
    response = api.generate(completed(sentinel_quiz()))
    assert response.status_code == 503 and error(response)["code"] == "quiz_storage_unavailable" and api.provider.calls == []
    assert api.count("charge_quiz_generation") == 2  # the missing key never reaches the network


def test_not_ready_charges_nothing_and_calls_no_provider(api):
    api.fake.references = REFERENCES[:2]
    response = api.generate(completed(sentinel_quiz()))
    body = error(response)
    assert response.status_code == 422 and body["code"] == "quiz_not_ready" and body["reason"] == "not_enough_cited_material"
    assert api.count("charge_quiz_generation") == 0 and api.provider.calls == [] and api.fake.quizzes == {}


def test_plan_and_lease_conflicts(api):
    api.fake.active = False
    assert (api.generate().status_code, error(api.generate())["code"]) == (409, "quiz_plan_not_current")
    api.fake.active = True
    api.fake.fn_request_quiz_generation(COLLECTION, PLAN, str(uuid4()), False)
    response = api.generate(completed(sentinel_quiz()))
    assert response.status_code == 409 and error(response)["code"] == "quiz_generation_in_progress" and api.provider.calls == []


def test_a_concurrent_duplicate_request_id_is_a_409(api):
    request_id = str(uuid4())
    api.fake.fn_request_quiz_generation(COLLECTION, PLAN, request_id, False)
    response = api.generate(completed(sentinel_quiz()), request_id=request_id)
    assert response.status_code == 409 and error(response)["code"] == "quiz_generation_in_progress" and api.provider.calls == []


def test_the_same_request_id_with_another_intent_is_a_409(api):
    request_id = str(uuid4())
    api.generate(completed(sentinel_quiz()), request_id=request_id)
    response = api.generate(request_id=request_id, regenerate=True)
    assert response.status_code == 409 and error(response)["code"] == "quiz_request_changed"


def test_plan_cap_and_failed_row_cap(api):
    for i in range(20):
        api.fake.quizzes[str(i)] = {"id": str(i), "request_id": str(i), "status": "ready", "is_current": False, "lease_live": False, "questions": [], "keys": {}, "outcomes": [], "redacted": False}
    response = api.generate(completed(sentinel_quiz()), regenerate=True)
    assert response.status_code == 429 and error(response)["code"] == "quiz_plan_cap_reached"
    api.fake.quizzes.clear()
    for i in range(10):
        api.fake.quizzes[str(i)] = {"id": str(i), "request_id": str(i), "status": "failed", "is_current": False, "lease_live": False, "questions": [], "keys": {}, "outcomes": [], "redacted": False}
    response = api.generate(completed(sentinel_quiz()))
    assert response.status_code == 429 and error(response)["code"] == "quiz_generation_attempts_capped" and "retry-after" in response.headers


def test_an_older_plan_can_still_be_read_and_retaken_but_not_regenerated(api):
    quiz_id = api.ready()
    api.fake.active = False
    state = api.get().json()
    assert state["plan"]["is_active"] is False and state["can_take"] is True and state["can_generate"] is False
    assert api.submit(quiz_id)[0].status_code == 201
    assert api.generate(regenerate=True).status_code == 409


def test_disabled_keeps_the_stored_quiz_takeable_but_blocks_spending(api):
    quiz_id, graded, _b = api.graded()
    api.config = dataclasses.replace(api.config, enabled=False)
    state = api.get().json()
    assert (state["status"], state["generate_blocked"], state["can_take"]) == ("ready", "disabled", True)
    assert api.submit(quiz_id)[0].status_code == 201
    before = (api.count("charge_quiz_generation"), api.count("charge_quiz_grading"))
    response = api.generate(completed(sentinel_quiz()), regenerate=True)
    assert response.status_code == 503 and error(response)["code"] == "quiz_disabled"
    response = api.feedback(graded["attempt_id"], api.short_ids(graded)[0])
    assert response.status_code == 503 and error(response)["code"] == "quiz_disabled"
    assert (api.count("charge_quiz_generation"), api.count("charge_quiz_grading")) == before and api.provider.calls == []
    assert all(q["status"] != "generating" for q in api.fake.quizzes.values())


def test_a_replay_after_the_evidence_changed_returns_the_stored_result(api):
    request_id, attempt_key = str(uuid4()), str(uuid4())
    api.generate(completed(sentinel_quiz()), request_id=request_id)
    quiz_id = next(iter(api.fake.quizzes))
    first, body = api.submit(quiz_id, key=attempt_key)
    api.fake.current = False
    assert api.generate(request_id=request_id).status_code == 200
    replay = api.post("/attempts", body)
    assert replay.status_code == 200 and replay.json() == first.json()


# --- the outer request may be cancelled without losing the generation --------------------------


def direct_store(fake, config):
    client = httpx.AsyncClient(transport=httpx.MockTransport(fake.handler))
    gateway = SimpleNamespace(client=client, project_url="https://supabase.test", user_id=UUID(OWNER),
                              headers={"apikey": "public-test", "Authorization": "Bearer owner-token"})
    return QuizStore.for_gateway(gateway, config), client


def slow_model(gate, started, result):
    class Slow:
        async def call(self, *, ledger, **_):
            ledger.begin()
            started.set()
            await gate.wait()
            ledger.settle("http", 200)
            return result
    return Slow()


def test_an_outer_cancel_still_finishes_the_generation(api):
    async def scenario():
        gate, started = asyncio.Event(), asyncio.Event()
        store, client = direct_store(api.fake, api.config)
        outer = asyncio.ensure_future(quiz.generate(UUID(COLLECTION), UUID(PLAN), QuizGenerateRequest(request_id=uuid4()), Response(),
                                                    store, slow_model(gate, started, completed(sentinel_quiz()))))
        await started.wait()
        outer.cancel()
        with pytest.raises(asyncio.CancelledError):
            await outer
        gate.set()
        await asyncio.gather(*quiz._TASKS)
        await client.aclose()

    asyncio.run(scenario())
    assert "finish_quiz_generation" in api.fake.events and api.fake.used["generation"] == 1
    assert [q["status"] for q in api.fake.quizzes.values()] == ["ready"]
    assert api.get().json()["status"] == "ready"


def test_output_lost_after_the_provider_ran_is_a_generation_error_that_says_it_was_charged(api):
    def reject(**_body):
        raise SqlError("22023", "quiz_invalid_output")

    api.fake.fn_finish_quiz_generation = reject
    response = api.generate(completed(sentinel_quiz()))
    body = error(response)
    assert response.status_code == 503 and body["code"] == "quiz_generation_unavailable" and body["charged"] is True
    assert api.fake.used["generation"] == 1


def test_a_cancelled_provider_call_still_releases_the_lease_and_keeps_the_charge(api):
    async def scenario():
        gate, started = asyncio.Event(), asyncio.Event()
        store, client = direct_store(api.fake, api.config)
        outer = asyncio.ensure_future(quiz.generate(UUID(COLLECTION), UUID(PLAN), QuizGenerateRequest(request_id=uuid4()), Response(),
                                                    store, slow_model(gate, started, completed(sentinel_quiz()))))
        await started.wait()
        for task in list(quiz._TASKS):
            task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await outer
        await asyncio.sleep(0.05)
        await client.aclose()

    asyncio.run(scenario())
    last = [c for c in api.fake.calls if c[0] == "fail_quiz_generation"][-1][1]
    assert last["p_refund"] is False and last["p_error_code"] == "cancelled" and api.fake.used["generation"] == 1
    assert "finish_quiz_generation" not in api.fake.events


# --- attempts ------------------------------------------------------------------------------------


def test_submit_grades_deterministically_and_keeps_short_answers_pending(api):
    quiz_id, result, body = api.graded()
    assert result["score"] == {"correct": 5, "total": 5}
    assert [q["kind"] for q in result["questions"]].count("short_answer") == 1
    assert result["short_answers"] == {"total": 1, "pending": 1, "unavailable": 0}
    assert [o["label"] for o in result["outcomes"]] == ["looks_solid", "looks_solid"] and result["review_first"] == []
    short = next(q for q in result["questions"] if q["kind"] == "short_answer")
    assert (short["grading_state"], short["result"], short["provisional"]) == ("pending", None, True)
    assert [q["position"] for q in result["questions"]] == sorted(q["position"] for q in result["questions"])
    assert result["grading_usage"] == {"used": 0, "limit": 20, "resets_at": "2026-10-22T00:00:00Z"}
    assert OWNER not in json.dumps(result)


def test_wrong_and_missing_answers_count_in_y_and_label_worth_reviewing(api):
    quiz_id = api.ready()
    result = api.submit(quiz_id, api.answers(quiz_id, right=False))[0].json()
    assert result["score"]["correct"] == 0 and result["score"]["total"] == 5
    assert {q["result"] for q in result["questions"] if q["kind"] != "short_answer"} <= {"incorrect", "partly_correct"}
    assert [o["label"] for o in result["outcomes"]] == ["worth_reviewing"] * 2 and result["review_first"]
    blank = api.submit(quiz_id, [])[0].json()
    assert blank["score"] == {"correct": 0, "total": 5} and {q["result"] for q in blank["questions"] if q["kind"] != "short_answer"} == {"unanswered"}


def test_a_blank_short_answer_is_worth_reviewing_without_ai_attribution(api):
    quiz_id = api.ready()
    answers = [a for a in api.answers(quiz_id) if a["kind"] != "short_answer"]
    result = api.submit(quiz_id, answers)[0].json()
    short = next(q for q in result["questions"] if q["kind"] == "short_answer")
    assert (short["result"], short["signal"], short["grading_state"]) == ("unanswered", "negative", "not_applicable")
    outcome = next(o for o in result["outcomes"] if o["short_blank"])
    assert (outcome["label"], outcome["ai_contributed"], outcome["short_needs_review"]) == ("worth_reviewing", False, 0)
    assert result["short_answers"]["pending"] == 0


def test_replay_returns_the_stored_result_without_regrading(api):
    quiz_id, first, body = api.graded()
    contexts = api.count("get_quiz_grading_context")
    replay = api.post("/attempts", body)
    assert replay.status_code == 200 and replay.json() == first
    assert api.count("get_quiz_grading_context") == contexts and api.count("finish_quiz_attempt") == 1


def test_reordered_answers_with_the_same_key_are_a_replay_and_changed_answers_conflict(api):
    quiz_id, first, body = api.graded()
    reordered = {**body, "answers": list(reversed(body["answers"]))}
    assert api.post("/attempts", reordered).status_code == 200
    changed = {**body, "answers": api.answers(quiz_id, right=False)}
    response = api.post("/attempts", changed)
    assert response.status_code == 409 and error(response)["code"] == "quiz_attempt_conflict"


def test_invalid_answers_are_422(api):
    quiz_id = api.ready()
    good = api.answers(quiz_id)
    first = good[0]
    for answers in (
        [first, first],
        [{"question_id": str(uuid4()), "kind": "single_choice", "option_id": "o1"}],
        [{"question_id": first["question_id"], "kind": "short_answer", "text": "x"}],
        [{**first, "option_id": "o5"}] if "option_id" in first else [{**first, "option_ids": ["o5"]}],
        [{**a, "text": "x" * (api.config.short_answer_max_chars + 1)} for a in good if a["kind"] == "short_answer"],
    ):
        response = api.submit(quiz_id, answers)[0]
        assert response.status_code == 422 and error(response)["code"] == "quiz_answer_invalid", answers
    bad_body = {"attempt_key": "nope", "quiz_id": quiz_id, "answers": []}
    assert api.post("/attempts", bad_body).status_code == 422


def test_a_live_lease_is_a_409_never_a_503(api):
    quiz_id = api.ready()
    key, answers = str(uuid4()), api.answers(quiz_id)
    stored = quiz.stored_answers(QuizSubmitRequest.model_validate({"attempt_key": key, "quiz_id": quiz_id, "answers": answers}), api.config)
    api.fake.fn_submit_quiz_attempt(COLLECTION, PLAN, quiz_id, key, stored, canonical_answers_hash(stored))
    response = api.post("/attempts", {"attempt_key": key, "quiz_id": quiz_id, "answers": answers})
    assert response.status_code == 409 and error(response)["code"] == "quiz_attempt_in_progress"


def test_the_21st_attempt_is_a_429(api):
    quiz_id = api.ready()
    for _ in range(20):
        assert api.submit(quiz_id, [])[0].status_code == 201
    response = api.submit(quiz_id, [])[0]
    assert response.status_code == 429 and error(response)["code"] == "quiz_attempt_limit_reached"


def test_reading_an_attempt_heals_an_interrupted_submit(api):
    quiz_id = api.ready()
    key, answers = str(uuid4()), api.answers(quiz_id)
    stored = quiz.stored_answers(QuizSubmitRequest.model_validate({"attempt_key": key, "quiz_id": quiz_id, "answers": answers}), api.config)
    claim = api.fake.fn_submit_quiz_attempt(COLLECTION, PLAN, quiz_id, key, stored, canonical_answers_hash(stored))
    live = api.get(f"/attempts/{claim['attempt_id']}")
    assert live.status_code == 409 and error(live)["code"] == "quiz_attempt_in_progress"
    api.fake.expire_leases()
    healed = api.get(f"/attempts/{claim['attempt_id']}")
    assert healed.status_code == 200 and healed.json()["score"] == {"correct": 5, "total": 5}
    assert api.count("claim_quiz_attempt_grading") == 1


def test_a_redacted_attempt_reads_back_as_redacted_questions_with_scores_intact(api):
    quiz_id, first, _body = api.graded()
    api.fake.redact_source()
    result = api.get(f"/attempts/{first['attempt_id']}").json()
    assert {q["kind"] for q in result["questions"]} == {"redacted"} and result["score"] == first["score"]
    assert [o["label"] for o in result["outcomes"]] == [o["label"] for o in first["outcomes"]]
    for q in result["questions"]:
        assert not {"prompt", "options", "explanation", "citation_ids", "criteria", "model_answer"} & set(q)
    state = api.get().json()
    assert state["quiz"]["redacted"] is True and state["quiz"]["questions"] == [] and state["can_take"] is False


def test_questions_come_back_in_stored_position_order_whatever_the_answer_order(api):
    quiz_id = api.ready()
    result = api.submit(quiz_id, list(reversed(api.answers(quiz_id))))[0].json()
    assert [q["position"] for q in result["questions"]] == list(range(6))


# --- feedback ------------------------------------------------------------------------------------------


def test_feedback_grades_a_short_answer_and_a_second_call_is_free(api):
    _quiz_id, result, _body = api.graded()
    attempt_id, question_id = result["attempt_id"], api.short_ids(result)[0]
    api.script(api.short_feedback(attempt_id, question_id, "addressed", "try_again"))
    response = api.feedback(attempt_id, question_id)
    assert response.status_code == 200, response.text
    short = next(q for q in response.json()["questions"] if q["kind"] == "short_answer")
    assert (short["grading_state"], short["result"], short["signal"]) == ("graded", "needs_review", "negative")
    assert [c["assessment"] for c in short["criteria"]] == ["addressed", "try_again"] and short["feedback_summary"] == "Good start."
    outcome = next(o for o in response.json()["outcomes"] if o["index"] == short["outcome_index"])
    assert outcome["short_needs_review"] == 1 and outcome["ai_contributed"] is True and outcome["label"] == "worth_reviewing"
    assert response.json()["score"] == result["score"]  # the score never moves
    assert api.fake.used["grading"] == 1
    charges = api.count("charge_quiz_grading")
    assert api.feedback(attempt_id, question_id).status_code == 200
    assert api.count("charge_quiz_grading") == charges and len(api.provider.calls) == 1


def test_a_grading_limit_is_a_429_recorded_on_the_answer_and_costs_no_try(api):
    _quiz_id, result, _body = api.graded()
    attempt_id, question_id = result["attempt_id"], api.short_ids(result)[0]
    api.fake.used["grading"] = 20
    for _ in range(3):
        response = api.feedback(attempt_id, question_id)
        body = error(response)
        assert response.status_code == 429 and body["code"] == "quiz_grading_limit_reached" and body["limit"] == 20
        assert int(response.headers["retry-after"]) > 0
    assert api.provider.calls == []
    row = api.fake.attempts[attempt_id]["answers"][question_id]
    assert (row["grading_state"], row["unavailable_reason"], row["grading_attempts"]) == ("unavailable", "limit", 0)
    api.fake.used["grading"] = 0
    api.script(api.short_feedback(attempt_id, question_id))
    assert api.feedback(attempt_id, question_id).status_code == 200
    assert api.fake.attempts[attempt_id]["answers"][question_id]["grading_state"] == "graded"


@pytest.mark.parametrize("failure,reason,used,tries", [
    (provider_error("timeout", "ReadTimeout"), "timeout", 1, 1),
    (provider_error("provider_unavailable", "ConnectError"), "provider", 0, 0),
    (provider_error("setup_required", "http", 401), "setup_required", 0, 0),
    (provider_error("provider_unavailable", "http", 503), "provider", 1, 1),
])
def test_provider_failures_are_a_200_with_an_unavailable_answer(api, failure, reason, used, tries):
    _quiz_id, result, _body = api.graded()
    attempt_id, question_id = result["attempt_id"], api.short_ids(result)[0]
    api.script(failure)
    response = api.feedback(attempt_id, question_id)
    short = next(q for q in response.json()["questions"] if q["kind"] == "short_answer")
    assert response.status_code == 200 and (short["grading_state"], short["unavailable_reason"], short["result"]) == ("unavailable", reason, "unavailable")
    assert api.fake.used["grading"] == used
    assert api.fake.attempts[attempt_id]["answers"][question_id]["grading_attempts"] == tries


def test_three_provider_bound_tries_then_exhausted(api):
    _quiz_id, result, _body = api.graded()
    attempt_id, question_id = result["attempt_id"], api.short_ids(result)[0]
    for _ in range(3):
        api.script(provider_error("timeout", "ReadTimeout"))
        assert api.feedback(attempt_id, question_id).status_code == 200
    response = api.feedback(attempt_id, question_id)
    assert response.status_code == 429 and error(response)["code"] == "quiz_grading_exhausted"


def test_feedback_for_a_choice_question_is_a_422(api):
    _quiz_id, result, _body = api.graded()
    choice = next(q["question_id"] for q in result["questions"] if q["kind"] != "short_answer")
    response = api.feedback(result["attempt_id"], choice)
    assert response.status_code == 422 and error(response)["code"] == "quiz_request_invalid"
    assert api.feedback(result["attempt_id"], str(uuid4())).status_code == 404


def test_an_over_cap_stored_answer_is_a_422_and_never_sticks_on_pending(api):
    _quiz_id, result, _body = api.graded(answers=None)
    attempt_id, question_id = result["attempt_id"], api.short_ids(result)[0]
    api.config = dataclasses.replace(api.config, short_answer_max_chars=20)
    response = api.feedback(attempt_id, question_id)
    assert response.status_code == 422 and error(response)["code"] == "quiz_answer_invalid"
    row = api.fake.attempts[attempt_id]["answers"][question_id]
    assert (row["grading_state"], row["unavailable_reason"]) == ("unavailable", "invalid_output")
    assert api.count("charge_quiz_grading") == 0 and api.provider.calls == []


def test_feedback_for_a_busy_lease_is_a_409(api):
    _quiz_id, result, _body = api.graded()
    attempt_id, question_id = result["attempt_id"], api.short_ids(result)[0]
    api.fake.fn_claim_quiz_short_answer(COLLECTION, PLAN, attempt_id, question_id)
    response = api.feedback(attempt_id, question_id)
    assert response.status_code == 409 and error(response)["code"] == "quiz_grading_busy"


# --- ownership, leaks and logs -----------------------------------------------------------------------------


def test_another_users_ids_are_404_on_every_route(api):
    other = f"/api/v2/learning/collections/{OTHER}/plans/{PLAN}/quiz"
    attempt = f"{other}/attempts/{uuid4()}"
    for method, url, body in (("get", other, None), ("post", other, {"request_id": str(uuid4())}),
                              ("post", other + "/attempts", {"attempt_key": str(uuid4()), "quiz_id": str(uuid4()), "answers": []}),
                              ("get", attempt, None), ("post", f"{attempt}/feedback/{uuid4()}", None)):
        response = api.client.request(method.upper(), url, headers=AUTH, json=body)
        assert response.status_code == 404 and error(response)["code"] == "quiz_not_found", (method, url)


def test_results_for_another_user_or_plan_are_never_returned(api):
    quiz_id = api.ready()
    original = api.fake.fn_get_quiz_grading_context
    api.fake.fn_get_quiz_grading_context = lambda **kw: {**original(**kw), "user_id": OTHER}
    response = api.submit(quiz_id)[0]
    assert response.status_code == 503 and error(response)["code"] == "quiz_storage_unavailable"
    original_attempt = api.fake.fn_get_quiz_attempt
    api.fake.fn_get_quiz_attempt = lambda **kw: {**original_attempt(**kw), "attempt": {**original_attempt(**kw)["attempt"], "plan_id": OTHER}}
    attempt_id = next(iter(api.fake.attempts))
    assert api.get(f"/attempts/{attempt_id}").status_code == 503


def test_errors_and_logs_never_contain_answers_keys_or_provider_text(api, caplog):
    caplog.set_level(logging.DEBUG)
    quiz_id = api.ready()
    secret = "SENTINEL-LEARNER-ANSWER"
    response, _body = api.submit(quiz_id, [a if a["kind"] != "short_answer" else {**a, "text": secret} for a in api.answers(quiz_id)])
    attempt_id = response.json()["attempt_id"]
    api.script(provider_error("provider_unavailable", "http", 503))
    api.feedback(attempt_id, api.short_ids(response.json())[0])
    api.generate(provider_error("timeout", "ReadTimeout"), regenerate=True)
    failing = api.generate(completed({"questions": []}), completed({"questions": []}), completed({"questions": []}), regenerate=True)
    for text in [caplog.text, failing.text]:
        assert secret not in text and "SENTINEL-EXPLANATION" not in text and "sk-test" not in text and "server-test" not in text
