# Progress Tracker

## Current status

**Phase:** Phase 2 MVP verified; Phase 3 architecture selected

**Last completed:** Native iOS share-to-knowledge flow, interactive graph rendering, simulator verification, and repository split

**Next:** Anonymous-first Supabase authentication and authoritative Postgres persistence

## Completed and verified

### Phase 1 — Backend API

- [x] Strict FastAPI request and response models for `POST /api/v1/process-link`
- [x] LangGraph extraction, Feynman summary, and graph-generation pipeline
- [x] Bounded fetching and readable-text extraction with shared-text fallback
- [x] Structured graph nodes and edges alongside the compatibility Mermaid field
- [x] Eight passing backend tests

### Phase 2 — Mobile UI and native sharing

- [x] Expo Router TypeScript development-build project
- [x] Native iOS share intent and deep-link interception
- [x] Modal-route folder-selection bottom sheet with fixed folders
- [x] Typed API integration and transient in-memory knowledge state
- [x] Folder detail view with title, four Markdown bullets, graph, and sources
- [x] Dashboard folder cards with transient item counts
- [x] React Flow/Dagre WebView with pan, pinch-to-zoom, and node dragging
- [x] TypeScript and lint checks pass
- [x] End-to-end iOS simulator flow verified
- [x] Mobile repository published separately and referenced as a root submodule

## Dependency-ordered roadmap

### Phase 3 — Identity and persistence

- [ ] Create Supabase migrations for fixed folders, knowledge items, processing status, and the job outbox
- [ ] Enable and test Row Level Security for every user-owned table
- [ ] Add anonymous Supabase sessions and persist the session across launches
- [ ] Support later Apple identity linking without changing item ownership
- [ ] Persist and list authoritative folder/item records from Postgres

### Phase 4 — Asynchronous processing

- [ ] Add authenticated `POST /api/v2/knowledge-items` returning `202` with `{ item_id, status }`
- [ ] Add item-status and Postgres-backed folder/item listing endpoints
- [ ] Add idempotency keys and explicit `queued | processing | succeeded | failed` transitions
- [ ] Add a transactional outbox dispatcher and reconciliation path
- [ ] Enqueue only stable item UUIDs through ARQ/Redis
- [ ] Add retry-safe workers that fetch inputs and persist outputs in Postgres
- [ ] Add mobile queued, processing, retry, and failed states

### Phase 5 — Vector cross-linking

- [ ] Provision one Qdrant Cloud cosine-similarity collection
- [ ] Index `user_id`, `folder_id`, and `item_id` payload fields
- [ ] Upsert vectors with the Postgres item UUID after successful processing
- [ ] Retrieve related items with mandatory authenticated user filters
- [ ] Add rebuild and reindex tooling so Qdrant remains derived state

### Phase 6 — iOS release hardening

- [ ] Add Apple identity upgrade UX and account recovery behavior
- [ ] Test share extension behavior on physical devices and release builds
- [ ] Add privacy disclosures, observability, failure recovery, and production environment separation
- [ ] Complete App Store signing, assets, metadata, and submission checks

## Selected decisions

- 2026-09-17 — Preserve the synchronous v1 contract during migration.
- 2026-09-17 — Use Supabase Auth and Postgres as the target identity and source-of-truth layer.
- 2026-09-17 — Start users anonymously and later link Apple identity without changing ownership.
- 2026-09-17 — Use ARQ/Redis for target background processing; Redis remains transient transport.
- 2026-09-17 — Use one Qdrant Cloud collection with cosine distance and tenant-filtered payloads.
- 2026-09-17 — Deliver iOS first and keep hosting provider-neutral through containers and environment contracts.
- 2026-09-17 — Keep `AI Engineering` and `System Design` fixed; custom folders remain out of scope.

## Open questions

- None blocking the approved roadmap. Provider project provisioning, quotas, and production sizing are deployment-time decisions.

## Notes

- Current mobile results are in memory only and disappear on restart.
- Native sharing requires an Expo development build; Expo Go is insufficient.
- The mobile API base URL must be reachable from the selected simulator or device.
- The graph WebView currently loads React Flow and Dagre assets over the network.
- `mobile/` is a separate Git repository and a submodule of the root repository.
- Supabase, Redis, ARQ, Qdrant, persistence, asynchronous processing, and production release work above are targets, not current capabilities.


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


## Browser study-note generation — ticket #2, 2026-10-03

Current unit: **implementation, review and hosted acceptance complete**.

- [x] Persistent structured article notes with variable concepts and recall
- [x] Exact captured passages, original links and Unicode-offset validation
- [x] Owned study acceptance/list, atomic study/outbox, unique source identity
- [x] ARQ ID-only dispatch, SQL bounded retries, lease recovery and fenced results
- [x] Read-only viewer, polling, reload and explicit generation retry
- [x] Local SQL/RLS/rollback, provider HTTP and browser evidence checks
- [x] 54 backend tests through project Python; 20 web tests; build and lint
- [x] Apply reviewed migration and complete hosted generation/worker recovery checks

Setup: `docs/study-note-setup.md`. Issue #2 acceptance is complete.
This supersedes the browser's pending-generation limitation; native persistence,
PDF/video, topics and assistant/research remain target work.

Hosted acceptance passed on 2026-10-03 after the user approved applying the
reviewed migration to AI Study Friends. A real article completed on attempt one;
citations opened exact excerpts, reload restored the same note, and repeated
requests reused it. Another anonymous learner could neither read nor generate
that source's note. A request accepted while Redis was stopped remained in the
persistent outbox. After a processing worker was killed, its lease expired and
the restarted worker completed attempt two with 13 exact references, one note
and no remaining dispatch. Disposable verification captures were removed.


## Browser PDF study notes — ticket #3, 2026-10-03

Current unit: completed and verified locally and against hosted Supabase.

- [x] Owned selectable-text PDF uploads and public links
- [x] Bounded subprocess extraction, limits and accurate coverage
- [x] Preserved physical page identity and page-bound citations
- [x] PDF form, source filtering and uploaded/local-file disclosure
- [x] Final backend/web/browser checks and independent code review
- [x] Apply reviewed migration and verify hosted PDF generation/reload/ownership

71 backend tests and 24 web tests passed; web build/typecheck and lint passed.
Live upload, public PDF URL generation, page citations, reload, duplicate upload
and second-learner API/RLS checks passed. Two standards findings were resolved;
independent re-review has no remaining material issue. Disposable sources/jobs
were removed. GitHub issue #3 is complete. Setup: `docs/pdf-study-setup.md`.
