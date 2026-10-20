"""QuizStore: error mapping, service transport, result validation and API model building."""

import asyncio
import copy
import json
from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace
from uuid import UUID, uuid4

import httpx
import pytest

from backend.quiz import store as qs
from backend.quiz.routes import quiz_error_handler
from backend.quiz.limits import QuizConfig
from backend.quiz.messages import QUIZ_MESSAGES
from backend.quiz.models import QuizErrorResponse
from backend.studies.store import StudyStorageError
from backend.tests.quiz_supabase import COLLECTION, OWNER, PLAN, SERVER_KEY, TOKEN, FakeSupabase

FIXTURES = Path(__file__).parent / "fixtures"
CODES = json.loads((FIXTURES / "quiz_error_codes.json").read_text(encoding="utf-8"))
EXAMPLE = json.loads((FIXTURES / "quiz_stored_example.json").read_text(encoding="utf-8"))
COARSE = {"40001": "stale", "P0002": "not_found", "55P03": "busy", "54000": "limit"}


def storage_error(sqlstate, message, code=None):
    return StudyStorageError(code or COARSE.get(sqlstate, "unavailable"), sqlstate=sqlstate, message=message)


# --- the shared fixture and the tables agree ----------------------------------------------------


def test_status_table_equals_the_shared_fixture_and_every_code_has_a_message():
    assert qs.STATUS == {row["code"]: row["http"] for row in CODES}
    assert set(qs.STATUS) == set(QUIZ_MESSAGES)
    sql = {row["sql_message"]: row["code"] for row in CODES if row["sql_message"]}
    extra = {item["sql_message"]: "quiz_storage_unavailable" for row in CODES for item in row.get("extra_sql_messages", [])}
    assert qs.SQL_MESSAGES == {**sql, **extra}


@pytest.mark.parametrize("row", [r for r in CODES if r["sql_message"]], ids=lambda r: r["code"])
def test_every_sql_message_maps_to_its_code_and_status(row):
    error = qs.map_storage_error(storage_error(row["sqlstate"], row["sql_message"]), service=False)
    assert (error.code, error.status) == (row["code"], row["http"])
    service_error = qs.map_storage_error(storage_error(row["sqlstate"], row["sql_message"]), service=True)
    assert service_error.code == row["code"]


@pytest.mark.parametrize("message", ["quiz_invalid_output", "quiz_usage_invalid"])
def test_backend_bug_messages_are_unavailable_and_logged_at_error(message, caplog):
    error = qs.map_storage_error(storage_error("22023", message), service=True)
    assert error.code == "quiz_storage_unavailable" and any(r.levelname == "ERROR" for r in caplog.records)


def test_a_message_that_is_not_in_the_table_is_never_interpreted():
    for sqlstate, message in (("40001", "stale tuple"), ("P0002", "not found"), ("54000", "quiz_unknown_limit"),
                              ("40001", "QUIZ_LEASE_LOST"), ("40001", None), ("22023", "quizzes_one_generating")):
        assert qs.map_storage_error(storage_error(sqlstate, message), service=False).code == "quiz_storage_unavailable", message


def test_unique_violations_map_to_in_progress_codes():
    assert qs.map_storage_error(storage_error("23505", 'duplicate key value violates unique constraint "quizzes_one_generating"'), service=False).code == "quiz_generation_in_progress"
    assert qs.map_storage_error(storage_error("23505", 'unique constraint "quiz_attempts_user_id_client_attempt_id_key"'), service=False).code == "quiz_attempt_in_progress"
    assert qs.map_storage_error(storage_error("23505", "some other index"), service=False).code == "quiz_storage_unavailable"


def test_session_errors_differ_for_learner_and_server_credentials(caplog):
    session = StudyStorageError("session", sqlstate="PGRST301", message="JWT expired")
    assert qs.map_storage_error(session, service=False).code == "quiz_session_expired"
    assert qs.map_storage_error(session, service=True).code == "quiz_storage_unavailable"
    assert any(r.levelname == "ERROR" for r in caplog.records)


def test_the_attempts_cap_error_carries_the_next_utc_midnight():
    error = qs.map_storage_error(storage_error("54000", "quiz_generation_attempts_capped"), service=False)
    assert isinstance(error.extra["resets_at"], datetime) and error.extra["resets_at"] > datetime.now(UTC)


# --- the error handler ------------------------------------------------------------------------------------


