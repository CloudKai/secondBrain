# Feature: Native Share-to-Knowledge MVP

This is the authoritative baseline for completed Phase 1 and Phase 2 behavior. It describes the current synchronous, transient MVP; the persistence, authentication, queue, and similarity roadmap is a separate handoff below.

## User outcome

An iOS user shares a web link to Second Brain, chooses one of two fixed folders, and receives a guided learning experience containing a title, four Feynman-style concept cards, an adaptive diagram, graph-derived recall prompts, and source context.

## Implemented flow

1. The iOS share extension wakes the Expo development build and supplies shared URL/text through `expo-share-intent`.
2. Expo Router rewrites the share-extension wake-up URL to a valid application route.
3. A global bottom sheet presents `AI Engineering` and `System Design`; submission is disabled until a valid URL and folder are available.
4. The mobile client posts the shared data to `POST /api/v1/process-link`.
5. FastAPI validates the request and synchronously invokes the LangGraph extraction, simplification, and diagram pipeline.
6. The mobile app derives a concise title from share metadata or the source hostname, extracts and de-duplicates at most eight source URLs, and stores the result in memory.
7. The folder detail route turns the response into four modes: Learn presents one concept card at a time; Visual offers compatible Flow, Hierarchy, and Network presentations; Recall builds relationship cards from graph edges; Source exposes links and bounded original context.
8. Session-only progress tracks understood lesson cards and mastered graph relationships, updating a visible mastery score on the detail screen and learning metrics on the dashboard.
9. When the library is empty, a clearly labeled local demo exercises the complete learning UI without calling the backend.

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
- `diagram_type` (`flow`, `hierarchy`, or `network`)
- `diagram_options` (the compatible types, including the default)
- `nodes`
- `edges`

Unknown request fields are rejected. `url` must be an HTTP or HTTPS URL, and `folder_id` must not be blank. The backend response is parsed defensively on mobile before it enters application state.

## Current scope limits

- Results are transient and disappear when the mobile process restarts.
- There is no account, database, background worker, vector index, or cross-linking.
- The two existing folders are fixed; users cannot create, rename, delete, or reorder folders.
- Generated knowledge remains read-only, while users can record transient lesson and recall progress.
- This milestone does not include an Android acceptance requirement, App Store distribution, offline processing, collaboration, or a web client.
- Flow is offered for acyclic graphs, Hierarchy for a connected rooted tree, and Network for every valid graph. Mobile renders only the validated options.

## Baseline acceptance evidence

- [x] Fifteen backend tests pass.
- [x] Mobile TypeScript compilation passes.
- [x] Mobile lint passes.
- [x] The iOS simulator flow completes from Safari share through folder selection, API processing, guided lesson display, interactive graph/source display, and updated folder count.
- [x] The demo flow verifies concept completion, mastery updates, concept-to-visual navigation, adaptive layout switching, recall reveal/advance, and original-context expansion.
- [x] Invalid input and backend failures produce bounded, user-readable errors rather than unvalidated UI state.

## Roadmap handoff

The next slice adds anonymous-first Supabase Auth and Postgres persistence while keeping v1 operational. Later slices add authenticated asynchronous v2 endpoints, ARQ/Redis processing, and Qdrant similarity retrieval. Those systems are target architecture only and are specified in `architecture.md` and `scope.md`; none is implemented in this baseline.
