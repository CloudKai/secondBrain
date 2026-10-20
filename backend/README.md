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


## Path quiz (Slice 2) — in development

Status 2026-10-20: implemented in development, not build-verified. The exact ran
and NOT run lists are in
[`context/web-progress-tracker.md`](../context/web-progress-tracker.md).

Design: [`docs/planning/path-quiz-spec.md`](../docs/planning/path-quiz-spec.md)
(section 20, Revision 3, is binding). Not build-verified here: the migration
`supabase/migrations/202610200023_path_quiz.sql` has **not** been applied to any
database and the owner must approve applying it first. The pytest suites that need
pydantic, fastapi and httpx were written but not run in the authoring sandbox.

Endpoints, under `/api/v2/learning/collections/{collection_id}/plans/{plan_id}/quiz`
(learner JWT on every route, `Cache-Control: no-store`):

| Method and path | Purpose | Model call |
| --- | --- | --- |
| `GET ""` | Quiz state: eligibility, key-free quiz, attempts, today's generation usage | never |
| `POST ""` | Generate (idempotent by `request_id`) or regenerate | yes, limit-checked |
| `POST /attempts` | Submit answers; deterministic grading; idempotent by `attempt_key` | never |
| `GET /attempts/{attempt_id}` | A graded attempt (heals an interrupted submit) | never |
| `POST /attempts/{attempt_id}/feedback/{question_id}` | Provisional AI feedback for one short answer | yes, limit-checked |

Errors are `{"detail", "error": {code, message, retryable, ...}}`; a 429 carries
`limit`, `used`, `resets_at` and `Retry-After`. Codes and their HTTP status are
listed in `backend/tests/fixtures/quiz_error_codes.json`; every learner-visible
message is in `backend/quiz_messages.py`.

Limits (all server-side, read only by `backend/quiz_limits.py::load_quiz_config`;
see `backend/.env.example`):

| Setting | Default | Range |
| --- | --- | --- |
| `QUIZ_GENERATIONS_PER_USER_PER_DAY` | 3 | 1-20, per user per UTC day |
| `QUIZ_GRADINGS_PER_USER_PER_DAY` | 20 | 1-100, per user per UTC day |
| `QUIZ_MAX_QUESTIONS` / `QUIZ_MAX_SHORT_ANSWER` | 8 / 2 | 4-10 / 0-2 |
| `QUIZ_MAX_OUTPUT_TOKENS` / `QUIZ_GRADING_MAX_OUTPUT_TOKENS` | 4000 / 800 | 1000-8000 / 200-2000 |
| `QUIZ_SHORT_ANSWER_MAX_CHARS` | 1500 | 100-5000 |
| `QUIZ_ENABLED` | true | spend switch only; a value that is not true or false switches it off |

The per-day limits cannot be set to 0: a lower value is raised to 1. To stop spending, set
`QUIZ_ENABLED=false`.

Fixed guards: at most 3 provider calls per generation and 2 per feedback, 20
attempts per quiz, 20 ready quizzes per plan, 3 provider-bound feedback tries per
answer. The counter is charged before any provider call and refunded only when the
call is provably unspent (no request sent, connect errors, HTTP 400/401/403/404, and
429 `invalid_request_error` or `insufficient_quota`); timeouts, cancellation, 5xx
and every 2xx stay charged.

Models: `gpt-6-luna` by default; `gpt-6.1-sol` only after a completed but invalid
Luna output survived one repair (generation only). Short-answer feedback uses the
separate `QUIZ_GRADING_MODEL`, one repair call, and no fallback rung. Generation runs
in a detached task, so a reload or dropped connection does not lose the output.
Confirm the hosting function allows at least 120 seconds before enabling generation.

Before enabling spend:

- Per-user daily limits can be bypassed by creating new anonymous accounts (spec
  R1/U5). A global cap and per-IP limits are not built, so do not expose the quiz
  endpoints publicly until they are; `QUIZ_ENABLED=false` keeps spending off.
- Explanations are not overlap-checked against the cited excerpts (the guard covers
  correct options, true/false prompts and short-answer model answers).
- Run a two-connection smoke test of the daily counter against a real Postgres; the
  PGlite burst test uses one connection.
