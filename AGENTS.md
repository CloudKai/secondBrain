# AGENTS.md

Always-on instructions for Cursor, Codex, Copilot, and Claude Code (through
`CLAUDE.md`). Keep this file short and use the indexed context files for detail.

Second Brain helps learners capture dense web articles from the native share
sheet and turns them into four plain-language points and an interactive concept
map organized by folder.

Do not invent product behavior that is not written in `context/` or `scope.md`.
Every roadmap document must label target behavior separately from the verified
MVP; planned services are not current capabilities.

## Index

| File | Read when |
| --- | --- |
| `context/project-overview.md` | New feature, scope question, or user-facing behavior |
| `context/architecture.md` | API, data model, auth, queue, vector, or folder-boundary change |
| `context/code-standards.md` | Writing or reviewing code |
| `context/ui-context.md` | Routes, screens, components, or visual behavior |
| `context/feature-spec.md` | Working on or validating the Phase 1–2 baseline |
| `scope.md` | Continuing a slice, claiming status, or changing a decision |
| `context/progress-tracker.md` | Starting or ending a unit of work |
| Nested `AGENTS.md` | Editing that folder; nested files contain deltas only |

## Work loop

Skip the approval pause for a one-line or one-file fix.

1. Inspect existing code and the relevant context files.
2. Ask one focused question only when the requirement cannot be derived.
3. For a new slice or boundary crossing, state the intended unit before coding.
4. Implement only that unit; do not pull roadmap work into the current MVP.
5. Run the exact applicable commands below.
6. Update `scope.md` and `context/progress-tracker.md` when status changes.
7. Report: `What I did` · `Test` · `Needs your attention`.

## Stack

| Layer | Current verified MVP | Target architecture |
| --- | --- | --- |
| Mobile | Expo 57, React Native 0.86, Expo Router, TypeScript | Same, iOS-first |
| API | FastAPI and strict Pydantic models | Authenticated, provider-neutral container deployment |
| Auth | None | Supabase anonymous auth, later linked to Apple identity |
| Database | None; mobile React context only | Supabase Postgres with RLS as source of truth |
| Background work | None; request waits for the full pipeline | ARQ workers with Redis transport |
| AI | LangGraph, OpenAI `gpt-4o-mini` | Same plus `text-embedding-3-small` |
| Vector search | None | Qdrant Cloud, derived and rebuildable from Postgres |
| Styling | React Native `StyleSheet` and `mobile/constants/theme.ts` | Same token system |

## Repository boundary

- The parent repository is `CloudKai/secondBrain`.
- `mobile/` is a Git submodule backed by `CloudKai/mobile`.
- For a mobile change: commit and push inside `mobile/` first, then commit the
  updated submodule pointer in the parent repository.
- Never stage mobile working-tree changes as parent-repository content.

## Commands

Run these exact strings from the repository root.

- Typecheck: `cd mobile && npx tsc --noEmit`
- Lint: `cd mobile && npm run lint`
- Backend tests: `uv run --project backend --extra dev pytest backend/tests -q`
- Backend dev server: `uv run --project backend uvicorn backend.main:app --reload`
- Mobile dev server: `cd mobile && npm start`
- iOS development build: `cd mobile && npm run ios`
- Expo project health: `cd mobile && npx expo-doctor`
- Production build: `none — release pipeline is not configured`

## Secrets and boundaries

- Canonical templates are `backend/.env.example` and `mobile/.env.example`.
- `OPENAI_API_KEY`, future Supabase service-role credentials, Redis credentials,
  and Qdrant API keys are server-only.
- Mobile may receive only client-safe values such as
  `EXPO_PUBLIC_API_BASE_URL` and the future Supabase public client settings.
- The mobile app renders returned or stored data. It does not scrape pages,
  call model providers, enqueue jobs, or access Qdrant directly.

## Fences

- Outputs are read-only; do not add rich-text editing without a new feature spec.
- Keep the current two folders fixed until a custom-folder feature is approved.
- Do not describe Supabase, Redis, ARQ, Qdrant, persistence, or authentication as
  implemented until their roadmap slices have passed acceptance checks.
- Do not modify generated native folders unless the task explicitly requires it.

## Skills

Use available skills or repository-local instructions before guessing an SDK.

## Nested AGENTS.md

None currently.
