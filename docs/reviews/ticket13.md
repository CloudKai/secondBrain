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

Both independent re-reviews have zero remaining findings through 08d4835.
Hosted browser acceptance caught a missing PDF origin; 2bf070f fixes upload/direct
origins and safe validation messages. The real extraction/public HTTP regression
failed before the fix and passes afterward. Both additional independent reviews
of 5a67f4b...2bf070f have zero findings.

Final local checks: 123 backend tests, 55 web tests, web build/typecheck and lint.
Approved migration applied to the development project; hosted capture/refresh,
ownership, archives, worker leases, corrections, relations, stale overviews and
independent-source counts pass. Browser video/PDF compare/decline/confirm/review,
exact old/current citations, duplicate import and reload pass. Controlled fixtures
and scoped derived rows were cleaned and verified; real note preserved.

Desktop/development only. Sequential after-claim regressions plus lock review;
concurrent stress and deterministic delayed browser-response overlap are untested.
Original bundle/deprecation warnings remain. Ticket #13 acceptance complete.
