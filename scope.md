# Scope: AI Second Brain

Second Brain lets an iOS user share a dense web article, choose one of two
folders, and receive a read-only four-point explanation with an interactive
concept graph and source links. Phase 1–2 delivered and verified that thin
slice. The roadmap thickens it in dependency order with anonymous-first
identity and persistence, durable background processing, vector cross-linking,
and release hardening.

## Stack

- **Current:** Expo/React Native/Expo Router, FastAPI/Pydantic, LangGraph/OpenAI,
  React Flow/Dagre in a WebView, transient React context.
- **Target:** Supabase Auth/Postgres, ARQ/Redis, Qdrant Cloud, and OpenAI
  `text-embedding-3-small`; deployment remains provider-neutral.

## At a glance

Status: `not started` · `decided` · `built` · `verified` · `built, needs a person to check`.

| # | Feature | Phase | Status |
| --- | --- | --- | --- |
| 1 | Strict LangGraph processing API | Phase 1 | verified |
| 2 | Native share capture and folder selection | Phase 2 | verified |
| 3 | Read-only summary, graph, and sources | Phase 2 | verified |
| 4 | Supabase anonymous auth and Postgres persistence | Phase 3 | decided |
| 5 | ARQ/Redis asynchronous processing | Phase 4 | decided |
| 6 | Qdrant related-knowledge retrieval | Phase 5 | decided |
| 7 | iOS release hardening | Phase 6 | not started |

## Phase 1–2: Verified MVP

### Decided

- The simplifier returns exactly four beginner-friendly bullet points.
- Ingestion tries a direct bounded fetch, a rendered reader fallback, then
  meaningful shared text.
- `POST /api/v1/process-link` remains synchronous and returns the complete typed
  result while the MVP is active.
- The only folders are `AI Engineering` and `System Design`.
- React Flow with Dagre is the active graph renderer; Mermaid remains in the API
  for compatibility.
- Items are stored only in mobile memory. The folder count includes every item
  in the current session, while the detail screen shows the newest item.

### What got built

- `backend/graph.py` — bounded ingestion, three-node LangGraph pipeline, summary,
  Mermaid, and typed graph output.
- `backend/main.py` and `backend/schemas.py` — strict FastAPI boundary.
- `mobile/app/modal/share.tsx` — native share folder selection and submission.
- `mobile/app/folder/[id].tsx` — read-only summary, graph, and sources.
- `mobile/components/InteractiveGraphViewer.tsx` — React Flow/Dagre WebView.

### Verified on 2026-09-17

- Backend: `8 passed` with
  `uv run --project backend --extra dev pytest backend/tests -q`.
- Mobile TypeScript: passed with `cd mobile && npx tsc --noEmit`.
- Mobile lint: passed with `cd mobile && npm run lint`.
- Expo Doctor: `21/21` checks passed.
- iOS simulator: Safari share → folder selection → processing → detail view;
  four bullets, source link, graph rendering/zoom, and folder count were checked.
- The previously blocked Medium article completed through the live local API.

### Current limitations

- Data is lost when the app process restarts.
- There is no authentication, tenancy, database, queue, or vector search.
- Processing blocks the HTTP request and can be affected by provider latency.
- Graph assets load from jsDelivr and require network access.
- Android is configured but not an acceptance platform and remains unverified.

## Phase 3: Identity and persistence

### Decided

- Create a Supabase anonymous user on first launch and persist its session.
- All Postgres rows are owned by `auth.uid()` and protected by RLS.
- Let the user later link Sign in with Apple to the same Supabase user instead
  of migrating rows to a new owner.
- Seed the same two fixed folders for each user; custom folders remain out of
  scope.

- [ ] Add Supabase client/session handling to mobile.
- [ ] Add Postgres schema, migrations, RLS policies, and seed behavior.
- [ ] Persist and list knowledge items from the API.
- [ ] Add guest-account recovery/upgrade messaging.
- [ ] Verify ownership isolation with two real test users.

## Phase 4: Asynchronous processing

### Decided

- Add authenticated v2 endpoints while preserving v1 during migration.
- FastAPI persists a `queued` item and enqueues only its stable item ID.
- ARQ workers read inputs from Postgres and use Redis only as transport.
- Status is `queued`, `processing`, `succeeded`, or `failed`.
- Jobs are idempotent and safe to retry.

