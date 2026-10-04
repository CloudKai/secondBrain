# Persistent topic corrections — planned 11 / GitHub #12

## Status

Local implementation and focused agreed-seam checks pass. Independent review,
full checks and hosted development acceptance are pending. The migration has
not been applied; this is target behavior until hosted acceptance passes.
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
and worker fences, and browser corrections/reload/citation flows. Focused HTTP,
Postgres migration/rollback and authenticated client checks pass. Full suite,
independent review, hosted migration and browser acceptance remain pending.
