"""Worker checks at Supabase, model HTTP, and Redis seams."""

import asyncio
import json
import inspect
from uuid import UUID

import httpx
import pytest
from arq.connections import ArqRedis

from backend.study_generation import StudyGenerator
from backend.study_store import StudyStorageError, StudyStore
from backend.study_worker import build_source_study, dispatch_pending_studies
from backend.tests.test_study_generation import CAPTURE, completion

SOURCE = "33333333-3333-4333-8333-333333333333"
LEASE = "44444444-4444-4444-8444-444444444444"


class RedisTransport:
    def __init__(self, fail=False):
        self.calls = []
        self.fail = fail

    async def enqueue_job(self, name, *args, **kwargs):
        bound = inspect.signature(ArqRedis.enqueue_job).bind(
            self, name, *args, **kwargs
        )
        inspect.signature(build_source_study).bind(
            {}, *args, **bound.arguments.get("kwargs", {})
        )
        if self.fail:
            raise ConnectionError("redis unavailable")
        self.calls.append((name, args, kwargs))
        return None  # Existing unique job also counts as delivered.


def test_dispatch_acknowledges_only_after_redis_accepts_stable_id():
    async def run():
        acknowledged = []

        def external(request):
            assert request.headers["apikey"] == "sb_secret_test"
            assert "authorization" not in request.headers
            if request.url.path.endswith("due_study_dispatches"):
                return httpx.Response(200, json=[{"source_id": SOURCE}])
            acknowledged.append(json.loads(request.content)["p_source_id"])
            return httpx.Response(204)

        async with httpx.AsyncClient(transport=httpx.MockTransport(external)) as client:
            store = StudyStore(
                client, "https://supabase.test", {"apikey": "sb_secret_test"}
            )
            redis = RedisTransport(fail=True)
            with pytest.raises(ConnectionError):
                await dispatch_pending_studies({"store": store, "redis": redis})
            assert acknowledged == []
            redis.fail = False
            await dispatch_pending_studies({"store": store, "redis": redis})
            assert acknowledged == [SOURCE]
            assert redis.calls == [
                (
                    "build_source_study",
                    (SOURCE,),
                    {"_job_id": f"study:{SOURCE}"},
                )
            ]

    asyncio.run(run())


@pytest.mark.parametrize("provider_status", [200, 503])
def test_worker_persists_grounded_success_or_safe_failure_not_fabricated_content(
    provider_status,
):
    async def run():
        finishes = []

        def external(request):
            if request.url.host == "supabase.test":
                assert request.headers["apikey"] == "sb_secret_test"
                if request.url.path.endswith("claim_source_study"):
                    return httpx.Response(
                        200,
                        json={
                            "source_id": SOURCE,
                            "user_id": "11111111-1111-4111-8111-111111111111",
                            "lease_token": LEASE,
                            "attempt": 1,
                            "captured_text": CAPTURE,
                        },
                    )
                if request.url.path.endswith(("plan_source_study", "save_study_section")):
                    return httpx.Response(200, json=True)
                finishes.append(json.loads(request.content))
                return httpx.Response(200, json=True)
            assert "apikey" not in request.headers
            return (
                completion(request)
                if provider_status == 200
                else httpx.Response(503, json={"error": {"message": "private error"}})
            )

        async with httpx.AsyncClient(transport=httpx.MockTransport(external)) as client:
            await build_source_study(
                {
                    "store": StudyStore(
                        client, "https://supabase.test", {"apikey": "sb_secret_test"}
                    ),
                    "generator": StudyGenerator(client, api_key="test-key"),
                },
                SOURCE,
            )
        assert finishes[0]["p_source_id"] == SOURCE
        assert finishes[0]["p_lease_token"] == LEASE
        if provider_status == 200:
            assert finishes[0]["p_note"]["references"][0]["excerpt"] == CAPTURE
            assert finishes[0]["p_error_code"] is None
        else:
            assert finishes[0]["p_note"] is None
            assert finishes[0]["p_error_code"] == "provider_unavailable"

    asyncio.run(run())


def test_duplicate_or_deleted_job_does_not_call_model():
    async def run():
        calls = []

        def external(request):
            calls.append(request.url.path)
            return httpx.Response(200, json=None)

        async with httpx.AsyncClient(transport=httpx.MockTransport(external)) as client:
            await build_source_study(
                {
                    "store": StudyStore(
                        client, "https://supabase.test", {"apikey": "sb_secret_test"}
                    ),
                    "generator": StudyGenerator(client, api_key="test-key"),
                },
                SOURCE,
            )
        assert calls == ["/rest/v1/rpc/claim_source_study"]

    asyncio.run(run())


@pytest.mark.parametrize("value", [{}, [], False, 0, {"source_id": 123}])
def test_malformed_claims_are_storage_failures_not_silently_skipped_jobs(value):
    async def run():
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(
                lambda request: httpx.Response(200, json=value)
            )
        ) as client:
            store = StudyStore(
                client, "https://supabase.test", {"apikey": "sb_secret_test"}
            )
            with pytest.raises(StudyStorageError):
                await store.claim(UUID(SOURCE))

    asyncio.run(run())


@pytest.mark.parametrize(
    "value", [{}, False, [{"source_id": 123}], [{"source_id": SOURCE, "unknown": True}]]
)
def test_malformed_dispatches_are_storage_failures(value):
    async def run():
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(
                lambda request: httpx.Response(200, json=value)
            )
        ) as client:
            store = StudyStore(
                client, "https://supabase.test", {"apikey": "sb_secret_test"}
            )
            with pytest.raises(StudyStorageError):
                await store.due()

    asyncio.run(run())