- [ ] Add ARQ/Redis dependencies and worker entry point.
- [ ] Implement v2 create/read/list endpoints and mobile polling.
- [ ] Add bounded retries and user-safe terminal errors.
- [ ] Verify duplicate delivery cannot create duplicate rows or vectors.

## Phase 5: Related knowledge

### Decided

- Embed completed item summaries with `text-embedding-3-small`.
- Store one point per knowledge item in one cosine-distance Qdrant collection.
- Use the Postgres item UUID as the point ID and payload-filter every query by
  `user_id`; `folder_id` remains available for filtering and cross-folder labels.
- Qdrant returns IDs only; the API joins authoritative Postgres records.

- [ ] Add Qdrant collection/bootstrap and payload indexes.
- [ ] Upsert vectors only after the Postgres result succeeds.
- [ ] Return up to five related items across the user's folders.
- [ ] Add a read-only `Related ideas` section and verify tenant isolation.

## Phase 6: iOS release hardening

- [ ] Replace CDN graph assets or explicitly accept the online-only dependency.
- [ ] Add production backend URL and environment validation.
- [ ] Add observability for API, queue, worker, and provider failures.
- [ ] Configure a release pipeline and complete a physical-device share test.
- [ ] Document TestFlight/App Store delivery when a release channel exists.

## Explicitly out of scope

- Rich-text editing.
- Custom folders.
- Android acceptance or release work.
- A specific API/worker/Redis hosting provider.
- Treating Redis or Qdrant as authoritative storage.


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


## Structured browser study notes — ticket #2, 2026-10-03

Status: **verified locally and against the hosted development project**.
GitHub issue: https://github.com/CloudKai/secondBrain/issues/2.

- Captured articles request persistent English notes with an overview, variable
  substantive concepts, supported examples/equations and recall questions. Notes
  are read-only; citations open exact saved passages and the original URL.
- Added owned study acceptance/list endpoints and a reversible Postgres migration.
  Generation acceptance atomically creates one study and outbox per source. ARQ
  transports source IDs; SQL owns three-attempt cycles, leases and fenced writes.
  Redis loss and interrupted workers are recoverable without duplicating notes.
- The first capture persists separately. A failed generation request leaves a
  saved source with Generate study note; explicit retry reuses the failed study.
- Verified locally: 54 backend tests via the project interpreter; 20 web tests,
  build/typecheck and lint; desktop/narrow browser fixtures for citations, reload
  and failure/retry. The exact pytest entrypoint still selects a stale external
  interpreter; `python -m pytest` passes.
- Hosted generation and recovery passed with the applied migration and configured
  server-only keys. Keep Redis and the worker running for development; see
  `docs/study-note-setup.md`. Ticket #1 hosted capture remains verified.
- This unit does not implement PDF/video ingestion, persistent topic organization,
  live assistant/research, source refresh or native integration. Existing native
  changes and v1 contracts are preserved.

Hosted acceptance passed on 2026-10-03 after the user approved applying the
reviewed migration to AI Study Friends. A real article completed on attempt one;
citations opened exact excerpts, reload restored the same note, and repeated
requests reused it. Another anonymous learner could neither read nor generate
that source's note. A request accepted while Redis was stopped remained in the
persistent outbox. After a processing worker was killed, its lease expired and
the restarted worker completed attempt two with 13 exact references, one note
and no remaining dispatch. Disposable verification captures were removed.


## Selectable-text PDF notes — ticket #3, 2026-10-03

Status: **verified locally and against the hosted development project**.
Issue: https://github.com/CloudKai/secondBrain/issues/3.

PDF uploads and public PDF links join the owned source/study workflow with
physical page metadata and exact page-bound references. Inputs are bounded to
10 MB, 100 pages and 30,000 captured characters; missing/omitted text is labelled.
Scanned-only, encrypted, oversized and unreadable files receive correction paths.
Uploads retain captured page text and filename, not the original binary. Source
identity, RLS, read-only notes, retry limits and worker fencing are preserved.
Live upload and a 15-page public PDF completed through the worker. Exact page
citations, reload, digest reuse and second-learner API/RLS isolation passed.
Final checks: 71 backend tests, 24 web tests, web build/typecheck and lint passed.
Independent standards/spec reviews are complete; two standards findings were
fixed and re-reviewed. Temporary acceptance sources and their jobs were removed.
Migration/rollback and limits: `docs/pdf-study-setup.md`. Native code is unchanged.
PDF page-range selection, OCR, videos, topics and research remain target work.


