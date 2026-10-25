"""Queue-only FastAPI service: no public ingress route in vercel.json."""
import vercel_app  # noqa: F401 -- service-root backend package bootstrap
from fastapi import FastAPI, HTTPException, Request, Response
from vercel.queue import Message, SanitizedName, accept_and_handle, subscribe
from backend.workers.vercel_queue import TOPIC, process

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
_handlers = {}


@app.post("/{path:path}")
async def queue_callback(request: Request, path: str) -> Response:
    # V2 triggers assign the consumer name. Register that exact, already
    # sanitized group; the SDK validates/accepts its queue receipt before work.
    group = request.headers.get("ce-vqsconsumergroup")
    if not group or request.headers.get("ce-vqsqueuename") != TOPIC:
        raise HTTPException(400, "A queue delivery is required.")
    if group not in _handlers:
        async def handle(message: Message[dict[str, str]]) -> None:
            await process(message.payload)
        _handlers[group] = subscribe(topic=TOPIC, consumer_group=SanitizedName(group))(handle)
    await accept_and_handle(await request.body(), request.headers, lease_duration=300)
    return Response(status_code=204)
