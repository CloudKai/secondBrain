# Grounded assistant — planned 14 / GitHub #15

## Historical selection — 2026-10-04

At selection this slice was not implemented or verified. The hosted baseline
then was planned tickets 01–13. Native/iOS and its progress tracker remain untouched.

A completed saved note gains a live English study assistant beneath its content.
Current note always participates. Ask this topic and Ask my library are independent
textbox toggles, including both together. A topic selector uses this note's
confirmed topics. Topic evidence takes precedence over wider library relevance;
source identities are deduplicated. Exact citations open the existing evidence
panel while preserving the anchor note and conversation.

Use Postgres full-text retrieval over owned completed current source notes,
current note plus up to four topic and four relevant library sources. Topic
corrections apply through the current maps. Each request has a bounded serialized
model context (30,000 characters), original saved passages and bounded output.
The backend checks source versions/note revisions and topic membership again
after the model call. Changed/deleted evidence returns an actionable retry,
not an answer using stale material. Provider calls use existing server-only
configuration and strict structured responses. Source text/previous messages
are untrusted content. No outside facts, browsing or research links are allowed.

The conversation is local to the current component/tab, with bounded recent
messages if needed for follow-ups; durable chat history is outside this slice.
Changing note/version or reloading starts a fresh conversation. Unsupported
questions explain the evidence gap and offer Find reliable sources, opening the
existing clearly labelled reading-list preview. Live discovery remains planned
15; existing example assistant remains labelled preview. Notes are read-only.

## Agreed checks at selection

Authenticated question/scope API; model HTTP responses; database
ownership/retrieval and source-version checks; browser scope/citation/unsupported
answer flows. Follow RED→GREEN at these boundaries, full checks at closeout,
and independent standards/spec review. Reviewed reversible migration and hosted
API/model/browser acceptance remain pending.

## Initial local implementation — 2026-10-05

Implemented `POST /api/v2/sources/{id}/ask`, owned Postgres retrieval and
post-generation source/note/map fences, strict grounded model answers, bounded
recent conversation (four turns, 2,000 characters each), and the live saved-note
assistant. Topic evidence precedes query-relevant library results. The server
selects exact original saved passages; serialized model context is at most
30,000 characters. Provider failures and changed evidence return actionable
errors. No research URLs are generated. Citation inspection fetches the current
source and checks version, exact excerpt and original page/cue locations while
preserving the anchor note. Both scope toggles work together; only confirmed
source topics appear in the selector. Existing example assistant stays preview.

Focused checks: 15 assistant API/model tests and three client/database tests
pass. Web typecheck/lint pass. Full checks pass: 158 backend/64 web tests before the additional bounded-context
check (15 focused assistant checks now pass), plus build/typecheck/lint. Independent
review, migration 011 and hosted acceptance remain pending. This is local implementation, not yet a
verified hosted capability.

## Migration and rollback

Apply reviewed `supabase/migrations/202610050011_assistant_context.sql` to the
same development Supabase project. It adds one full-text index and two read-only
security-definer RPCs with empty search paths, authenticated ownership checks,
8-second SQL deadlines and restricted execution grants. It does not change or
delete sources, studies, topic maps, or archives. Existing server-only
`OPENAI_API_KEY` is required; no additional provider/database secret is needed
by learner requests. The learner bearer token remains the database authority.

Rollback (after stopping assistant requests):

```sql
begin;
drop function public.get_assistant_context(uuid,integer,text,uuid,boolean);
drop function public.validate_assistant_context(uuid,uuid,jsonb);
drop index public.source_studies_assistant_search;
commit;
```

Rollback removes assistant retrieval and its index while preserving saved data.

## Verified completion — 2026-10-05

Implementation and review fixes through `fb813e0` pass **161 backend tests and
64 web tests**, build/typecheck/lint. Independent standards/spec re-reviews have
zero remaining findings. Migration 011 applied successfully to development
Supabase. GitHub #15 is closed; planned slices 01–14 are complete.

Hosted real auth/database/model acceptance verifies current-note answers,
confirmed-topic comparison, combined topic-first/library retrieval without
source duplicates, unsupported questions without invented facts/links,
unauthenticated and cross-learner denial, and changed note revisions rejecting
after generation. Controlled fictional evidence supports exact PDF page 3 and
video cues at 6–12 seconds.

Browser acceptance verifies both scope toggles and topic selection, exact PDF
and video citation inspection without changing the anchor note or losing the
conversation, stale citation retry guidance, follow-up answers that preserve
source limitations, unsupported-answer discovery navigation and reset on
reload/reopen. The uploaded-PDF empty-URL crash in discovery was fixed; the
reading list is explicitly labelled a preview. The model receives bounded recent
learner questions plus current saved evidence; prior generated assistant claims
are excluded from follow-up evidence.

All controlled API/browser sources were removed. Browser-owner source counts
and dependent studies/maps/outboxes/versions/identities/overrides/sections were
verified empty. The original learner source was not targeted. Native/iOS and
its progress tracker are untouched. Live research remains planned 15; production
deployment is not configured. Existing dependency deprecation and large-bundle
warnings remain.

Commands from the repository root:

```bash
uv run --project backend --extra dev python -m pytest backend/tests -q
cd web && npm test && npm run build && npm run lint
```

The bare `pytest`/`uvicorn` entrypoints resolved to a stale global runtime in this
environment; module commands use the project's interpreter. Development API:

```bash
uv run --project backend python -m uvicorn backend.main:app --reload --env-file backend/.env
```

No new credentials are required beyond the existing ignored server environment.
