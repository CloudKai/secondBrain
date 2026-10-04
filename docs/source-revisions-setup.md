# Source reuse and versioned refresh — planned 12 / GitHub #13

## Status

Selected on 2026-10-04. **Target behavior; not implemented or verified.**
Existing captures reuse canonical article/recording URLs and PDF file digests,
but repeated URLs are reopened without rechecking content. The browser duplicate
shortcut and API lookup both need an explicit comparison path. Current notes and
topic jobs use one stable source ID; worker completion is fenced by a lease token.

The TDD skill requires agreed test seams before tests. Proposed boundaries:
authenticated capture/refresh API, external capture HTTP responses, database
ownership/version/worker fences and browser compare/refresh/reload/citation flows.
No implementation or tests have started at this checkpoint.

## Intended learner flow

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

## Intended database and browser boundary

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

Use existing capture bounds and provider access. No OCR, range selection,
private recording/account retrieval, assistant/research or production deployment.
Native/iOS and its tracker remain separate and unchanged.

## Completion record

Open: [GitHub #13](https://github.com/CloudKai/secondBrain/issues/13).
Update acceptance, migrations/rollback, tests, hosted evidence and this status as
the slice progresses. Check `docs/planning/web-learning-library-tickets.md` and
`context/web-progress-tracker.md`; do not claim target behavior as verified.