## Citation and PDF title polish — issue #4, 2026-10-03

Implemented: citation numbers inherit the surrounding text size and use inline
circular mint badges matching the supplied reference. Touchscreens retain a
44px pointer target. The PDF input is labelled Topic
title with a topic-name example. No automatic PDF acceptance prefix exists;
that wording was a manually entered disposable verification title. A supplied
title is kept as-is; uploads otherwise use their filename.
Web typecheck/lint passed and the circular badges were inspected in the browser.
No new tests were requested or run. Native files are untouched.


## Supplied video transcripts — issue #5, 2026-10-03

Status: verified locally and against the hosted development project.
Issue: https://github.com/CloudKai/secondBrain/issues/5 (planning draft 04).

The browser Video form saves YouTube, Teams/SharePoint, Zoom and Panopto
recording context with uploaded UTF-8 TXT/VTT/SRT or pasted transcript text.
Owned immutable captures preserve supplied speaker labels and cue times; study
notes cite exact passages with no inferred times. YouTube links can open at a
supplied time; other providers open the original recording with visible times.
Limits and migration/rollback: `docs/video-transcript-setup.md`. Native files
are untouched. Automatic retrieval, provider connections, topics and research
remain target work. GitHub issue #5 acceptance is complete.

Final checks: 93 backend tests, 28 web tests, web build/typecheck and lint pass.
Timed VTT upload and untimed paste generated live notes; reload, exact cue and
excerpt citations, Panopto reuse, SRT zero time, Teams context and second-learner
API/REST/RPC isolation passed. Review: Standards 0 remaining; Spec 0 remaining.
Six disposable verification captures and their notes/jobs were removed and
the cascade was verified; private test session tokens were discarded.
The browser viewport override remained at 1265px; phone-width verification
is not claimed. Existing responsive styles and native files were unchanged.


## Web ticket progress synchronization — 2026-10-03

The ticket breakdown now marks planned slices 01–04 complete and maps them to
closed GitHub #1/#2/#3/#5; the additional citation/title polish is GitHub #4.
Tickets 05–15 remain target behavior and unpublished. Later provider/long-source
criteria already satisfied by shared capture work are checked individually,
without marking automatic access, range selection or whole future slices complete.
The progress tracker headline now points to the latest verified web work and
links to the full ticket overview. GitHub completion records were checked; no
implementation or new tests were added by this documentation update.


## Accessible YouTube captions — issue #6, planned ticket 05 (2026-10-03)

Status: complete, verified locally and against the hosted development project.
Real anonymous English caption retrieval returned 286 cues / 18,430 characters
and generated a persistent read-only note. Its 13 references match saved excerpts
and real cue ranges. Browser citation p0020 shows 1:15.120–1:18.950 and links to
75 seconds; reload/canonical reuse restored the same note. Unavailable retrieval
retained URL/title and opened upload/paste; supplied VTT then generated a note
with pasted provenance and exact 5.250–20.500 second timing. Cross-learner
API/REST/RPC access was denied. The real Neural networks note is retained; only
the synthetic fallback capture was removed, with its study/outbox cascade verified.

Final checks: 103 backend tests, 30 web tests, web build/typecheck and lint pass.
Standards — three findings fixed, no remaining material issue; Spec — zero
material defects. Minor timeout documentation corrected. Setup and reviewed
migration/rollback: `docs/youtube-transcript-setup.md`; review:
`docs/reviews/ticket06.md`. No account, authentication/consent cookies, proxy
bypass, audio/video download or transcription. Other providers’ automatic access
remains planned. Browser checks were at desktop width; production is unconfigured.

Web progress lives in `context/web-progress-tracker.md` and per-ticket status in
`docs/planning/web-learning-library-tickets.md`; native progress stays in
`context/progress-tracker.md`, as requested. Existing unrelated native/v1 working
tree changes are not part of this ticket. Next proposed slice: planned ticket 06,
Teams transcript access and feedback.


## Teams transcript access — issue #7 (2026-10-03)

