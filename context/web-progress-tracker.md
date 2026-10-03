# Web Progress Tracker

## Current status — 2026-10-03

**Verified MVP:** planned tickets 01–04 are complete with hosted development
acceptance. GitHub #1/#2/#3/#5 cover articles, structured notes, selectable-text
PDFs and supplied video transcripts; extra #4 covers citation/title polish.

**Current unit:** planned ticket 05, accessible automatic YouTube transcript
import with upload/paste fallback. Selected by the user and published as [GitHub #6](https://github.com/CloudKai/secondBrain/issues/6).
The authenticated API and public-caption HTTP boundary have an initial passing
controlled fixture. A real public retrieval returned 286 cues / 18,430 characters;
hosted persistence and browser acceptance remain pending. Automatic import is not yet a verified end-to-end capability.

**Current local checks:** 102 backend tests, 30 web tests, build/typecheck and
lint pass for ticket 05. **Latest hosted completed checks:** 93 backend tests,
28 web tests, build/typecheck and
lint; hosted supplied-transcript generation, browser citations/reload and ownership
checks passed. Phone-width verification for that slice was unavailable because
the viewport override remained at desktop width.

**Target behavior:** provider-specific automatic access, saved-source topics,
combined overviews, persistent corrections, refresh/ranges and assistant/research
remain planned. Example UI does not establish live service acceptance.

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
