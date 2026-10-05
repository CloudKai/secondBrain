# Architecture

This file separates the verified implementation from the selected target. A
target component is not available until its slice is marked verified in
`scope.md` and `context/progress-tracker.md`.

## Repository topology

```text
CloudKai/secondBrain
├── AGENTS.md
├── scope.md
├── context/                 planning and product truth
├── backend/                 FastAPI and LangGraph service
├── web/                     React browser learning library
├── supabase/                versioned database migrations
└── mobile/                  Expo app, tracked in this repository
    ├── app/                 Expo Router screens and native-intent handling
    ├── components/          rendering components
    ├── lib/                 API transport and response validation
    ├── state/               current transient knowledge state
    └── types/               shared mobile domain types
```

On 2026-10-05, the existing mobile files and history were imported into this
repository. All applications now use one Git checkout; a fresh clone needs no
submodule initialization. Generated native folders and dependencies remain local.

## Current verified MVP

### Stack

| Layer | Technology | Role |
| --- | --- | --- |
| Mobile | Expo 57, React Native 0.86, Expo Router | Native share handling and read-only UI |
| API | FastAPI, Pydantic | Synchronous typed HTTP boundary |
| Pipeline | LangGraph, OpenAI | Ingest, four-point summary, and graph generation |
| Fetching | HTTPX, BeautifulSoup, reader fallback | Bounded source extraction |
| Diagram | React Flow 11, Dagre 0.8, D3 7 in WebView | Adaptive layout and interaction |
| State | React context | Process-lifetime items only |

### Boundaries

| Location | Owns | Must not own |
| --- | --- | --- |
| `backend/main.py` | HTTP translation and status mapping | Prompt or scraping logic |
| `backend/schemas.py` | Strict request, response, and model-output validation | Network calls |
| `backend/graph.py` | Fetching, fallbacks, prompts, and LangGraph orchestration | Mobile state |
| `mobile/app/` | Routes, screens, and share workflow orchestration | Provider SDKs or secrets |
| `mobile/lib/api.ts` | HTTP transport and runtime response validation | UI rendering |
| `KnowledgeContext` | Transient items and folder filtering | Durable-storage claims |
| `AdaptiveDiagramViewer` | Isolated WebView HTML and adaptive diagram interaction | API calls or persistence |

### Current API

- `GET /health` → `200 { "status": "ok" }`.
- `POST /api/v1/process-link` accepts a valid HTTP URL, optional `raw_text` up
  to 30,000 characters, and a nonblank `folder_id`.
- Success is synchronous `200` with folder/source/raw text, summary, preferred
  diagram type, compatible diagram options, typed nodes, and typed edges.
- Schema validation and pipeline `ValueError` failures are `422`; upstream HTTP
  and provider failures are translated to user-safe `502` responses.

Mobile and backend migrate the v1 diagram fields together; there is no legacy
diagram-syntax compatibility field.

### Current pipeline

```text
request
  → direct bounded fetch
  → rendered reader fallback
  → meaningful shared-text fallback
  → Feynman simplifier (exactly four points)
  → typed adaptive graph visualizer
  → synchronous response
```

The native v1 request remains open for the entire operation. That flow has no
auth, database, queue, tenancy, or vector store. The separate browser source
flow now uses Supabase Auth and Postgres; its hosted acceptance is recorded
below.

## Target architecture

### Stack

| Layer | Selected technology | Role |
| --- | --- | --- |
| Identity | Supabase Auth | Anonymous-first sessions, later Apple identity linking |
| Source of truth | Supabase Postgres | Folders, items, outputs, status, and ownership |
| API | FastAPI | JWT validation, authorization, persistence, and read models |
| Queue | ARQ with Redis | Transient job transport and bounded retries |
| Worker | Python async worker | Ingestion, LangGraph, embeddings, and result writes |
| Vector index | Qdrant Cloud | Derived user-scoped cosine similarity |
| AI | OpenAI `gpt-4o-mini`, `text-embedding-3-small` | Generation and 1,536-dimensional embeddings |
| Hosting | Provider-neutral containers | Separate API and worker processes plus reachable Redis |

### Authentication and ownership

- Mobile creates a Supabase anonymous user on first launch and stores the
  refreshable session in platform-secure storage.
- The target API accepts a Supabase bearer JWT, validates it server-side, and
  derives `user_id`; clients never choose an owner ID.
