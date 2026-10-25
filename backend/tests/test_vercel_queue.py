"""Queue handoff tests without provider calls or live queue credentials."""
import asyncio
from unittest.mock import AsyncMock
from uuid import UUID

import pytest
from vercel.queue import RetryAfter
from backend.workers import vercel_queue as worker

SOURCE = "33333333-3333-4333-8333-333333333333"

def test_vercel_wakeup_publishes_only_a_dispatch_signal(monkeypatch):
    monkeypatch.setenv("VERCEL", "1")
    sender = AsyncMock()
    monkeypatch.setattr(worker, "send", sender)
    asyncio.run(worker.wake_worker())
    assert sender.await_args.args == (worker.TOPIC, {"task": "dispatch"})
    assert "dispatch:" in sender.await_args.kwargs["idempotency_key"]


def test_local_arq_does_not_publish_and_queue_failure_keeps_durable_job(monkeypatch):
    sender = AsyncMock(side_effect=ConnectionError("queue unavailable"))
    monkeypatch.setattr(worker, "send", sender)
    monkeypatch.delenv("VERCEL", raising=False)
    asyncio.run(worker.wake_worker())
    sender.assert_not_awaited()
    monkeypatch.setenv("VERCEL", "1")
    asyncio.run(worker.wake_worker())  # Caller already committed the outbox.
    sender.assert_awaited_once()


def test_existing_dispatcher_acknowledges_only_after_queue_accepts(monkeypatch):
    from backend.workers.study import dispatch_pending_studies
    async def run():
        store = AsyncMock()
        store.due.return_value = [UUID(SOURCE)]
        sender = AsyncMock(side_effect=ConnectionError())
        monkeypatch.setattr(worker, "send", sender)
        with pytest.raises(ConnectionError):
            await dispatch_pending_studies({"store": store, "redis": worker.QueueTransport()})
        store.acknowledge.assert_not_awaited()
        sender.side_effect = None
        await dispatch_pending_studies({"store": store, "redis": worker.QueueTransport()})
        store.acknowledge.assert_awaited_once_with(UUID(SOURCE))
        assert sender.await_args.args == (worker.TOPIC, {"task":"build_source_study", "id": SOURCE})
    asyncio.run(run())


def test_queued_or_interrupted_jobs_keep_the_queue_delivery(monkeypatch):
    async def run():
        ctx = {"store": AsyncMock()}
        ctx["store"].request.return_value = [{"status": "processing"}]
        build = AsyncMock()
        monkeypatch.setitem(worker.JOBS, "build_source_study", build)
        with pytest.raises(RetryAfter):
            await worker.run_job(ctx, {"task":"build_source_study", "id":SOURCE})
        ctx["store"].due.assert_awaited_once()
        build.assert_awaited_once_with(ctx, SOURCE)
        ctx["store"].request.return_value = [{"status":"succeeded"}]
        await worker.run_job(ctx, {"task":"build_source_study", "id":SOURCE})
    asyncio.run(run())


def test_consumer_closes_clients_after_failure(monkeypatch):
    async def start(ctx): ctx["started"] = True
    shutdown = AsyncMock()
    monkeypatch.setattr(worker, "startup", start)
    monkeypatch.setattr(worker, "shutdown", shutdown)
    monkeypatch.setattr(worker, "run_job", AsyncMock(side_effect=RuntimeError("transport")))
    with pytest.raises(RuntimeError):
        asyncio.run(worker.process({"task":"build_source_study", "id":SOURCE}))
    shutdown.assert_awaited_once()


def test_unknown_tasks_and_untrusted_payloads_never_call_worker(monkeypatch):
    build = AsyncMock()
    monkeypatch.setitem(worker.JOBS, "build_source_study", build)
    for payload in [{"task":"arbitrary_function", "id":SOURCE}, {"task":"build_source_study", "id":"not-a-uuid"}, {"task":"build_source_study", "id":SOURCE, "api_key":"untrusted"}]:
        with pytest.raises(ValueError):
            asyncio.run(worker.run_job({}, payload))
    build.assert_not_awaited()

@pytest.mark.parametrize("task,store_name,table,key", [
    ("build_source_topics", "topic_store", "source_topic_maps", "source_id"),
    ("build_topic_overview", "overview_store", "topic_overviews", "id"),
])
def test_related_jobs_check_the_existing_authoritative_status_table(monkeypatch, task, store_name, table, key):
    async def run():
        store = AsyncMock()
        store.transport.request.return_value = [{"status":"succeeded"}]
        monkeypatch.setitem(worker.JOBS, task, AsyncMock())
        await worker.run_job({store_name:store}, {"task":task, "id":SOURCE})
        store.transport.request.assert_awaited_once_with(f"/{table}", params={"select":"status", key:f"eq.{SOURCE}", "limit":"1"})
    asyncio.run(run())


def test_function_time_limit_retains_delivery_for_checkpoint_recovery(monkeypatch):
    async def run():
        store = AsyncMock()
        monkeypatch.setitem(worker.JOBS, "build_source_study", AsyncMock(side_effect=TimeoutError()))
        with pytest.raises(RetryAfter):
            await worker.run_job({"store":store}, {"task":"build_source_study", "id":SOURCE})
    asyncio.run(run())
