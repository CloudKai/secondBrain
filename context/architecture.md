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
└── mobile/                  Git submodule → CloudKai/mobile
    ├── app/                 Expo Router screens and native-intent handling
    ├── components/          rendering components
    ├── lib/                 API transport and response validation
    ├── state/               current transient knowledge state
    └── types/               shared mobile domain types
```

## Current verified MVP

### Stack

| Layer | Technology | Role |
| --- | --- | --- |
| Mobile | Expo 57, React Native 0.86, Expo Router | Native share handling and read-only UI |
| API | FastAPI, Pydantic | Synchronous typed HTTP boundary |
| Pipeline | LangGraph, OpenAI | Ingest, four-point summary, and graph generation |
| Fetching | HTTPX, BeautifulSoup, reader fallback | Bounded source extraction |
| Graph | React Flow 11, Dagre 0.8 in WebView | Layout and interaction |
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
| `InteractiveGraphViewer` | Isolated WebView HTML and graph interaction | API calls or persistence |

### Current API

- `GET /health` → `200 { "status": "ok" }`.
- `POST /api/v1/process-link` accepts a valid HTTP URL, optional `raw_text` up
  to 30,000 characters, and a nonblank `folder_id`.
- Success is synchronous `200` with folder/source/raw text, summary, Mermaid,
  typed nodes, and typed edges.
- Schema validation and pipeline `ValueError` failures are `422`; upstream HTTP
  and provider failures are translated to user-safe `502` responses.

The v1 contract stays unchanged until mobile and backend migrate together.

### Current pipeline

```text
request
  → direct bounded fetch
  → rendered reader fallback
  → meaningful shared-text fallback
  → Feynman simplifier (exactly four points)
  → Mermaid + typed graph visualizer
  → synchronous response
```

The request remains open for the entire operation. There is currently no auth,
database, queue, tenancy, or vector store.

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
  title, four-point summary, Mermaid, graph nodes/edges JSON, source links,
  processing status, safe error text, idempotency key, and timestamps.
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
3. Mermaid begins with `graph TD`.
4. Node/edge IDs are unique and every edge references existing nodes.
5. Generated content is read-only.
6. Current v1 stays synchronous until an explicit coordinated migration.
7. Target mutations validate the authenticated owner at API and RLS boundaries.
8. Queue payloads contain stable IDs, not copied article or generated content.
9. Jobs are idempotent; retries cannot duplicate items or vectors.
10. Postgres is authoritative; Redis is transport and Qdrant is derived.
11. Item creation and its queue outbox record commit atomically; a dispatcher
    reconciles delivery to Redis.
12. React Flow, React, ReactDOM, and Dagre currently load from jsDelivr inside
    the WebView, so graph rendering is online-only until release hardening.
