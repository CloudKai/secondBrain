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
full checks: 122 backend, 55 web, build/typecheck and lint. Refreshed full checks pass: 122 backend, 55 web, build/typecheck and lint.
Independent re-review pending. Hosted migration/API/browser acceptance pending.
