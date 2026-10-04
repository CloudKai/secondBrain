# Persistent topic corrections — planned 11 / GitHub #12

## Status

Complete: local checks, both independent re-reviews and hosted development
API/browser acceptance pass. The user approved the dashboard warning, and
migration `202610040008_topic_corrections.sql` applied on 2026-10-04.
Native/iOS and its progress tracker remain untouched.

## Learner flow

Saved topic panels provide Rename and Merge with a topic. The survivor keeps its
identity and source branches; duplicates and self-connections are removed.
Original study notes remain read-only. Manage this source's topics changes its
memberships and asks for passages supporting added topics. Existing assignments
keep their own citations. A source must retain 1–12 topics and a main topic.

Supported graph connections can be accepted or rejected. Rejected pairs remain
recorded when support disappears; merging pairs preserves rejection precedence.
Accept if supported restores eligibility, without inventing a connection or
bypassing the existing independent-source/evidence gate.

Changing mapped evidence hides outdated combined overviews. Choose Combine
explicitly to regenerate; membership fingerprints fence delayed overview writes.
Deleting a source removes its notes, maps, overrides and queue rows through
ownership-protected cascades. Surviving rename/merge and connection decisions
remain durable, including when no source currently supports their topics.

## Boundary

Migration `202610040008_topic_corrections.sql` adds server-only topic rules and
source overrides, plus owned read-only connection decisions. Authenticated
`POST /api/v2/topic-corrections` validates a rename, merge, assignment or connection
action and calls one atomic owned RPC. Clients cannot choose an owner or write
the ledger tables directly. The library API returns current decisions and filters
rejected pairs. Failed mutations retain the dialog with actionable errors.

Database triggers resolve redirects and title overrides on future worker writes,
and preserve learner source assignments/placement confirmations. Exact source
passage IDs must still exist. Existing placement confirmations are backfilled.
The topic claim and completion functions take the owner lock before row locks, matching the
correction lock order. Existing source foreign keys fence deleted-source writes.

Rollback `supabase/rollbacks/202610040008_topic_corrections.sql` removes correction
ledgers/triggers and restores the prior claim/completion functions. It preserves original
notes and the latest corrected maps; future correction retention is lost after
rollback. No new credentials, services, ingestion or native API changes.

## Checks

Agreed with the user: authenticated correction/removal API, database ownership
and worker fences, and browser corrections/reload/citation flows. HTTP, Postgres migration/rollback and authenticated client checks pass.
Final local suite: 118 backend tests, 46 web tests, build/typecheck and lint.
Both independent re-reviews have zero remaining findings through acd3c92.
Hosted API acceptance verifies owned rename/merge/assignment, rejection precedence,
explicit acceptance, cross-learner denial, preserved original note JSON, outdated
overview suppression, correction retention on service completion, and deletion
cascades. Browser acceptance verifies rename/reload, merge/rejection precedence,
explicit acceptance/rejection, assignment removal/addition/reload, exact PDF page
and supplied-video timestamp citations, and stale overview feedback. An on-demand
merged-topic overview completed on attempt 1 before the assignment changed.
Cleanup used only verified controlled fixture IDs; browser reload shows no
remaining fixture topics, connections or source citations. These are fictional
saved inputs, not new provider ingestion. Hosted source deletion used API/REST;
post-removal browser reload was checked, not a new UI delete-confirmation flow.

The after-claim completion regression is sequential; deterministic concurrent
overlap is not tested. Static owner-before-row lock-order review supports the
race fix. Desktop acceptance only; production deployment is unconfigured.
Evidence: `docs/reviews/ticket12.md`; screenshots `corrections-migration-success.png`,
`corrections-browser-persisted.png`, `corrections-browser-stale.png` in the local
Codex task outputs. Existing bundle/deprecation warnings and stale bare launchers
remain. GitHub #12 and both dedicated web records are synchronized.
