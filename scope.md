# Scope: AI Second Brain

Second Brain lets an iOS user share a dense web article, choose one of two
folders, and receive a read-only four-point explanation with an interactive
concept graph and source links. Phase 1–2 delivered and verified that thin
slice. The roadmap thickens it in dependency order with anonymous-first
identity and persistence, durable background processing, vector cross-linking,
and release hardening.

## Stack

- **Current:** Expo/React Native/Expo Router, FastAPI/Pydantic, LangGraph/OpenAI,
  React Flow/Dagre in a WebView, transient React context.
- **Target:** Supabase Auth/Postgres, ARQ/Redis, Qdrant Cloud, and OpenAI
  `text-embedding-3-small`; deployment remains provider-neutral.

## At a glance

Status: `not started` · `decided` · `built` · `verified` · `built, needs a person to check`.

| # | Feature | Phase | Status |
| --- | --- | --- | --- |
| 1 | Strict LangGraph processing API | Phase 1 | verified |
| 2 | Native share capture and folder selection | Phase 2 | verified |
| 3 | Read-only summary, graph, and sources | Phase 2 | verified |
| 4 | Supabase anonymous auth and Postgres persistence | Phase 3 | decided |
| 5 | ARQ/Redis asynchronous processing | Phase 4 | decided |
| 6 | Qdrant related-knowledge retrieval | Phase 5 | decided |
| 7 | iOS release hardening | Phase 6 | not started |

## Phase 1–2: Verified MVP

### Decided

- The simplifier returns exactly four beginner-friendly bullet points.
- Ingestion tries a direct bounded fetch, a rendered reader fallback, then
  meaningful shared text.
- `POST /api/v1/process-link` remains synchronous and returns the complete typed
  result while the MVP is active.
- The only folders are `AI Engineering` and `System Design`.
- React Flow with Dagre is the active graph renderer; Mermaid remains in the API
  for compatibility.
- Items are stored only in mobile memory. The folder count includes every item
  in the current session, while the detail screen shows the newest item.

### What got built

- `backend/graph.py` — bounded ingestion, three-node LangGraph pipeline, summary,
  Mermaid, and typed graph output.
- `backend/main.py` and `backend/schemas.py` — strict FastAPI boundary.
- `mobile/app/modal/share.tsx` — native share folder selection and submission.
- `mobile/app/folder/[id].tsx` — read-only summary, graph, and sources.
- `mobile/components/InteractiveGraphViewer.tsx` — React Flow/Dagre WebView.

### Verified on 2026-09-17

- Backend: `8 passed` with
  `uv run --project backend --extra dev pytest backend/tests -q`.
- Mobile TypeScript: passed with `cd mobile && npx tsc --noEmit`.
- Mobile lint: passed with `cd mobile && npm run lint`.
- Expo Doctor: `21/21` checks passed.
- iOS simulator: Safari share → folder selection → processing → detail view;
  four bullets, source link, graph rendering/zoom, and folder count were checked.
- The previously blocked Medium article completed through the live local API.

### Current limitations

- Data is lost when the app process restarts.
- There is no authentication, tenancy, database, queue, or vector search.
- Processing blocks the HTTP request and can be affected by provider latency.
- Graph assets load from jsDelivr and require network access.
- Android is configured but not an acceptance platform and remains unverified.

## Phase 3: Identity and persistence

### Decided

- Create a Supabase anonymous user on first launch and persist its session.
- All Postgres rows are owned by `auth.uid()` and protected by RLS.
- Let the user later link Sign in with Apple to the same Supabase user instead
  of migrating rows to a new owner.
- Seed the same two fixed folders for each user; custom folders remain out of
  scope.

- [ ] Add Supabase client/session handling to mobile.
- [ ] Add Postgres schema, migrations, RLS policies, and seed behavior.
- [ ] Persist and list knowledge items from the API.
- [ ] Add guest-account recovery/upgrade messaging.
- [ ] Verify ownership isolation with two real test users.

## Phase 4: Asynchronous processing

### Decided

