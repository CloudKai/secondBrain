"""Run approved search backfill without dispatching study/topic/model jobs."""
import os
from pathlib import Path
from arq import cron, run_worker
from arq.connections import RedisSettings
from dotenv import load_dotenv
from backend.workers.study import build_source_index, dispatch_pending_indexes, startup, shutdown


class RetrievalWorkerSettings:
    functions = [build_source_index]
    cron_jobs = [cron(dispatch_pending_indexes, second={9,19,29,39,49,59},
                      run_at_startup=True, timeout=60)]
    queue_name = "arq:retrieval"
    # ARQ uses the class __dict__, so lifecycle settings must be declared here.
    on_startup = startup
    on_shutdown = shutdown
    max_jobs = 2
    job_timeout = 1500
    keep_result = 0
    max_tries = 1
    retry_jobs = False


def main() -> None:
    load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=False)
    if os.getenv('ENABLE_RETRIEVAL_INDEXING','false').lower() != 'true':
        raise RuntimeError('Enable retrieval indexing after acceptance before starting this worker')
    required = ('REDIS_URL','QDRANT_URL','QDRANT_API_KEY')
    if any(not os.getenv(k) or os.getenv(k)=='replace-me' for k in required):
        raise RuntimeError('Configure REDIS_URL and server Qdrant settings before indexing')
    RetrievalWorkerSettings.redis_settings = RedisSettings.from_dsn(os.environ['REDIS_URL'])
    run_worker(RetrievalWorkerSettings)


if __name__ == '__main__':
    main()
