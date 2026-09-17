# Code Standards

These rules apply to the current MVP and to roadmap work unless a later architecture decision explicitly replaces them.

## Type safety and validation

- TypeScript must compile in strict mode. Do not introduce `any`; narrow `unknown` at network and native-module boundaries.
- Keep shared mobile domain types in `mobile/types/knowledge.ts`. Components consume typed props and do not reinterpret API payloads ad hoc.
- Every structured knowledge request and response must use a Pydantic model. Models reject unknown fields, constrain strings and URLs, and return a stable JSON shape.
- Keep the LangGraph state explicit. The current `TypedDict` carries `raw_text`, `simplified_summary`, `mermaid_code`, `nodes`, and `edges`; add fields deliberately when a node contract changes.
- Treat external responses, share-extension values, WebView messages, JWT claims, and database rows as untrusted until validated.

## Current application boundaries

- Expo Router route files coordinate screens. Reusable UI belongs in `mobile/components`, network access in `mobile/lib`, state in `mobile/state`, and shared types in `mobile/types`.
- Use the palette and spacing tokens in `mobile/constants/theme.ts`. The HTML inside `InteractiveGraphViewer` is an isolated document and may mirror its required palette locally.
- Backend routes validate and delegate. Extraction, summarization, and graph generation belong in the LangGraph pipeline rather than in `main.py`.
- Keep ingestion bounded: page downloads are limited to 2 MB, and model input is limited to 30,000 characters. New ingestion paths need equivalent limits and timeouts.
- Preserve the synchronous `POST /api/v1/process-link` contract until the documented v2 migration is available.

## Security and ownership

- Never commit provider keys, Supabase service-role keys, Redis credentials, Qdrant API keys, Apple credentials, or populated environment files.
- The mobile app may contain only public configuration such as the Supabase project URL and publishable/anonymous key. Privileged credentials are server- or worker-only.
- Return plain, actionable errors to users. Log diagnostic detail on the backend without logging tokens, raw secrets, or unnecessarily retaining shared content.
- Target v2 endpoints must require a verified Supabase bearer JWT. Derive `user_id` from the token; never accept ownership from a client-supplied body or query parameter.
- Enforce ownership in both application queries and Postgres Row Level Security policies. Every user-owned table needs RLS and tests for cross-user denial.

## Persistence, migrations, and background work

The rules in this section describe the target architecture; Supabase, ARQ/Redis, and Qdrant are not part of the current MVP.

- Apply schema changes through reviewed, reversible SQL migrations. Do not make production schema changes manually.
- Postgres is authoritative for users, folders, knowledge items, processing status, and source metadata.
- Commit the queued item and its outbox record in one Postgres transaction; reconcile outbox delivery so Redis downtime cannot strand accepted work.
- Queue only stable Postgres item UUIDs in ARQ/Redis. Workers fetch current inputs from Postgres and write results back transactionally.
- Jobs must be idempotent and safe to retry. Use an idempotency key at item creation, explicit status transitions, bounded attempts, and a recorded terminal error.
- Redis is transient job transport, never the source of truth.
- Qdrant is a rebuildable derived index. Upsert points with the Postgres item UUID and always filter retrieval by authenticated `user_id`; include indexed `folder_id` and `item_id` payloads.
- A database commit must not depend on a Qdrant write succeeding. Record or retry indexing work separately.

## Tests and review

- Backend tests must cover schema rejection, ownership boundaries when added, bounded ingestion, provider failure, and idempotent retry behavior. Unit tests do not call real model or storage providers.
- Mobile changes must pass TypeScript and lint. Native-share changes also require a development-build simulator or device check because Expo Go cannot exercise the share extension.
- A change that alters a public contract must update the relevant context documents and tests in the same root-repository commit.
- Comments explain non-obvious reasons or native limitations, not syntax. Put deferred product work in `scope.md` or the progress tracker rather than scattering vague TODOs.

## Repository and submodule commits

- `mobile/` is a Git submodule with its own history. Commit and push mobile changes in `CloudKai/mobile` first.
- Only after that commit is reachable should the root repository commit the new submodule pointer alongside related backend or documentation changes.
- Never stage unrelated untracked files, generated native artifacts, build products, secrets, or local environment files.
