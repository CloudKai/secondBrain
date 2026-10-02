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
captured text is capped at 30,000 characters. Reader/pasted coverage is
unconfirmed; truncation is partial. Unsupported binary/private URLs do not use
the fallback. These limits are separate from the preserved native pipeline.
