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