Status: complete; verified locally and against hosted development storage.
Independent Standards and Spec review found no material issues; a naming
suggestion was applied. Planned ticket 06 shows permission/export guidance
and immediately opens upload/paste for Teams/SharePoint recording context.
No anonymous retrieval method is validated; automatic Teams retrieval is not a
current capability. The app does not inspect recording-specific permissions,
existence, processing or deletion, and connects no Microsoft account.

Controlled VTT upload generated a saved note with the Lecturer label and exact
5.250–20.500 second citation; reload restored it. Readable text paste generated
an untimed note. Duplicate import reopened the same note; all three references
matched saved text/cues, and second-learner API/REST/RPC access was denied.
Fixtures use fictional recording context, not private Teams access. Local checks:
104 backend tests, 30 web tests, build/typecheck and lint pass using the project
Python interpreter. Setup: `docs/teams-transcript-setup.md`. No migration or new
credentials; native/v1 changes are excluded. Web status remains in the dedicated
web tracker and ticket breakdown. Zoom/Panopto automatic support remains target work.

Both controlled captures and their study/outbox rows were removed with cascade
verified; existing learner notes are preserved. Review: `docs/reviews/ticket07.md`.
The web ticket breakdown and GitHub #7 are synchronized. Next proposed slice is
planned ticket 07, Zoom transcript availability/export feedback; not started.


## Zoom transcript availability — issue #8 (2026-10-03)

Status: complete; verified locally and against hosted development storage.
Independent Standards and Spec reviews found zero material issues. Planned ticket 07 immediately opens upload/paste
for Zoom share/play recording context, with cloud VTT export instructions and
conditional next steps for processing, missing, restricted, expired/deleted
material. The app lacks Zoom download authorization and does not infer the
specific recording's state. A URL or passcode alone is not transcript permission.
No anonymous retrieval method is validated or advertised; account integration,
webhooks, private-page scraping, bypass and media processing are excluded.

Hosted controlled VTT upload preserved the Lecturer label and 5.250–20.500
second citation after reload. Text paste generated untimed evidence; duplicate
intake with transcript input and a fragment variant reopened the same note.
All three references matched stored text/cues; another learner received
API404/RESTempty/RPCdenied. Fixtures use fictional recording context, not private
Zoom access. Local checks: 106 backend tests, 30 web tests, build/typecheck and
lint pass using project Python. Setup: `docs/zoom-transcript-setup.md`. No new
migration/credentials or native/v1 changes. Web progress and planning files are
updated; native history remains separate. Panopto is the next proposed slice.

Both controlled captures and their study/outbox rows were removed with cascade
verified; existing learner notes are preserved. Review: `docs/reviews/ticket08.md`.
GitHub #8 and both web progress records are synchronized. Planned ticket 08,
Panopto caption access/tenant fallback, remains an unpublished draft; not started.


## Panopto caption access — issue #9 (2026-10-03)

Status: complete; local checks, hosted acceptance and independent review passed.
Planned ticket 08 opens supplied transcript controls for recognized Panopto viewer
links and displays the actual site hostname. Conditional export, lecturer/site
administrator and UTF-8 correction help preserves URL/title. It does not infer
an institution name, site policy, lecture existence, permissions or captions.
No anonymous caption path for a concrete session is validated or advertised;
automatic retrieval and institutional integrations remain target work.

Controlled SRT upload preserved the Lecturer label and 5.250–20.500 second
citation after reload. Paste generated untimed excerpt evidence. The same session
ID on two sites remained distinct; display/query/fragment variants reused the
saved note. All three references matched stored text/cues. Another learner
received API404/RESTempty/RPCdenied. These fictional contexts verify supplied
intake, not private lecture access. Checks: 108 backend tests through project
Python, 30 web tests, build/typecheck and lint pass. The bare pytest launcher
retains its stale external interpreter. No migration, credentials or native/v1
changes. Setup: `docs/panopto-transcript-setup.md`. Web progress stays in the web
tracker and ticket breakdown. Next proposed slice: planned 09, saved-source
topic cards and graph; unpublished and not started.

Both reviews found no material findings; Standards noted one optional future
rendering cleanup. Both synthetic captures and note/job rows were removed with
cascade verified; existing learner notes remain. Review: `docs/reviews/ticket09.md`.
GitHub #9 is closed and both web records are synchronized. Commits are local.


## Saved-source topic graph — issue #10 (2026-10-03)