- Every Postgres table with user data has RLS policies based on `auth.uid()`.
- User-facing API handlers query through a JWT-scoped Supabase data client so
  RLS evaluates the caller's `auth.uid()`; they never use a service-role client.
- Server-only workers may use privileged database access for a queued item UUID,
  but must resolve ownership from Postgres and never trust a queued user ID.
- Manual identity linking is enabled so `Continue with Apple` upgrades the same
  Supabase user. Rows require no ownership migration when the ID is retained.
- This flow follows Supabase's documented support for
  [anonymous sign-ins and identity linking](https://supabase.com/docs/guides/auth/auth-anonymous).
- Signing out or deleting the app before linking may make an anonymous account
  unrecoverable; the UI must state this before destructive session actions.

### Postgres model

- `folders`: UUID, `user_id` UUID, fixed slug, display name, timestamps. Seed
  `ai-engineering` and `system-design` once per user; no folder CRUD in scope.
- `knowledge_items`: UUID, `user_id` UUID, folder UUID, source URL, shared/raw text,
  title, four-point summary, diagram type/options, graph nodes/edges JSON,
  source links, processing status, safe error text, idempotency key, and timestamps.
- `job_outbox`: UUID, knowledge-item UUID, delivery status, attempts, next-attempt
  time, and timestamps. It is transport bookkeeping, not duplicated item data.
- Unique `(user_id, idempotency_key)` prevents duplicate share retries.
- Postgres is authoritative for status and display data. Redis loss or a Qdrant
  rebuild must not lose a knowledge item.

### Target v2 API

All v2 endpoints require a Supabase bearer JWT.

- `POST /api/v2/knowledge-items`
  - Request body: `{ url, raw_text?, folder_id }`.
  - Required `Idempotency-Key` header: client-generated UUID for one share.
  - Creates a `queued` row, enqueues its item ID, and returns
    `202 { item_id, status: "queued" }`.
- `GET /api/v2/knowledge-items/{item_id}`
  - Returns only an owned item.
  - Status is `queued`, `processing`, `succeeded`, or `failed`.
  - Generated fields are present only after `succeeded`.
- `GET /api/v2/folders`
  - Returns the authenticated user's two persisted folders and item counts.
- `GET /api/v2/folders/{folder_id}/items`
  - Returns owned persisted items newest first.
- `GET /api/v2/knowledge-items/{item_id}/related`
  - Returns up to five owned Postgres read models for related Qdrant IDs.

Expected boundary codes are `401` invalid session, `404` missing or unowned
resource, `422` invalid input, `503` persistence unavailable, and user-safe
terminal failure details on the item resource.

### Job flow

1. FastAPI validates the JWT, folder ownership, and idempotency key.
2. In one Postgres transaction, it creates or reuses the item in `queued` state
   and writes an outbox record for that stable item UUID.
3. An outbox dispatcher enqueues only the item UUID in ARQ/Redis and marks the
   outbox delivery; a reconciler retries records left pending by Redis outages.
4. The worker atomically claims the item and marks it `processing`.
5. The worker reads authoritative inputs, runs bounded ingestion, produces the
   four-point summary and graph, and creates the summary embedding.
6. It writes generated output and marks the item `succeeded` in Postgres.
7. It upserts the Qdrant point with the item UUID as an idempotent, independently
   retryable indexing step; a Qdrant outage does not roll back Postgres output.
8. Bounded processing failures write a safe `failed` state. Retries re-use the
   same row and vector ID.

### Qdrant model

- Use one collection named `knowledge_items` with cosine distance and vectors
  matching `text-embedding-3-small` dimensions.
- The point ID is the Postgres knowledge-item UUID.
- Payload contains `user_id`, `folder_id`, and `item_id`; create keyword indexes
  for every filtered field before enabling queries.
- The shared-collection and payload-filter design follows
  [Qdrant's multitenancy guidance](https://qdrant.tech/documentation/tutorials/multiple-partitions/).
- Every query must filter by `user_id`, exclude the current item, and may span
  both folders. Qdrant returns identifiers and scores, never the authoritative
  display record.
- A rebuild reads succeeded Postgres items and recreates embeddings/points.

### Mobile target boundary

- Mobile uses Supabase only for client-safe session operations.
- All data mutations and owned reads go through FastAPI.
- After a v2 create, mobile polls the item resource with bounded backoff and
  renders queued, processing, failed, or succeeded states.
- Mobile never receives the Supabase service-role key, OpenAI key, Redis URL, or
  Qdrant key.

## Invariants

1. A completed summary contains exactly four non-empty points.
2. Downloads are capped at 2 MB and model input at 30,000 characters.
3. The preferred diagram is `flow`, `hierarchy`, or `network` and must appear
   in the compatible options returned with it.
4. Flow requires an acyclic graph; hierarchy requires one connected rooted
   tree; network is the safe fallback for every valid graph.
5. Node/edge IDs are unique and every edge references existing nodes.
6. Generated content is read-only.
7. Current v1 stays synchronous until an explicit coordinated migration.
8. Target mutations validate the authenticated owner at API and RLS boundaries.
9. Queue payloads contain stable IDs, not copied article or generated content.
10. Jobs are idempotent; retries cannot duplicate items or vectors.
11. Postgres is authoritative; Redis is transport and Qdrant is derived.
12. Item creation and its queue outbox record commit atomically; a dispatcher
    reconciles delivery to Redis.
13. React Flow, React, ReactDOM, Dagre, and D3 currently load from jsDelivr
    inside the WebView, so diagram rendering is online-only until release
    hardening.

## Browser library organization — 2026-10-02

The session-only browser learning-library module lives in
`web/src/lib/library.ts`. Its interface creates a library, applies learner
actions, and reads a consistent view. Its implementation owns saved notes,
topic names and assignments, rejected topic pairs, recall marks, and graph/search
derivation. `web/src/App.tsx` sends actions through a React reducer and retains
navigation, dialogs, form state, and rendering.

Topic merges remap rejected pairs to the surviving topic, deduplicate pairs,
and drop self-connections. Rejection takes precedence over a visible connection
until explicitly restored. Connection identity encodes the topic pair without
relying on a delimiter inside topic names. Search uses the same corrected names
as topic display. Source removal and hiding examples share recall cleanup and
preserve surviving corrections.

This is an in-process module; persistence and a storage adapter remain target
work. The existing article adapter and native contract are unchanged. Typecheck
and lint are the checks for this refactor; behavioral tests were not added or run.


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


## Browser study processing — ticket #2

Verified locally and against hosted Supabase on 2026-10-03. Source
identity and capture remain the ticket #1 contract. An authenticated
`POST /api/v2/sources/{id}/study` calls an owner-checked SQL function that creates
`source_studies` and `study_outbox` in one transaction. Repeated requests reuse
one study per source; only an explicit failed-study retry resets its attempt cycle.
`GET /api/v2/studies` verifies the session, filters ownership and returns strict
records; learner SELECT uses RLS, learner mutation is restricted to the owner RPC.

The independent ARQ worker uses a server-only Supabase secret key. A 10s dispatcher
enqueues UUIDs with stable job IDs and reschedules outbox delivery after 30s.
Postgres atomically claims queued work, increments a maximum-three-attempt cycle,
and fences completion with a random 120s lease. SQL recovers expired leases,
records retry/terminal codes and cascades jobs/notes when a source is deleted.
Redis is localhost transient transport in the development compose configuration.

`study_generation.py` uses an explicit LangGraph state for explain/validate.
Model calls have no SDK retries and a 65s deadline. Strict structured explanations
cite server-indexed passage IDs; only server-derived excerpts and code-point
offsets are persisted. Unsupported examples/equations stay empty. Browser
validation checks each reference against its immutable capture before rendering.

Capture save and generation request are separate: generation can be recovered
from the saved-source viewer if the request was not acknowledged. Native APIs,
fixed folders, topic assignment, vectors and production deployment are unchanged.
Migration/rollback and development instructions: `docs/study-note-setup.md`.


## PDF capture and page evidence — ticket #3

Verified for the browser locally and against hosted Supabase. `sources` gains an
article/PDF discriminator and validated PDF page spans. Uploads use an owned
SHA-256 identity with no fabricated URL; linked PDFs retain their HTTP(S) URL.
Only captured text and metadata persist. The original binary is not retained.

The API streams at most 10 MB; public downloads validate/pin each redirect,
request identity encoding, reject encoded responses and bound raw bytes.
A disposable resource-limited subprocess extracts at most 100 pages and 30,000
characters. The existing worker claim includes validated page metadata; passage
splitting stays within each physical page, with server-derived page references.
Browser validation checks immutable excerpt and page bounds. RLS and queue/retry
contracts are preserved. Migration rollback refuses while PDF captures exist.
The updated worker was restarted before the reviewed migration was applied.
Live PDF generation, physical-page citations and cross-learner isolation passed.
See `docs/pdf-study-setup.md` for limits and rollout details.


## Browser transcript extension — issue #5 (2026-10-03)

Verified locally and against hosted Supabase: a video source stores its
recording URL, normalized supplied transcript and strict bounded cue metadata.
`POST /api/v2/sources/video` accepts raw UTF-8 text with bearer authentication and
`X-Video-URL`; no recording fetch occurs. The existing owned source/study/outbox
workflow carries transcript metadata into service-only worker claims. Server
passages split within cues and attach the supplied start/end range; the model
returns passage IDs only. RLS and worker fencing are unchanged. Setup, limits
and rollback are in `docs/video-transcript-setup.md`. Automatic retrieval and
provider integrations remain planned; native/v1 contracts are unchanged.


## Accessible YouTube retrieval — issue #6 (2026-10-03)

Verified locally and against hosted development storage. Authenticated
`/api/v2/sources/youtube` validates identity, reuses an owned capture and delegates
to a bounded anonymous English caption adapter. Asynchronous HTTP reads enforce
a wall-clock deadline; SDK execution retains its concurrency slot after caller
cancellation. Exact cue times enter the existing source/study/outbox pipeline
with direct origin. Migration 005 extends source validation while preserving RLS,
grants, worker contracts and existing captures. Failed access saves nothing and
returns upload/paste fallback. Anonymous response cookies are discarded and
consent-cookie access is rejected. No provider account, bypass or audio/video
download is used. Hosted generation, exact references, reload/reuse and ownership
denial passed. Limits/rollback: `docs/youtube-transcript-setup.md`. Other automatic
providers remain planned. Native/v1 behavior is unchanged by this slice.


## Teams transcript access — issue #7 (2026-10-03)

Teams/SharePoint feedback uses the existing supplied-transcript boundary; it adds
no remote adapter, schema, migration, auth provider or credentials. Recognized
context immediately opens browser upload/paste. Original URL identity and source
validation remain compatible with saved captures. VTT speaker/cue metadata and
untimed text use the existing authenticated source/study/outbox worker path.
Hosted controlled fixtures verified exact references and cross-learner API/REST/
RPC denial. Microsoft's documented transcript API requires authorization; no
anonymous access path is validated. Automatic Teams retrieval remains target work,
and native/v1 contracts are unchanged by this slice.


## Zoom transcript availability — issue #8 (2026-10-03)

Zoom feedback uses the existing supplied-transcript boundary: no remote adapter,
schema, migration, auth provider, webhook or credential is added. Browser source
recognition immediately opens upload/paste for Zoom share/play context while
preserving existing saved-source validators and query identity. Supplied VTT
speaker/cue metadata and untimed text enter the authenticated source/study/outbox
path. Controlled hosted fixtures verified exact references and second-learner
API/REST/RPC denial. Zoom's documented download requires OAuth authorization;
no anonymous path is validated. Conditional guidance does not determine a
recording's actual availability/permissions. Automatic Zoom retrieval remains
target work; native/v1 behavior is unchanged.


## Panopto caption access — issue #9 (2026-10-03)

Panopto guidance reuses the authenticated supplied-transcript source/study/outbox
boundary. No remote adapter, migration, schema, auth provider or credentials
are added. The browser recognizes viewer context and immediately opens upload/
paste. Canonical identity retains site/path/session ID and ignores presentation
parameters while preserving the original URL. Site/session separation, exact
supplied evidence and second-learner API/REST/RPC denial passed controlled hosted
checks. No anonymous caption-download path for a concrete lecture is validated.
The public API caption field does not prove anonymous access; conditional help
does not inspect permissions, site policy, lecture existence or captions.
Automatic retrieval remains target work; native/v1 behavior is unchanged.


## Saved-source topic mapping — issue #10 (2026-10-03)

Implementation is local; hosted migration/acceptance and independent review are
pending. Separate owned source_topic_maps and topic_outbox records queue from
completed notes, including a migration backfill. The existing ARQ worker sends
stable source IDs, while Postgres owns retries, leases, outbox recovery and
late-result fences. Per-learner claims serialize contextual catalog matching.
Topic generation uses bounded LangGraph/model HTTP over saved note evidence.
Validated shared identities and distinct uncertain suggestions preserve notes.
Learner placement confirmation changes only topic metadata. Derived graphs
require independent saved-source support and remain rebuildable; no Qdrant
service or new credentials are added. Limits and rollback are documented in
`docs/topic-graph-setup.md`. Native/v1 contracts are unchanged.


## Verified hosted web topic mapping — issue #10 (2026-10-04)

The preceding local-only topic checkpoint is superseded by hosted development
acceptance. Migration 202610030006_topic_maps.sql is applied and the existing
worker restarted. Owned topic maps/outbox, automatic backfill, bounded claims,
contextual matching, placement RPCs and learner isolation passed. UUID string
parsing is explicitly scoped to the two placement request fields; other strict
contracts remain. Derived graphs retain the independent-source gate. Controlled
placement changes preserved notes and references. Disposable fixture removal
cascaded through study/topic jobs; the real Neural networks note/map remain.
Model matching used bounded retries and remains subject to evidence inspection.
No vector service, native persistence or production deployment was added.


## Web topic overview boundary — ticket #11

Target pending hosted acceptance: derived topic_overviews/overview_outbox, authenticated owned RPC snapshots and view mutation, stable-ID ARQ synthesis with bounded attempts/leases. Exact source-prefixed passage references and membership revision fences preserve authoritative source_studies/source_topic_maps. No native API change or new vector/provider service.


### Topic overview review checkpoint — #11

Local checks and both independent reviews pass; hosted acceptance awaits approval
of the staged Supabase warning. No hosted overview capability is verified yet.


## Verified hosted web overview boundary — #11 (2026-10-04)

The pending overview checkpoints above are superseded by hosted acceptance.
Migration 202610040007_topic_overviews.sql is applied; authenticated owned
snapshots/view mutation, service-only worker claims/outbox, stable queue identity,
bounded retries and membership fences pass. On-demand synthesis resolves model
passage labels to exact saved source-prefixed identities; only redundant grounded
prose tags are normalized. Direct learner table/worker access and cross-user
requests are denied. Source removal hides stale results; original notes/maps
remain authoritative. Controlled inputs exercised the real worker/model and
exact PDF/video references. No native API, vector service or production change.
See docs/topic-overview-setup.md for bounds, rollback and acceptance limits.


## Verified hosted web correction boundary — #12 (2026-10-04)

Migration 202610040008_topic_corrections.sql is applied. Authenticated atomic
correct_topic_library validates owned rename/merge/assignment/connection actions.
Server-only topic_rules and source_topic_overrides constrain future map writes;
owned read-only topic_connection_decisions retain rejected canonical pairs.
Redirects flatten merges; rejection takes precedence; citations must resolve to
exact saved passages. Owner advisory locks precede row locks in claim/completion
and corrections. Membership revisions hide outdated combined overviews; source
foreign-key cascades and worker fences prevent deleted content from reappearing.
Hosted API/browser checks preserve original notes and ownership. Sequential
after-claim coverage plus static lock review, not concurrent stress testing.
No native API, vector/provider service or production deployment change.


## Source version boundary — #13, verified development acceptance

Stable source UUIDs now carry source_version; source_studies inherit it. Private
source_versions store immutable capture/note snapshots, source_revision_candidates
stage a bounded 24-hour replacement, and source_identities retain uploaded PDF
digest aliases. Owned comparison/expected-version promotion is atomic under the
correction owner lock, archives prior inputs and queues a new note. Old study/map
leases cannot publish. Current graph/overview joins exclude archived versions.
Corrected membership evidence uniquely reanchors by exact excerpt or waits for
learner review. Rollback disables compare/promote while preserving history,
aliases, review and version-aware fences. Hosted API and desktop acceptance
passed; production remains unconfigured.


## Browser long-source acceptance — #14 (2026-10-04)

Migration 010 and matching worker passed hosted development acceptance. Browser
captures are bounded at 120,000 characters. Original PDF page/time selections
retain capture offsets and locations. Worker model inputs have 30,000 source
characters/200 passages per section, at most 20 sections, with private RLS-protected
study_sections keyed by source/version/index. Service-only plan/save RPCs renew
leases and fence current version/live claims under the existing owner lock.
Owned study reads expose total/completed counts. Long retries reuse summaries;
single-call retries regenerate from full original passages. Final synthesis
requires all sections. Refresh/removal cascades old section work; stable source
identity and graph source counts remain unchanged. Explicit reimport ranges
are validated before existing source reuse. Native/v1 remains unchanged.
