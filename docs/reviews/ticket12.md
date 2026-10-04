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

## Evidence and hosted acceptance

Final full local checks through acd3c92: 118 backend tests, 46 web tests,
build/typecheck and lint pass. Six focused Postgres tests pass after
correction, including real service claim/finish following an after-claim rename,
assignment override retention, rejection/remapping, stale overviews, deletion
and rollback. The after-claim regression is sequential; deterministic concurrent
overlap is not tested. Static lock-order review supports the race fix.
Passage identifier RED→GREEN HTTP regression passes. Final full checks pass. Existing bare-launcher/deprecation/bundle limitations remain.

The user approved the dashboard warning. Migration
`202610040008_topic_corrections.sql` applied successfully on 2026-10-04 to the
configured development project (query 69038fae-191b-4dbb-8e99-7ff1b3ab70c9).
Hosted API checks passed ownership/direct-ledger restrictions, durable actions,
merge rejection precedence, explicit acceptance, original-note equality,
stale overview hiding, future service completion and source deletion cascades.

Desktop browser checks passed rename/reload, merge/rejection precedence,
accept/reject/reload, assignment removal/addition/reload, PDF page 1 and supplied
video 0:06–0:12 citation navigation. A merged overview completed on attempt 1;
a later assignment change hid it with the changed-source message. Stored
original-note JSON remained unchanged. Verified controlled sources and their
scoped ledgers/derived jobs were cleaned. Post-removal browser reload restored
an empty saved graph; deletion itself was checked through the authenticated API
and scoped REST cleanup, not a new browser delete-confirmation interaction.

Both review axes have zero remaining findings through acd3c92. A final About
copy correction describes saved-topic persistence accurately; build/typecheck
and lint pass afterward. Fictional saved inputs isolate this correction slice;
no new ingestion/provider or concurrent stress-test capability is established.
Ticket #12 acceptance is complete. Native/iOS and its tracker are untouched.
