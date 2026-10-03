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
from backend.study_store import StudyStore

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
            **({"document": claim.document} if claim.document else {}),
            **({"transcript": claim.transcript} if claim.transcript else {}),
        )
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
        generator=StudyGenerator(model_client, api_key=values["OPENAI_API_KEY"]),
    )


async def shutdown(ctx: dict) -> None:
    for name in ("storage_client", "model_client"):
        if name in ctx:
            await ctx[name].aclose()


class WorkerSettings:
    functions = [build_source_study]
    cron_jobs = [
        cron(
            dispatch_pending_studies,
            second={0, 10, 20, 30, 40, 50},
            run_at_startup=True,
            timeout=60,
        )
    ]
    on_startup = startup
    on_shutdown = shutdown
    max_jobs = 4
    job_timeout = 90
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
