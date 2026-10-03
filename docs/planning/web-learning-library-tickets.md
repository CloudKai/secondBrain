# Web learning-library ticket breakdown

Last synchronized: **2026-10-03 (Asia/Singapore)** against GitHub Issues and
completed acceptance records in `context/web-progress-tracker.md` and `scope.md`.

## Progress at a glance

**Verified MVP:** planned tickets **01–04 are complete** (4 of 15 slices), including
hosted development acceptance. GitHub issues **#1–#5 are closed**; #4 is an extra
citation/title-polish task, so planning numbers and GitHub numbers differ.

**In progress:** planned ticket **05**, automatic YouTube transcripts with fallback.

**Target behavior:** planned tickets **06–15 remain unpublished drafts**. Completed shared foundations are checked where they fully satisfy a criterion;
provider retrieval and other remaining criteria stay unchecked. Existing example
UI does not count as live target behavior.
The current selected slice is **05: Import accessible YouTube transcripts with a
reliable fallback**; the adapter and browser controls are implemented locally; hosted acceptance remains pending.

| Planned ticket | Work | Status | GitHub / evidence |
| --- | --- | --- | --- |
| 01 | Save and reopen articles | Complete; local + hosted acceptance | [#1](https://github.com/CloudKai/secondBrain/issues/1), [implementation](ticket01-implementation.md) |
| 02 | Structured article notes and evidence | Complete; local + hosted acceptance | [#2](https://github.com/CloudKai/secondBrain/issues/2), [setup](../study-note-setup.md), [review](../reviews/ticket02.md) |
| 03 | Selectable-text PDF uploads and links | Complete; local + hosted acceptance | [#3](https://github.com/CloudKai/secondBrain/issues/3), [setup](../pdf-study-setup.md), [review](../reviews/ticket03.md) |
| 04 | Supplied video transcripts | Complete; local + hosted acceptance | [#5](https://github.com/CloudKai/secondBrain/issues/5), [setup](../video-transcript-setup.md) |
| Extra | Circular mint citations and PDF topic title | Complete; browser inspection + typecheck/lint | [#4](https://github.com/CloudKai/secondBrain/issues/4) |
| 05 | Automatic YouTube transcripts | In progress; local checks pass, hosted acceptance pending | [#6](https://github.com/CloudKai/secondBrain/issues/6) |
| 06 | Teams transcript access and feedback | Draft; supplied-transcript foundations complete | Unpublished |
| 07 | Zoom transcript availability and feedback | Draft; supplied-transcript foundations complete | Unpublished |
| 08 | Panopto caption access and fallback | Draft; supplied-transcript foundations complete | Unpublished |
| 09 | Saved-source topic cards and graph | Draft; completed dependency 02 | Unpublished |
| 10 | Synthesized topic overviews and source branches | Draft; depends on 09 | Unpublished |
| 11 | Persistent topic corrections and consistent removal | Draft; depends on 10 | Unpublished |
| 12 | Reuse and versioned refresh | Draft; capture reuse exists, refresh remains planned | Unpublished |
| 13 | Long sources and page/time range selection | Draft; bounded capture exists, ranges remain planned | Unpublished |
| 14 | Grounded assistant with selectable scopes | Draft; example preview only | Unpublished |
| 15 | Live reliable-resource discovery and explicit saving | Draft; curated examples only | Unpublished |

Latest completed checks: **93 backend tests, 28 web tests, web build/typecheck and
lint**, plus hosted transcript generation, browser citations/reload, and ownership
checks. Test counts are from completed implementation work; this documentation
synchronization does not rerun tests. The latest browser viewport override stayed
at desktop width, so phone-width verification for ticket 04 is not claimed.
Native/iOS files were not changed by these web tickets. This is development
acceptance; production deployment is not configured.

GitHub Issues for `CloudKai/secondBrain` hold published acceptance checklists and
completion comments. This document maps them to the original 15-slice plan;
`context/web-progress-tracker.md` records web checks, and `scope.md` records decisions.
Update this overview and the relevant acceptance checkboxes when a slice closes.

## Supplied UI/UX and implementation baseline

The product specification in `context/learning-library-design.md` is confirmed.
The user supplied the UI/UX in `web/src` on 2026-10-02. Source inspection covers
the existing library, reading workspace, Topic/Graph/Sources panel, topic
correction controls, assistant scope buttons, and curated reading list. Extend
this separate React/TypeScript/Vite frontend using its current design. Preserve
the native application and its existing API contract.

Published implementation slices use `ready-for-agent` with native GitHub blocking
relationships. Tickets 01–04 were selected by the user and completed. Remaining
drafts keep their proposed labels and dependencies until selected for publication.
No production hosting provider or recording-provider account connection is selected.

### Original handoff baseline — historical, 2026-10-02

At handoff the article adapter used the synchronous four-point API; library state
and corrections reset on reload, topic connections represented co-coverage, the
assistant retrieved stored example note text, and discovery was curated.

### Current verified browser behavior — 2026-10-03

Articles, selectable-text PDFs and supplied video transcripts now use owned,
persistent captures and asynchronous structured notes with inspectable evidence.
Topic organization/corrections, combined overviews, model chat and live research
remain target work; their existing example UI is not live implementation.
Supplied transcript links do not retrieve or watch recordings. PDF OCR,
page/time ranges, source refresh and automatic provider retrieval remain planned.

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

**Status:** In progress — selected on 2026-10-03; acceptance pending.

**GitHub:** [#6 — open](https://github.com/CloudKai/secondBrain/issues/6)

**Label:** `ready-for-agent`

### What to build

A learner submits a YouTube URL and gets a note from an accessible transcript or an immediate upload/paste path.

### Acceptance criteria

- [ ] Automatic retrieval uses a validated accessible method without asking the learner to connect a YouTube account.
- [ ] Support is demonstrated with an accessible-caption fixture; a public playable URL is not assumed to authorize the official caption-download API.
- [ ] The import preserves transcript origin and real timing, then uses the existing video-note flow.
- [ ] Unavailable, blocked, or missing captions show the transcript fallback without claiming successful automatic retrieval.
- [ ] Provider support copy reflects validated capabilities.
- [ ] Adapter checks and a browser flow verify retrieval success and unavailable-transcript fallback.

### Blocked by

- Planned ticket 04: Create video study notes from uploaded or pasted transcripts — [GitHub #5](https://github.com/CloudKai/secondBrain/issues/5), complete

## 06: Handle Teams recording transcripts and access feedback

**Status:** Target behavior — unpublished draft; acceptance is not complete.

**Proposed label:** `ready-for-agent`

**Already verified from ticket 04:** Teams/SharePoint recording context and supplied TXT/VTT/SRT or pasted text are supported. Provider-specific automatic access and restricted-recording feedback remain planned.

### What to build

A learner submits a Teams recording and can use an accessible transcript or supply an export without connecting an account.

### Acceptance criteria

- [x] Recognized recording links retain the original Teams source identity.
- [ ] Retrieve a transcript only through an independently validated accessible path; do not introduce Graph account connections or admin-consent setup.
- [ ] Where transcript access requires permissions the app does not have, explain the limitation and open upload/paste controls.
- [x] Exported transcripts retain only their actual text, speaker information, and times; supported export formats are described accurately.
- [ ] Automatic support is advertised only for access paths demonstrated with a fixture.
- [ ] Provider and browser checks cover accessible transcript input, restricted recordings, and export fallback.

### Blocked by

- Planned ticket 04: Create video study notes from uploaded or pasted transcripts — [GitHub #5](https://github.com/CloudKai/secondBrain/issues/5), complete

## 07: Handle Zoom recording transcripts and availability states

**Status:** Target behavior — unpublished draft; acceptance is not complete.

**Proposed label:** `ready-for-agent`

**Already verified from ticket 04:** Zoom recording context and supplied transcript capture preserve actual text/times. Automatic retrieval and provider availability-state handling remain planned.

### What to build

A learner submits a Zoom recording and obtains a transcript-backed note or a clear export fallback.

### Acceptance criteria

- [x] Recognized recording links retain the original Zoom source identity.
- [ ] Automatic transcript retrieval is limited to a validated accessible path with no Zoom account connection.
- [ ] Missing, processing, restricted, expired, or deleted transcript states lead to accurate feedback and the upload/paste fallback.
- [x] Available transcript times are retained, with source evidence linked to the supplied or retrieved transcript.
- [ ] A shared playback URL or password alone is not treated as proof of transcript download permission.
- [ ] Provider and browser checks cover accessible transcript input and the relevant fallback states.

### Blocked by

- Planned ticket 04: Create video study notes from uploaded or pasted transcripts — [GitHub #5](https://github.com/CloudKai/secondBrain/issues/5), complete

## 08: Handle Panopto lecture transcripts with tenant-aware fallback

**Status:** Target behavior — unpublished draft; acceptance is not complete.

**Proposed label:** `ready-for-agent`

**Already verified from ticket 04:** Panopto tenant/session identity, supplied transcripts and real cue times are supported; display-parameter variants reuse the capture. Automatic caption access and tenant-specific feedback remain planned.

### What to build

A learner submits a Panopto lecture and gets a note from accessible captions or a transcript they supply.

### Acceptance criteria

- [x] Recognized lecture links preserve the original session identity and institution context where available.
- [ ] A caption download is attempted only through a validated accessible path without connecting institutional accounts.
- [ ] Tenant restrictions, unavailable captions, and unreadable exports produce an actionable upload/paste path.
- [x] Actual caption times are retained; untimed text cites excerpts.
- [ ] Validate any automatic capability against a concrete accessible session before advertising it.
- [ ] Provider and browser checks cover session recognition, accessible captions, and restricted-lecture fallback.

### Blocked by

- Planned ticket 04: Create video study notes from uploaded or pasted transcripts — [GitHub #5](https://github.com/CloudKai/secondBrain/issues/5), complete

## 09: Build topic cards and a source-driven graph

**Status:** Target behavior — unpublished draft; acceptance is not complete.

**Proposed label:** `ready-for-agent`

### What to build

Saved notes produce topic cards, and related independent sources form an explorable map with explained connections.

### Acceptance criteria

- [ ] An empty library has no prepared outline. The first completed source produces concise topic cards.
- [ ] Extract main and substantive supporting topics; passing mentions do not imply meaningful coverage.
- [ ] Shared topics are canonicalized when context is clear; uncertain placement is presented for learner correction.
- [ ] A graph emerges after at least two independent saved sources support a shared substantive topic or explained relationship such as uses, requires, or evaluates.
- [ ] Topic nodes remain distinct from sources; broad subject groups can overlap without implying unsupported direct relationships.
- [ ] Each connection explains its basis, and saved-material coverage is not presented as mastery.
- [ ] Graph data and any derived retrieval index are learner-scoped; source records remain authoritative.
- [ ] Checks cover related and unrelated notes, aliases, uncertainty, source-count thresholds, and topic navigation.

### Blocked by

- Planned ticket 02: Generate a structured article study note with inspectable evidence — [GitHub #2](https://github.com/CloudKai/secondBrain/issues/2), complete

## 10: Offer combined overviews and separate source branches

**Status:** Target behavior — unpublished draft; acceptance is not complete.

**Proposed label:** `ready-for-agent`

### What to build

A learner compares overlapping material through a combined topic overview or individual source-note branches under the same topic.

### Acceptance criteria

- [ ] Same-topic overlap is explained, with explicit Combine and Keep separate choices.
- [ ] Combine opens a synthesized topic overview with supporting references and preserved disagreements.
- [ ] Keep separate reveals source-note branches under one parent topic; branch types are visibly distinct from primary topic nodes.
- [ ] Both views retain each original note and its references, and the learner's view choice survives reload.
- [ ] Clicking a topic word opens the corresponding topic overview in the contextual panel.
- [ ] Checks cover same-topic sources, conflicting claims, view switching, and reference preservation.

### Blocked by

- Draft ticket 09: Build topic cards and a source-driven graph

## 11: Correct topic organization and remove sources consistently

**Status:** Target behavior — unpublished draft; acceptance is not complete.

**Proposed label:** `ready-for-agent`

### What to build

A learner fixes topic names, duplicates, assignments, or connections and deletes sources without leaving misleading overviews.

### Acceptance criteria

- [ ] Allow topic rename, duplicate-topic merge, source-topic assignment correction, and connection acceptance or rejection.
- [ ] Preserve source notes during organizational changes, including notes attached to multiple topics.
- [ ] Update affected topic overviews and graph connections after a correction or deletion.
- [ ] Remove citations to deleted material and preserve learner corrections for surviving material.
- [ ] Future automatic comparison respects prior corrections and rejected connections; stale processing cannot recreate deleted source content.
- [ ] Checks cover merge, reassignment, rejection, cross-topic membership, deletion, and persisted corrections.

### Blocked by

- Draft ticket 10: Offer combined overviews and separate source branches

## 12: Reuse repeated sources and refresh changed material

**Status:** Target behavior — unpublished draft; acceptance is not complete.

**Proposed label:** `ready-for-agent`

**Already verified:** canonical recording/article identity and PDF upload digests reuse existing captures per learner. Changed-content detection, explicit versioned refresh and correction-preserving rebuilds remain planned.

### What to build

Repeated imports reuse existing material, while changed sources can refresh their notes without losing corrected organization.

### Acceptance criteria

- [ ] Detect unchanged supported article, PDF, and transcript-backed video imports and reuse the captured source.
- [ ] Offer an explicit refresh when content differs rather than silently replacing a captured note.
- [ ] Keep source references tied to the exact captured version used for generation.
- [ ] Rebuild affected notes, overviews, and connections while retaining learner corrections.
- [ ] Repeated imports and source revisions do not inflate the graph's independent-source threshold.
- [ ] Checks cover unchanged imports, changed content, version-bound citations, and correction preservation.

### Blocked by

- Planned ticket 03: Create study notes from selectable-text PDF uploads and links — [GitHub #3](https://github.com/CloudKai/secondBrain/issues/3), complete
- Planned ticket 04: Create video study notes from uploaded or pasted transcripts — [GitHub #5](https://github.com/CloudKai/secondBrain/issues/5), complete
- Draft ticket 11: Correct topic organization and remove sources consistently

## 13: Process long sources with range selection and honest coverage

**Status:** Target behavior — unpublished draft; acceptance is not complete.

**Proposed label:** `ready-for-agent`

**Already verified:** published input limits, bounded captures and honest partial/unknown coverage. Whole-input section orchestration and selectable page/time ranges remain planned.

### What to build

A learner processes a full supported article, PDF, or lecture, or selects a page/time range, and sees accurate progress and coverage.

### Acceptance criteria

- [ ] Process the whole supported input by default in sections, with learner-visible progress.
- [ ] Allow PDF page ranges and timed-video ranges; validate ranges against actual source locations.
- [ ] Aggregate the selected sections into a coherent study note with references that retain original page or time locations.
- [x] Partial extraction or processing is clearly marked and does not claim whole-source completion.
- [x] Publish enforceable input limits and provide a usable correction path for unsupported input.
- [ ] Retries do not duplicate source records, and section counts do not inflate independent-source counts.
- [ ] Checks cover long inputs, selected ranges, section failures, coverage, and citation locations.

### Blocked by

- Planned ticket 03: Create study notes from selectable-text PDF uploads and links — [GitHub #3](https://github.com/CloudKai/secondBrain/issues/3), complete
- Planned ticket 04: Create video study notes from uploaded or pasted transcripts — [GitHub #5](https://github.com/CloudKai/secondBrain/issues/5), complete

## 14: Answer questions using selectable note, topic, and library scopes

**Status:** Target behavior — unpublished draft; acceptance is not complete.

**Proposed label:** `ready-for-agent`

### What to build

A learner uses suggested prompts or free text to ask a source-grounded study assistant about the current note and selected wider material.

### Acceptance criteria

- [ ] Place the assistant beneath the notes and default to the current note.
- [ ] Ask this topic and Ask my library buttons are selectable independently and together in the textbox.
- [ ] Always include the current note; with both buttons selected, prioritize topic material and retrieve relevant library evidence without duplicate sources.
- [ ] Answers cite the actual selected material and open evidence through the same source panel.
- [ ] When material cannot support an answer, explain the gap and offer Find reliable sources.
- [ ] Generate English answers, enforce learner isolation, and keep provider and retrieval operations on the backend.
- [ ] Checks cover scope combinations, source attribution, unsupported questions, and cross-learner denial.

### Blocked by

- Draft ticket 09: Build topic cards and a source-driven graph

## 15: Discover credible further-study resources and save selected sources

**Status:** Target behavior — unpublished draft; acceptance is not complete.

**Proposed label:** `ready-for-agent`

### What to build

A learner requests further research, inspects relevant papers or documents, and saves a selected result into the existing note-and-topic workflow.

### Acceptance criteria

- [ ] Research runs only on learner request, including the assistant's Find reliable sources action.
- [ ] Prioritize original papers, official documentation, and university teaching materials.
- [ ] Show verified source links, author or organization, date, type, and relevance where available; label preprints and avoid invented metadata.
- [ ] Let the learner open the original result and explicitly choose Save to my library.
- [ ] Saving a public article or selectable-text PDF uses the existing capture, note, and topic-comparison flow; unsaved results do not change the library graph.
- [ ] Distinguish discovered external material from saved-source evidence in the conversation.
- [ ] Checks cover grounded results, missing metadata, explicit saving, and unchanged library state before saving.

### Blocked by

- Draft ticket 14: Answer questions using selectable note, topic, and library scopes
- Planned ticket 03: Create study notes from selectable-text PDF uploads and links — [GitHub #3](https://github.com/CloudKai/secondBrain/issues/3), complete
