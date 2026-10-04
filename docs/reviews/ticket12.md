# Ticket #12 review — persistent topic corrections

Fixed point: `7e9358f`. Implementation: `39b1807`; correction: `acd3c92`.
Reviewed committed changes only, excluding unrelated native/v1 working-tree
edits. Two independent code-review agents; no tests run by reviewers.

## Standards

Initial P2: worker completion did not take the correction owner lock, allowing a
concurrent rename/merge to race a processing row. Initial P3: passage identifier
items had no request length bound. Completion now locks owner before row;
rollback restores the prior function. Passage IDs are bounded to 1–16 characters
and malformed requests return 422. Re-review through acd3c92: zero remaining
standards/correctness/ownership findings or actionable heuristic smells.

## Spec

Initial P2: the same completion race could violate durable correction retention.
Owner-before-row serialization resolves it. Re-review through acd3c92: zero
remaining findings. Rename/merge, source overrides/placement backfill, rejection
precedence, original-note preservation, evidence validation, overview
invalidation and deletion fences match the selected criteria.

## Evidence and pending acceptance

Final full local checks through acd3c92: 118 backend tests, 46 web tests,
build/typecheck and lint pass. Six focused Postgres tests pass after
correction, including real service claim/finish following an after-claim rename,
assignment override retention, rejection/remapping, stale overviews, deletion
and rollback. The after-claim regression is sequential; deterministic concurrent
overlap is not tested. Static lock-order review supports the race fix.
Passage identifier RED→GREEN HTTP regression passes. Final full checks pass. Existing bare-launcher/deprecation/bundle limitations remain.

The reviewed migration is staged at Supabase's destructive-operation warning:
query 69038fae-191b-4dbb-8e99-7ff1b3ab70c9 in the configured development project.
It preserves source notes; DELETE statements consolidate this learner's
connection decisions and clean worker queues. Browser policy requires user
approval to click Run query. No migration or hosted acceptance is claimed yet.
Ticket #12 remains open. Native/iOS and its tracker are untouched.