Status: selected planned ticket 09; implementation and acceptance pending.
The existing approved plan is published with completed GitHub #2 as its blocker.
Inspection covers the owned study worker and supplied browser topic/graph views.
Topic analysis will be stored separately from completed notes so mapping failure
does not invalidate source notes. Main/supporting topics need saved evidence;
no prepared outline, mention-only coverage or unsupported broad-group edges.
Clear contextual matches share identities; uncertain suggestions remain distinct
until learner placement confirmation. Two independent sources gate meaningful
connections; repeat imports do not count twice. No vector service is required.

New topic API/model HTTP/database/browser test-boundary agreement is pending
under the TDD skill. No tests or implementation changes at this checkpoint.
Combined topic synthesis and broad corrections remain planned tickets 10/11.
Both web progress files reflect current work; native history stays separate.


## Topic-graph implementation checkpoint — issue #10 (2026-10-03)

Status: local implementation and checks complete; independent review and hosted
migration/acceptance pending. User agreed topic API, model HTTP, database and
browser-navigation test boundaries. Source-backed cards and contextual alias
matching, uncertain placement confirmation, explained relationships and the
two-source threshold reuse the supplied design. Examples are explicitly selected
and separate from saved topics. Source notes and evidence are preserved.

Separate owned topic mapping jobs use the existing Postgres/outbox/ARQ transport;
claims serialize matching within a learner. Migration/rollback preserve source
notes and backfill existing completed notes. Model and graph limits show partial
coverage. No new credentials or vector service; native/iOS and v1 unchanged.
Local checks: 112 backend tests through project Python, 34 web tests, build,
typecheck and lint pass. Setup: `docs/topic-graph-setup.md`. Combined synthesis
and broad corrections remain planned tickets 10/11.


## Topic-graph hosted acceptance — issue #10 (2026-10-04)

Completed web planned ticket 09; this supersedes its pending checkpoints above.
The user approved the SQL warning; the topic migration succeeded and the worker
restarted. The existing Neural networks note mapped on attempt one. Controlled
RAG notes reused a substantive topic; unrelated calculus created no invented
relationship. Empty/first-source thresholds and learner API/RLS/worker isolation
passed. Placement confirmation and keeping separate persisted without changing
notes. A UUID JSON parsing defect was fixed with an authenticated RED→GREEN
regression, then verified hosted.

Browser exact passage links, reload, saved/example history and a seven-topic
focus view passed. The relationship explanation used a controlled supported
relation; extraction/mention filtering also have model HTTP checks. Six temporary
sources and their study/topic/outbox rows were removed with cascades verified.
The original Neural networks capture, study and map remain. Topic matching took
two attempts for RAG and three for the related Neural networks fixture; its
results remain evidence to inspect, not a mastery score or guaranteed taxonomy.

Final checks: 113 backend tests through project Python, 34 web tests, build,
typecheck and lint pass. Bare pytest still has a stale interpreter. Standards
and Spec re-review: no remaining findings. Both web progress files synchronized;
native/iOS and its tracker unchanged. Next is planned ticket 10, combined topic
overviews/source branches, unpublished and not started. Setup and review:
`docs/topic-graph-setup.md`, `docs/reviews/ticket10.md`. Commits remain local; no
production release or new phone-width acceptance is claimed.


## Combined topic overviews — issue #11 selected (2026-10-04)

Target slice: web planned ticket 10, dependent on completed #10. Combine will
request a cited synthesis across completed owned notes assigned to one topic,
preserving agreements/disagreements and exact source passage identities. Keep
separate will show individually styled source-note branches under the same
parent. View choice will persist per learner/topic; original notes stay read-only.
Topic-word navigation will open its contextual overview.

Use the existing authenticated Postgres/worker/outbox boundary with bounded
processing, explicit retry and honest pending/partial/failure feedback. Fence
results against current source membership so stale or removed-source citations
cannot appear. Broad topic corrections remain planned ticket 11; no new
ingestion, vector service, credentials or native/iOS change. New test seams
await agreement under TDD; no implementation or tests at this checkpoint.
Both web progress records are updated.


## Combined topic overview implementation — planned 10 / #11