def test_the_handler_shapes_the_body_and_retry_after():
    error = qs.QuizError("quiz_generation_limit_reached", limit=3, used=3, resets_at="2026-10-22T00:00:00+00:00")
    response = asyncio.run(quiz_error_handler(None, error))
    body = json.loads(response.body)
    assert response.status_code == 429 and response.headers["cache-control"] == "no-store" and int(response.headers["retry-after"]) >= 1
    assert body["error"] == {"code": "quiz_generation_limit_reached", "message": body["detail"], "retryable": False,
                             "limit": 3, "used": 3, "resets_at": "2026-10-22T00:00:00Z"}
    QuizErrorResponse.model_validate_json(response.body)
    plain = asyncio.run(quiz_error_handler(None, qs.QuizError("quiz_plan_cap_reached")))
    assert plain.status_code == 429 and "retry-after" not in plain.headers
    busy = json.loads(asyncio.run(quiz_error_handler(None, qs.QuizError("quiz_attempt_in_progress", retry_after_seconds=5))).body)
    assert busy["error"]["retryable"] is True and busy["error"]["retry_after_seconds"] == 5


def test_messages_contain_no_ids_or_provider_text():
    for code in qs.STATUS:
        body = qs.QuizError(code, limit=3).body()
        assert body["detail"] == QUIZ_MESSAGES[code].replace("{limit}", "3")


# --- transports --------------------------------------------------------------------------------------------


def make_store(fake, monkeypatch, config=None):
    monkeypatch.setenv("SUPABASE_SECRET_KEY", SERVER_KEY)
    client = httpx.AsyncClient(transport=httpx.MockTransport(fake.handler))
    gateway = SimpleNamespace(client=client, project_url="https://supabase.test", user_id=UUID(OWNER),
                              headers={"apikey": "public-test", "Authorization": f"Bearer {TOKEN}"})
    return qs.QuizStore.for_gateway(gateway, config or QuizConfig()), client


def test_service_calls_use_their_own_client_with_the_secret_key_and_return_the_json_value(monkeypatch):
    fake, created = FakeSupabase(), []
    original = httpx.AsyncClient

    def factory(**kw):
        created.append(kw)
        return original(**{**kw, "transport": httpx.MockTransport(fake.handler)})

    store, request_client = make_store(fake, monkeypatch)
    monkeypatch.setattr(httpx, "AsyncClient", factory)
    claim = asyncio.run(store.jwt("request_quiz_generation", p_collection_id=COLLECTION, p_plan_id=PLAN, p_request_id=str(uuid4()), p_regenerate=False))

    async def go():
        grant = await store.service("charge_quiz_generation", p_quiz_id=claim["quiz_id"], p_lease_token=claim["lease_token"], p_limit=3)
        failed = await store.fail_generation(claim["quiz_id"], claim["lease_token"], "limit", False)
        assert store._http is not request_client
        await store.aclose()
        return grant, failed

    grant, failed = asyncio.run(go())
    assert grant["allowed"] is True and grant["used"] == 1 and failed is True
    assert created == [{"timeout": 15, "trust_env": False}]
    assert fake.calls[-1][0] == "fail_quiz_generation"


def test_a_missing_service_key_is_storage_unavailable_without_a_network_call(monkeypatch, caplog):
    fake = FakeSupabase()
    store, _client = make_store(fake, monkeypatch)
    monkeypatch.delenv("SUPABASE_SECRET_KEY")
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    with pytest.raises(qs.QuizError) as caught:
        asyncio.run(store.service("charge_quiz_generation", p_quiz_id="x", p_lease_token="y", p_limit=3))
    assert caught.value.code == "quiz_storage_unavailable" and fake.events == [] and any(r.levelname == "ERROR" for r in caplog.records)


def test_a_rejected_service_key_is_never_a_session_error(monkeypatch):
    fake = FakeSupabase()
    store, _client = make_store(fake, monkeypatch)
    monkeypatch.setenv("SUPABASE_SECRET_KEY", "revoked")
    with pytest.raises(qs.QuizError) as caught:
        asyncio.run(store.service("charge_quiz_generation", p_quiz_id="x", p_lease_token="y", p_limit=3))
    assert caught.value.code == "quiz_storage_unavailable"


def test_a_rejected_learner_token_is_a_session_error(monkeypatch):
    fake = FakeSupabase()
    store, client = make_store(fake, monkeypatch)
    client.headers.update({"authorization": "Bearer expired"})
    store.learning.transport.headers = {"apikey": "public-test", "Authorization": "Bearer expired"}
    with pytest.raises(qs.QuizError) as caught:
        asyncio.run(store.state(UUID(COLLECTION), UUID(PLAN)))
    assert caught.value.code == "quiz_session_expired"


def test_a_detached_store_has_no_learner_session(monkeypatch):
    store, _client = make_store(FakeSupabase(), monkeypatch)
    detached = store.detached()
    assert detached.learning is None and detached.user_id == store.user_id
    with pytest.raises(qs.QuizError) as caught:
        asyncio.run(detached.state(UUID(COLLECTION), UUID(PLAN)))
    assert caught.value.code == "quiz_storage_unavailable"


