"""StudyStore.request: today's coarse codes are unchanged; sqlstate and message are additive."""

import asyncio

import httpx
import pytest

from backend.studies.store import StudyStorageError, StudyStore


def request(status, body=None, raw=None):
    """POST /rpc/x against a mocked PostgREST answering `status`."""
    def handler(_request):
        return httpx.Response(status, json=body) if raw is None else httpx.Response(status, content=raw)

    async def go():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            return await StudyStore(client, "https://db.test", {"apikey": "k"}).request("/rpc/x", body={})

    try:
        return asyncio.run(go())
    except StudyStorageError as error:
        return error


@pytest.mark.parametrize("status,code,expected", [
    (409, "40001", "stale"),
    (404, "P0002", "not_found"),
    (409, "55P03", "busy"),
    (400, "54000", "limit"),
])
def test_known_postgres_codes_keep_their_coarse_mapping(status, code, expected):
    error = request(status, {"code": code, "message": "quiz_lease_lost", "details": None})
    assert isinstance(error, StudyStorageError)
    assert error.code == expected and str(error) == expected
    assert error.sqlstate == code and error.message == "quiz_lease_lost"


@pytest.mark.parametrize("status", [401, 403])
def test_session_errors_keep_their_mapping(status):
    error = request(status, {"code": "PGRST301", "message": "JWT expired"})
    assert error.code == "session" and error.sqlstate == "PGRST301" and error.message == "JWT expired"
    assert request(status, {"message": "no code at all"}).code == "session"


def test_postgres_codes_win_over_http_status():
    assert request(401, {"code": "40001"}).code == "stale"
    assert request(403, {"code": "P0002"}).code == "not_found"


def test_other_errors_stay_generic_but_expose_what_the_database_said():
    error = request(400, {"code": "22023", "message": "quiz_answer_invalid"})
    assert error.code == "unavailable" and error.sqlstate == "22023" and error.message == "quiz_answer_invalid"
    assert request(500, {"code": "XX000", "message": "boom"}).code == "unavailable"


def test_the_message_is_truncated_to_200_characters():
    assert len(request(400, {"code": "22023", "message": "m" * 500}).message) == 200


def test_missing_or_oddly_typed_fields_leave_the_new_attributes_empty():
    error = request(400, {})
    assert (error.code, error.sqlstate, error.message) == ("unavailable", None, None)
    error = request(400, {"code": 22023, "message": ["x"]})
    assert (error.code, error.sqlstate, error.message) == ("unavailable", None, None)


def test_an_unreadable_error_body_is_still_generic():
    for error in (request(500, raw=b"<html>"), request(500, ["not", "a", "dict"])):
        assert error.code == "unavailable" and error.sqlstate is None and error.message is None


def test_the_constructor_stays_backward_compatible():
    plain = StudyStorageError()
    assert (plain.code, plain.sqlstate, plain.message, str(plain)) == ("unavailable", None, None, "unavailable")
    assert StudyStorageError("stale").code == "stale"
    detailed = StudyStorageError("busy", sqlstate="55P03", message="quiz_grading_busy")
    assert (detailed.code, detailed.sqlstate, detailed.message) == ("busy", "55P03", "quiz_grading_busy")


def test_success_still_returns_json_or_none():
    assert request(200, {"ok": True}) == {"ok": True}
    assert request(200, raw=b"") is None