Local implementation/checks pass at the agreed API/model HTTP/database/browser seams. Hosted acceptance and independent review remain pending. Explicit Combine queues cited synthesis; Keep separate preserves source branches and persisted per-topic choice. Membership changes hide stale results and fence late workers. Original notes are read-only; broad corrections remain planned 11.


### Topic overview review checkpoint — #11

Local checks and both independent reviews pass; hosted acceptance awaits approval
of the staged Supabase warning. No hosted overview capability is verified yet.


## Verified combined topic overviews — planned 10 / #11 (2026-10-04)

Supersedes the local-only checkpoints above. The approved migration is applied
and the worker restarted. On-demand cited synthesis, attributed disagreements,
separate source branches and persisted Combine/Keep separate are verified in
hosted development. Exact PDF/video references and original notes are preserved.
Mixed certainty requires confirmation; source membership revisions hide stale
results and fence late workers. Hosted API/browser model runs each passed on
attempt 1 using controlled fictional saved sources. Fixtures/derived queues were
removed and verified. 117 backend tests, 39 web tests, build/typecheck and lint
pass; both independent re-reviews have no remaining findings through a9c4507.
GitHub #11 and both web records are synchronized. Next draft: planned 11, broad
persistent corrections/removal. Native/iOS and its tracker unchanged; commits
local, desktop acceptance only, production unconfigured. Semantic synthesis
quality requires evidence inspection. Setup/review: docs/topic-overview-setup.md
and docs/reviews/ticket11.md.


## Persistent topic corrections — planned 11 / #12 selected (2026-10-04)

Target unit: durable saved-topic rename/merge, source membership corrections and
connection decisions through one authenticated atomic database boundary.
Original notes remain read-only. Redirects, assignment overrides and rejection
precedence must survive later automatic writes and source removal. Current
evidence drives graph rebuilds; fingerprints hide stale combined citations.
The user agreed correction/removal API, database ownership/worker fences and
browser correction/reload/citation seams. Focused local checks pass; independent
review, full suite, migration and hosted acceptance remain pending. Native/iOS
and its tracker remain unchanged. Setup: docs/topic-corrections-setup.md.


## Verified persistent topic corrections — planned 11 / #12 (2026-10-04)

Supersedes the pending correction checkpoint. The approved migration is applied;
owned saved-topic rename/merge, source assignment overrides and connection
decisions persist in hosted development. Rejection wins merged pairs and remains
recorded when support disappears. Future worker writes respect learner rules;
owner-before-row locks serialize completion/corrections. Original notes and exact
PDF/video passages remain unchanged. Current evidence rebuilds graphs and hides
stale overviews; source deletion cascades fence obsolete citations/late writes.
118 backend tests, 46 web tests, build/typecheck/lint and both independent reviews
pass. Hosted API/browser correction acceptance and scoped fixture cleanup pass;
merged synthesis succeeded on attempt 1 before correction invalidated it.
Sequential after-claim regression only; deterministic concurrent overlap untested.
GitHub #12 and both web records synchronized. Native/iOS and its tracker unchanged;
commits local, desktop acceptance only, production unconfigured. Next draft:
planned 12 reuse/versioned refresh, not started. Setup/review: topic-corrections.


## Source reuse/versioned refresh selected — planned 12 / #13 (2026-10-04)

Target unit: compare repeated supported captures, offer explicit refresh, retain
exact prior capture/note versions and one independent source identity. Lease and
reader version fences prevent stale citations; current evidence rebuilds topics
and hides outdated overviews. Preserve learner rules; assignments with missing
support require evidence review. Uploaded PDF refresh explicitly targets the
saved source, not a similar filename. No new ingestion/provider services or
native/iOS changes. Inspected existing capture/queue/correction boundaries and
published #13 with completed #3/#5/#12 blockers. TDD seam agreement requested;
implementation/tests/migration/acceptance not started. Both web records updated.
Setup: docs/source-revisions-setup.md.


### Versioned refresh local implementation — #13

At agreed capture/refresh API, external HTTP, database and browser seams, local
comparison/confirmation, immutable saved-version readers, PDF identity aliases,
current reader/version/lease fences and retained correction review are implemented.
Unique saved excerpts reanchor corrected assignments; changed evidence requires
learner confirmation before graph use. Source recall and stale evidence caches
reset on refresh. Focused checks pass; full checks/review, migration and hosted
acceptance pending. Native/iOS and its tracker unchanged.
