# Browser study notes — ticket #2

## Verified locally

FastAPI accepts owned study requests, Postgres persists one study/outbox together,
and an ARQ worker builds read-only English notes through LangGraph/OpenAI.
Deterministic checks cover grounded passages, provider failures, bounded retries,
duplicate requests, lease recovery, ownership and rollback. Browser fixtures cover
generated notes, citation navigation, reload and retry. Hosted generation acceptance
is pending; ticket #1's hosted source capture already passed.

## Development setup

1. Apply `supabase/migrations/202610030002_source_studies.sql` once, after the
   ticket #1 migration, in your development project's Supabase SQL editor.
   The versioned file is the schema source; retain it with deployment history.
2. Fill these values in the ignored `backend/.env` file. Public project settings
   remain as configured for source capture:

   ```dotenv
   OPENAI_API_KEY=replace-me
   SUPABASE_SECRET_KEY=replace-me
   REDIS_URL=redis://127.0.0.1:6379/0
   ```

   Use the project's server secret key. Never place either secret in `web/`,
   a `VITE_` variable, GitHub issues or chat. The model account needs API access.
3. Start Docker Desktop, then run these commands from the repository root:

   ```sh
   docker compose up -d redis
   uv run --project backend python -m backend.study_worker
   ```

   Keep the worker running in its own terminal. It loads `backend/.env` itself.
   Redis listens only on localhost and keeps no authoritative application data.
   `docker compose stop redis` stops the local transport without deleting notes.
4. Keep FastAPI and Vite running as described in `supabase/README.md`. The API
   needs the public project settings and learner session; generation secrets
   are used by the worker. Restart processes after changing their configuration.

## Live acceptance

- Save a public article. Its capture persists first; the browser then requests
  generation. If requesting generation fails, the capture remains available with
  **Generate study note** so the learner can recover.
- Observe queued/processing then ready. Open citations from the overview,
  concepts, equations/examples and revealed recall answers. Check exact source
  excerpts and original URL, then reload and reopen the same completed note.
- Use an independent anonymous browser: study SELECT returns no other owner's
  rows and requesting generation for another owner's source returns 404.
- Stop Redis during an accepted request; restart it and verify eventual
  completion. Stop a processing worker; restart and verify lease recovery.
- Verify a provider failure saves no completed note, retries at most three times,
  and ends with an actionable error. **Retry generation** explicitly starts a
  fresh bounded cycle for the same source, without another note record.

## Contract and recovery

- `POST /api/v2/sources/{id}/study` accepts `{ "retry": false }`, returns 202,
  and atomically creates/reuses one owned study plus its dispatch record.
- `GET /api/v2/studies` lists persisted owned records with `limit`/`offset`.
  The original source DTO remains compatible with ticket #1; its `pending` field
  describes capture alone. The separate study record owns generation status.
- SQL owns attempts (maximum 3), retries (10s then 30s), 120s leases and fenced
  completion. Setup errors end immediately. The model has no hidden SDK retries
  and a 65s processing deadline. Redis jobs carry source UUIDs only.
- A dispatcher runs every 10s and redelivers unclaimed outbox records after 30s.
  Expired leases recover interrupted jobs; deleted sources cascade their studies
  and dispatches. Stale workers cannot overwrite a later claim.
- Each model explanation cites server-indexed passage IDs. The server attaches
  exact excerpts and Unicode code-point offsets from the immutable capture;
  the browser checks them again. Locations are captured-text characters, not
  invented page numbers or video times. This validates reference integrity;
  learners can use the passages to check the explanations' meaning.
- Examples/equations may be empty if unsupported. Concepts are substantive and
  variable in count. Topic assignment/graphs, research/chat, PDFs, videos,
  changed-source refresh and native integration remain later tickets.

`supabase/rollbacks/202610030002_source_studies.sql` removes generated notes/jobs
and preserves captures. Use it only when intentionally removing this development
feature; it deletes stored study outputs.

Primary contracts: [Supabase functions](https://supabase.com/docs/guides/database/functions),
[ARQ worker](https://arq-docs.helpmanual.io/),
[OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs).
