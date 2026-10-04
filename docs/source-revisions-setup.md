# Source reuse and versioned refresh — planned 12 / GitHub #13

## Status

Selected on 2026-10-04. **Implemented locally; hosted acceptance is pending.**
The user agreed the authenticated capture/refresh API, external capture HTTP,
database ownership/version/worker fences and browser compare/refresh/reload/
citation seams. RED→GREEN tracers cover staged comparison, explicit promotion,
changed correction evidence, PDF digest aliases and the current reader fence.

Current implementation uses one stable source ID, 1–20 capture versions, one
candidate per source expiring after 24 hours, and immutable prior capture/note
snapshots. No hosted migration or browser acceptance is claimed at this checkpoint.
Full checks pass: 122 backend and 55 web tests, web build/typecheck and lint.
Independent review is underway. Native/iOS is unchanged.

## Implemented learner flow — hosted verification pending

- Add repeated material: compare the captured content and citation locations.
  Unchanged material opens the saved note. Changed material offers a refresh
  comparison while preserving the current capture and note until confirmation.
- Refresh an uploaded PDF from its saved source: upload the replacement file.
  Filename similarity alone never selects the source to replace. Supplied video
  refresh asks for a new transcript; publicly accessible YouTube captions can be
  checked again with the existing fallback.
- Confirm refresh: retain the same source identity, archive the exact prior
  capture and note, invalidate old jobs/derived results, and queue a new note.
  Inspect previous saved versions and their own PDF/time/passage references.
- Learner corrections remain authoritative. Remap assignment evidence only when
  supporting excerpts resolve in the refreshed note. If passages disappeared,
  retain the correction for review and ask for current supporting passages before
  using that assignment in the graph. Preserve rename/merge and rejected pairs.

## Implemented database and browser boundary — hosted verification pending

Postgres remains authoritative. Use bounded owned comparison candidates,
immutable saved-version snapshots and an atomic expected-version confirmation.
Serialize refresh with this learner's correction operations. Superseded study
and topic leases cannot publish; membership revisions hide stale combined
citations. Current graph coverage counts one source identity across all versions.
Delete cascades include candidates and history; correction ledgers retain the
existing surviving-material semantics.

Browser readers must check source/study versions as well as passage offsets:
matching offsets alone can accept an earlier response against changed content.
History evidence uses its archived capture and read-only note, without adding
historical source branches to current graph coverage. Comparison/refresh failure
keeps the current version available and offers an actionable retry.

Migration `202610040009_source_revisions.sql` adds source/study versions, private
archive/candidate/identity tables and owned comparison/confirmation/history/review
RPCs. Current graph and overview members still join only current source rows.
Uploaded PDF aliases reuse the stable source even when a replacement file has a
new digest. Identical captured text and page/cue locations reuse the current note.

Corrected assignments reanchor only unique exact supporting excerpts into new
note passage IDs. Otherwise the map is withheld with retained corrections for
current-evidence review; old relationships are not replayed after that review.
Study and topic completion use owner-before-row locks and refreshed leases.
The current browser reader compares source/study versions before accepting refs;
refresh clears stale source evidence, topic cache and recall state for that source.

Rollback revokes authenticated comparison and promotion without dropping captures,
archives, aliases, correction review or version-aware worker fences. Re-enable by
granting execute on the same two function signatures; do not reapply table DDL.
This preserves existing refreshed material and prior-version access.

Use existing capture bounds and provider access. No OCR, range selection,
private recording/account retrieval, assistant/research or production deployment.
Native/iOS and its tracker remain separate and unchanged.

## Completion record

Open: [GitHub #13](https://github.com/CloudKai/secondBrain/issues/13).
Update full check counts, independent review, hosted evidence and this status as
the slice progresses. Check `docs/planning/web-learning-library-tickets.md` and
`context/web-progress-tracker.md`; do not claim target behavior as verified.