# --- every returned id and owner is checked -----------------------------------------------------------------------


def prepared(monkeypatch):
    """A fake with one ready quiz (the shared stored example) and one graded attempt."""
    fake = FakeSupabase()
    claim = fake.fn_request_quiz_generation(COLLECTION, PLAN, str(uuid4()), False)
    fake.fn_charge_quiz_generation(claim["quiz_id"], claim["lease_token"], 3)
    fake.fn_finish_quiz_generation(claim["quiz_id"], claim["lease_token"], copy.deepcopy(EXAMPLE), "gpt-6-luna", False, 1, 1)
    quiz = fake.quizzes[claim["quiz_id"]]
    answers = []
    for q in quiz["questions"]:
        key = quiz["keys"][q["id"]]
        answers.append({"question_id": q["id"], "kind": q["kind"],
                        "answer": {"text": "mine"} if q["kind"] == "short_answer" else {"option_ids": key["correct_option_ids"]}})
    attempt = fake.fn_submit_quiz_attempt(COLLECTION, PLAN, quiz["id"], str(uuid4()), answers, "a" * 64)
    context = fake.fn_get_quiz_grading_context(attempt["attempt_id"], attempt["lease_token"])
    from backend.quiz.routes import build_results

    fake.fn_finish_quiz_attempt(attempt["attempt_id"], attempt["lease_token"], build_results(context))
    store, _client = make_store(fake, monkeypatch)
    return fake, store, quiz, attempt["attempt_id"]


def test_grading_and_short_answer_contexts_must_belong_to_the_user_and_request(monkeypatch):
    fake = FakeSupabase()
    store, _client = make_store(fake, monkeypatch)
    fake.fn_get_quiz_grading_context = lambda **kw: {"attempt_id": kw["p_attempt_id"], "user_id": str(uuid4()), "questions": []}
    with pytest.raises(qs.QuizError) as caught:
        asyncio.run(store.grading_context(uuid4(), uuid4()))
    assert caught.value.code == "quiz_storage_unavailable"
    attempt = uuid4()
    fake.fn_get_quiz_grading_context = lambda **kw: {"attempt_id": str(uuid4()), "user_id": OWNER, "questions": []}
    with pytest.raises(qs.QuizError):
        asyncio.run(store.grading_context(attempt, uuid4()))
    fake.fn_get_quiz_short_answer_context = lambda **kw: {"user_id": OWNER, "attempt_id": kw["p_attempt_id"], "question_id": str(uuid4()),
                                                          "criteria": ["a"], "answer_text": "x"}
    with pytest.raises(qs.QuizError):
        asyncio.run(store.short_context(uuid4(), uuid4(), uuid4()))


def test_attempt_and_claim_results_must_match_the_request(monkeypatch):
    fake, store, quiz, attempt_id = prepared(monkeypatch)
    ok = asyncio.run(store.attempt(UUID(COLLECTION), UUID(PLAN), UUID(attempt_id)))
    assert ok["attempt"]["id"] == attempt_id
    with pytest.raises(qs.QuizError):
        asyncio.run(store.attempt(UUID(COLLECTION), UUID(PLAN), uuid4()))
    original = fake.fn_get_quiz_attempt
    fake.fn_get_quiz_attempt = lambda **kw: {**original(**kw), "attempt": {**original(**kw)["attempt"], "plan_id": str(uuid4())}}
    with pytest.raises(qs.QuizError):
        asyncio.run(store.attempt(UUID(COLLECTION), UUID(PLAN), UUID(attempt_id)))
    fake.fn_claim_quiz_short_answer = lambda **kw: {"attempt_id": str(uuid4()), "question_id": kw["p_question_id"], "lease_token": None, "grading_state": "graded"}
    with pytest.raises(qs.QuizError):
        asyncio.run(store.claim_short_answer(UUID(COLLECTION), UUID(PLAN), UUID(attempt_id), uuid4()))


def test_malformed_claims_and_non_boolean_finishes_are_rejected(monkeypatch):
    fake = FakeSupabase()
    store, _client = make_store(fake, monkeypatch)
    fake.fn_request_quiz_generation = lambda **kw: {"quiz_id": "not-a-uuid", "lease_token": None, "replay": True}
    with pytest.raises(qs.QuizError):
        asyncio.run(store.request_generation(UUID(COLLECTION), UUID(PLAN), uuid4(), False))
    fake.fn_finish_quiz_generation = lambda **kw: "yes"
    with pytest.raises(qs.QuizError):
        asyncio.run(store.finish_generation(uuid4(), uuid4(), {}, "m", False, 0, 0))
    fake.fn_finish_quiz_attempt = lambda **kw: None
    with pytest.raises(qs.QuizError):
        asyncio.run(store.finish_attempt(uuid4(), uuid4(), {}))
    fake.fn_finish_quiz_short_answer = lambda **kw: False
    with pytest.raises(qs.QuizError):
        asyncio.run(store.finish_short_answer(uuid4(), uuid4(), uuid4(), unavailable_reason="limit"))


