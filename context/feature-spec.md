# Feature: Native Share-to-Knowledge MVP

This is the authoritative baseline for completed Phase 1 and Phase 2 behavior. It describes the current synchronous, transient MVP; the persistence, authentication, queue, and similarity roadmap is a separate handoff below.

## User outcome

An iOS user shares a web link to Second Brain, chooses one of two fixed folders, and receives a concise learning card containing a title, four Feynman-style Markdown bullets, an interactive concept graph, and source links.

## Implemented flow

1. The iOS share extension wakes the Expo development build and supplies shared URL/text through `expo-share-intent`.
2. Expo Router rewrites the share-extension wake-up URL to a valid application route.
3. A global bottom sheet presents `AI Engineering` and `System Design`; submission is disabled until a valid URL and folder are available.
4. The mobile client posts the shared data to `POST /api/v1/process-link`.
5. FastAPI validates the request and synchronously invokes the LangGraph extraction, simplification, and diagram pipeline.
6. The mobile app derives a concise title from share metadata or the source hostname, extracts and de-duplicates at most eight source URLs, and stores the result in memory.
7. The folder detail route renders the four-bullet Markdown summary and a React Flow graph laid out by Dagre. The graph supports pan, pinch-to-zoom, and node dragging.

## Current API contract

Request:

```json
{
  "url": "https://example.com/article",
  "raw_text": "Optional text supplied by the share extension",
  "folder_id": "ai-engineering"
}
```

Successful response remains synchronous HTTP `200` and contains:

- `folder_id`
- `source_url`
- `raw_text`
- `simplified_summary`
- `mermaid_code`
- `nodes`
- `edges`

Unknown request fields are rejected. `url` must be an HTTP or HTTPS URL, and `folder_id` must not be blank. The backend response is parsed defensively on mobile before it enters application state.

## Current scope limits

- Results are transient and disappear when the mobile process restarts.
- There is no account, database, background worker, vector index, or cross-linking.
- The two existing folders are fixed; users cannot create, rename, delete, or reorder folders.
- Knowledge items are read-only after processing.
- This milestone does not include an Android acceptance requirement, App Store distribution, offline processing, collaboration, or a web client.
- Mermaid code remains in the v1 response for compatibility, but the mobile detail view uses structured `nodes` and `edges` with React Flow and Dagre.

## Baseline acceptance evidence

- [x] Eight backend tests pass.
- [x] Mobile TypeScript compilation passes.
- [x] Mobile lint passes.
- [x] The iOS simulator flow completes from Safari share through folder selection, API processing, four-bullet display, interactive graph/source display, and updated folder count.
- [x] Invalid input and backend failures produce bounded, user-readable errors rather than unvalidated UI state.

## Roadmap handoff

The next slice adds anonymous-first Supabase Auth and Postgres persistence while keeping v1 operational. Later slices add authenticated asynchronous v2 endpoints, ARQ/Redis processing, and Qdrant similarity retrieval. Those systems are target architecture only and are specified in `architecture.md` and `scope.md`; none is implemented in this baseline.
