# Ticket #13 source reuse / versioned refresh review

Fixed point: e8ec6dc. Initial implementation: 07895b8.
Only committed ticket changes reviewed; unrelated working-tree edits excluded.

## Standards

Initial independent review found two P2 issues:
- Delayed correction reads could repopulate the cleared graph after refresh.
- A late refresh callback could close another dialog.

Generation-guard mutation results/errors and guard dialog completion by mounted
instance while preserving the authoritative source cache update.

## Spec

Initial independent review found two P2 issues:
- Current-evidence review discarded freshly generated relationships permanently.
- Comparison previews omitted changed PDF boundaries and transcript times.

Keep a bounded private pending analysis from this capture; evidence review
publishes only its current relationships between retained topics. Old relations
are not replayed. PDF page and transcript cue boundaries and excerpts appear in
both comparison previews. Existing correction and rejection rules remain applied.

## Checks / status

The relationship regression failed before the fix and passes afterward. Initial
and refreshed full checks: 122 backend, 55 web, build/typecheck and lint pass.
Both independent re-reviews through 08d4835 have zero remaining findings.
Hosted migration/API/browser acceptance pending. Automatic approval review
blocked Run: earlier approvals did not cover this migration. Reviewed SQL is
staged at query 2f6e3734-be16-4f73-a85c-c4d047815618 and matches the file exactly.
Fresh approval requested; no schema execution occurred.
