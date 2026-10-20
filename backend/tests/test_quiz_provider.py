"""The real OpenAIResponsesModel over httpx.MockTransport: one case per refund-table row."""

import asyncio
import json

import httpx
import pytest

from backend.quiz import provider as p
from backend.quiz.limits import ProviderLedger, QuizConfig
from backend.quiz.models import GeneratedQuiz
from backend.tests.quiz_fakes import generated_dict

OK_BODY = {"status": "completed", "usage": {"input_tokens": 120, "output_tokens": 340},
           "output": [{"type": "message", "content": [{"type": "output_text", "text": json.dumps(generated_dict())}]}]}


@pytest.fixture(autouse=True)
def key(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")


def invoke(handler, config=None, model="gpt-6-luna", tokens=4000):
    """Run one call through the real adapter; return (ledger, response-or-error, captured requests)."""
    seen = []

    def recording(request):
        seen.append(request)
        return handler(request)

    async def go():
        ledger = ProviderLedger()
        async with httpx.AsyncClient(transport=httpx.MockTransport(recording)) as client:
            adapter = p.OpenAIResponsesModel(client, config or QuizConfig())
            try:
                result = await adapter.call(model=model, instructions="INSTR", input='{"data": 1}', schema=GeneratedQuiz,
                                            max_output_tokens=tokens, timeout=30, ledger=ledger)
            except p.ProviderError as error:
                result = error
        return ledger, result, seen

    return asyncio.run(go())


def respond(status, body=None, raw=None):
    return lambda request: httpx.Response(status, json=body) if raw is None else httpx.Response(status, content=raw)


def raising(error):
    def handler(request):
        raise error
    return handler


def test_request_shape_follows_the_responses_api_contract():
    ledger, response, seen = invoke(respond(200, OK_BODY), QuizConfig(reasoning_effort="medium"), model="custom-model", tokens=1234)
    request = seen[0]
    body = json.loads(request.content)
    assert str(request.url) == "https://api.openai.com/v1/responses"
    assert request.headers["authorization"] == "Bearer sk-test"
    assert body["model"] == "custom-model" and body["max_output_tokens"] == 1234
    assert body["store"] is False and body["reasoning"] == {"effort": "medium"}
    assert body["instructions"] == "INSTR" and body["input"] == '{"data": 1}'
    fmt = body["text"]["format"]
    assert (fmt["type"], fmt["name"], fmt["strict"]) == ("json_schema", "GeneratedQuiz", True)
    assert fmt["schema"] == GeneratedQuiz.model_json_schema() and "oneOf" not in json.dumps(fmt["schema"])
    assert response.outcome == "completed" and (response.tokens_in, response.tokens_out) == (120, 340)
    assert json.loads(response.text) == generated_dict()


def test_without_an_injected_client_the_adapter_opens_one_with_trust_env_disabled(monkeypatch):
    created = []
    original = httpx.AsyncClient

    def factory(**kwargs):
        created.append(kwargs)
        return original(**{**kwargs, "transport": httpx.MockTransport(respond(200, OK_BODY))})

    monkeypatch.setattr(httpx, "AsyncClient", factory)
    ledger = ProviderLedger()
    response = asyncio.run(p.OpenAIResponsesModel(config=QuizConfig()).call(
        model="m", instructions="i", input="{}", schema=GeneratedQuiz, max_output_tokens=1000, timeout=5, ledger=ledger))
    assert response.outcome == "completed" and created[0]["trust_env"] is False


# --- response classification ------------------------------------------------------------


def test_incomplete_and_refused_outcomes():
    incomplete = {"status": "incomplete", "incomplete_details": {"reason": "max_output_tokens"}, "output": []}
    ledger, response, _ = invoke(respond(200, incomplete))
    assert (response.outcome, response.reason) == ("incomplete", "truncated") and not ledger.refundable
    filtered = {"status": "incomplete", "incomplete_details": {"reason": "content_filter"}, "output": []}
    assert invoke(respond(200, filtered))[1].reason == "refused"
    refusal = {"status": "completed", "output": [{"type": "message", "content": [{"type": "refusal", "refusal": "No."}]}]}
    ledger, response, _ = invoke(respond(200, refusal))
    assert (response.outcome, response.reason) == ("refused", "refused") and not ledger.refundable


def test_a_2xx_without_a_completed_status_is_a_provider_failure_that_stays_spent():
    for body in ({"status": "failed", "output": []}, {"status": "queued"}, [], "text"):
        ledger, error, _ = invoke(respond(200, body))
        assert isinstance(error, p.ProviderError) and error.code == "provider_unavailable"
        assert ledger.calls_started == 1 and not ledger.refundable


def test_completed_without_text_is_returned_for_validation_not_hidden():
    ledger, response, _ = invoke(respond(200, {"status": "completed", "output": []}))
    assert response.outcome == "completed" and response.text == ""


# --- one case per row of the refund table -----------------------------------------------


def test_missing_or_placeholder_key_starts_no_call(monkeypatch):
    for value in ("", "YOUR_KEY_HERE"):
        monkeypatch.setenv("OPENAI_API_KEY", value)
        ledger, error, seen = invoke(respond(200, OK_BODY))
        assert error.code == "setup_required" and seen == []
        assert ledger.calls_started == 0 and ledger.refundable
    monkeypatch.delenv("OPENAI_API_KEY")
    ledger, error, seen = invoke(respond(200, OK_BODY))
    assert error.code == "setup_required" and ledger.refundable


@pytest.mark.parametrize("error,code,refundable", [
    (httpx.ConnectError("no route"), "provider_unavailable", True),
    (httpx.ConnectTimeout("slow connect"), "timeout", True),
    (httpx.ReadTimeout("slow read"), "timeout", False),
    (httpx.WriteTimeout("slow write"), "timeout", False),
    (httpx.PoolTimeout("no connection"), "timeout", False),
    (httpx.RemoteProtocolError("dropped"), "provider_unavailable", False),
    (httpx.ReadError("reset"), "provider_unavailable", False),
])
def test_transport_errors(error, code, refundable):
    ledger, result, _ = invoke(raising(error))
    assert isinstance(result, p.ProviderError) and result.code == code
    assert ledger.calls_started == 1 and ledger.refundable is refundable


@pytest.mark.parametrize("status,code", [(400, "provider_unavailable"), (401, "setup_required"),
                                         (403, "setup_required"), (404, "setup_required")])
def test_rejected_before_processing_is_unspent(status, code):
    ledger, error, _ = invoke(respond(status, {"error": {"message": "nope"}}))
    assert error.code == code and ledger.calls_started == 1 and ledger.refundable


@pytest.mark.parametrize("body,refundable", [
    ({"error": {"type": "invalid_request_error"}}, True),
    ({"error": {"type": "insufficient_quota", "code": "insufficient_quota"}}, True),
    ({"error": {"type": "requests", "code": "insufficient_quota"}}, True),
    ({"error": {"type": "requests", "code": "rate_limit_exceeded"}}, False),
    ({"error": {"code": "rate_limit_exceeded"}}, False),
    ({"error": "text"}, False),
    ({}, False),
])
def test_429_is_unspent_only_for_owner_caused_errors(body, refundable):
    ledger, error, _ = invoke(respond(429, body))
    assert error.code == "provider_unavailable" and ledger.refundable is refundable


def test_a_429_without_json_is_spent():
    ledger, error, _ = invoke(respond(429, raw=b"<html>busy</html>"))
    assert error.code == "provider_unavailable" and not ledger.refundable


@pytest.mark.parametrize("status", [422, 500, 502, 503])
def test_other_errors_are_spent(status):
    ledger, error, _ = invoke(respond(status, {"error": {"type": "server_error"}}))
    assert error.code == "provider_unavailable" and not ledger.refundable


def test_a_mixed_ladder_is_not_refundable():
    ledger = ProviderLedger()
    answers = iter([httpx.Response(200, json=OK_BODY), httpx.Response(401, json={"error": {}})])

    async def go():
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda r: next(answers))) as client:
            adapter = p.OpenAIResponsesModel(client, QuizConfig())
            await adapter.call(model="m", instructions="i", input="{}", schema=GeneratedQuiz, max_output_tokens=1000, timeout=5, ledger=ledger)
            with pytest.raises(p.ProviderError):
                await adapter.call(model="m", instructions="i", input="{}", schema=GeneratedQuiz, max_output_tokens=1000, timeout=5, ledger=ledger)

    asyncio.run(go())
    assert (ledger.calls_started, ledger.calls_unspent) == (2, 1) and not ledger.refundable