# --- API models are built from explicit fields -----------------------------------------------------------------------


def test_the_public_state_drops_key_fields_even_if_the_database_leaked_them(monkeypatch):
    fake, store, quiz, _attempt = prepared(monkeypatch)
    rpc = fake.fn_get_quiz_state(COLLECTION, PLAN)
    for question in rpc["quiz"]["questions"]:
        question.update(correct_option_ids=["SENTINEL-KEY"], explanation="SENTINEL-EXPLANATION", citation_ids=["SENTINEL-CITE"],
                        criteria=["SENTINEL-CRITERION"], model_answer="SENTINEL-MODEL", is_correct=True)
        for option in question["options"]:
            option["is_correct"] = True
    state = qs.build_state(rpc, QuizConfig())
    text = state.model_dump_json()
    assert "SENTINEL" not in text and "is_correct" not in text
    assert state.status == "ready" and state.can_take and len(state.quiz.questions) == 7
    assert [q.kind for q in state.quiz.questions].count("short_answer") == 2
    short = next(q for q in state.quiz.questions if q.kind == "short_answer")
    assert short.max_chars == QuizConfig().short_answer_max_chars


def test_state_derivation_precedence(monkeypatch):
    fake, store, quiz, _attempt = prepared(monkeypatch)
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    rpc = fake.fn_get_quiz_state(COLLECTION, PLAN)
    config = QuizConfig()
    assert qs.build_state(rpc, config).generate_blocked is None
    assert qs.build_state({**rpc, "generating": True}, config).regenerating is True
    assert qs.build_state({**rpc, "generating": True}, config).generate_blocked == "generating"
    assert qs.build_state({**rpc, "usage": {**rpc["usage"], "generation_used": 3}}, config).generate_blocked == "limit"
    assert qs.build_state({**rpc, "plan": {**rpc["plan"], "is_active": False}}, config).generate_blocked == "not_active"
    assert qs.build_state(rpc, QuizConfig(enabled=False)).generate_blocked == "disabled"
    monkeypatch.setenv("OPENAI_API_KEY", "YOUR_KEY")
    assert qs.build_state(rpc, config).generate_blocked == "setup"
    none = qs.build_state({**rpc, "quiz": None, "material": {"content": fake.content, "source_references": fake.references}}, config)
    assert (none.status, none.quiz, none.can_take) == ("none", None, False)
    assert qs.build_state({**rpc, "quiz": None, "generating": True}, config).status == "generating"


def test_a_graded_attempt_is_built_from_the_stored_snapshot(monkeypatch):
    fake, store, quiz, attempt_id = prepared(monkeypatch)
    rpc = asyncio.run(store.attempt(UUID(COLLECTION), UUID(PLAN), UUID(attempt_id)))
    result = qs.build_attempt_result(rpc, QuizConfig())
    assert result.score.correct == 5 and result.score.total == 5 and len(result.questions) == 7
    assert result.short_answers.total == 2 and result.short_answers.pending == 2
    assert [q.position for q in result.questions] == list(range(7))
    assert [o.label for o in result.outcomes] == ["looks_solid", "looks_solid"] and result.grading_usage.limit == 20
    short = next(q for q in result.questions if q.kind == "short_answer")
    assert [c.text for c in short.criteria] == EXAMPLE["key"][5]["criteria"] and short.model_answer == EXAMPLE["key"][5]["model_answer"]


def test_a_stored_score_that_disagrees_with_the_results_is_rejected(monkeypatch):
    fake, store, quiz, attempt_id = prepared(monkeypatch)
    rpc = asyncio.run(store.attempt(UUID(COLLECTION), UUID(PLAN), UUID(attempt_id)))
    rpc["attempt"]["correct"] = 4
    with pytest.raises(qs.QuizError) as caught:
        qs.build_attempt_result(rpc, QuizConfig())
    assert caught.value.code == "quiz_storage_unavailable"


def test_an_ungraded_attempt_has_no_result(monkeypatch):
    fake, store, quiz, attempt_id = prepared(monkeypatch)
    rpc = asyncio.run(store.attempt(UUID(COLLECTION), UUID(PLAN), UUID(attempt_id)))
    rpc["attempt"]["status"] = "grading"
    with pytest.raises(qs.QuizError):
        qs.build_attempt_result(rpc, QuizConfig())
