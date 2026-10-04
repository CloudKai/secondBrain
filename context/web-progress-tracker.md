# Web Progress Tracker

## Current status — 2026-10-04

**Verified MVP:** planned tickets 01–12 are complete with hosted development
acceptance. GitHub #1/#2/#3/#5/#6/#7/#8/#9/#10/#11 cover articles, structured notes,
selectable-text PDFs, supplied transcripts, accessible English YouTube captions,
Teams/Zoom/Panopto export feedback, saved-source topics/graph, combined overviews, source branches and persistent corrections/removal. GitHub #12
completes the correction slice. Extra #4 covers
citation/title polish.

**Last completed:** planned ticket 12 / [GitHub #13](https://github.com/CloudKai/secondBrain/issues/13).
Unchanged imports reuse a source; explicit refresh archives captures/notes and
retains correction decisions with current supporting evidence.

**Latest checks:** 123 backend tests, 55 web tests, web build/typecheck and lint
pass. Both independent review axes have zero findings through 2bf070f. Hosted
API/browser acceptance and controlled-fixture cleanup pass. Desktop/development
only; concurrent stress and deterministic browser delay overlap are untested.

**Current unit:** planned 13 / [GitHub #14](https://github.com/CloudKai/secondBrain/issues/14), long sources and page/time ranges. Local range capture/section processing and independent review complete. Migration approval and hosted acceptance pending.

**Target behavior:** Automatic Teams/Zoom/Panopto access, long-source ranges,
assistant/research and production deployment remain planned. YouTube support is
conditional on anonymously accessible English captions.

**Where to check:** [ticket breakdown](../docs/planning/web-learning-library-tickets.md)
for acceptance checkboxes and GitHub mapping; published GitHub issues for completion
comments; `scope.md` for decisions. Native progress stays in
[progress-tracker.md](progress-tracker.md). Update this file and the ticket
breakdown as each web slice progresses. Dated history below preserves previous
checks and limitations.

## Original browser UI history

### Web browser UI slice — historical snapshot, 2026-10-02

- [x] Separate React/TypeScript/Vite frontend; dark default and light appearance
- [x] Library, read-only study notes, contextual Topic/Graph/Sources, topic map, reading list
- [x] Search, filters, sorting, duplicate-URL reuse, and empty-library behavior
- [x] Recall reveal/advance and session understood-state
- [x] Topic rename/merge/assignment and connection correction controls
- [x] Source removal updates topic coverage; original notes preserved by organization changes
- [x] Explicit saved-note assistant preview with scope toggles and source references
- [x] Strict v1 article-response adapter; no invented passage, page, or timestamp citations
- [x] Web bundle/typecheck/lint and seven domain/boundary tests
- [x] Browser checks at desktop/mobile sizes; local screenshots in `output/playwright/`
- [ ] Verify live article import through the configured backend from the browser
- [ ] Implement the dedicated web study-note/assistant contracts and target services

The following describes the original UI handoff; later article/PDF/transcript
sections record completed persistence and note generation.

This historical slice used labelled curated examples and in-memory state. Article transport
was checked with controlled fixtures, not a live model request. PDF/video intake,
open-ended chat, live research, semantic topic comparison, versioned refresh, and
persistence are still planned. The 15 backend tests pass through the project
Python interpreter; the exact pytest command has a stale virtualenv shebang.
See `web/README.md` and the UI-slice section in `scope.md`.

### Library organization refactor — 2026-10-02

- [x] User approved session-only scope and rejection precedence after topic merges
- [x] Centralized learner actions and graph/search derivation in the library module
- [x] Updated topic search to use corrected names
- [x] Remapped rejected pairs during merges, with deduplication and self-edge removal
- [x] Shared source/example removal and recall cleanup; retained surviving corrections
- [x] Web typecheck and lint pass
- [ ] Behavioral verification of the refactor; no tests were added or run

The existing design and source-note text are preserved. State still resets on
reload, and native/mobile code and the article transport remain unchanged.

## Browser article capture — ticket #1, 2026-10-02

Status: implementation and local checks complete; hosted Supabase acceptance
pending project provisioning. The user selected ticket 01 and confirmed no
Supabase project is set up. GitHub issue: https://github.com/CloudKai/secondBrain/issues/1.

- Extended the supplied browser design with anonymous session restoration,
  owned-source save/list/reopen/delete, capture provenance/coverage, storage
  retry/error states, and a clear read-only **Study note pending** viewer.
- Added `/api/v2/sources` with verified Supabase Auth ownership, learner-token
  PostgREST access, strict validation, and bounded public-article capture.
- Reviewed browser-only source migration and rollback are in `supabase/`.
  The schema is source-first and independent of native fixed folders; topic,
  note, queue/outbox, and vector tables are deferred to their selected slices.
- Verified: 13 web tests, build/typecheck, lint; 31 backend tests through the
  project interpreter. The exact pytest entrypoint selects an obsolete external
  interpreter and fails collection (`langchain_openai` missing); the project
  interpreter passes. Existing native/mobile files and v1 behavior were not
  modified by this ticket.
- Desktop and 390px browser fixtures cover save, captured-text inspection,
  original-link identity, reload recovery, capture/storage errors, disabled
  saving, and deletion followed by reload.
  A real public-page capture also passed; this is not hosted storage acceptance.
- Setup and remaining live checks: `supabase/README.md`. Structured generation
  is ticket 02; the other 14 proposed tickets remain unpublished drafts.


## Browser hosted acceptance — ticket #1, 2026-10-03

Status: **verified against the configured hosted Supabase development project**.
The user supplied its public settings; anonymous sign-ins are enabled and the
source schema is available. Backend and Vite environment files are configured
locally and ignored by Git. Native/mobile behavior remains unchanged.

- A real anonymous browser saved a public page, loaded its capture through the
  API, reloaded, and reopened the same source ID, original URL, text, timestamp,
  provenance, and pending study status. No fixture routes were used.
- An isolated second browser had zero owned sources. Cross-owner API read and
  deletion returned 404. Direct PostgREST SELECT/DELETE returned zero matching
  rows; the owner's record remained readable afterward.
- A private-network source was rejected with 422; requests without a bearer
  session returned 401. Owner deletion succeeded in the UI, and reload plus
  API read confirmed permanent removal of the temporary verification source.
- Ticket #1 acceptance is complete. Structured study-note generation, PDF/video
  ingestion, topic persistence, model assistant/research, and production release
  remain target work. The native application has no new auth or persistence.
- Local API/browser servers are available at `http://127.0.0.1:8000` and
  `http://127.0.0.1:5173`. The backend uses `python -m uvicorn` through the
  project interpreter to avoid the pre-existing copied entrypoint problem.
- Evidence is in ignored `output/playwright/supabase-live-*.yml` and
  `supabase-live-reopened.png`. No session tokens or populated environment
  files are included in the commit or issue record.


## Browser study-note generation — ticket #2, 2026-10-03

Current unit: **implementation, review and hosted acceptance complete**.

- [x] Persistent structured article notes with variable concepts and recall
- [x] Exact captured passages, original links and Unicode-offset validation
- [x] Owned study acceptance/list, atomic study/outbox, unique source identity
- [x] ARQ ID-only dispatch, SQL bounded retries, lease recovery and fenced results
- [x] Read-only viewer, polling, reload and explicit generation retry
- [x] Local SQL/RLS/rollback, provider HTTP and browser evidence checks
- [x] 54 backend tests through project Python; 20 web tests; build and lint
- [x] Apply reviewed migration and complete hosted generation/worker recovery checks

Setup: `docs/study-note-setup.md`. Issue #2 acceptance is complete.
This supersedes the browser's pending-generation limitation; native persistence,
PDF/video, topics and assistant/research remain target work.

Hosted acceptance passed on 2026-10-03 after the user approved applying the
reviewed migration to AI Study Friends. A real article completed on attempt one;
citations opened exact excerpts, reload restored the same note, and repeated
requests reused it. Another anonymous learner could neither read nor generate
that source's note. A request accepted while Redis was stopped remained in the
persistent outbox. After a processing worker was killed, its lease expired and
the restarted worker completed attempt two with 13 exact references, one note
and no remaining dispatch. Disposable verification captures were removed.


## Browser PDF study notes — ticket #3, 2026-10-03

Current unit: completed and verified locally and against hosted Supabase.

- [x] Owned selectable-text PDF uploads and public links
- [x] Bounded subprocess extraction, limits and accurate coverage
- [x] Preserved physical page identity and page-bound citations
- [x] PDF form, source filtering and uploaded/local-file disclosure
- [x] Final backend/web/browser checks and independent code review
- [x] Apply reviewed migration and verify hosted PDF generation/reload/ownership

71 backend tests and 24 web tests passed; web build/typecheck and lint passed.
Live upload, public PDF URL generation, page citations, reload, duplicate upload
and second-learner API/RLS checks passed. Two standards findings were resolved;
independent re-review has no remaining material issue. Disposable sources/jobs
were removed. GitHub issue #3 is complete. Setup: `docs/pdf-study-setup.md`.


## Citation/title polish — issue #4, 2026-10-03

Completed the requested inline, text-size circular mint citation styling and clarified the PDF
Topic title field. Web typecheck and lint passed. Browser inspection confirmed
that citation clicks still open Sources and the PDF form uses the new label.
Numbers identify saved passages; PDF physical page numbers appear in Sources.
The curated example note separately labels its paraphrased evidence.
No new tests were requested or run.


## Browser supplied transcripts — issue #5, 2026-10-03

Current unit: implementation, review and hosted acceptance complete.

- [x] Supported recording context with UTF-8 TXT/VTT/SRT upload and paste
- [x] Supplied times/speakers, honest coverage and exact cue-bound citations
- [x] Authenticated capture, owned source/study workflow and worker metadata
- [x] Local API/model HTTP/SQL ownership tests, web build/typecheck and lint
- [x] Independent standards/spec reviews; findings fixed and re-reviewed
- [x] Hosted migration, generation/reload, timed/untimed browser citations and ownership checks

Setup: `docs/video-transcript-setup.md`. Planning draft 04 maps to GitHub #5.
Automatic transcript retrieval remains target work; native is unchanged.

Final checks: 93 backend tests, 28 web tests, web build/typecheck and lint pass.
Timed VTT upload and untimed paste generated live notes; reload, exact cue and
excerpt citations, Panopto reuse, SRT zero time, Teams context and second-learner
API/REST/RPC isolation passed. Review: Standards 0 remaining; Spec 0 remaining.
Six disposable verification captures and their notes/jobs were removed and
the cascade was verified; private test session tokens were discarded.
The browser viewport override remained at 1265px; phone-width verification
is not claimed. Existing responsive styles and native files were unchanged.


## Ticket progress synchronization — 2026-10-03

Updated `docs/planning/web-learning-library-tickets.md` to mark planned tickets
01–04 complete, map them to closed GitHub #1/#2/#3/#5, include extra polish #4,
and keep 05–15 explicitly planned. Checked the already-complete shared
recognition, transcript evidence, coverage and limit criteria within later drafts.
Recorded shared verified foundations without
claiming automatic provider retrieval, refresh or selected ranges. Updated this
tracker's current-status headline. Checked all five published issue states and
acceptance records; this documentation-only update adds/runs no tests.


## Accessible YouTube captions — issue #6, planned ticket 05, 2026-10-03

- [x] Validated anonymous public-caption method with a real accessible video
- [x] Bounded HTTP responses, wall-clock deadline and cancellation-safe capacity
- [x] Exact cue times and distinct retrieved/supplied provenance
- [x] Reviewed migration/rollback preserving captures, RLS and worker contracts
- [x] Hosted generation, canonical reuse and browser reload
- [x] Browser timed citation and Open video link using the saved caption cue
- [x] Unavailable-caption feedback opens upload/paste and retains URL/title
- [x] Supplied fallback generates a note with real supplied times
- [x] Second-learner API/REST/RPC denial
- [x] Web ticket checklist and GitHub acceptance synchronized

The real Neural networks video returned 286 cues and 18,430 characters. Its
saved note has 13 validated exact references; p0020 is 1:15.120–1:18.950 with
Open video at 75 seconds. The real note remains in the library. The synthetic
paste-fallback capture and its study/outbox rows were removed, with cascade
verified. Private session tokens were not exposed or retained in files.

Final checks: 103 backend tests, 30 web tests, build/typecheck and lint pass.
Review: Standards — three bounded-ingestion/fallback findings fixed, zero remaining
material findings; Spec — zero material defects. A minor timeout description
was corrected. Setup: `docs/youtube-transcript-setup.md`; review:
`docs/reviews/ticket06.md`. Native/v1 files are unchanged by this ticket.


## Teams access and export feedback — issue #7, planned ticket 06, 2026-10-03

- [x] Microsoft permission boundary verified against primary documentation
- [x] Teams/SharePoint context immediately opens upload/paste and export guidance
- [x] VTT speaker/times and untimed readable-text fallback preserved
- [x] Hosted note generation, citation inspection, reload and duplicate reuse
- [x] Exact saved references and second-learner API/REST/RPC denial
- [x] 104 backend tests, 30 web tests, build/typecheck and lint pass
- [x] Independent Standards/Spec review and final issue synchronization

No anonymous Teams retrieval path is validated. Access feedback describes the
app's authorization limitation; it does not inspect a recording's specific state.
Hosted checks use controlled transcripts and fictional recording URLs, not a
private Teams recording. Setup: `docs/teams-transcript-setup.md`. No migration,
new credentials or native/iOS changes. Standards found no documented breach; its
naming suggestion was applied. Spec found no material issue. Both controlled
captures and their study/outbox rows were removed, with cascade verified. Existing
learner notes were preserved. Review: `docs/reviews/ticket07.md`.


## Zoom availability/export feedback — issue #8, planned ticket 07, 2026-10-03

- [x] Primary documentation verifies download authorization and VTT export
- [x] Zoom share/play context immediately opens upload/paste and access guidance
- [x] Conditional help for processing, missing, restricted, expired/deleted material
- [x] Share URL or passcode is not treated as transcript download permission
- [x] Hosted VTT/paste generation, exact timed/untimed citations and reload/reuse
- [x] Exact three references and second-learner API/REST/RPC denial
- [x] 106 backend tests, 30 web tests, build/typecheck and lint pass
- [x] Independent Standards/Spec review and final synchronization

Setup: `docs/zoom-transcript-setup.md`. No anonymous Zoom retrieval path is
validated or advertised. The app does not inspect a recording's specific state;
controlled transcripts and fictional share/play contexts verify supplied input.
No new migration, credentials, account connection or native/iOS changes. Standards
and Spec reviews have no material findings. Both controlled captures and their
study/outbox rows were removed with cascade verified; existing learner notes are
preserved. Review: `docs/reviews/ticket08.md`. Web status stays separate from native
history; #8 is closed.


## Panopto access and site-specific fallback — issue #9, planned 08, 2026-10-03

Complete: local checks, hosted acceptance and independent review passed.

- [x] Actual site hostname and immediate upload/paste for viewer context
- [x] Conditional export/access help without inventing menus or lecture status
- [x] Unreadable UTF-8 correction retains recording URL and title
- [x] SRT speaker/times, exact timed citations after reload and untimed paste
- [x] Distinct site/session identity and canonical variant reuse
- [x] Three exact saved references and second-learner API/REST/RPC denial
- [x] 108 backend tests, 30 web tests, build/typecheck and lint pass
- [x] Independent Standards/Spec review and final synchronization

Setup: `docs/panopto-transcript-setup.md`. No concrete anonymous caption path is
validated or advertised. Controlled transcripts and fictional viewer contexts
verify supplied intake, not private lecture access. No migration, credentials,
account connection or native/v1 changes. The exact bare pytest launcher still
uses a stale external interpreter; project Python passes. Desktop checks only.

Standards: no material findings, one optional future rendering cleanup. Spec:
no findings. Both synthetic captures and their note/job rows were removed with
cascade verified; existing learner notes remain. Review: `docs/reviews/ticket09.md`.
GitHub #9 is closed; both web records are synchronized. Native history remains
separate. Planned 09 topic cards and graph is next, unpublished and not started.


## Topic cards and explained graph — issue #10, planned 09

Selected 2026-10-03; closeout synchronized 2026-10-04.
Status: implementation, independent review and hosted acceptance complete.

- [x] Approved graph specification and topic API/model/database/browser seams
- [x] Separate owned topic jobs, automatic enqueue/backfill and bounded recovery
- [x] Evidence-backed main/supporting topics, clear aliases and uncertain choices
- [x] First-source cards and two-independent-source graph threshold
- [x] Unrelated notes, learner ownership and original-note preservation
- [x] Exact browser evidence links, reload and saved/example history navigation
- [x] Seven-topic graph focus with every topic reachable and explained connection
- [x] Placement request UUID regression: RED→GREEN and hosted verification
- [x] Independent Standards/Spec re-review with no remaining findings
- [x] Six disposable sources and their study/topic/outbox rows removed
- [x] Both web records and GitHub #10 synchronized

The user approved the Supabase warning; migration 202610030006_topic_maps.sql
succeeded and the existing worker restarted. The real Neural networks note was
mapped on attempt one. Controlled saved notes verified first-source cards,
RAG alias reuse, meaningful shared-topic support and unrelated calculus. RAG
matching completed on attempt two; the related Neural networks fixture completed
on attempt three under the bounded retry policy. Context validation rejects
conflicting placements; generation quality still needs evidence inspection.

Controlled uncertain analyses verified suggested-topic confirmation and keeping
a distinct node, with notes unchanged and another learner denied. The browser
also confirmed a naturally uncertain topic as separate. A controlled supported
relation verified the seven-topic graph, explanation and exact passage link;
this does not claim every real model response yields a relationship. Local model
HTTP checks cover substantive/mention handling and contextual validation. Cleanup
preserved the original Neural networks capture, note and map.

113 backend tests through project Python, 34 web tests, build/typecheck and lint
pass. Standards: 0 remaining findings. Spec: 3 initial UI findings fixed,
0 remaining. Review: docs/reviews/ticket10.md. Setup: docs/topic-graph-setup.md.
Native/iOS and its tracker remain unchanged. Combined synthesis and broad
corrections remain planned tickets 10/11. Commits are local; no production
release or new phone-width acceptance is claimed.


## Combined topic overviews and source branches — issue #11, planned 10

Selected and completed 2026-10-04. Hosted development acceptance and independent
review pass; GitHub #11 closed and both web progress records synchronized.

- [x] Inspect approved decisions, glossary, ADR and existing boundaries
- [x] Publish/claim GitHub #11 with completed #10 as its dependency
- [x] Agree overview API/model HTTP/database/browser test boundaries
- [x] Implement requested synthesis, disagreements, branches and persisted choice
- [x] Independent Standards/Spec reviews and corrections; zero remaining findings
- [x] Apply reviewed migration after the user's dashboard warning approval
- [x] Hosted browser/API acceptance, fixture cleanup and issue synchronization

Migration 202610040007_topic_overviews.sql is applied; the existing worker was
restarted. Final real-model API and browser synthesis each succeeded on attempt 1.
Authenticated checks passed queue idempotence, on-demand generation, view choice,
cross-learner/direct-table/worker denial, exact references and original-note
equality. Removing a source hid the stale result; one source cannot Combine.

Desktop browser checks passed overlap explanations, original source branches,
both views after reload, topic-word navigation, conflicting findings and mint
citations to PDF page 1/video 0:06–0:12. A mixed-certainty pair blocked Combine
until confirmed through the public UI. Pending, failed and retry feedback was
observed. Controlled fictional PDF/video inputs isolate this slice; real model,
worker and hosted ownership were exercised without new provider access claims.
Temporary API/browser captures and derived queues were removed and verified.

Live-output corrections disambiguate passage labels, keep internal tags out of
prose and normalize only redundant grounded markers. Literal source wording and
unknown-label rejection remain intact. Final reviews through a9c4507 have no
remaining findings; 117 backend tests, 39 web tests, build/typecheck and lint pass.
Existing deprecation/bundle warnings and stale bare launchers remain. Semantic
quality still needs evidence inspection. Setup: docs/topic-overview-setup.md.
Review: docs/reviews/ticket11.md. Commits remain local; no production release or
phone-width acceptance. Native/iOS and its progress tracker remain unchanged.


## Persistent topic corrections and removal — issue #12, planned 11

Selected 2026-10-04. Published with native dependency on completed #11.
The user agreed authenticated correction/removal API, database ownership and
worker fences, and browser correction/reload/citation seams. Existing maps and
example controls inspected. Implement durable rename/merge redirects, source
assignment corrections and rejected/accepted connection decisions, preserving
original notes and surviving corrections. Local/hosted acceptance is pending.
Review fixed point: 7e9358f. Native/iOS and its tracker remain unchanged.

Local checkpoint: validated correction API; rename/merge redirects; source
assignment overrides; persisted connection decisions/rejection precedence; saved
UI controls; membership/worker/deletion fences and reversible migration.
Focused API/client/Postgres checks and typecheck pass. Full checks, independent
review, migration and hosted acceptance remain pending.

Independent reviews: Standards found one P2 completion race and one P3 unbounded
passage-ID item; Spec found the completion race. acd3c92 fixes owner-before-row
completion serialization and 1–16-character IDs; both re-reviews have zero
remaining findings. Six focused DB tests and HTTP validation pass. Full checks
are being refreshed. The reviewed migration is staged at query
69038fae-191b-4dbb-8e99-7ff1b3ab70c9; browser warning approval is requested.
No hosted correction capability is claimed yet. Review: docs/reviews/ticket12.md.

Final local checks through acd3c92: 118 backend tests via project Python,
46 web tests, build/typecheck and lint pass. Both independent re-reviews have
zero remaining findings. Migration warning approval remains pending; the hosted
API/browser acceptance helper is prepared but has not run. GitHub #12 stays open.
Native/iOS and its tracker remain untouched.


## Persistent saved-topic corrections — planned 11 / GitHub #12, 2026-10-04

Status: **complete with hosted development acceptance**. User-approved migration
202610040008_topic_corrections.sql applied successfully. Atomic owned corrections,
server-only rules/overrides, rejection precedence, owner-before-row worker locks,
current-evidence graph rebuilds and membership overview fences are implemented.
Original notes and exact references are preserved; surviving corrections remain
authoritative through automatic writes and source deletion.

- Local: 118 backend tests, 46 web tests, build/typecheck and lint; both independent
  Standards and Spec re-reviews have zero remaining findings through acd3c92.
- Hosted API: owned rename/merge/assign/decisions, cross-learner/direct-ledger
  denial, preserved original JSON, stale overview hiding, later service
  completion retention and deletion cascades pass.
- Browser: rename/reload, merge/rejection precedence, accept/reject/reload,
  assignment removal/addition/reload and exact PDF page/video time citations
  pass. Merged-topic synthesis succeeded on attempt 1; changing its assignment
  hid the old overview with explicit changed-source feedback.
- All controlled fixtures, overrides, queues, overviews and scoped correction
  ledgers were removed and verified. Browser reload reflects removal. Deletion
  itself used authenticated API/scoped REST, not a new UI confirmation flow.
- Controlled fictional saved material only; desktop acceptance, production
  unconfigured. Sequential after-claim checks and lock-order review support the
  race fix; deterministic concurrent overlap is untested. Existing bundle and
  deprecation warnings/stale bare launchers remain.

Both web records and GitHub #12 synchronized. Setup/review:
`docs/topic-corrections-setup.md`, `docs/reviews/ticket12.md`. Native/iOS and
`context/progress-tracker.md` unchanged by this unit. Commits remain local.
Next draft: planned 12, reuse/versioned refresh; not started.


## Source reuse/versioned refresh selected — planned 12 / #13, 2026-10-04

Target slice only. Published #13 with native blocking links to completed #3, #5
and #12. Existing duplicate URL shortcuts reopen without comparing current
content; upload digests already reuse identical files. Selected implementation
will add explicit comparison/confirmation, immutable saved captures/notes and a
stable source identity with worker/reader version fences. Corrections whose
evidence disappeared will be retained for learner review rather than linked to
unrelated new passage numbers. No new implementation, tests or hosted migration
yet. The TDD skill requires agreement on the proposed API/external HTTP/database/
browser seams. Both web records updated; native/iOS and its tracker untouched.
Scope: docs/source-revisions-setup.md.


### Versioned refresh implementation checkpoint — #13

The user agreed API, external HTTP, database ownership/version/worker and browser
seams. Local RED→GREEN tracers pass for unchanged comparison, staged replacement,
explicit refresh/archive, ownership, stale study leases, correction evidence
review, unique-excerpt reanchoring, PDF aliases, stale confirmation and rollback.
Browser adds source versions/refresh, a reviewable comparison and archived exact
citations. Current reader rejects mismatched note versions; source recall state
and stale topic/evidence cache are cleared on refresh. Full checks pass: 122 backend and 55 web tests, web build/typecheck and lint.
Independent review fixes are being checked; no hosted migration/acceptance claimed. Native/iOS untouched.


### #13 independent review fixes

Standards: delayed correction responses could restore obsolete graph state; a
completed refresh could close a newer dialog. Spec: review lost newly generated
connections; before/after previews omitted changed page/cue locations. Fixed all
four: generation-guard mutation reads, preserve late authoritative cache updates
without closing unrelated dialogs, retain only current-capture relationships
between reviewed topics, and display page/cue boundaries with excerpts. The
connection regression failed first and now passes at the database seam. Refreshed
full checks pass: 122 backend, 55 web, build/typecheck and lint. Independent
re-review pending; hosted migration not applied.


### #13 review complete / migration execution approval pending

Implementation 07895b8 and fixes 08d4835: 122 backend tests, 55 web tests, web
build/typecheck and lint pass. Both independent re-reviews have zero findings.
Reviewed SQL is staged at 2f6e3734-be16-4f73-a85c-c4d047815618 and exact editor
text matches the local migration. Automatic approval review blocked Run because
previous approvals did not cover this migration. Fresh execution approval asked;
no hosted schema execution or acceptance claimed. Hosted API helper prepared.
GitHub #13 stays open. Native/iOS and its tracker untouched.


## Paused checkpoint — ticket #13, 2026-10-04

Paused at the user's explicit request. Approved migration
202610040009_source_revisions.sql applied successfully in Supabase query
2f6e3734-be16-4f73-a85c-c4d047815618. Hosted API checks passed unchanged reuse,
staged promotion, archive equality, ownership/private-table denial, stale study
and topic leases, stale overview hiding, unique evidence reanchoring, renamed
assignments, retained-evidence review, current relationships, rejected decisions
and independent-source counts. Controlled correction/import API fixtures were
cleaned and their cascades verified.

Browser passed unchanged transcript comparison, timestamp-only changes, decline,
confirmed video/PDF refresh, exact original/current cue and PDF page citations,
current-evidence review and reload persistence. Real note and topic workers ran.
PDF acceptance caught missing origin in refreshed extraction: fix 2bf070f adds
explicit upload/direct origins and safe validation messages; regression failed
first then passed. Latest backend: 123 tests pass. Prior web: 55 tests, build,
typecheck and lint pass; no frontend change after those checks. Both independent
review axes report zero remaining findings through 2bf070f.

Pending on resume: inspect the last repeated-video import result; clean remaining
controlled fixtures listed in /private/tmp/revisions-fixture-ids.json and
/private/tmp/revisions-browser-ids.json with their scoped derived rows; verify
post-removal browser state; finish docs/GitHub #13 closeout. Do not touch the
user's real note 79b1b905-ebeb-4896-84bc-d55f395070ce. SQL/test tabs 24/25 retained
for resume. API and current worker remain running. GitHub #13 stays open.
Native/iOS and its tracker untouched.


## Source reuse and versioned refresh — planned 12 / GitHub #13, 2026-10-04

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


## Long sources selected — planned 13 / #14, 2026-10-04

Inspected capture limits, exact page/cue metadata, source identity/version reuse,
worker claims/leases, note synthesis and browser import/readers. Published #14
with completed #3/#5/#13 dependencies. Target: bounded whole-capture section
processing with saved progress/retry, validated original page/time selection,
and coherent final notes with exact citations. Existing partial/unknown coverage
must remain honest. New capture/processing limits will be published and enforced;
no native/iOS change. The implement/TDD skills require agreement on test boundaries
before tests; authenticated import/range API, external capture/model HTTP,
database ownership/progress/worker fences and browser flows were proposed.
Implementation, checks, review, migration and hosted acceptance have not started.
See docs/long-source-setup.md for the selected target and implementation plan.


### Long sources local implementation — #14

The user approved the proposed API, external HTTP, database and browser seams.
Whole browser captures now allow 120,000 characters; each model call stays bounded.
Validated original pages/timed overlapping cues, private version-bound section
checkpoints, retry/resume, final all-section synthesis and browser range/progress
controls are implemented locally. Focused red/green checks pass; 140 backend tests
pass. Initial web suite 60/61 exposed an obsolete Unicode limit assertion, now
corrected with focused checks passing. Build/typecheck/lint pass. Final web rerun,
independent review, migration and hosted acceptance pending. GitHub #14 remains
open; native/iOS and its tracker unchanged. Setup: docs/long-source-setup.md.


### Long sources review complete — #14

Implementation `7816966` plus review fixes `4aa30d9`: 142 backend tests, 61 web
tests, build/typecheck/lint pass. Standards and spec reviews against `3c984fc`
report no remaining findings. Dense supported transcripts fit the section budget;
short-source retries preserve original passage evidence. Migration 010 is staged
in Supabase with the destructive-operation warning awaiting user approval; not
applied. Hosted worker/model/browser acceptance and controlled cleanup remain
pending. GitHub #14 stays open. Native/iOS and its tracker untouched.
