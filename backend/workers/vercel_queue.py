"""Vercel's private push queue transports IDs; existing Postgres claims own work."""
import asyncio
import logging
import os
import time
from uuid import UUID

from vercel.queue import RetryAfter, send
from backend.workers.study import (
    startup, shutdown, build_source_study, build_source_topics,
    build_topic_overview, build_source_index, dispatch_pending_studies,
    dispatch_pending_topics, dispatch_pending_overviews, dispatch_pending_indexes,
)

logger = logging.getLogger(__name__)
TOPIC = "secondbrain-work"
JOBS = {
    "build_source_study": build_source_study,
    "build_source_topics": build_source_topics,
    "build_topic_overview": build_topic_overview,
    "build_source_index": build_source_index,
}
# These are server-selected tables/keys, never values from a queue payload.
STATUS = {
    "build_source_study": ("store", "source_studies", "source_id"),
    "build_source_topics": ("topic_store", "source_topic_maps", "source_id"),
    "build_topic_overview": ("overview_store", "topic_overviews", "id"),
}


async def wake_worker() -> None:
    if os.getenv("SECOND_BRAIN_QUEUE_TRANSPORT") != "vercel" and os.getenv("VERCEL") != "1":
        return  # Local/self-hosted installations retain the existing ARQ worker.
    try:
        await send(TOPIC, {"task": "dispatch"},
                   idempotency_key=f"dispatch:{int(time.time()) // 10}")
        logger.info("Queue dispatch accepted")
    except Exception as exc:
        # Acceptance already committed an outbox. Reads/retries can wake it again.
        logger.warning("Queue wakeup failed: %s", type(exc).__name__)


class QueueTransport:
    async def enqueue_job(self, name: str, identity: str, **_options) -> None:
        if name not in JOBS:
            raise ValueError("Unknown worker task")
        identity = str(UUID(identity))
        # Do not deduplicate by source ID: refreshes and explicit retries use the
        # same ID. Atomic database claims make duplicate deliveries harmless.
        await send(TOPIC, {"task": name, "id": identity})


async def dispatch(ctx: dict) -> None:
    for dispatcher in (dispatch_pending_studies, dispatch_pending_topics,
                       dispatch_pending_overviews, dispatch_pending_indexes):
        await dispatcher(ctx)


async def run_job(ctx: dict, payload: dict) -> None:
    task = payload.get("task")
    if task not in JOBS or set(payload) != {"task", "id"}:
        raise ValueError("Invalid worker message")
    identity = str(UUID(payload["id"]))
    if task in STATUS:
        store_name, table, key = STATUS[task]
        store = ctx[store_name]
        await store.due()  # Existing RPC recovers expired leases before claiming.
    try:
        # Leave headroom below Hobby's 300s limit. Existing per-section
        # checkpoints survive cancellation; Postgres bounds total attempts.
        async with asyncio.timeout(240):
            await JOBS[task](ctx, identity)
    except TimeoutError as exc:
        raise RetryAfter(130) from exc
    if task in STATUS:
        transport = store if store_name == "store" else store.transport
        rows = await transport.request(f"/{table}", params={
            "select": "status", key: f"eq.{identity}", "limit": "1",
        })
        if not isinstance(rows, list) or len(rows) > 1:
            raise ValueError("Invalid worker status")
        if rows and rows[0]["status"] in ("queued", "processing"):
            # A duplicate, future retry, or interrupted lease must not silently
            # acknowledge the only durable delivery for unfinished work.
            raise RetryAfter(130)


async def process(payload: dict) -> None:
    ctx: dict = {}
    try:
        await startup(ctx)
        ctx["redis"] = QueueTransport()
        if payload == {"task": "dispatch"}:
            await dispatch(ctx)
        else:
            await run_job(ctx, payload)
            await dispatch(ctx)
    finally:
        await shutdown(ctx)
