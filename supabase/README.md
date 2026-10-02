# Browser source storage — ticket #1

The migration and adapters pass local checks. **Hosted acceptance passed on
2026-10-03:** anonymous capture/save/reload/reopen and cross-user API/RLS
isolation were verified against the user-configured development project.
The native app still uses its existing in-memory flow.

## Set up a development project

1. Create a Supabase project and enable anonymous sign-ins in Auth settings.
   See [anonymous authentication](https://supabase.com/docs/guides/auth/auth-anonymous).
2. Apply `migrations/202610020001_browser_sources.sql` once in the new project's
   SQL editor. Use this reviewed file as the schema source.
3. Copy the project URL and **public publishable key** into both templates:

   ```sh
   cp backend/.env.example backend/.env
   cp web/.env.example web/.env.local
   ```

   Backend: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`.
   Browser: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.
   Both must refer to the same project. No service-role/secret key is used by
   this flow. Article capture does not need an OpenAI key.
4. Load the backend environment and start it from the repository root:

   ```sh
   set -a
   source backend/.env
   set +a
   uv run --project backend uvicorn backend.main:app --reload
   ```

   If the copied virtualenv entrypoint selects the wrong interpreter, use
   `uv run --project backend python -m uvicorn backend.main:app --reload`
   instead. This is the command used for the hosted checks.

5. In another terminal, run `npm --prefix web install`, then
   `npm --prefix web run dev`. Vite reads `web/.env.local`; restart it after
   changing configuration. Open `http://127.0.0.1:5173`.

## Live acceptance checks

- Save a public article, inspect its captured text and original link, reload,
  and reopen it. The viewer must continue to say **Study note pending**.
- Open a separate browser profile/private session. Its saved-source list must
  be empty and the first learner's source ID must return 404 with that session's
  bearer token. Verify deletion is denied across learners and allowed for its owner.
- Check blocked/unsupported capture feedback and storage-error recovery.

Local tests use external HTTP fixtures and an embedded Postgres runtime.
The separate hosted browser checks passed on 2026-10-03, including owner
deletion and cross-user denial. The temporary verification source was removed.

## Ownership and schema boundary

The browser persists its anonymous Supabase session locally. The API verifies
its bearer token with Supabase Auth, derives ownership from the verified user,
and sends that learner's token to PostgREST. Application filters and
[Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
both restrict source access. Captures are immutable: authenticated learners can
select, insert, and delete their own records; anonymous database access and
updates have no grants.

This browser schema stores only source identity, URLs, captured text,
capture time/provenance/coverage, and pending study status. It does not migrate
native folders or add generated notes, topics, jobs, or a vector index.
The unique owner/canonical-URL pair reuses the first capture; source refresh and
version comparison remain future work.

`rollbacks/202610020001_browser_sources.sql` reverses this migration by deleting
the source table and its records. Use it when intentionally removing this
development schema; retain any needed data first.
