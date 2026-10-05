# Web learning-library ticket breakdown

Last synchronized: **2026-10-05 (Asia/Singapore)** against GitHub Issues and
completed acceptance records in `context/web-progress-tracker.md` and `scope.md`.

## Progress at a glance

**Verified MVP:** planned tickets **01–15 are complete** (15 of 15 slices), including
development acceptance. GitHub issues **#1–#16 are closed**; #4 is an extra
citation/title-polish task, so planning numbers and GitHub numbers differ.

**Last completed:** planned ticket **15**, live reliable-resource discovery and explicit saving — [GitHub #16](https://github.com/CloudKai/secondBrain/issues/16).

**Current unit:** none; the original 15-slice web plan is complete.

**Target behavior:** private recording-provider access, PDF OCR, linked accounts
and production deployment remain planned. Saved-note assistant answers and live
external research are verified; example-note assistant remains a preview. YouTube
support requires anonymously accessible English captions; private provider access
remains planned.

| Planned ticket | Work | Status | GitHub / evidence |
| --- | --- | --- | --- |
| 01 | Save and reopen articles | Complete; local + hosted acceptance | [#1](https://github.com/CloudKai/secondBrain/issues/1), [implementation](ticket01-implementation.md) |
| 02 | Structured article notes and evidence | Complete; local + hosted acceptance | [#2](https://github.com/CloudKai/secondBrain/issues/2), [setup](../study-note-setup.md), [review](../reviews/ticket02.md) |
| 03 | Selectable-text PDF uploads and links | Complete; local + hosted acceptance | [#3](https://github.com/CloudKai/secondBrain/issues/3), [setup](../pdf-study-setup.md), [review](../reviews/ticket03.md) |
| 04 | Supplied video transcripts | Complete; local + hosted acceptance | [#5](https://github.com/CloudKai/secondBrain/issues/5), [setup](../video-transcript-setup.md) |
| Extra | Circular mint citations and PDF topic title | Complete; browser inspection + typecheck/lint | [#4](https://github.com/CloudKai/secondBrain/issues/4) |
| 05 | Accessible YouTube transcripts | Complete; local + hosted acceptance | [#6](https://github.com/CloudKai/secondBrain/issues/6), [setup](../youtube-transcript-setup.md), [review](../reviews/ticket06.md) |
| 06 | Teams transcript access and feedback | Complete; local + hosted supplied-transcript acceptance | [#7](https://github.com/CloudKai/secondBrain/issues/7), [setup](../teams-transcript-setup.md), [review](../reviews/ticket07.md) |
| 07 | Zoom transcript availability and feedback | Complete; local + hosted supplied-transcript acceptance | [#8](https://github.com/CloudKai/secondBrain/issues/8), [setup](../zoom-transcript-setup.md), [review](../reviews/ticket08.md) |
| 08 | Panopto caption access and fallback | Complete; local + hosted supplied-input acceptance | [#9](https://github.com/CloudKai/secondBrain/issues/9), [setup](../panopto-transcript-setup.md), [review](../reviews/ticket09.md) |
| 09 | Saved-source topic cards and graph | Complete; local + hosted acceptance | [#10](https://github.com/CloudKai/secondBrain/issues/10), [setup](../topic-graph-setup.md), [review](../reviews/ticket10.md) |
| 10 | Synthesized topic overviews and source branches | Complete; local + hosted acceptance | [#11](https://github.com/CloudKai/secondBrain/issues/11), [setup](../topic-overview-setup.md), [review](../reviews/ticket11.md) |
| 11 | Persistent topic corrections and consistent removal | Complete; local + hosted acceptance | [#12](https://github.com/CloudKai/secondBrain/issues/12), [setup](../topic-corrections-setup.md), [review](../reviews/ticket12.md) |
| 12 | Reuse and versioned refresh | Complete; local + hosted acceptance | [#13](https://github.com/CloudKai/secondBrain/issues/13), [scope](../source-revisions-setup.md) |
| 13 | Long sources and page/time range selection | Complete; local + hosted acceptance | [#14](https://github.com/CloudKai/secondBrain/issues/14), [scope](../long-source-setup.md) |
| 14 | Grounded assistant with selectable scopes | Complete; local + hosted acceptance | [#15](https://github.com/CloudKai/secondBrain/issues/15), [setup](../assistant-setup.md), [review](../reviews/ticket15.md) |
| 15 | Live reliable-resource discovery and explicit saving | Complete; local + hosted development acceptance | [#16](https://github.com/CloudKai/secondBrain/issues/16), [setup](../research-discovery-setup.md), [review](../reviews/ticket16.md) |

Latest completed checks: **188 backend tests, 66 web tests, web build/typecheck
and lint**. The provider replacement uses OpenAI search and direct public fetch;
TinyFish is not used. Independent standards/spec reviews pass through `a5491c3`;
the replacement review is recorded in the setup/review documents.
Real discovery/auth/storage checks and browser explicit article saving through
the model/worker/topic pipeline pass. Extensionless PDF discovery/save is checked
at the API HTTP boundary. Unsaved results leave library/graph unchanged;
controlled sources cleaned. No migration for #16. Desktop development acceptance
only; native/iOS remains unchanged.

GitHub Issues for `CloudKai/secondBrain` hold published acceptance checklists and
completion comments. This document maps them to the original 15-slice plan;
`context/web-progress-tracker.md` records web checks, and `scope.md` records decisions.
Update this overview and the relevant acceptance checkboxes when a slice closes.

## Post-plan improvements

| Work | Status | Ticket and scope |
| --- | --- | --- |
| Complete-thought citation passages and caption grouping | Implemented locally; review and migration 012 activation pending | [#17](https://github.com/CloudKai/secondBrain/issues/17), [spec](citation-passages.md), [setup](../citation-passages-setup.md) |

Citation work passes 198 backend and 68 web tests plus web build/typecheck/lint.
The original 15 slices above remain development-complete.

## Supplied UI/UX and implementation baseline

The product specification in `context/learning-library-design.md` is confirmed.
The user supplied the UI/UX in `web/src` on 2026-10-02. Source inspection covers
the existing library, reading workspace, Topic/Graph/Sources panel, topic
correction controls, assistant scope buttons, and curated reading list. Extend
this separate React/TypeScript/Vite frontend using its current design. Preserve
the native application and its existing API contract.

Published implementation slices use `ready-for-agent` with native GitHub blocking
relationships. Tickets 01–15 were selected by the user and completed.
No production hosting provider or recording-provider account connection is selected.

### Original handoff baseline — historical, 2026-10-02

At handoff the article adapter used the synchronous four-point API; library state
and corrections reset on reload, topic connections represented co-coverage, the
assistant retrieved stored example note text, and discovery was curated.

### Current verified browser behavior — 2026-10-05

Articles, selectable-text PDFs, accessible English YouTube captions and supplied
video transcripts now use owned,
persistent captures and asynchronous structured notes with inspectable evidence.
Saved-source topic mapping, explained graph connections, placement confirmation,
on-demand cited combined overviews, separate source branches and durable topic
corrections/removal are verified. The saved-note assistant answers from current
note/topic/library evidence with exact citations and evidence-gap feedback. Its
conversation resets on reload/reopen. The reading list supports explicit live
research, checked original links and article/PDF saves. External results stay
separate from saved evidence; the example-note assistant remains a preview.
Supplied transcript links do not retrieve or watch recordings. Whole/selected captures with original page/time ranges and resumable section
processing are verified. PDF OCR and automatic Teams/Zoom/Panopto retrieval remain planned.
Unchanged imports reuse saved sources; explicit versioned refresh preserves prior
captures/notes and retains learner corrections with current supporting evidence.

Each ticket is an end-to-end slice with acceptance checks. Provider tickets
validate available access paths and the transcript fallback; they do not
promise that every playable video URL provides downloadable captions.

## Implementation slices — status recorded per ticket

## 01: Save and reopen a public article in the browser library

**Status:** Complete — verified locally and against hosted development storage on 2026-10-03.

**GitHub:** [#1 — closed](https://github.com/CloudKai/secondBrain/issues/1)

**Label:** `ready-for-agent`

**Completion:** Anonymous article save/list/reopen, capture provenance, hosted ownership isolation and the native/v1 contract passed. Evidence: [ticket01-implementation.md](ticket01-implementation.md).

### What to build

A learner uses the supplied web design to save a public article, inspect its captured source, and reopen it after reloading.

### Acceptance criteria

- [x] Extend the supplied browser library and reading workspace, preserving its design and mapping the new states to the confirmed behavior.
- [x] The existing native iPhone app and its public API contract are preserved.
- [x] An anonymous learner can save, list, and reopen an owned source without a signup wall; persisted records are isolated between learners.
- [x] Capture preserves source identity, original URL, captured text, and capture time. Bounded extraction reports unavailable or incomplete content accurately.
- [x] The source viewer and submission controls show accurate article support, actionable errors, and a clear pending-study-note state.
- [x] Browser checks and backend ownership, validation, and legacy-contract checks pass.

### Blocked by

None. Completed as [GitHub #1](https://github.com/CloudKai/secondBrain/issues/1).

## 02: Generate a structured article study note with inspectable evidence

**Status:** Complete — verified locally and against hosted development storage on 2026-10-03.

**GitHub:** [#2 — closed](https://github.com/CloudKai/secondBrain/issues/2)

**Label:** `ready-for-agent`

**Completion:** Structured read-only notes, exact passage citations, reload, bounded retries, Redis outage and interrupted-worker recovery passed. Evidence: [study-note setup](../study-note-setup.md) and [independent review](../reviews/ticket02.md).

### What to build

A saved article becomes a persistent English study note with source references the learner can inspect in the reading workspace.

### Acceptance criteria

- [x] The note contains an overview, substantive concept explanations, relevant examples or equations, and recall questions; it is not constrained to four bullets.
- [x] Clicking a citation opens its supporting captured excerpt and an Open original action. Generated references must resolve to actual captured material.
- [x] Persisted processing status, bounded retries, and actionable terminal errors are visible; a failed provider call never produces a fabricated completed note.
- [x] The accepted item and processing dispatch are durable and idempotent; retries do not duplicate notes or lose accepted work.
- [x] Completed notes remain read-only and reopen after reload; model/provider credentials remain server-only.
- [x] Deterministic backend checks cover structured output, citation validation, failures, and retry behavior; browser checks cover the note-to-evidence flow.

### Blocked by

- Planned ticket 01: Save and reopen a public article in the browser library — [GitHub #1](https://github.com/CloudKai/secondBrain/issues/1), complete

## 03: Create study notes from selectable-text PDF uploads and links

**Status:** Complete — verified locally and against hosted development storage on 2026-10-03.

**GitHub:** [#3 — closed](https://github.com/CloudKai/secondBrain/issues/3)

**Label:** `ready-for-agent`

**Completion:** Upload and public PDF-link generation, physical page citations/reload, published limits, unsupported inputs, digest reuse and ownership isolation passed. Evidence: [PDF setup](../pdf-study-setup.md) and [independent review](../reviews/ticket03.md).

### What to build

A learner uploads a PDF or submits its URL and reads a structured study note with real page evidence.

### Acceptance criteria

- [x] Both upload and URL capture use the same owned-source and note workflow.
- [x] Extracted text retains original page identity, and citations open the supporting page excerpt after reload.
- [x] Supported-size PDFs are processed with accurate coverage; limits are published and enforced.
- [x] Scanned-only or unreadable PDFs receive an actionable unsupported-source message rather than an invented note.
- [x] The source-support message accurately describes selectable-text PDF support.
- [x] Backend and browser checks cover upload, URL, page references, ownership, and unsupported files.

### Blocked by

- Planned ticket 02: Generate a structured article study note with inspectable evidence — [GitHub #2](https://github.com/CloudKai/secondBrain/issues/2), complete

## 04: Create video study notes from uploaded or pasted transcripts

**Status:** Complete — verified locally and against hosted development storage on 2026-10-03.

**GitHub:** [#5 — closed](https://github.com/CloudKai/secondBrain/issues/5)

**Label:** `ready-for-agent`

**Completion:** Browser VTT upload and untimed paste generated persistent notes. Supplied times/speakers, exact citations, reload, SRT zero time, Teams context, Panopto reuse and learner isolation passed. Evidence: [transcript setup and review record](../video-transcript-setup.md). YouTube start-time links are implemented; other platforms show supplied times and open the original without seeking.

### What to build

A learner supplies a video link plus transcript text or a transcript file and receives a video-linked study note.

### Acceptance criteria

- [x] YouTube, Teams, Zoom, and Panopto video links can be retained as source context without a provider account connection.
- [x] Timed and untimed transcript inputs are supported through published upload formats and paste controls; exported lecture transcripts have an actionable text fallback.
- [x] Real timestamps are preserved and can open the relevant original-video moment where the platform supports it; untimed material cites excerpts.
- [x] The app identifies the transcript as user-supplied and does not imply it retrieved or watched the video.
- [x] Missing, invalid, or unreadable transcript input receives a clear correction path.
- [x] Backend and browser checks cover timed uploads, untimed paste, original-video identity, and provenance.

### Blocked by

- Planned ticket 02: Generate a structured article study note with inspectable evidence — [GitHub #2](https://github.com/CloudKai/secondBrain/issues/2), complete

## 05: Import accessible YouTube transcripts with a reliable fallback

**Status:** Complete — verified locally and against hosted development storage on 2026-10-03.

**GitHub:** [#6 — closed](https://github.com/CloudKai/secondBrain/issues/6)

**Label:** `ready-for-agent`

### What to build

A learner submits a YouTube URL and gets a note from an accessible transcript or an immediate upload/paste path.

### Acceptance criteria

- [x] Automatic retrieval uses a validated accessible method without asking the learner to connect a YouTube account.
- [x] Support is demonstrated with an accessible-caption fixture; a public playable URL is not assumed to authorize the official caption-download API.
- [x] The import preserves transcript origin and real timing, then uses the existing video-note flow.
- [x] Unavailable, blocked, or missing captions show the transcript fallback without claiming successful automatic retrieval.
- [x] Provider support copy reflects validated capabilities.
- [x] Adapter checks and a browser flow verify retrieval success and unavailable-transcript fallback.

### Verification

Real public captions: 286 cues / 18,430 characters; generated note, exact cue
citations, canonical reuse and reload passed. Missing/unavailable access retained
URL/title and opened fallback; supplied VTT then generated a note. Second-learner
API/REST/RPC access was denied. 103 backend tests, 30 web tests, build/typecheck
and lint pass; reviews have no remaining material findings. YouTube availability
remains conditional; no account/cookie/bypass/audio-video flow was added.

### Blocked by

- Planned ticket 04: Create video study notes from uploaded or pasted transcripts — [GitHub #5](https://github.com/CloudKai/secondBrain/issues/5), complete

## 06: Handle Teams recording transcripts and access feedback

**Status:** Complete — local and hosted supplied-transcript acceptance passed on 2026-10-03; independent review complete.

**GitHub:** [#7 — closed](https://github.com/CloudKai/secondBrain/issues/7)

**Label:** `ready-for-agent`

**Already verified from ticket 04:** Teams/SharePoint recording context and supplied TXT/VTT/SRT or pasted text are supported. Microsoft’s documented API requires authorization this app does not have. No anonymous access path is validated; this slice adds accurate permission/export feedback and verifies the supplied-transcript path.

**Completion:** Teams/SharePoint context immediately opens permission/export guidance and upload/paste. Controlled VTT and readable-text paste generated saved notes with actual speaker/times or untimed evidence; reload, reuse, exact references and ownership checks passed. No automatic Teams retrieval is advertised. These checks do not probe a real private recording. [Setup and acceptance](../teams-transcript-setup.md); [independent review](../reviews/ticket07.md).

### What to build

A learner submits a Teams recording and can use an accessible transcript or supply an export without connecting an account.

### Acceptance criteria

- [x] Recognized recording links retain the original Teams source identity.
- [x] Retrieve a transcript only through an independently validated accessible path; do not introduce Graph account connections or admin-consent setup.
- [x] Where transcript access requires permissions the app does not have, explain the limitation and open upload/paste controls.
- [x] Exported transcripts retain only their actual text, speaker information, and times; supported export formats are described accurately.
- [x] Automatic support is advertised only for access paths demonstrated with a fixture.
- [x] Provider and browser checks cover accessible transcript input, restricted recordings, and export fallback.

### Blocked by

- Planned ticket 04: Create video study notes from uploaded or pasted transcripts — [GitHub #5](https://github.com/CloudKai/secondBrain/issues/5), complete

## 07: Handle Zoom recording transcripts and availability states

**Status:** Complete — local and hosted supplied-transcript acceptance passed on 2026-10-03; independent review complete.

**GitHub:** [#8 — closed](https://github.com/CloudKai/secondBrain/issues/8)

**Label:** `ready-for-agent`

**Already verified from ticket 04:** Zoom recording context and supplied transcript capture preserve actual text/times. Zoom’s documented transcript download requires authorization this app lacks; no anonymous path is validated. This slice adds app-level export guidance and conditional availability feedback, without claiming to inspect the specific recording’s status.

**Completion:** Zoom share/play context immediately opens upload/paste and cloud VTT export instructions, with conditional availability guidance. No specific recording state is inferred; a playback URL/passcode is not proof of download permission. Controlled VTT/text notes, exact references, timing/speaker retention, reload/reuse and ownership checks passed. No automatic Zoom retrieval is advertised. [Setup and acceptance](../zoom-transcript-setup.md); [review](../reviews/ticket08.md).

### What to build

A learner submits a Zoom recording and obtains a transcript-backed note or a clear export fallback.

### Acceptance criteria

- [x] Recognized recording links retain the original Zoom source identity.
- [x] Automatic transcript retrieval is limited to a validated accessible path with no Zoom account connection.
- [x] Missing, processing, restricted, expired, or deleted transcript states lead to accurate feedback and the upload/paste fallback.
- [x] Available transcript times are retained, with source evidence linked to the supplied or retrieved transcript.
- [x] A shared playback URL or password alone is not treated as proof of transcript download permission.
- [x] Provider and browser checks cover accessible transcript input and the relevant fallback states.

### Blocked by

- Planned ticket 04: Create video study notes from uploaded or pasted transcripts — [GitHub #5](https://github.com/CloudKai/secondBrain/issues/5), complete

## 08: Handle Panopto lecture transcripts with tenant-aware fallback

**Status:** Complete — local checks, hosted supplied-transcript acceptance and independent review passed on 2026-10-03.

**GitHub:** [#9 — closed](https://github.com/CloudKai/secondBrain/issues/9)

**Label:** `ready-for-agent`

**Already verified from ticket 04:** Panopto tenant/session identity, supplied transcripts and real cue times are supported; display-parameter variants reuse the capture. No anonymous caption-download path for a concrete session is validated. This slice adds site-specific supplied-transcript guidance without claiming to inspect a lecture’s permissions or availability.

**Completion:** Site-specific guidance, unreadable-export correction, hosted SRT/paste notes, exact timed/untimed citations, reload/reuse and ownership checks passed. Automatic retrieval remains unvalidated and unavailable. [Setup and evidence](../panopto-transcript-setup.md). Both reviews found no material issues; one optional rendering refactor was recorded. Controlled captures and note/job rows were removed with cascade verified. [Review](../reviews/ticket09.md).

### What to build

A learner submits a Panopto lecture and gets a note from accessible captions or a transcript they supply.

### Acceptance criteria

- [x] Recognized lecture links preserve the original session identity and institution context where available.
- [x] A caption download is attempted only through a validated accessible path without connecting institutional accounts.
- [x] Tenant restrictions, unavailable captions, and unreadable exports produce an actionable upload/paste path.
- [x] Actual caption times are retained; untimed text cites excerpts.
- [x] Validate any automatic capability against a concrete accessible session before advertising it.
- [x] Provider and browser checks cover session recognition, supplied captions, and conditional restricted-lecture fallback guidance. Controlled fixtures do not establish automatic/private access.

### Blocked by

- Planned ticket 04: Create video study notes from uploaded or pasted transcripts — [GitHub #5](https://github.com/CloudKai/secondBrain/issues/5), complete

## 09: Build topic cards and a source-driven graph

**Status:** Complete — implementation, independent review and hosted development acceptance passed. Closeout synchronized 2026-10-04.

**GitHub:** [#10 — closed](https://github.com/CloudKai/secondBrain/issues/10)

**Label:** `ready-for-agent`

**Current progress:** Completed notes queue separate evidence-backed topic mapping. Clear contextual aliases share identities; uncertain placements remain distinct until learner confirmation. The approved migration is applied and the worker is running. Hosted checks passed empty/first-source thresholds, real-model RAG matching, unrelated calculus, ownership, placement persistence and original-note preservation. Browser checks passed exact passages, reload, saved/example history, and a seven-topic focus view. The relationship display used a controlled supported relation; model extraction and mention filtering also have HTTP boundary checks. Six disposable sources were removed with cascades verified. Final checks: 113 backend tests, 34 web tests, build/typecheck and lint. Both reviews have no remaining findings; native/iOS and its tracker remain unchanged.

### What to build

Saved notes produce topic cards, and related independent sources form an explorable map with explained connections.

### Acceptance criteria

- [x] An empty library has no prepared outline. The first completed source produces concise topic cards.
- [x] Extract main and substantive supporting topics; passing mentions do not imply meaningful coverage.
- [x] Shared topics are canonicalized when context is clear; uncertain placement is presented for learner correction.
- [x] A graph emerges after at least two independent saved sources support a shared substantive topic or explained relationship such as uses, requires, or evaluates.
- [x] Topic nodes remain distinct from sources; broad subject groups can overlap without implying unsupported direct relationships.
- [x] Each connection explains its basis, and saved-material coverage is not presented as mastery.
- [x] Graph data and any derived retrieval index are learner-scoped; source records remain authoritative.
- [x] Checks cover related and unrelated notes, aliases, uncertainty, source-count thresholds, and topic navigation.

### Blocked by

- Planned ticket 02: Generate a structured article study note with inspectable evidence — [GitHub #2](https://github.com/CloudKai/secondBrain/issues/2), complete

## 10: Offer combined overviews and separate source branches

**Status:** Complete — local checks, independent review and hosted development acceptance passed on 2026-10-04.

**GitHub:** [#11 — closed](https://github.com/CloudKai/secondBrain/issues/11)

**Current progress:** The approved migration is applied and the worker runs. Combine explicitly generates attributed synthesis and disagreements; Keep separate shows original branches. Both choices persist after reload, topic words open the panel, and exact PDF/video citations retain original passages. Mixed certainty requires confirmation. Hosted API checks passed ownership, queue idempotence, preserved originals and stale-result hiding. Final model API/browser runs succeeded on attempt 1. 117 backend tests, 39 web tests, build/typecheck and lint pass; both reviews have zero remaining findings. Fictional controlled fixtures were removed with cascades verified. [Setup](../topic-overview-setup.md), [review](../reviews/ticket11.md). Native/iOS and its tracker remain unchanged.

**Label:** `ready-for-agent`

### What to build

A learner compares overlapping material through a combined topic overview or individual source-note branches under the same topic.

### Acceptance criteria

- [x] Same-topic overlap is explained, with explicit Combine and Keep separate choices.
- [x] Combine opens a synthesized topic overview with supporting references and preserved disagreements.
- [x] Keep separate reveals source-note branches under one parent topic; branch types are visibly distinct from primary topic nodes.
- [x] Both views retain each original note and its references, and the learner's view choice survives reload.
- [x] Clicking a topic word opens the corresponding topic overview in the contextual panel.
- [x] Checks cover same-topic sources, conflicting claims, view switching, and reference preservation.

### Blocked by

- Planned ticket 09: Saved-source topic graph — [GitHub #10](https://github.com/CloudKai/secondBrain/issues/10), complete

## 11: Correct topic organization and remove sources consistently

**Status:** Complete — local and hosted development acceptance passed 2026-10-04.

**GitHub:** [#12 — closed](https://github.com/CloudKai/secondBrain/issues/12)

**Completion:** Durable rename/merge, assignment overrides and accepted/rejected connections, original-note preservation, current-evidence graph/overview updates, worker correction/deletion fences and hosted ownership passed. Approved migration applied; browser reload/PDF/video citations and stale overview feedback verified. Controlled fixtures/ledgers cleaned. 118 backend tests, 46 web tests, build/typecheck/lint; both independent re-reviews have no remaining findings. [Setup](../topic-corrections-setup.md), [review](../reviews/ticket12.md). Native/iOS and its tracker unchanged.

**Label:** `ready-for-agent`

### What to build

A learner fixes topic names, duplicates, assignments, or connections and deletes sources without leaving misleading overviews.

### Acceptance criteria

- [x] Allow topic rename, duplicate-topic merge, source-topic assignment correction, and connection acceptance or rejection.
- [x] Preserve source notes during organizational changes, including notes attached to multiple topics.
- [x] Update affected topic overviews and graph connections after a correction or deletion.
- [x] Remove citations to deleted material and preserve learner corrections for surviving material.
- [x] Future automatic comparison respects prior corrections and rejected connections; stale processing cannot recreate deleted source content.
- [x] Checks cover merge, reassignment, rejection, cross-topic membership, deletion, and persisted corrections.

### Blocked by

- Planned ticket 10: Combined overviews and source branches — [GitHub #11](https://github.com/CloudKai/secondBrain/issues/11), complete

## 12: Reuse repeated sources and refresh changed material

**Status:** Complete with hosted development acceptance on 2026-10-04.

**GitHub:** [#13 — closed](https://github.com/CloudKai/secondBrain/issues/13)

**Verified:** Unchanged capture/location reuse, explicit comparison/refresh,
version-bound read-only archives, stable identity/PDF aliases, worker fences,
current-evidence correction review and one independent source across versions.
123 backend tests, 55 web tests, build/typecheck and lint pass. Both review axes
have zero findings; approved migration, hosted API/browser and cleanup pass.
[Acceptance record](../source-revisions-setup.md), [review](../reviews/ticket13.md).

### What to build

Repeated imports reuse existing material, while changed sources can refresh their notes without losing corrected organization.

### Acceptance criteria

- [x] Detect unchanged supported article, PDF, and transcript-backed video imports and reuse the captured source.
- [x] Offer an explicit refresh when content differs rather than silently replacing a captured note.
- [x] Keep source references tied to the exact captured version used for generation.
- [x] Rebuild affected notes, overviews, and connections while retaining learner corrections.
- [x] Repeated imports and source revisions do not inflate the graph's independent-source threshold.
- [x] Checks cover unchanged imports, changed content, version-bound citations, and correction preservation.

### Blocked by

- Planned ticket 03: Create study notes from selectable-text PDF uploads and links — [GitHub #3](https://github.com/CloudKai/secondBrain/issues/3), complete
- Planned ticket 04: Create video study notes from uploaded or pasted transcripts — [GitHub #5](https://github.com/CloudKai/secondBrain/issues/5), complete
- Planned ticket 11: Correct topic organization and remove sources consistently — [GitHub #12](https://github.com/CloudKai/secondBrain/issues/12), complete

### Completion — 2026-10-04

Migration applied after approval. Desktop unchanged import, time/page comparison,
decline/confirmation, archived/current citations, evidence review and reload pass.
Scoped test sources and derived records removed; real note preserved. Native/iOS
untouched. Bounded captures/versions only; ranges and production remain planned.

## 13: Process long sources with range selection and honest coverage

**Status:** Complete — [GitHub #14](https://github.com/CloudKai/secondBrain/issues/14). Local and hosted acceptance pass; see [setup](../long-source-setup.md) and [review](../reviews/ticket14.md).

**Label:** `ready-for-agent`

**Verified:** bounded whole-capture sections, original page/time ranges, saved progress/retry, honest coverage and coherent exact citations. Migration and hosted acceptance pass; controlled fixtures cleaned.

### What to build

A learner processes a full supported article, PDF, or lecture, or selects a page/time range, and sees accurate progress and coverage.

### Acceptance criteria

- [x] Process the whole supported input by default in sections, with learner-visible progress.
- [x] Allow PDF page ranges and timed-video ranges; validate ranges against actual source locations.
- [x] Aggregate the selected sections into a coherent study note with references that retain original page or time locations.
- [x] Partial extraction or processing is clearly marked and does not claim whole-source completion.
- [x] Publish enforceable input limits and provide a usable correction path for unsupported input.
- [x] Retries do not duplicate source records, and section counts do not inflate independent-source counts.
- [x] Checks cover long inputs, selected ranges, section failures, coverage, and citation locations.

### Dependencies

- Planned ticket 03: Selectable-text PDFs — [GitHub #3](https://github.com/CloudKai/secondBrain/issues/3), complete
- Planned ticket 04: Supplied transcripts — [GitHub #5](https://github.com/CloudKai/secondBrain/issues/5), complete
- Planned ticket 12: Stable source/version identity — [GitHub #13](https://github.com/CloudKai/secondBrain/issues/13), complete

### Completion — 2026-10-04

Migration applied after user approval. Whole/selected captures, exact page/time
citations, progress reload, saved section retry, ownership and source identities
passed hosted API/model/worker/browser acceptance. Controlled fixtures removed;
existing learner note unchanged. Native/iOS untouched.

## 14: Answer questions using selectable note, topic, and library scopes

**Status:** Complete — local and hosted development acceptance on 2026-10-05.

**GitHub:** [#15 — closed](https://github.com/CloudKai/secondBrain/issues/15)

**Completion:** Current-note default, independent combined scopes, owned topic-first
retrieval, exact saved citations, changed-evidence rejection, unsupported gaps,
follow-up grounding and browser conversation/reset flows pass. Migration 011
applied; 161 backend/64 web tests and build/typecheck/lint pass, with no remaining
independent review findings. Controlled sources and dependent records cleaned.
[Setup](../assistant-setup.md), [review](../reviews/ticket15.md). Live research
remains planned 15; native/iOS and its tracker unchanged.

**Label:** `ready-for-agent`

### What to build

A learner uses suggested prompts or free text to ask a source-grounded study assistant about the current note and selected wider material.

### Acceptance criteria

- [x] Place the assistant beneath the notes and default to the current note.
- [x] Ask this topic and Ask my library buttons are selectable independently and together in the textbox.
- [x] Always include the current note; with both buttons selected, prioritize topic material and retrieve relevant library evidence without duplicate sources.
- [x] Answers cite the actual selected material and open evidence through the same source panel.
- [x] When material cannot support an answer, explain the gap and offer Find reliable sources.
- [x] Generate English answers, enforce learner isolation, and keep provider and retrieval operations on the backend.
- [x] Checks cover scope combinations, source attribution, unsupported questions, and cross-learner denial.

### Blocked by

- Planned 09: Topics/graph — #10, complete
- Planned 12: Stable source versions — #13, complete
- Planned 13: Bounded long-source evidence — #14, complete

## 15: Discover credible further-study resources and save selected sources

**Status:** Complete — [GitHub #16](https://github.com/CloudKai/secondBrain/issues/16), local and hosted development acceptance on 2026-10-05.

**Scope:** [Research discovery setup](../research-discovery-setup.md), [review](../reviews/ticket16.md). Approved TDD boundaries used; no migration.

**Label:** `ready-for-agent`

### What to build

A learner requests further research, inspects relevant papers or documents, and saves a selected result into the existing note-and-topic workflow.

### Acceptance criteria

- [x] Research runs only on learner request, including the assistant's Find reliable sources action.
- [x] Prioritize original papers, official documentation, and university teaching materials.
- [x] Show verified source links, author or organization, date, type, and relevance where available; label preprints and avoid invented metadata.
- [x] Let the learner open the original result and explicitly choose Save to my library.
- [x] Saving a public article or selectable-text PDF uses the existing capture, note, and topic-comparison flow; unsaved results do not change the library graph.
- [x] Distinguish discovered external material from saved-source evidence in the conversation.
- [x] Checks cover grounded results, missing metadata, explicit saving, and unchanged library state before saving.

### Blocked by

- Planned ticket 14: Answer questions using selectable note, topic, and library scopes — [GitHub #15](https://github.com/CloudKai/secondBrain/issues/15), complete
- Planned ticket 03: Create study notes from selectable-text PDF uploads and links — [GitHub #3](https://github.com/CloudKai/secondBrain/issues/3), complete

### Completion — 2026-10-05

Authenticated bounded Search/Fetch and public response-type checks, honest
metadata/preprints, safe redirects and blocked-page omission pass. Browser
article save generated a real cited note and four topics; unsupported assistant
questions prefill an editable research question without automatic searching.
Empty/partial results and original-link opening pass. API checks cover explicit
article/PDF saves, duplicate reuse and ownership. 182 backend/66 web tests and
build/typecheck/lint pass; both reviews clear. Controlled source/dependent rows
removed. Live browser PDF saving was not exercised for this slice; its capture
path is covered by the existing PDF acceptance and the new discovery API tests.
All 15 planned slices complete for development; production/native unchanged.


### TinyFish replacement complete — #16 (2026-10-05)

The user requested no TinyFish usage. `d465fd9` replaces research with OpenAI
Responses web search using the existing server-only key, plus direct public
HTML/plain-text/PDF verification. The configuration template no longer includes
a TinyFish key. Completed search tool URLs are validated; generated prose links
are ignored. Direct downloads retain DNS/TLS pinning, same-publisher redirects,
bounded bodies/deadlines and original metadata. Search never saves sources.

`a5491c3` corrects direct-page title provenance with API RED→GREEN coverage.
Both standards/spec reviews and final follow-ups have no remaining findings.
Final backend suite: 188 passed, including 27 discovery tests. The frontend is
unchanged; previous 66 tests/build/typecheck/lint remain valid. Hosted replacement
search verified six readable resources with unchanged library/topic reads;
browser documentation search returned six resources with zero sources/topics.
No replacement acceptance sources were created. Discovery verification is bounded
to 2 MB per source; the separate PDF capture form retains its 10 MB limit.

GitHub #16 and web setup/review/planning records updated for the current provider.
All original web slices remain development-complete. No migration. Production
acceptance remains unverified; native/iOS and its tracker untouched.
