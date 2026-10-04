"""ARQ transports source IDs; Postgres owns claims, attempts, results and recovery."""

import logging
import os
from pathlib import Path
from uuid import UUID

import httpx
from arq import cron, run_worker
from arq.connections import RedisSettings
from dotenv import load_dotenv

from backend.study_generation import GenerationFailure, StudyGenerator
from backend.study_store import StudyStore, StudyStorageError
from backend.topic_store import TopicStore
from backend.topic_generation import TopicGenerator
from backend.topic_library import build_topic_library
from backend.topic_models import TopicDescription
from backend.overview_store import OverviewStore
from backend.overview_generation import OverviewGenerator

logger = logging.getLogger(__name__)


async def dispatch_pending_studies(ctx: dict) -> None:
    store: StudyStore = ctx["store"]
    for source_id in await store.due():
        await ctx["redis"].enqueue_job(
            "build_source_study",
            str(source_id),
            _job_id=f"study:{source_id}",
        )
        await store.acknowledge(source_id)


async def build_source_study(ctx: dict, source_id: str) -> None:
    store: StudyStore = ctx["store"]
    claim = await store.claim(UUID(source_id))
    if claim is None:
        return
    try:
        note = await ctx["generator"].generate(
            claim.captured_text,
            completed_sections=claim.completed_sections,
            on_plan=lambda total: store.plan(claim, total),
            on_section=lambda index, summary: store.save_section(claim, index, summary),
            **({"document": claim.document} if claim.document else {}),
            **({"transcript": claim.transcript} if claim.transcript else {}),
        )
    except StudyStorageError as exc:
        if exc.code != "stale":
            raise
        return
    except GenerationFailure as exc:
        await store.finish(claim, error=exc.code)
        logger.info(
            "Study attempt failed: source=%s attempt=%s code=%s",
            source_id,
            claim.attempt,
            exc.code,
        )
    else:
        await store.finish(claim, note=note)
    # Transport/storage exceptions and cancelled workers leave the lease intact.
    # The dispatcher recovers it; late completions are fenced in Postgres.


async def dispatch_pending_topics(ctx: dict) -> None:
    store: TopicStore = ctx["topic_store"]
    for source_id in await store.due():
        await ctx["redis"].enqueue_job(
            "build_source_topics", str(source_id), _job_id=f"topics:{source_id}"
        )
        await store.acknowledge(source_id)


async def build_source_topics(ctx: dict, source_id: str) -> None:
    store: TopicStore = ctx["topic_store"]
    claim = await store.claim(UUID(source_id))
    if claim is None:
        return
    records = await store.list_owned(claim.user_id)
    library = build_topic_library(records[:500], partial=len(records) > 500)
    catalog = [
        TopicDescription(
            **{
                **t.model_dump(exclude={"source_ids", "uncertain"}),
                "aliases": t.aliases[:6],
                "groups": t.groups[:4],
            }
        )
        for t in library.topics
        if not t.uncertain
    ]
    try:
        analysis = await ctx["topic_generator"].generate(
            claim.note, catalog, claim.user_id, claim.source_id
        )
        analysis.catalog_partial = analysis.catalog_partial or library.partial
    except GenerationFailure as exc:
        await store.finish(claim, error=exc.code)
    else:
        await store.finish(claim, analysis=analysis)


async def dispatch_pending_overviews(ctx: dict) -> None:
    store: OverviewStore = ctx["overview_store"]
    for job_id in await store.due():
        await ctx["redis"].enqueue_job(
            "build_topic_overview", str(job_id), _job_id=f"overview:{job_id}"
        )
        await store.acknowledge(job_id)


async def build_topic_overview(ctx: dict, job_id: str) -> None:
    store: OverviewStore = ctx["overview_store"]
    claim = await store.claim(UUID(job_id))
    if claim is None:
        return
    try:
        overview = await ctx["overview_generator"].generate(
            claim.inputs, source_count=claim.source_count
        )
    except GenerationFailure as exc:
        await store.finish(claim, error=exc.code)
    else:
        await store.finish(claim, overview=overview)


async def startup(ctx: dict) -> None:
    values = {
        name: os.getenv(name, "")
        for name in ("SUPABASE_URL", "SUPABASE_SECRET_KEY", "OPENAI_API_KEY")
    }
    missing = [
        name for name, value in values.items() if not value or value == "replace-me"
    ]
    if missing:
        raise RuntimeError("Configure backend/.env: " + ", ".join(missing))
    storage_client = httpx.AsyncClient(timeout=10, trust_env=False)
    model_client = httpx.AsyncClient(timeout=60, trust_env=False)
    ctx.update(
        storage_client=storage_client,
        model_client=model_client,
        store=StudyStore(
            storage_client,
            values["SUPABASE_URL"],
            {"apikey": values["SUPABASE_SECRET_KEY"]},
        ),
        topic_store=TopicStore(
            storage_client,
            values["SUPABASE_URL"],
            {"apikey": values["SUPABASE_SECRET_KEY"]},
        ),
        overview_store=OverviewStore(
            storage_client,
            values["SUPABASE_URL"],
            {"apikey": values["SUPABASE_SECRET_KEY"]},
        ),
        overview_generator=OverviewGenerator(
            model_client, api_key=values["OPENAI_API_KEY"]
        ),
        topic_generator=TopicGenerator(model_client, api_key=values["OPENAI_API_KEY"]),
        generator=StudyGenerator(model_client, api_key=values["OPENAI_API_KEY"]),
    )


async def shutdown(ctx: dict) -> None:
    for name in ("storage_client", "model_client"):
        if name in ctx:
            await ctx[name].aclose()


class WorkerSettings:
    functions = [build_source_study, build_source_topics, build_topic_overview]
    cron_jobs = [
        cron(
            dispatch_pending_studies,
            second={0, 10, 20, 30, 40, 50},
            run_at_startup=True,
            timeout=60,
        )
    ]
    cron_jobs.append(
        cron(
            dispatch_pending_topics,
            second={5, 15, 25, 35, 45, 55},
            run_at_startup=True,
            timeout=60,
        )
    )
    cron_jobs.append(
        cron(
            dispatch_pending_overviews,
            second={7, 17, 27, 37, 47, 57},
            run_at_startup=True,
            timeout=60,
        )
    )
    on_startup = startup
    on_shutdown = shutdown
    max_jobs = 4
    job_timeout = 1_500  # At most 20 bounded section calls and one synthesis call.
    keep_result = 0
    max_tries = 1
    retry_jobs = False


def main() -> None:
    load_dotenv(Path(__file__).with_name(".env"), override=False)
    redis_url = os.getenv("REDIS_URL", "")
    if not redis_url or redis_url == "replace-me":
        raise RuntimeError("Configure REDIS_URL in backend/.env")
    WorkerSettings.redis_settings = RedisSettings.from_dsn(redis_url)
    run_worker(WorkerSettings)


if __name__ == "__main__":
    main()
