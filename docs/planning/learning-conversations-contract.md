# U2c2 saved lesson conversations

**Implemented in development; final accessibility/download acceptance remains open.** Delivery #34, part of #29, following U2c1. Starting commit 11bb05b; unrelated WIP is excluded. Approved seams: authenticated learning API, provider HTTP, public Postgres RPC/RLS and browser journey.

## Identity and sends

- One owned conversation per collection, immutable confirmed plan, lesson and `lesson` scope. Reopening restores saved exchanges in order. New plan versions and branches have separate conversations. Collection/library tutoring remains U5.
- Postgres owns the revision. Each send carries a UUID request ID and expected revision. Only a completed exchange increments the revision. A live lease prevents concurrent generation. An unchanged retry returns an already completed exchange without another provider request; failed sends retain the question and allow up to three attempts with the same ID. Requests that fail or are processing never masquerade as completed replies.
- Keep the durable question draft from U2c1. On an uncertain network outcome retain the request ID in tab-private, owner-scoped session storage so retry/reload does not create a second exchange. Auth changes clear pending work and fence late responses. A stale revision asks the learner to reload before sending; no automatic conflicting send.
- Limit a thread to 50 uncleared exchanges and new requests to 30 per learner per hour. Explain limits and offer export/clear. No silent truncation of retained history.

## Context, provenance and evidence

- The server chooses at most the last two completed, unredacted exchanges (four messages, 1,000 Unicode characters each) as conversational context. Client bodies cannot supply history or ownership. Context is never source evidence.
- Reuse existing learning_v1 policy: Luna medium first, bounded Sol medium structural repair. Persist the actual model, policy, creation/completion dates and immutable plan/source-version identity; keep citation IDs pointing into the plan's original references. Do not copy captured passages into conversation records.
- Validate collection/lesson/current source evidence before generation and again in the atomic finish. A source/assignment change during generation cannot save a stale reply. Changed evidence labels retained replies as historical; it blocks new sends until a reviewed plan is selected. Existing exact-version citation links remain available where retained references exist.
- Removing any source used by a plan redacts its saved generated reply and citation IDs, including stored exports obtained afterward. Learner questions and model/policy/date provenance remain accessible. This deliberately conservative rule follows existing whole-plan evidence removal. Pending replies cannot resurrect removed evidence.

## Clear, export and recovery

- Retain server conversations until explicitly cleared or collection/plan/account deletion. No expiry. Clear requires the current revision and explicit in-app confirmation; it removes question/reply content while retaining request tombstones to reject late finishes/retries. It does not clear drafts, submitted attempts, sources or activity.
- Download this conversation produces versioned JSON for this lesson only, with provenance, save revision, states and redaction labels. It is not whole-account recovery/export. Reads and exports after removal never reveal redacted replies.
- Migration 021 is additive with no backfill (old view-local replies cannot be recovered). Recovery revokes send/finish writes while retaining reads, exports, clearing and existing learning/draft writers. Never drop learner work on rollback.

## Acceptance

Verify exact question/reply Unicode, reopen, distinct lessons/versions, strict identities and owner denial, ordered history, stale tabs, same-request retry and changed payload rejection, lease expiry/failed-send retry, bounded context, cited/gap replies, source-change finish rejection, source-removal redaction, clear during generation, limits and recovery. Browser acceptance covers failed send/reload/retry, saved history, conflict, evidence return, clear/export, auth fencing and unchanged practice/activity; both themes, desktop/narrow, keyboard, actual zoom/screen-reader limitations recorded. Provider HTTP fixtures avoid live AI spending.
