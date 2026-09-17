# Project Overview

## About the project

Second Brain is an iOS-first personal knowledge app for learners and technical
professionals. A user shares a dense webpage from another app, chooses a topic
folder, and receives a read-only four-point explanation, an interactive concept
map, and traceable source links.

## The problem it solves

Useful technical knowledge is scattered across long articles and is difficult
to revisit. Traditional bookmark lists preserve URLs but not understanding.
Second Brain turns a shared source into a compact explanation and visual model
at capture time, then organizes it by topic. The verified MVP proves this flow;
the roadmap adds durable ownership, background processing, and semantic links
between related ideas.

## Target user

A technically curious learner or engineer who regularly saves dense AI and
system-design articles and wants a faster way to understand and recall them.

## Current verified MVP

### Surfaces

| Route / entry | Behavior |
| --- | --- |
| `/` | Dark folder dashboard with in-session item counts |
| `/modal/share` | Native-share folder selector and `Simplify & save` action |
| `/folder/[id]` | Newest in-session item, four Markdown bullets, interactive graph, and sources |
| `app/+native-intent.ts` | Rewrites share-extension wake-up URLs to `/` before routing |

### Core flow

1. The user opens the iOS share sheet for a webpage and chooses Second Brain.
2. The app extracts a URL and any shared text, then opens only the folder sheet.
3. The user selects `AI Engineering` or `System Design`.
4. Mobile posts `{ url, raw_text, folder_id }` to
   `POST /api/v1/process-link`.
5. The synchronous backend fetches the source, produces exactly four simple
   points, and returns Mermaid plus typed graph nodes and edges.
6. Mobile stores the result in React context and opens the chosen folder.
7. The user reads the summary, pans/zooms/drags the graph, and can open sources.

### Current data boundaries

- **Shared URL/text** — enters through iOS and is sent only to the backend API.
- **Generated result** — exists in the current mobile process only.
- **OpenAI credentials** — server-only and never included in the mobile bundle.
- **Graph assets** — loaded by the isolated WebView from jsDelivr.

## Target roadmap behavior

1. On first launch, mobile creates and securely persists an anonymous Supabase
   session; no sign-up wall blocks capture.
2. The user may later link Sign in with Apple to that same user ID, retaining
   ownership of existing records.
3. A share creates a Postgres knowledge item in `queued` state and returns
   immediately.
4. An ARQ worker receives the stable item ID through Redis, fetches the
   authoritative row, and performs ingestion, summarization, graph generation,
   and embedding.
5. The worker writes output and status to Postgres and upserts a derived vector
   into Qdrant.
6. Mobile reads persisted status and results through authenticated API
   endpoints rather than holding the only copy.
7. Completed details show up to five related ideas across the same user's two
   folders, with Qdrant returning IDs and Postgres supplying display data.

## Features in scope

### Current

- iOS native share capture for HTTP(S) sources.
- Two fixed folders.
- Exactly four beginner-friendly bullet points.
- Read-only React Flow/Dagre graph and source list.
- Strict mobile and backend response validation.

### Target

- Anonymous-first Supabase Auth with later Apple identity linking.
- Supabase Postgres persistence protected by RLS.
- ARQ/Redis asynchronous processing and observable status.
- User-scoped Qdrant similarity links across folders.
- Provider-neutral API and worker deployment.

## Features out of scope

- Rich-text editing or user-authored notes.
- Custom folder creation, rename, or deletion.
- Collaborative workspaces or public sharing.
- Android acceptance and release work.
- Offline AI processing or offline graph assets.
- Direct scraping, model, Redis, or Qdrant access from mobile.

## Success criteria

### MVP acceptance

1. A Safari share opens the selectable folder sheet without an unmatched route.
2. A valid source produces exactly four non-empty Markdown bullets.
3. Every returned edge references existing uniquely identified nodes.
4. The detail view renders the summary, interactive graph, and source link as
   read-only content.
5. Backend tests, mobile typecheck, lint, and Expo Doctor pass.

### Roadmap acceptance

1. Anonymous and Apple-linked users retain the same owned records under RLS.
2. Item creation returns without waiting for scraping or model execution.
3. Retried jobs never create duplicate Postgres items or Qdrant points.
4. Failed jobs end in a readable terminal state and remain inspectable.
5. Related-item queries cannot return another user's IDs or records.
