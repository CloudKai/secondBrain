"""Private queue subscriber, discovered by Vercel independently of the HTTP API."""
import vercel_app  # noqa: F401 -- retain the service-root backend package bootstrap
from vercel.queue import Message, subscribe
from backend.workers.vercel_queue import TOPIC, process


@subscribe(topic=TOPIC, consumer_group="secondbrain-worker", max_concurrency=2,
           max_attempts=10, retry_after=130)
async def handle_work(message: Message[dict[str, str]]) -> None:
    await process(message.payload)
