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
