# Source reuse and versioned refresh — planned 12 / GitHub #13

## Status

**Complete with hosted development acceptance on 2026-10-04.** Approved migration
applied successfully; local checks, independent re-reviews, hosted API/browser
acceptance and scoped fixture cleanup pass. Native/iOS is unchanged.

One stable source ID, 1–20 capture versions, one candidate per source expiring
after 24 hours, and immutable prior capture/note snapshots. Current-evidence review
preserves learner assignments without reusing unrelated passage numbers.

## Implemented learner flow

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

## Implemented database and browser boundary

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
current-evidence review; only relationships generated from the current capture between retained topics
are published after that review.
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

Status: **complete with hosted development acceptance**. User-approved migration
202610040009_source_revisions.sql applied successfully (query
2f6e3734-be16-4f73-a85c-c4d047815618). Stable owned source IDs support unchanged
reuse, reviewable capture/location comparison, explicit expected-version refresh
and exact prior capture/note archives. Versions count as one independent source.

- Local: 123 backend tests, 55 web tests, web build/typecheck and lint pass.
  Both independent review axes have zero remaining findings through 2bf070f.
- Hosted API: unchanged/changed supplied articles, real PDF extraction and digest
  aliases, transcript versions, archive equality, ownership/private-table denial,
  delayed study/topic completion rejection, stale overview hiding, retained renamed
  assignments, unique evidence reanchoring/current-evidence review, fresh
  relationships and rejected decisions pass.
- Desktop browser: unchanged transcript import reopens version 2 without adding
  a source/archive; time-only comparison, decline, video/PDF confirmation,
  retained-evidence review and reload persistence pass. Archived video citations
  retain 0:06–0:12; current citations use 0:24–0:42. Archived PDF page 1 and
  current PDF page 2 open their own exact captures. Real note/topic workers ran.
- Browser acceptance found missing PDF comparison origin; fix 2bf070f explicitly
  sets upload/direct and hides internal validation diagnostics. Its actual upload
  and public-link regression failed before the fix and now passes.
- Controlled sources, history, candidates, aliases, overrides, queues and scoped
  overview/correction records were removed and verified. Browser reload reflects
  removal. The real source identity/version is preserved. Cleanup used scoped
  REST/authenticated API, not a new browser deletion confirmation flow.

Bounded to 20 versions and one 24-hour comparison candidate per source. Existing
capture limits remain; automatic private recording access, OCR, ranges, assistant
and live research are separate target work. Development/desktop acceptance only;
production unconfigured. Sequential after-claim checks and lock-order review,
not concurrent stress testing. Browser network-delay overlap for graph/dialog
races is not deterministically exercised. Existing bundle/deprecation warnings
remain. Native/iOS and its tracker untouched. Commits remain local.

GitHub #13 and both web records synchronized. Next unpublished draft: planned
13, long sources and page/time ranges; not started. Setup/review:
docs/source-revisions-setup.md and docs/reviews/ticket13.md.
