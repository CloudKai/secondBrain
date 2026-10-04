# Grounded assistant — planned 14 / GitHub #15

## Selected target — 2026-10-04

Not implemented or verified yet. Current hosted baseline is planned tickets
01–13. Native/iOS and its progress tracker remain untouched.

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

## Agreed checks

Authenticated question/scope API; model HTTP responses; database
ownership/retrieval and source-version checks; browser scope/citation/unsupported
answer flows. Follow RED→GREEN at these boundaries, full checks at closeout,
and independent standards/spec review. Reviewed reversible migration and hosted
API/model/browser acceptance remain pending.

## Local implementation — 2026-10-05

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
