# AI Second Brain backend

Python 3.11 FastAPI service implementing the Deep Feynman LangGraph pipeline.

From the repository root:

```bash
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
export OPENAI_API_KEY="your-key"
uvicorn backend.main:app --reload
```

Process a link:

```bash
curl -X POST http://127.0.0.1:8000/api/v1/process-link \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com/article","folder_id":"learning"}'
```

Interactive API documentation is available at `http://127.0.0.1:8000/docs`.

Run the test suite with `pytest backend/tests` from the repository root.

Alternatively, `uv sync --project backend --extra dev` creates the environment
directly from `pyproject.toml`.

## Owned browser articles (ticket #1)

`/api/v2/sources` adds a separate source-capture contract while preserving the
existing synchronous `/api/v1/process-link` route. GET lists owned records with
`limit`/`offset` pagination; POST saves or reuses a captured public article.
GET and DELETE `/{source_id}` require ownership and return 404 otherwise.
All source routes require a verified Supabase bearer session. Owner IDs cannot
be chosen in request bodies. Returned captures are read-only and carry pending
study status, original/canonical URL, captured text/time, origin, and coverage.

Set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` in the process environment.
The source flow uses the public key plus the learner's verified bearer token,
with application ownership filters and Postgres RLS. It uses no model call,
service-role key, job queue, or native folder migration. See
[`supabase/README.md`](../supabase/README.md) for project setup and the reviewed
migration. Hosted anonymous source persistence and ownership acceptance
passed on 2026-10-03.

Capture permits only public HTTP(S) article hosts, checks every redirect,
connects to the validated IP with the original TLS identity, and limits each
download to 2 MB. Direct and reader attempts share a 60-second deadline;
captured text is capped at 120,000 characters after the long-source migration; section model calls remain capped at 30,000 characters. Reader/pasted coverage is
unconfirmed; truncation is partial. Unsupported binary/private URLs do not use
the fallback. These limits are separate from the preserved native pipeline.


## Structured browser notes (ticket #2)

Owned `POST /api/v2/sources/{id}/study` returns persisted 202 status;
`GET /api/v2/studies` lists owned status/notes. The separate ARQ worker uses
LangGraph/OpenAI and a server-only Supabase secret key. Postgres owns durable
outbox delivery, bounded attempts, leases and read-only results. The HTTP capture
contract remains compatible and no provider call blocks generation acceptance.

Apply the versioned study migration and run Redis/worker as described in
[`docs/study-note-setup.md`](../docs/study-note-setup.md). Local SQL/HTTP/browser
checks pass; hosted study generation and recovery also passed on 2026-10-03. The native v1
pipeline remains synchronous.


## Browser long captures and ranges — #14

Hosted development checks pass for original PDF page/timed-caption selection
and durable section processing/progress with retry. Migration 010 is applied;
apply it before running the matching worker in another environment. Exact limits and rollback:
[long-source setup](../docs/long-source-setup.md). Native/v1 behavior is unchanged.