def test_cancellation_mid_call_leaves_the_call_spent():
    async def slow(request):
        await asyncio.sleep(30)

    async def go():
        ledger = ProviderLedger()
        async with httpx.AsyncClient(transport=httpx.MockTransport(slow)) as client:
            adapter = p.OpenAIResponsesModel(client, QuizConfig())
            task = asyncio.ensure_future(adapter.call(model="m", instructions="i", input="{}", schema=GeneratedQuiz,
                                                      max_output_tokens=1000, timeout=60, ledger=ledger))
            await asyncio.sleep(0.05)
            task.cancel()
            with pytest.raises(asyncio.CancelledError):
                await task
        return ledger

    ledger = asyncio.run(go())
    assert ledger.calls_started == 1 and not ledger.refundable


def test_exception_kind_checks_connect_timeout_before_timeout_exception():
    assert p.exception_kind(httpx.ConnectTimeout("x")) == "ConnectTimeout"
    assert p.exception_kind(httpx.ConnectError("x")) == "ConnectError"
    assert p.exception_kind(httpx.ReadTimeout("x")) == "ReadTimeout"
    assert p.exception_kind(TimeoutError()) == "TimeoutError"
    assert p.provider_code(httpx.ConnectTimeout("x")) == "timeout"
    assert p.provider_code(httpx.ConnectError("x")) == "provider_unavailable"


def test_get_quiz_model_returns_the_real_adapter():
    assert isinstance(p.get_quiz_model(), p.OpenAIResponsesModel)
