# Web learning-library ticket breakdown

## U3a2 implemented in development — 2026-10-10

[#36](https://github.com/CloudKai/secondBrain/issues/36) under #29: initial source paths can use full captured material through existing BM25/semantic retrieval. New immutable plans have a cited, sampled concept/coverage manifest; explicit Saved note passages remains compatible. Original spans/pages/times, ownership, capture/index snapshots and failed-preview recovery are enforced. No existing learning is regenerated; multi-source revisions still use their existing saved-note policy.

Migration **022 applied after exact approval**; live MIT PDF previews persist Luna-generated lessons and exact original page references without activation. The current lesson, draft, conversation and 0 studied / 2 attempts / 2 provisional checks remain intact. **361 workspace backend / 134 web; 295 isolated backend / 121 web tests**, web typecheck/lint/build pass. Exact uv runner still has the system-pytest dependency issue. Separate reviews clear. See [acceptance](../reviews/capture-teaching-acceptance-2026-10-10.md).

#36 stays open for actual 200% zoom/screen-reader checks. Independently reviewed synthetic cases and one live PDF do not calibrate teaching or grading. **Next target U3a3**: outcome-specific full-capture evidence for multi-source contribution previews, then U3b stable outcomes/practice. U4/U5 remain target work. No push/mobile/iOS/TinyFish; older WIP stays separate. Checkpoint before the next unit.

## U3a1 — Teaching evidence preview accepted in development (2026-10-10)

Delivery [#35](https://github.com/CloudKai/secondBrain/issues/35), part of #29. Owned confirmed-plan evidence preview searches full captured material using existing BM25+dense RRF, with exact version/page/time citations, explicit partial indexing, limits and freshness checks. Read-only foundation; lesson generation, stable outcomes and manifests remain targets. No new hosted migration or model change; required previously accepted retrieval prerequisites are included in the scoped commit.

344 backend/126 web workspace; 278 backend/113 web isolated; typecheck/lint/build pass. Live PDF/video selection returned24 exact passages,14 omitted from notes, unchanged history; 401/404 fences. Separate standards/spec reviews clean. [Acceptance](../reviews/teaching-evidence-acceptance-2026-10-10.md). Next U3a2 reviewed teaching cases/manifest/integration, then U3b outcomes/checks. Earlier U2 accessibility/download gates remain open. No push or mobile/iOS changes.


## Ideal learning app U2c2 — development delivery, 2026-10-10

[Delivery #34](https://github.com/CloudKai/secondBrain/issues/34), parent #29: completed lesson conversation retention implemented with migration021, checked/retry-safe sends, owned lesson scope, bounded context, model provenance, removal redaction and clear/export. Live saved Luna hint and exact citations survive reload. 124 workspace web/324 backend and isolated111 web/258 backend tests pass; typecheck/lint/build pass. Reviews resolved; [acceptance](../reviews/learning-conversations-acceptance-2026-10-10.md).

#34 remains open for actual 200% zoom, screen-reader operation and native download completion. **Next planned delivery: U3 evidence-aware teaching and stable outcomes**, followed by U4 graph/discovery and U5 policy/operations. These are targets, not verified current capabilities. Old WIP retained separately; no push/mobile work.

Last synchronized: **2026-10-10 (Asia/Singapore)** against GitHub Issues and
completed acceptance records in `context/web-progress-tracker.md` and `scope.md`.

## U2c1 unfinished learning drafts — implemented in development, 2026-10-10

[GitHub #33](https://github.com/CloudKai/secondBrain/issues/33), part of #29, adds owned answer/question drafts per collection, immutable plan and lesson. Autosave shows Saved/Unsaved/Retry/conflict states; tab-private pending recovery survives same-tab reload/navigation. Revision checks and idempotent save IDs protect retries and multiple tabs, including opener clones. Changed/removed source evidence retains learner-authored writing. Clear is a checked empty save; Download exports this draft’s versioned JSON. Drafts never count as attempts/activity. Existing tutor replies remain view-local.

**Migration 020 applied** successfully to AI Study Friends. Live lesson-two answer/question drafts survived reload and were then cleared; the collection remained at 0 studied, 2 attempts and 2 provisional checks. Exact timed video evidence and keyboard focus return still work. **118 workspace web / 311 backend tests pass**, plus web typecheck/lint/build. Backend uses its existing virtual environment because the exact uv runner selects system pytest missing a dependency. Spec and standards review findings are resolved. Isolated HEAD + this unit passes 105 web / 245 backend tests and web typecheck/lint/build. Measured 1440×900 dark and 390×844 light live layouts have no horizontal overflow.

See [U2c1 acceptance](../reviews/learning-drafts-acceptance-2026-10-10.md). #33 remains open for actual 200% zoom, screen-reader acceptance and native download completion; the actual export payload is verified at the browser boundary. **Next target:** U2c2 completed tutor exchanges, with its own provenance/retention/redaction/send/recovery contract before implementation. U3–U5 remain target work. Earlier WIP is separate; no push or mobile/iOS changes.

## U2b collection workspace — implemented in development, 2026-10-09

[GitHub #32](https://github.com/CloudKai/secondBrain/issues/32), part of #29, adds an owned `#collection/<id>` learning destination and collection home. Library resume, source entries and topic learning actions open the same saved path/lesson. Teaching, practice and review are primary; sources, plan coverage, map and dated version history are secondary. Removed anchors retain goals/answers without fabricated evidence. Metadata refreshes after confirmation without remounting the lesson; initial snapshots avoid duplicate reads.

**113 workspace web / 299 backend tests pass**, web lint/typecheck/build pass. Isolated commit files also pass 100 web tests, typecheck/build and lint. Backend used its existing virtual environment; the exact uv command still selects system pytest missing `langchain_openai`. Spec/standards review findings are resolved. Live PDF/video collection resume/reload, retained practice, exact timed evidence and keyboard focus return pass. Measured 1440×900 and 390×844 dark/light layouts fit without horizontal overflow. Unknown IDs fail safely; navigation leaves persisted activity unchanged. Fixture HTTP confirmation verifies fresh goal/counts without live model or database writes.

No new migration, model or retrieval policy. See [U2b acceptance](../reviews/collection-workspace-acceptance-2026-10-09.md). #32 stays open for actual 200% zoom and screen-reader acceptance. **Next target:** U2c durable unfinished answers/tutor conversations; U3–U5 remain target work. Earlier unrelated WIP remains separate. Local changes only; no push and mobile/iOS untouched.

## U2a collection identity — implemented in development, 2026-10-09

[GitHub #31](https://github.com/CloudKai/secondBrain/issues/31) delivers the identity/backfill subunit of #29. Owned collection IDs survive removal of the original capture. Repeatable backfill retains paths, plans, attempts, branches, exact citations and cursor metadata. Confirmed source membership is deduplicated; pending previews do not increase coverage. Authenticated collection reads, legacy aliases and checked selection are implemented.

**Migration 019 applied** to AI Study Friends. Hosted backfill mapped 2 collections, 3 paths, 5 plans, 1 place and 3 attempts with zero unmapped records. Live authenticated list/detail/alias reads match legacy learning snapshots; no-auth reads return 401 and unknown IDs return 404. Saved lesson two, cursor revision and activity remain unchanged by reads. **299 backend / 106 web tests pass**, plus web typecheck/lint/build. Backend used its existing virtual environment because the exact uv runner selected system pytest without a project dependency. Spec/standards reviews have no remaining actionable findings. Recovery retains reads/history and legacy writers while disabling new selection.

See [U2a acceptance](../reviews/collection-identity-acceptance-2026-10-09.md). Local implementation commit `ee2f0c4`; no push. **Next target:** U2b collection workspace/navigation, then U2c durable drafts/chat; U3–U5 remain target work. U1's exact viewport, actual 200% zoom and screen-reader gates remain open under #30. Mobile/iOS untouched.

## Progress at a glance

**Latest implementation — 2026-10-09:** U1 continuity is implemented in development
under [#30](https://github.com/CloudKai/secondBrain/issues/30), part of #29. Relevant
note context, saved path/lesson resume, consistent activity and labelled plan
history are in place. Migration 018 applied after approval. **296 backend / 99 web
tests**, web typecheck/build and lint pass; rollback preserves saved answers.
Live resume/reload, history, unchanged counters and exact timed evidence/focus
return checked. Compact dark/light checked; exact viewport matrix, actual 200%
zoom and screen-reader acceptance remain pending. #30 stays open. See
[acceptance](../reviews/learning-continuity-acceptance-2026-10-09.md).
**Next target:** U2 independent collection workspace; U2–U5 are not implemented.
This unit is local, unpushed and leaves mobile/iOS unchanged.

**Latest specification — 2026-10-09:** [GitHub #29](https://github.com/CloudKai/secondBrain/issues/29)
is published with `ready-for-agent`; the [local specification](ideal-learning-app-spec.md)
contains 68 user stories and five ordered implementation units. U1 repairs
continuity first. This is specified target work, not completed application work.
Existing #28 and earlier acceptance statuses remain distinct. Use the specification
and roadmap when breaking these units into delivery tickets.

**Latest review — 2026-10-09:** the [ideal learning app audit](../reviews/ideal-learning-app-audit-2026-10-09.md)
is complete, with fresh browser screenshots and code/configuration evidence.
The [next implementation roadmap](ideal-learning-app-roadmap-2026-10-09.md) is
**proposed, awaiting acceptance**: U1 continuity; U2 independent collection
workspace; U3 teaching evidence and practice; U4 map/discovery; U5 AI policy and
operations. No application changes are part of this audit unit. [#28](https://github.com/CloudKai/secondBrain/issues/28)
remains open; its existing development work is not equivalent to passing all
educational-quality or public-release gates. New delivery issues can follow
roadmap acceptance without changing the historical 01–15 completion record.

**Verified MVP:** planned tickets **01–15 are complete** (15 of 15 slices), including
development acceptance. GitHub issues **#1–#17 are closed**; #4 is an extra
citation/title-polish task, so planning numbers and GitHub numbers differ.

**Last completed:** post-plan citation passage improvement — [GitHub #17](https://github.com/CloudKai/secondBrain/issues/17). Original planned ticket **15**, live discovery, remains complete.

**Current reading format implemented locally:** assistant source cards, shared reading styles and page/time-labelled evidence apply to existing material. **81 web tests pass**, plus typecheck/build, lint and whitespace checks. Real saved article/PDF/video, assistant, recall and topic views are checked; original coordinates remain intact. Native zoom, live archives and full screen-reader acceptance remain broader checks under #21/#23. See [reading-format acceptance](../reviews/reading-format-acceptance-2026-10-09.md).

**Previous local-product acceptance:** fresh article/PDF/video-caption imports, exact citations, reload, shared graph and combined overview are checked. The assistant returns attributed captured-source wording rather than an unverified draft paraphrase. **266 backend tests and 69 web tests pass**, plus web build/typecheck and lint. Twenty final development requests matched expected statuses with valid citation locations; one comparison used an alternate caption rather than both annotated exact spans. The approved worker is running. Hosted rollout, calibrated semantic verification, streaming, capacity and cost gates remain open under #25/#27. See [working-product acceptance and limits](../reviews/working-product-acceptance-2026-10-08.md).

**Earlier units:** post-plan UX audit review and AI retrieval design. The original
15-slice web plan remains complete. The [proposed UX plan](web-design-improvements.md)
prioritizes visible citation evidence, shorter import forms, readability/example
clarity and a real-source journey audit. Citation presentation is implemented
locally under [#21](https://github.com/CloudKai/secondBrain/issues/21), with
typecheck/lint and narrow example inspection passing; broader acceptance remains
pending. Import simplification is also implemented locally under
[#22](https://github.com/CloudKai/secondBrain/issues/22), with the same static
checks and narrow form inspection; live submission acceptance remains pending.
Readability/example/empty-state slice is implemented locally under
[#23](https://github.com/CloudKai/secondBrain/issues/23), with static checks,
contrast calculations and narrow-state inspection; broader acceptance is pending.
Qdrant indexing and scoped hybrid answers are enabled locally; broader quality acceptance is pending. AI design is recorded in the
[RAG discussion](assistant-rag-improvements.md); the remembered skill set is
`rag-implementation`, DeepEval and `typesafe-ai`.

**Repository organization — #19:** `mobile/` is now a regular folder alongside
`web/` in `CloudKai/secondBrain`, with its Git history preserved. This changes
repository layout; the completed web feature acceptance remains unchanged.

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

Original 15-slice completion checks: **200 backend tests, 68 web tests, web build/typecheck
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

**New target specification:** [topic learning journeys](topic-learning-journey-spec.md)
is published as [#28](https://github.com/CloudKai/secondBrain/issues/28), labelled
`ready-for-agent`. It covers the full phased learning vision, with complete
one-source teaching selected for first delivery. Per-request Luna/Sol-medium
routing includes proposed escalation checks and measured quality/cost gates.
Testing boundaries were approved. The first one-source unit is implemented in
development with migration 015 and live article confirmation/practice/history
checks. Feedback remains provisional; semantic/cost acceptance and desktop/zoom
checks remain. Multi-source revisions are implemented with migration 016; goal branches, teaching maps and graph activity are implemented with migration 017. The [interview record](topic-learning-journey.md) preserves decisions.

| Work | Status | Ticket and scope |
| --- | --- | --- |
| Source-backed topic learning journeys | Phases 1–3 implemented in development; 294 backend / 95 web checks pass; full rollout acceptance open | [#28](https://github.com/CloudKai/secondBrain/issues/28), [spec](topic-learning-journey-spec.md) |
| Complete-thought citation passages and caption grouping | Complete; migration 012 applied, existing saved note updated, local + hosted acceptance | [#17](https://github.com/CloudKai/secondBrain/issues/17), [spec](citation-passages.md), [setup](../citation-passages-setup.md) |
| Immediately visible citation evidence | Implemented locally; typecheck/lint and narrow example open/close inspected; real-source and wider acceptance pending | [#21](https://github.com/CloudKai/secondBrain/issues/21), [plan](web-design-improvements.md) |
| Shorter import forms and reachable actions | Implemented locally; typecheck/lint and narrow form inspection pass; live and wider acceptance pending | [#22](https://github.com/CloudKai/secondBrain/issues/22), [plan](web-design-improvements.md) |
| Readability, examples and focused empty states | Implemented locally; typecheck/lint, token contrast and narrow state inspection pass; broader acceptance pending | [#23](https://github.com/CloudKai/secondBrain/issues/23), [plan](web-design-improvements.md) |

Citation work passes 200 backend and 68 web tests plus web build/typecheck/lint.
Independent standards/spec reviews are clear through `074f157`. A six-cue live
fixture produced three exact joined references, with note/assistant inspection
and reload verified. The temporary source and dependent records were cleaned.
The original 15 slices above remain development-complete.

Existing-note follow-up: the sole saved **Neural networks** note now has 12
complete-thought citation passages (previously 13 cue references). Its original
text, capture, source version and four topic assignments are preserved. Topic
evidence IDs were remapped atomically. Exact saved text/times and preserved
source/job/map state were verified; no model regeneration or new migration.

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


## Proposed assistant AI follow-up — design interview, 2026-10-05

The learner selected better answers across saved sources for up to 200 sources,
with accuracy first. The current interview covers full-source BM25 + semantic
retrieval, structure-first recursive chunking, Jev/grounding-classifier comparison,
and streamed checked answers targeting first verified text in 10–15 seconds.

Confirmed choices and unresolved decisions are in
[assistant retrieval and evidence quality](assistant-rag-improvements.md).
This is proposed follow-up work, not a completed ticket or implemented capability.
New GitHub tickets and acceptance criteria follow confirmation of the design.


## Real-source UX acceptance audit — #24 (2026-10-06)

[GitHub #24](https://github.com/CloudKai/secondBrain/issues/24) records completed
slice 4 audit with incomplete acceptance. [Report](../reviews/web-saved-source-audit-2026-10-06.md)
includes current-run screenshots. Three real public PDF/article/video-caption notes
saved and generated; sampled citations/locators/focus, scoped assistant, stale retry,
evidence gap, reload, rename, validation, light and constrained layouts checked.

- [x] Run and record the real-source journey audit; stop approved worker afterward.
- [x] Retain audit sources for reproducible follow-up; preserve learner data.
- [x] Diagnose video topic mapping and combined-overview generation failures: canonical-context mismatch and claims with only one independent source.
- [ ] Fix citation-support mismatch and baseline missed positional-encoding retrieval.
- [ ] Improve narrow long graph-label wrapping.
- [ ] Finish successful overview/archive/edge, actual zoom and full accessibility acceptance.

#21–#23 remain open; the original development-complete baseline remains historical.
No code changes or automated tests in this audit. AI retrieval slice 5 is still planned.

### #24 fixes implemented locally — acceptance pending

Original excerpts now accompany long-note summaries; assistant retrieval can
select uncited captured passages; graph labels wrap at word boundaries. Mapping
and overview generation allow one correction using validation feedback within
the same deadline. Validation contracts and ownership/version fences remain.
Python syntax, web typecheck and lint pass. Focused regression and browser checks
await test-scope approval. Existing saved notes/jobs have not been repaired or
retried; keep fix/acceptance checkboxes and #24 open. No worker restart or native
tracker changes.

## Fresh-source baseline — #25 (2026-10-06)

The learner superseded old-note repair with deletion and fresh-source work. The
three named #24 audit sources were deleted with exact-ID and owner filtering;
follow-up read returned zero. Other sources were not targeted. #24 remains open
for fresh-source acceptance.

[GitHub #25](https://github.com/CloudKai/secondBrain/issues/25) starts the next AI
unit: [DeepEval baseline](assistant-evaluation-baseline.md). Twelve authored seed
cases are prepared; no fresh captures or scored results yet.

- [x] Prepare explicit baseline execution/measurement contract and seed cases.
- [ ] Confirm requested test boundaries and annotate fresh captured evidence.
- [ ] Capture actual retrieval context; check ownership/scope/version and locators.
- [ ] Record judge configuration/cost and run bounded DeepEval metrics.
- [ ] Publish reproducible results, failure breakdown and remaining coverage.

Q13 shared-engine choice is separately pending. No model/classifier winner,
200-source capacity, verified streaming or production acceptance is claimed.
Native/iOS tracker unchanged; no worker restarted.

## Baseline implementation / approved hosted engine — 2026-10-07

#25: implemented authenticated collection, actual-context snapshots, reviewed
capture fingerprints, revision/exact-citation checks and bounded local DeepEval
scoring. Optional 4.2.8 extra is locked; raw reports are ignored. One fresh public
PDF case measured 5.62-second non-streaming completion, exact span/recall/precision
1.0 and faithfulness 0.8571 with a suspected judge error. Eight calls, SDK estimated
judge cost $0.0017205. [Report](../reviews/assistant-baseline-2026-10-07.md).
Broader 12-case baseline remains pending, so #25 stays open.

#24: focused/full regressions pass (206 backend/68 web). New uncited-PDF regression
was verified red against HEAD and green with the fix. Web typecheck/lint/build
pass. Browser connection retry succeeded; fresh PDF capture failed twice, ending
with source-host resolution failure. Keep real browser/video/overview/graph
acceptance open. Only one named public study job ran; no dispatcher started.

#26: Qdrant credentials, 1.19.2 connectivity and the dedicated BM25/dense collection
are verified. Local indexing code and migration 013 are prepared; hosted approval
and acceptance remain pending. No captured source is indexed,
model winner, capacity or production release claim. Native tracker untouched.


## Qdrant indexing implementation checkpoint — #26 (2026-10-07)

- [x] Verify configured server credentials and cluster connection without exposing keys.
- [x] Create dedicated dense/BM25 collection and owner/source/generation/version indexes.
- [x] Prepare durable manifests, capture/change/delete work and resumable worker batches.
- [x] Preserve exact PDF/cue offsets and immutable saved citation identities.
- [x] Add authenticated owned indexing-status API and opt-in dispatch.
- [x] Pass seven external HTTP checks and full 213 backend regressions.
- [x] Apply all migrations and pass ownership/retry/version/deletion checks in disposable Postgres; roll back fixtures.
- [ ] Apply migration 013 to hosted Supabase: automatic review rejected the action against the branch labeled `main PRODUCTION`; exact approval requested.
- [ ] Verify one named real-source index, provider retry, hosted owner/version/delete fences.
- [ ] Add learner-visible readiness, then enable background backfill deliberately.

No source text was sent to Qdrant; no dispatcher started. Assistant hybrid query
integration, ID revalidation, model comparison and broader baseline remain target
work. #26 stays open. [Setup/checks](../qdrant-indexing-setup.md). Native tracker unchanged.


## Migration applied / named-source check — #26 (2026-10-07)

The learner explicitly approved applying migration 013; Supabase reported success.
This supersedes the approval-pending checkpoint above.

- [x] Apply migration 013 to the approved Supabase project.
- [x] Index the named public baseline PDF: ready, version 1, 2/2 chunks.
- [x] Verify exact source offsets/fingerprint, physical page 6, correct owner and dense/BM25 vectors.
- [x] Run a source/owner-filtered BM25 infrastructure smoke query: two owned hits.
- [ ] Complete hosted authenticated status, cross-owner, retry, refresh and deletion acceptance.
- [ ] Add learner-visible readiness and deliberately enable background backfill.

Background dispatch remains disabled; only the named source ran. Existing assistant
retrieval still uses Postgres. #26 stays open. Native tracker untouched; no push.


## Hosted indexing lifecycle checks — #26 (2026-10-07)

- [x] Owned/private/worker and cross-owner access checks against hosted services.
- [x] Simulated second-batch embedding outage: preserve 16 chunks, resume after retry delay, complete index.
- [x] Authenticated refresh to version 2 and cleanup of old-version vectors.
- [x] Authenticated deletion and complete fixture-vector cleanup.
- [x] Actual FastAPI hosted-auth status checks: owned 200, unauthenticated 401, cross-owner/deleted 404.
- [x] Remove all synthetic source fixtures from this acceptance run.
- [ ] Add indexing progress display and browser/client tests: requested TDD seam approval pending.
- [ ] Deliberately enable background indexing after UI acceptance.

[Detailed evidence](../reviews/qdrant-indexing-acceptance-2026-10-07.md). Only named
jobs ran; background indexing stays disabled. #26 remains open; native unchanged.


## Web progress display — #26 (2026-10-07)

- [x] Implement learner-visible source indexing states and section progress.
- [x] Validate authenticated status identity/version and reject incomplete readiness.
- [x] Verify waiting → ready and ready after reload in the actual browser.
- [x] Pass 69 web tests, typecheck/lint/build and 213 backend tests.
- [x] Prepare dedicated indexing-only worker using the separate `arq:retrieval` queue.
- [x] Remove the disposable browser source and its derived points.
- [ ] Activate persistent background indexing: auto-review rejected all-source egress; explicit activation approval required.

The activation attempt was rejected before execution; server flag remains false.
#26 stays open. Assistant hybrid queries are later work. Native files unchanged.


### #26 background activation accepted — 2026-10-07

The user explicitly approved background indexing. Local development now has
`ENABLE_RETRIEVAL_INDEXING=true`, Redis running and the dedicated
`backend.retrieval_worker` process on `arq:retrieval`. It automatically sends
queued and future captured text to the configured OpenAI embedding service and
Qdrant. This worker handles indexing and cleanup; it does not dispatch study or
topic generation. A hosted worker deployment remains future work.

A fresh disposable source reached ready automatically (1/1 chunk), then source
deletion automatically removed its Qdrant points. An earlier queued fixture also
recovered to ready and was deleted and cleaned automatically. Both fixtures have
zero remaining points. ARQ reads settings from the class's own dictionary;
explicit lifecycle and safety settings fixed inherited settings being skipped.
The added regression failed before the fix. All 214 backend tests pass; the
previous 69 web tests, typecheck, lint and build passed.

Ticket #26 indexing acceptance is complete. Assistant BM25/semantic query fusion,
Postgres scope/version revalidation and retrieval-quality comparisons are the
next unit. Earlier activation-pending checkpoints below are superseded.
Native/iOS and its tracker remain unchanged. No commit or push.

- [x] Explicit approval for persistent queued/future-source indexing.
- [x] Start Redis and the dedicated local indexing worker.
- [x] Verify automatic capture-to-ready and deletion-to-zero-points.
- [x] Recover and clean the earlier queued disposable fixture.
- [x] Fix ARQ lifecycle configuration with a failing-then-passing regression.
- [x] Pass 214 backend tests; previous web checks remain green.

## Hybrid assistant retrieval started — 2026-10-07

Planned unit [#27](https://github.com/CloudKai/secondBrain/issues/27) connects the
accepted Qdrant index to assistant questions. It will search the selected
note/topic/library inventory, combine BM25 and semantic candidates with RRF,
load bounded ranked sources and map chunks to exact citation passages. Postgres
ownership, scope, current version and index generation must be revalidated
before model input and after generation. Per-learner BM25 IDF prevents other
learners' corpora from affecting sparse scoring.

Inspection confirmed the existing `get_assistant_context` selects at most nine
sources using note-text search. Hybrid retrieval needs a bounded metadata
inventory before ranking, then exact source loads; querying only those nine
legacy candidates would retain the same source-discovery limitation.

The TDD skill requires agreement before new tests. The focused question covering
Qdrant/OpenAI HTTP, authenticated assistant questions and Postgres ownership/
scope/current-version seams is pending. No #27 implementation or tests have been
written or run. Hybrid answers remain target behavior; background indexing from
#26 continues locally. Native/iOS and its tracker remain untouched.

## Hybrid assistant retrieval implemented locally — 2026-10-07

The user approved the new HTTP/API/Postgres test boundaries. [#27](https://github.com/CloudKai/secondBrain/issues/27)
now has a bounded authenticated inventory, BM25+dense RRF retrieval, per-learner
IDF, exact passage attribution and pre/post-generation ownership/scope/version/
generation fences. Eighteen new checks and the full 232-test backend suite pass;
69 web tests pass. Disposable Postgres acceptance covers readiness, changes and
cross-owner denial. A hosted query against the retained public PDF returned two
current page-6 hits. This does not establish better answer quality.

Migration 014 and rollback are concrete and locally verified. Hosted application,
authenticated end-to-end acceptance and held-out comparisons remain pending.
`ENABLE_HYBRID_RETRIEVAL` defaults to false; live assistant retrieval is unchanged.
Background indexing remains enabled locally. This supersedes the test-boundary
question checkpoint. Native/iOS and its tracker are untouched; no commit/push.
See [acceptance evidence](../reviews/hybrid-retrieval-acceptance-2026-10-07.md).

## Hybrid assistant retrieval activated locally — 2026-10-07

The user explicitly approved migration 014. Supabase reported success; hosted
learner inventory, current capture loading, snapshot validation, unauthenticated
401 and cross-owner 404 checks pass. A disposable copy of the public page-6 PDF
baseline indexed automatically and produced exact citations through the real
model and hosted storage services. Source removal invalidated its snapshot and
background cleanup left zero derived points.

Three bounded old/hybrid question replays returned expected supported/supported/
unsupported statuses. Hybrid complete-response times were 7.94s, 5.77s and 4.36s.
These are single samples on one PDF page, not latency percentiles, streamed-text
measurements or evidence of improved answer quality. A restarted localhost API
also returned a supported exact-page answer in 5.57s; that second fixture was
removed and cleaned automatically. Reports stay in ignored output/evaluation/.

`ENABLE_HYBRID_RETRIEVAL=true` is set in ignored backend/.env and the localhost
API was restarted. Both background indexing and hybrid answers now run locally
using hosted services. Templates retain false defaults. The previous 232 backend
and 69 web tests pass; git diff --check passes. Broader multi-source/held-out
retrieval comparisons under #25/#27 and semantic claim verification remain
unfinished. Native/iOS and its tracker remain untouched; no commit or push.


## Fresh multi-source retrieval evaluation — 2026-10-08

Implemented shared HTTP/evaluation answer execution and independent owned-scope
expected-source annotations. Full backend suite: **234 passed** (two existing
warnings); uv cache access blocked, existing virtual environment used.

Three fresh public PDF/article/video sources generated notes and indexed in a
dedicated acceptance library. Nine questions replayed in each retrieval mode.
All 18 exact citation locations and expected answer statuses passed, but manual
review found one hybrid video retrieval regression and an incomplete comparison
in both modes. The rank-1 video chunk contains the evidence; passage-prefix caps
remove it before model input. DeepEval scored the incomplete comparison highly,
so those scores are not release gates.

[Results and next unit](../reviews/assistant-multisource-evaluation-2026-10-08.md): fix question-aware passage selection under #27
before classifier comparison. #25/#27 remain open for broader acceptance. Fresh
acceptance sources retained for reproducible replay. Native/iOS and its tracker
untouched; no commit or push.

## Question-aware passage selection — 2026-10-08

Implemented bounded semantic passage ordering with original chunk relevance and
short caption continuations. Existing exact citation identities/coordinates,
owned scope/version fences and 30,000-character context bound are preserved.
The two measured transcript failures now retrieve their independently annotated
evidence. Final unchanged nine-question replay: all expected spans/statuses and
citation locations pass; individual complete responses 3.36–6.22 seconds.

Full backend suite: **237 passed**, two existing warnings. No frontend changes;
native/iOS and its tracker untouched. [Acceptance and limits](../reviews/passage-selection-acceptance-2026-10-08.md).
#25/#27 remain open for broader held-out/topic/follow-up/capacity checks and
ranking calibration. Semantic claim checking and verified streaming remain
planned. No migration, commit or push.

## Broader retrieval evaluation — 2026-10-08

Eleven new questions ran after freezing the passage fix on the same acceptance
library. All ten annotated supporting spans reached the model; 10/11 answer
statuses matched expectations and emitted citation locations were valid. One
shared-topic GQA answer falsely abstained despite available evidence, and did so
again on one unchanged repeat. Two clear follow-ups passed; explicit reference
resolution remains unimplemented. Narrow-topic isolation plus actual API
401/404 ownership/version/topic denial checks pass.

PDF/article topic maps succeeded. Video mapping returned invalid output twice,
including one bounded named retry, and remains queued at two attempts. No broad
worker dispatcher started. [Results and remaining gates](../reviews/assistant-broader-evaluation-2026-10-08.md).

#25/#27 stay open. Next unit: false-abstention diagnosis, then video mapping.
Grounding comparison, ambiguity handling and capacity/cost/streaming remain
planned. No application/test code changed; prior 237 backend tests remain the
historical baseline. Native/iOS and its tracker untouched; no commit/push.


## Generation reliability fixes — 2026-10-08

Implemented a whitespace-normalized reading rendering for multiline evidence while
preserving exact citation text/coordinates. Topic schema instructions and owned
canonical-context repair requirements fix the rejected video mapping without
weakening validation or adding retry attempts.

**Verified locally:** 238 backend tests pass; all 11 broader and all nine prior
question statuses, annotated spans and citation locations pass. Actual API GQA
answer returned supported with an exact article citation. The named video map
saved successfully at attempt 3; all three acceptance source maps now succeed.
No unrestricted study/topic dispatcher ran.

[Acceptance and limits](../reviews/generation-reliability-acceptance-2026-10-08.md). #25/#27 remain open. Next planned unit: compare
Jev with a specialist grounding classifier using claim-level support/uncertainty
annotations. Explicit ambiguous follow-up handling, independent-source coverage,
200-source capacity, cost calibration and verified streaming remain planned.
Native/iOS and its tracker untouched; no migration, commit or push.


## Grounding classifier comparison — 2026-10-08

Implemented a development-only direct Jev adapter, optional pinned MiniCheck FT5
runner and 20 manually reviewed public claim/evidence cases. **240 backend tests
pass**; dry-run validation covers all cases. Production answers are unchanged.

MiniCheck scored all 20 on this Mac's MPS device: zero false support among 13
unsupported claims, but **two false rejections among seven supported claims**.
Original/compacted-whitespace probes retain both failures: GQA equations and
opposite boolean-mask semantics. Failed initial tokenizer setup is retained as
unscored runtime evidence. These are development regressions, not held-out
accuracy or calibrated thresholds.

**Needs input:** add server-only `TYPESAFE_API_KEY` to ignored backend/.env; the
focused question is pending. Jev has made zero requests. No winner or live checker
is selected. [Results, reproduction and limits](../reviews/grounding-classifier-development-2026-10-08.md).
#25/#27 remain open; follow-up/routing, broader labels, hosted cost/latency and
verified streaming remain planned. Native/iOS and its tracker untouched; no
migration, commit or push.


## Laya replaces Jev — 2026-10-08

The learner selected open-source Laya. Replaced the active development Jev adapter
with pinned local Laya English HTTP classification; removed its provider option
and TypeSafe placeholder requirement. No API key is needed. Production answers
are unchanged; the temporary model server was stopped after measurement.

**Measured:** unchanged 20 cases in original/compact layouts. Laya matches 17/20,
with three false acceptances and no false rejections; MiniCheck matches 18/20,
with no false acceptances and two false rejections. Scope generalization, GQA
negation and reversed mask semantics fail in Laya. No threshold was tuned or
winner/live checker selected. **240 backend tests pass**.

[Results and next gates](../reviews/laya-classifier-development-2026-10-08.md). #25/#27 remain open. Routing and broader grounding
calibration, hosted latency/cost and verified streaming remain planned. The earlier
TypeSafe-key request is superseded. Native/iOS tracker untouched; no migration,
commit or push.

## Claim generation — implementation verified; semantic acceptance pending, 2026-10-08

Implemented 600-character private draft claims, concise per-claim instructions,
literal source-qualifier hints, private source identity and declared-comparison
citation guards. Public answers remain compatible; citation marker cleanup keeps
exact attribution. **258 backend tests pass**. Seven of eight final regression
requests completed with expected statuses and exact citations; a comma-marker
failure was then fixed, and an actual API comparison returned 200 with exact PDF
and video locations. Earlier failed rounds remain recorded.

Qualifier attachment and unsupported extensions still fail conservative developer
review in scaling/comparison answers. **Semantic acceptance remains open**; shorter
claims and valid locations are not proof of support. No classifier, training,
routing or streaming is enabled. Independent review and unseen-source groups are
next. [Implementation, failures and next gates](../reviews/claim-generation-review-2026-10-08.md). #25/#27 stay open.
Native/iOS tracker untouched; no migration, worker, commit or push.

## Working first web version — local acceptance, 2026-10-08

**Verified:** fresh article/PDF/video-caption imports generate saved notes and ready
search indexes. Browser checks cover page/timestamp citations, reload, a shared
two-source topic, two graph connections and a completed combined overview. The
approved development worker is running. Mobile/iOS and its tracker are untouched.

The assistant now returns attributed captured-source wording with whitespace
simplified. This avoids displaying unverified draft paraphrases; evidence relevance
and completeness are still model judgments. A lexical passage reservation fixes
the fresh cleanup retrieval miss. Existing topic context is copied from the owned
catalog by the server, fixing the video mapping retry without changing public
records or database schema.

**Checks:** 266 backend tests, 69 web tests, web build/typecheck and lint pass.
Twenty final live regression requests matched expected statuses and had valid
citation locations, taking 3.13–6.55 seconds per complete response in single local
runs. One comparison selected an equivalent alternate caption and hit only one of
two annotated exact spans; this is not independently measured semantic accuracy.

**Target:** hosted rollout, calibrated verified paraphrases, streaming, 200-source
capacity and a measured cost ceiling remain open under #25/#27. Study notes and
combined overviews remain AI-generated and should be inspected through citations.
See [acceptance, failures and limits](../reviews/working-product-acceptance-2026-10-08.md).

GitHub progress synchronized:
[#25 update](https://github.com/CloudKai/secondBrain/issues/25#issuecomment-6063522492) ·
[#27 update](https://github.com/CloudKai/secondBrain/issues/27#issuecomment-6063522961).
Both issues remain open for the broader target gates above.

## Shared learning reading format — local acceptance, 2026-10-09

**Implemented:** original source wording now uses assistant source cards, readable
paragraphs, prominent page/time labels and expandable original text. Full sources
retain PDF pages and bounded caption groups with original cues. Saved notes,
recall, combined overviews, separate source branches and archived notes use shared
16px/1.75/70ch reading styles. Existing material needs no regeneration.

**Checks:** 81 web tests, typecheck/build, lint and whitespace checks pass. Public
article/PDF/video evidence, live assistant cards, recall and topic views were
checked at desktop and narrow widths in dark/light appearances. Keyboard citation
opening/closing, focus return, long-text scrolling and 200% magnified reflow pass.
Native browser zoom did not respond; magnification used a temporary same-origin
fixture, now removed. Archives are covered by retained-capture rendering/client
tests, not a new live archive journey; complete screen-reader acceptance remains.

**Preserved:** original wording/coordinates, public APIs, backend/model/retrieval
behavior and existing generated note prose. Ambiguous extracted layouts stay literal.
Mobile/iOS and its tracker are untouched. #21/#23 remain open for the broader checks;
#25/#27 retain their AI quality/hosted targets. See [acceptance and limits](../reviews/reading-format-acceptance-2026-10-09.md).

GitHub progress published:
[#21 update](https://github.com/CloudKai/secondBrain/issues/21#issuecomment-6064090399) ·
[#23 update](https://github.com/CloudKai/secondBrain/issues/23#issuecomment-6064090981).