- Add authenticated v2 endpoints while preserving v1 during migration.
- FastAPI persists a `queued` item and enqueues only its stable item ID.
- ARQ workers read inputs from Postgres and use Redis only as transport.
- Status is `queued`, `processing`, `succeeded`, or `failed`.
- Jobs are idempotent and safe to retry.

- [ ] Add ARQ/Redis dependencies and worker entry point.
- [ ] Implement v2 create/read/list endpoints and mobile polling.
- [ ] Add bounded retries and user-safe terminal errors.
- [ ] Verify duplicate delivery cannot create duplicate rows or vectors.

## Phase 5: Related knowledge

### Decided

- Embed completed item summaries with `text-embedding-3-small`.
- Store one point per knowledge item in one cosine-distance Qdrant collection.
- Use the Postgres item UUID as the point ID and payload-filter every query by
  `user_id`; `folder_id` remains available for filtering and cross-folder labels.
- Qdrant returns IDs only; the API joins authoritative Postgres records.

- [ ] Add Qdrant collection/bootstrap and payload indexes.
- [ ] Upsert vectors only after the Postgres result succeeds.
- [ ] Return up to five related items across the user's folders.
- [ ] Add a read-only `Related ideas` section and verify tenant isolation.

## Phase 6: iOS release hardening

- [ ] Replace CDN graph assets or explicitly accept the online-only dependency.
- [ ] Add production backend URL and environment validation.
- [ ] Add observability for API, queue, worker, and provider failures.
- [ ] Configure a release pipeline and complete a physical-device share test.
- [ ] Document TestFlight/App Store delivery when a release channel exists.

## Explicitly out of scope

- Rich-text editing.
- Custom folders.
- Android acceptance or release work.
- A specific API/worker/Redis hosting provider.
- Treating Redis or Qdrant as authoritative storage.


## Browser article capture — ticket #1, 2026-10-02

Status: implementation and local checks complete; hosted Supabase acceptance
pending project provisioning. The user selected ticket 01 and confirmed no
Supabase project is set up. GitHub issue: https://github.com/CloudKai/secondBrain/issues/1.

- Extended the supplied browser design with anonymous session restoration,
  owned-source save/list/reopen/delete, capture provenance/coverage, storage
  retry/error states, and a clear read-only **Study note pending** viewer.
- Added `/api/v2/sources` with verified Supabase Auth ownership, learner-token
  PostgREST access, strict validation, and bounded public-article capture.
- Reviewed browser-only source migration and rollback are in `supabase/`.
  The schema is source-first and independent of native fixed folders; topic,
  note, queue/outbox, and vector tables are deferred to their selected slices.
- Verified: 13 web tests, build/typecheck, lint; 31 backend tests through the
  project interpreter. The exact pytest entrypoint selects an obsolete external
  interpreter and fails collection (`langchain_openai` missing); the project
  interpreter passes. Existing native/mobile files and v1 behavior were not
  modified by this ticket.
- Desktop and 390px browser fixtures cover save, captured-text inspection,
  original-link identity, reload recovery, capture/storage errors, disabled
  saving, and deletion followed by reload.
  A real public-page capture also passed; this is not hosted storage acceptance.
- Setup and remaining live checks: `supabase/README.md`. Structured generation
  is ticket 02; the other 14 proposed tickets remain unpublished drafts.


## Browser hosted acceptance — ticket #1, 2026-10-03

Status: **verified against the configured hosted Supabase development project**.
The user supplied its public settings; anonymous sign-ins are enabled and the
source schema is available. Backend and Vite environment files are configured
locally and ignored by Git. Native/mobile behavior remains unchanged.

- A real anonymous browser saved a public page, loaded its capture through the
  API, reloaded, and reopened the same source ID, original URL, text, timestamp,
  provenance, and pending study status. No fixture routes were used.
- An isolated second browser had zero owned sources. Cross-owner API read and
  deletion returned 404. Direct PostgREST SELECT/DELETE returned zero matching
  rows; the owner's record remained readable afterward.
- A private-network source was rejected with 422; requests without a bearer
  session returned 401. Owner deletion succeeded in the UI, and reload plus
  API read confirmed permanent removal of the temporary verification source.
- Ticket #1 acceptance is complete. Structured study-note generation, PDF/video
  ingestion, topic persistence, model assistant/research, and production release
  remain target work. The native application has no new auth or persistence.
- Local API/browser servers are available at `http://127.0.0.1:8000` and
  `http://127.0.0.1:5173`. The backend uses `python -m uvicorn` through the
  project interpreter to avoid the pre-existing copied entrypoint problem.
- Evidence is in ignored `output/playwright/supabase-live-*.yml` and
  `supabase-live-reopened.png`. No session tokens or populated environment
  files are included in the commit or issue record.


## Structured browser study notes — ticket #2, 2026-10-03

Status: **verified locally and against the hosted development project**.
GitHub issue: https://github.com/CloudKai/secondBrain/issues/2.

- Captured articles request persistent English notes with an overview, variable
  substantive concepts, supported examples/equations and recall questions. Notes
  are read-only; citations open exact saved passages and the original URL.
- Added owned study acceptance/list endpoints and a reversible Postgres migration.
  Generation acceptance atomically creates one study and outbox per source. ARQ
  transports source IDs; SQL owns three-attempt cycles, leases and fenced writes.
  Redis loss and interrupted workers are recoverable without duplicating notes.
- The first capture persists separately. A failed generation request leaves a
  saved source with Generate study note; explicit retry reuses the failed study.
- Verified locally: 54 backend tests via the project interpreter; 20 web tests,
  build/typecheck and lint; desktop/narrow browser fixtures for citations, reload
  and failure/retry. The exact pytest entrypoint still selects a stale external
  interpreter; `python -m pytest` passes.
- Hosted generation and recovery passed with the applied migration and configured
  server-only keys. Keep Redis and the worker running for development; see
  `docs/study-note-setup.md`. Ticket #1 hosted capture remains verified.
- This unit does not implement PDF/video ingestion, persistent topic organization,
  live assistant/research, source refresh or native integration. Existing native
  changes and v1 contracts are preserved.

Hosted acceptance passed on 2026-10-03 after the user approved applying the
reviewed migration to AI Study Friends. A real article completed on attempt one;
citations opened exact excerpts, reload restored the same note, and repeated
requests reused it. Another anonymous learner could neither read nor generate
that source's note. A request accepted while Redis was stopped remained in the
persistent outbox. After a processing worker was killed, its lease expired and
the restarted worker completed attempt two with 13 exact references, one note
and no remaining dispatch. Disposable verification captures were removed.


## Selectable-text PDF notes — ticket #3, 2026-10-03

Status: **verified locally and against the hosted development project**.
Issue: https://github.com/CloudKai/secondBrain/issues/3.

PDF uploads and public PDF links join the owned source/study workflow with
physical page metadata and exact page-bound references. Inputs are bounded to
10 MB, 100 pages and 30,000 captured characters; missing/omitted text is labelled.
Scanned-only, encrypted, oversized and unreadable files receive correction paths.
Uploads retain captured page text and filename, not the original binary. Source
identity, RLS, read-only notes, retry limits and worker fencing are preserved.
Live upload and a 15-page public PDF completed through the worker. Exact page
citations, reload, digest reuse and second-learner API/RLS isolation passed.
Final checks: 71 backend tests, 24 web tests, web build/typecheck and lint passed.
Independent standards/spec reviews are complete; two standards findings were
fixed and re-reviewed. Temporary acceptance sources and their jobs were removed.
Migration/rollback and limits: `docs/pdf-study-setup.md`. Native code is unchanged.
PDF page-range selection, OCR, videos, topics and research remain target work.


## Citation and PDF title polish — issue #4, 2026-10-03

Implemented: citation numbers inherit the surrounding text size and use inline
underlined styling, with a 44px pointer target. The PDF input is labelled Topic
title with a topic-name example. No automatic PDF acceptance prefix exists;
that wording was a manually entered disposable verification title. A supplied
title is kept as-is; uploads otherwise use their filename.
Web typecheck/lint passed and the updated controls were inspected in the browser.
No new tests were requested or run. Native files are untouched.
