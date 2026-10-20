# Scope: AI Second Brain

## Path quiz v1 (Slice 2) — implemented in development, not build-verified, 2026-10-20

**Implemented in development, not build-verified.** The migration is not applied
and needs owner approval; the sandbox could not run the SQL, the pytest suites
that need pydantic, fastapi or httpx, the zod and react web tests, typecheck,
lint, build, a browser or a live model call. The exact ran / NOT run lists are in
[the web progress tracker](context/web-progress-tracker.md). The design specification is
[docs/planning/path-quiz-spec.md](docs/planning/path-quiz-spec.md) (revision 3:
the first design review's findings are resolved in the spec, and the later
amendments have had no second review round). The slice adds
an optional end-of-path quiz for one confirmed learning path revision:
single-choice, true/false and multi-select questions
graded deterministically on the server, plus one or two short answers with
provisional AI feedback. Questions and explanations cite only passages the path
already cites. The answer key stays server-side until an attempt is submitted.
Results are shown as "X of Y" with a "Looks solid" or "Worth reviewing" label per
outcome and are evidence, not proof of mastery; the quiz never blocks progress.
A retake reuses the stored quiz with no model call; new questions are generated
only on request, within server-side daily limits persisted in Postgres. A daily
unit is refunded only when the AI request provably never reached the service or
was rejected for an owner-side reason (HTTP 400, or HTTP 429 reporting an invalid
request or exhausted quota); timeouts, rate limits and every completed response stay
counted.

**Proposed, not applied:** one migration with a matching rollback
(`202610200023_path_quiz`). A backend quiz module and a Quiz tab in the lesson
workspace are implemented in development. No migration has been applied to any
database.

**Out of scope:** spaced repetition, scheduling, due dates and a review queue
(Slice 3); mastery claims; gamification; global spend caps (see U5). The quiz is
not available to learners until the migration is approved and applied and the
owner commands have been run.

## Web design foundation (Slice 1) — implemented in development, 2026-10-20

Web-only visual and structural foundation: design tokens with light, dark and
system themes (persisted override), shared UI primitives, a simplified sidebar,
a calm Home and a lesson-first collection workspace. See
[UI context](context/ui-context.md#design-system-web).

**Verified locally:** prettier parse, TS syntax-only check, CSS selector
comparison, contrast script and pure tests for theme, shell navigation and Home.

**Pending:** typecheck, lint, build, `npm test`, browser screenshots,
light/dark visual review and accessibility checks (npm was unreachable in the
sandbox). Owner command: `npm --prefix web install && npm --prefix web run typecheck && npm --prefix web run lint && npm --prefix web run build && npm --prefix web test`

Target work for later slices only: path quiz, spaced review, goal intake and
recommendations. None of these is available yet.

## Vercel services configuration prepared — 2026-10-20

Root configuration defines `backend` (FastAPI) and `web` (Vite), with public
`/api/*` and catch-all web routing. The deployment entrypoint preserves existing
Python package imports and PDF subprocess execution; `/api/health` provides a
routed health check. Browser
calls already use same-origin `/api/v2`, so no runtime service bindings apply.
External ARQ worker hosting and provider configuration are documented in
[Vercel deployment](docs/vercel-deployment.md).

**Verified locally:** isolated flattened-service import and health/auth/404
checks; 361 backend tests via the existing virtual environment; 134 web tests;
web build/typecheck/lint. The exact uv test command selects system pytest and
fails collection on missing `langchain_openai`. Vercel CLI 64.5.0 accepts both
services and starts Vite; backend startup requires uv >=0.9.25 (installed 0.7.12).
CLI login refresh also appeared; validation was stopped. Combined `vercel dev -L`
acceptance is not verified. **Pending:** user confirmation of service names,
public paths, no bindings, and separate worker hosting; updated local uv/CLI
authentication, combined routing checks and hosted deployment acceptance.
No deployment or native change.

## U3a2 implemented in development — 2026-10-10

[#36](https://github.com/CloudKai/secondBrain/issues/36) under #29: initial source paths can use full captured material through existing BM25/semantic retrieval. New immutable plans have a cited, sampled concept/coverage manifest; explicit Saved note passages remains compatible. Original spans/pages/times, ownership, capture/index snapshots and failed-preview recovery are enforced. No existing learning is regenerated; multi-source revisions still use their existing saved-note policy.

Migration **022 applied after exact approval**; live MIT PDF previews persist Luna-generated lessons and exact original page references without activation. The current lesson, draft, conversation and 0 studied / 2 attempts / 2 provisional checks remain intact. **361 workspace backend / 134 web; 295 isolated backend / 121 web tests**, web typecheck/lint/build pass. Exact uv runner still has the system-pytest dependency issue. Separate reviews clear. See [acceptance](docs/reviews/capture-teaching-acceptance-2026-10-10.md).

#36 stays open for actual 200% zoom/screen-reader checks. Independently reviewed synthetic cases and one live PDF do not calibrate teaching or grading. **Next target U3a3**: outcome-specific full-capture evidence for multi-source contribution previews, then U3b stable outcomes/practice. U4/U5 remain target work. No push/mobile/iOS/TinyFish; older WIP stays separate. Checkpoint before the next unit.

## Web U3a1 development checkpoint — 2026-10-10

Completed owned read-only teaching evidence preview (#35/#29), using full captured sources within confirmed plan membership, current BM25+dense RRF and original citation spans. Explicit partial-index consent and sampling limitations; exact owner/version/hash/index/membership fences; bounded selection. Existing lessons and history unchanged, no new migration/model/teaching generation policy. Acceptance: docs/reviews/teaching-evidence-acceptance-2026-10-10.md. 344 workspace backend/126 web;278 isolated backend/113 web; typecheck/lint/build pass and separate reviews clean.

Target next: U3a2 independently reviewed teaching cases and concept/coverage/lesson integration, U3b stable outcomes/checks later. U3–U5 remain incomplete; old U2 accessibility/download gates open. Current native/mobile baseline is unchanged. No push; older WIP remains separate.


## U2c2 lesson conversations — implemented in development, 2026-10-10

[GitHub #34](https://github.com/CloudKai/secondBrain/issues/34), part of #29, adds saved lesson conversations per owned collection and immutable plan/lesson. Checked idempotent sends preserve pending questions across reload; server-selected recent context never becomes evidence. Provenance, source-change completion fences, source-removal redaction, fresh reopen/export and revision-checked clear retain drafts/attempts separately. Model policy is unchanged.

**Migration 021 applied** successfully. One live Luna hint survives full reload, and its exact timed video citation/focus return works. Collection remains 0 studied/2 attempts/2 checks need review. **124 workspace web /324 backend**, web typecheck/lint/build pass; isolated unit **111 web /258 backend** passes. Separate reviews have no remaining actionable findings. See [acceptance](docs/reviews/learning-conversations-acceptance-2026-10-10.md).

#34 stays open for actual 200% zoom, screen-reader and native-download completion (export payload verified). **Next target: U3 teaching from full captured evidence with stable outcomes and improved practice.** U4 map/discovery and U5 shared AI policy/operations remain target work. Earlier WIP preserved; no push or mobile/iOS change.

## U2c1 unfinished learning drafts — implemented in development, 2026-10-10

[GitHub #33](https://github.com/CloudKai/secondBrain/issues/33), part of #29, adds owned answer/question drafts per collection, immutable plan and lesson. Autosave shows Saved/Unsaved/Retry/conflict states; tab-private pending recovery survives same-tab reload/navigation. Revision checks and idempotent save IDs protect retries and multiple tabs, including opener clones. Changed/removed source evidence retains learner-authored writing. Clear is a checked empty save; Download exports this draft’s versioned JSON. Drafts never count as attempts/activity. Existing tutor replies remain view-local.

**Migration 020 applied** successfully to AI Study Friends. Live lesson-two answer/question drafts survived reload and were then cleared; the collection remained at 0 studied, 2 attempts and 2 provisional checks. Exact timed video evidence and keyboard focus return still work. **118 workspace web / 311 backend tests pass**, plus web typecheck/lint/build. Backend uses its existing virtual environment because the exact uv runner selects system pytest missing a dependency. Spec and standards review findings are resolved. Isolated HEAD + this unit passes 105 web / 245 backend tests and web typecheck/lint/build. Measured 1440×900 dark and 390×844 light live layouts have no horizontal overflow.

See [U2c1 acceptance](docs/reviews/learning-drafts-acceptance-2026-10-10.md). #33 remains open for actual 200% zoom, screen-reader acceptance and native download completion; the actual export payload is verified at the browser boundary. **Next target:** U2c2 completed tutor exchanges, with its own provenance/retention/redaction/send/recovery contract before implementation. U3–U5 remain target work. Earlier WIP is separate; no push or mobile/iOS changes.

## U2b collection workspace — implemented in development, 2026-10-09

[GitHub #32](https://github.com/CloudKai/secondBrain/issues/32), part of #29, adds an owned `#collection/<id>` learning destination and collection home. Library resume, source entries and topic learning actions open the same saved path/lesson. Teaching, practice and review are primary; sources, plan coverage, map and dated version history are secondary. Removed anchors retain goals/answers without fabricated evidence. Metadata refreshes after confirmation without remounting the lesson; initial snapshots avoid duplicate reads.

**113 workspace web / 299 backend tests pass**, web lint/typecheck/build pass. Isolated commit files also pass 100 web tests, typecheck/build and lint. Backend used its existing virtual environment; the exact uv command still selects system pytest missing `langchain_openai`. Spec/standards review findings are resolved. Live PDF/video collection resume/reload, retained practice, exact timed evidence and keyboard focus return pass. Measured 1440×900 and 390×844 dark/light layouts fit without horizontal overflow. Unknown IDs fail safely; navigation leaves persisted activity unchanged. Fixture HTTP confirmation verifies fresh goal/counts without live model or database writes.

No new migration, model or retrieval policy. See [U2b acceptance](docs/reviews/collection-workspace-acceptance-2026-10-09.md). #32 stays open for actual 200% zoom and screen-reader acceptance. **Next target:** U2c durable unfinished answers/tutor conversations; U3–U5 remain target work. Earlier unrelated WIP remains separate. Local changes only; no push and mobile/iOS untouched.

## U2a collection identity — implemented in development, 2026-10-09

[GitHub #31](https://github.com/CloudKai/secondBrain/issues/31) delivers the identity/backfill subunit of #29. Owned collection IDs survive removal of the original capture. Repeatable backfill retains paths, plans, attempts, branches, exact citations and cursor metadata. Confirmed source membership is deduplicated; pending previews do not increase coverage. Authenticated collection reads, legacy aliases and checked selection are implemented.

**Migration 019 applied** to AI Study Friends. Hosted backfill mapped 2 collections, 3 paths, 5 plans, 1 place and 3 attempts with zero unmapped records. Live authenticated list/detail/alias reads match legacy learning snapshots; no-auth reads return 401 and unknown IDs return 404. Saved lesson two, cursor revision and activity remain unchanged by reads. **299 backend / 106 web tests pass**, plus web typecheck/lint/build. Backend used its existing virtual environment because the exact uv runner selected system pytest without a project dependency. Spec/standards reviews have no remaining actionable findings. Recovery retains reads/history and legacy writers while disabling new selection.

See [U2a acceptance](docs/reviews/collection-identity-acceptance-2026-10-09.md). Local implementation commit `ee2f0c4`; no push. **Next target:** U2b collection workspace/navigation, then U2c durable drafts/chat; U3–U5 remain target work. U1's exact viewport, actual 200% zoom and screen-reader gates remain open under #30. Mobile/iOS untouched.

## U1 learning continuity — implemented in development, 2026-10-09

[GitHub #30](https://github.com/CloudKai/secondBrain/issues/30) delivers the first
unit of #29: relevant note context, persisted selected-path/lesson resume,
consistent saved activity and visibly distinct current/previous plan versions.
Viewing history does not activate it; navigation does not award learning activity.
Late selection completion refreshes Library and stale writes restore owned state.

Migration 018 applied after the user's explicit approval. It adds timestamp/revision
metadata, an authenticated summary and checked selection while retaining learner
history, captures and citations. Legacy timestamps remain unknown until selection.
**296 backend / 99 web tests**, web lint/typecheck/build and rollback preservation
checks pass. Backend ran via its existing virtual environment; the exact `uv`
runner could not resolve its system pytest dependency environment.

Live PDF/video resume, reload, history and timed citation/focus return checked.
The compact view works in both themes. Exact viewport matrix, real 200% zoom and
screen-reader checks remain acceptance gates; #30 stays open. Details and six
screenshots: [U1 acceptance](docs/reviews/learning-continuity-acceptance-2026-10-09.md).
**Target, not implemented:** U2 independent collections/durable drafts/chat and
U3–U5 teaching, map/discovery and AI operations. Mobile untouched; changes local.

## Ideal learning specification — published, 2026-10-09

The audit and roadmap are synthesized into [GitHub #29](https://github.com/CloudKai/secondBrain/issues/29),
labelled `ready-for-agent`, with a [local specification](docs/planning/ideal-learning-app-spec.md).
**Target, not implemented:** 68 user stories and five ordered units covering
continuity, independent topic collections, deeper teaching/practice, growing
map/discovery and AI/operational readiness. Existing learning ownership, exact
citations and history are preserved by the specified compatibility rules.
The next implementation unit is U1; specification publication does not implement
app behavior or satisfy #28's quality/release gates. Document/tracker checks only;
no application changes, provider calls or migrations in this unit. Mobile untouched.

## Ideal learning experience audit — delivered, 2026-10-09

Completed the requested product, UX, teaching and configuration review of local
HEAD `1835298305d50f6a9042a1ef9b7c4a56c8ca242e` plus existing working changes.
The [audit](docs/reviews/ideal-learning-app-audit-2026-10-09.md) records strengths,
14 findings, screenshots, configuration policies and evidence limits.

**Target, not implemented:** the [five-unit roadmap](docs/planning/ideal-learning-app-roadmap-2026-10-09.md)
covers continuity, independent collections, full-capture teaching evidence and
stable outcomes, broader maps/discovery, and AI/operational readiness. Each unit
defines compatibility, failure behavior, checks and recovery. Application changes
follow after plan acceptance. This documentation unit changes no app code or
database state; mobile/iOS remains outside scope. Document links/assets and
whitespace checked; application tests not rerun. #28 remains open for acceptance.

## Goal branches and learning maps — implemented in development, 2026-10-09

**Implemented:** the third development unit of #28. Explicitly changed goals
preview a separate retained path with a new application question. Original goals,
source notes, difficulty levels and answers stay saved. Owned selected-plan/lesson
positions restore on reopening. Applicable prior learning is shown only for exact
matching outcomes, level and original evidence; it provides context and never
passes the branch's new check.

A teaching map opens from the first source. Its suggested-order arrows and closed
path previews are distinct from the existing topic graph's evidence relationships.
Topic graph panels show collection paths, study activity, attempts and provisional
checks separately. Deleted anchors open owned retained history. No mastery claim
or inferred equivalent assessment result is added.

**Checks:** migration 017 applied after approval; 294 backend / 95 web checks,
typecheck, lint and build pass. Independent spec/standards reviews cleared after
branch exercise, cursor restoration, locked source and deleted-anchor fixes.
Live PDF/video branch confirmation, independent practice, exact timestamp citations,
reload restoration and desktop/narrow dark/light presentation checked.
Full semantic teaching/assessment evaluation, hosted cost/latency/capacity,
screen-reader and actual 200% browser zoom remain rollout gates. Feedback remains
Needs review. #28 remains open for full acceptance. See [branch acceptance](docs/reviews/learning-branches-acceptance-2026-10-09.md).


## Learning collections — implemented in development, 2026-10-09

**Implemented:** explicit related-source contribution previews and confirmed plan
revisions for #28. A collection retains 2–8 owned sources, original notes, goals,
prior plans and answers. Related candidates can share confirmed topics with any
current member. Multi-source difficulty previews retain the collection. Exact
citation aliases resolve to original source/version/passage/page/time coordinates.
Changed source versions or topic assignments fence stale writes; source removal
clears copied evidence while retaining learner answers.

**Checks:** migration 016 applied to the development project; 291 backend and 89
web tests pass, plus typecheck, lint and build. Public RPC checks cover ownership,
leases, member changes, explicit confirmation, retained attempts and safe rollback.
Live PDF/video contribution preview and exact citation inspection checked. Feedback
remains provisional; no verified grades or mastery. Goal branches and graph states
are the next unit. Full evaluation, desktop/200% zoom and public rollout remain
open. See [collection acceptance](docs/reviews/learning-collections-acceptance-2026-10-09.md).


## Topic learning journey — first phase implemented in development, 2026-10-09

**Implemented:** the first one-source unit of [#28](https://github.com/CloudKai/secondBrain/issues/28)
now offers editable goals, previewed paths, outcome-driven lessons/examples,
written practice, provisional criterion feedback, hints/retry/worked answers,
a lesson tutor, retained difficulty/history and library review. Postgres/RLS
owns saved progress; source changes fence writes and removed sources retain
answers while capture reference excerpts are cleared. Migration 015 is applied.

Per-request Luna medium runs first; Sol 6.1 medium can repair invalid structure
or attribution once. All feedback remains Needs review; no verified pass/mastery.
The learner approved authenticated API, model HTTP and browser test boundaries.
284 backend / 85 web tests pass, plus typecheck/lint/build and whitespace checks.
The live public-article journey verified confirmation, practice/tutor, exact
citation and difficulty/reload preservation in both themes at narrow width.

**Remaining:** desktop/200% zoom controls were ineffective in IAB; live PDF/video
journeys, full accessibility and held-out semantic/cost/latency acceptance remain.
Multi-source revisions and goal branches/graph progress are later phases. #28
stays open. See [acceptance](docs/reviews/learning-journey-acceptance-2026-10-09.md).
Mobile/iOS and its progress tracker are untouched.

## Topic learning journey — specification published, 2026-10-09

**Target, not implemented:** [GitHub #28](https://github.com/CloudKai/secondBrain/issues/28)
is labelled `ready-for-agent`. It specifies topic collections, editable goals,
previewed paths/background teaching, guided practice and evidence-based feedback,
per-path difficulty with retained history, durable progress/review, source-driven
plan revisions, goal branches and distinct graph learning indicators.

First delivery is a complete one-source teaching journey. Model selection is
per request through backend code: Luna medium initially, Sol 6.1 medium as the
escalation candidate. Conservative escalation signals/limits and semantic
quality/cost gates are documented as proposed/measured decisions. Test boundaries
await the focused skill-required check. No application implementation, model
switch, migration, test run, commit or push occurred for this specification.
Documentation whitespace check passes. Mobile/iOS and its tracker are untouched.
See [specification](docs/planning/topic-learning-journey-spec.md) and retained
[interview decisions](docs/planning/topic-learning-journey.md).

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
#25/#27 retain their AI quality/hosted targets. See [acceptance and limits](docs/reviews/reading-format-acceptance-2026-10-09.md).

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
See [acceptance, failures and limits](docs/reviews/working-product-acceptance-2026-10-08.md).

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
next. [Implementation, failures and next gates](docs/reviews/claim-generation-review-2026-10-08.md). #25/#27 stay open.
Native/iOS tracker untouched; no migration, worker, commit or push.

## Claim/evidence preparation — development acceptance, 2026-10-08

Implemented private per-claim citation export, an offline unreviewed-draft exporter,
and optional exact sentence groups with all-groups acceptance and fail-closed
unscored results. Added 21 original app answer blocks to the existing 20 controlled
cases: **41 development examples** on the same three public captures. Labels are
developer-reviewed under a conservative uncertainty/all-parts policy; independent
adjudication and unseen source/topic groups are still required.

**Measured on the new 21 blocks:** Laya's explicit 1024-token probe matches 18,
with three false acceptances and no false rejections; MiniCheck matches 15, with
one false acceptance and five false rejections. Whole/sentence results are identical
for both candidates: **no demonstrated accuracy gain from grouping**. Original
512-token truncation and concurrent-memory setup failures remain unscored artifacts.
No classifier is enabled in the assistant; no model was trained. **248 backend tests
pass**, with two existing dependency warnings. Temporary model processes stopped.

[Preparation, measurements and limits](docs/reviews/claim-evidence-preparation-2026-10-08.md). #25/#27 remain open for independent
review/calibration, routing, hosted latency/cost, ambiguous follow-ups, capacity and
verified streaming. No application source reprocessing, migration, mobile/native
tracker change, commit or push.

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

[Results and next gates](docs/reviews/laya-classifier-development-2026-10-08.md). #25/#27 remain open. Routing and broader grounding
calibration, hosted latency/cost and verified streaming remain planned. The earlier
TypeSafe-key request is superseded. Native/iOS tracker untouched; no migration,
commit or push.


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
is selected. [Results, reproduction and limits](docs/reviews/grounding-classifier-development-2026-10-08.md).
#25/#27 remain open; follow-up/routing, broader labels, hosted cost/latency and
verified streaming remain planned. Native/iOS and its tracker untouched; no
migration, commit or push.


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

[Acceptance and limits](docs/reviews/generation-reliability-acceptance-2026-10-08.md). #25/#27 remain open. Next planned unit: compare
Jev with a specialist grounding classifier using claim-level support/uncertainty
annotations. Explicit ambiguous follow-up handling, independent-source coverage,
200-source capacity, cost calibration and verified streaming remain planned.
Native/iOS and its tracker untouched; no migration, commit or push.


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
worker dispatcher started. [Results and remaining gates](docs/reviews/assistant-broader-evaluation-2026-10-08.md).

#25/#27 stay open. Next unit: false-abstention diagnosis, then video mapping.
Grounding comparison, ambiguity handling and capacity/cost/streaming remain
planned. No application/test code changed; prior 237 backend tests remain the
historical baseline. Native/iOS and its tracker untouched; no commit/push.


## Question-aware passage selection — 2026-10-08

Implemented bounded semantic passage ordering with original chunk relevance and
short caption continuations. Existing exact citation identities/coordinates,
owned scope/version fences and 30,000-character context bound are preserved.
The two measured transcript failures now retrieve their independently annotated
evidence. Final unchanged nine-question replay: all expected spans/statuses and
citation locations pass; individual complete responses 3.36–6.22 seconds.

Full backend suite: **237 passed**, two existing warnings. No frontend changes;
native/iOS and its tracker untouched. [Acceptance and limits](docs/reviews/passage-selection-acceptance-2026-10-08.md).
#25/#27 remain open for broader held-out/topic/follow-up/capacity checks and
ranking calibration. Semantic claim checking and verified streaming remain
planned. No migration, commit or push.


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

[Results and next unit](docs/reviews/assistant-multisource-evaluation-2026-10-08.md): fix question-aware passage selection under #27
before classifier comparison. #25/#27 remain open for broader acceptance. Fresh
acceptance sources retained for reproducible replay. Native/iOS and its tracker
untouched; no commit or push.


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
See [acceptance evidence](docs/reviews/hybrid-retrieval-acceptance-2026-10-07.md).


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


## Background indexing activated and verified — 2026-10-07

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



## Web indexing progress implemented — 2026-10-07

Saved sources now show waiting/preparing/ready/failed search preparation, section
progress, status checking and Check again. The authenticated client rejects wrong
source/version and incomplete ready responses; pending states poll every five
seconds, failures stop polling. A real browser capture showed waiting, then ready
after its named index job, and retained ready after reload. The disposable browser
source and derived points were removed.

69 web tests, typecheck, lint and production build pass (existing bundle-size
warning); 213 backend tests pass. [Evidence](docs/reviews/qdrant-indexing-acceptance-2026-10-07.md).
A dedicated indexing-only worker uses `arq:retrieval` and does not dispatch study
or topic jobs. Automatic approval review blocked persistent activation because
it would send all queued/future captured source text to OpenAI and Qdrant.
`ENABLE_RETRIEVAL_INDEXING` remains false; approval for this exact activation is
required. #26 stays open for activation. Hybrid assistant queries remain planned.
Native/iOS and its tracker are unchanged; no commit/push.


## Hosted indexing lifecycle checks — 2026-10-07

Owned/cross-owner status and worker access, private manifest denial, simulated
second-batch embedding outage with 16-chunk checkpoint, retry to ready,
authenticated refresh to version 2, old-version vector cleanup, source deletion
and zero remaining fixture vectors passed against hosted services. Actual FastAPI
status/auth checks returned 200/401/404 as expected. Disposable source fixtures
were removed; only named jobs ran. [Evidence](docs/reviews/qdrant-indexing-acceptance-2026-10-07.md).

Web progress display and its browser/client tests await the requested TDD seam
approval. Background indexing remains disabled; assistant hybrid queries are
later work. #26 stays open; native tracker untouched.


## Approved testing and Qdrant direction — 2026-10-07

Testing boundaries are approved and Qdrant is selected for the hosted shared
hybrid index. The learner explicitly approved migration 013; Supabase reported
success on 2026-10-07. The named public baseline PDF indexed successfully into
Qdrant 1.19.2: ready, version 1, 2/2 chunks, exact offsets/fingerprint/page 6,
correct owner and both dense/BM25 vectors. A scoped BM25 smoke query returned
two owned hits. [Setup/evidence](docs/qdrant-indexing-setup.md).

#26 local implementation and 213 backend regressions plus disposable Postgres
ownership/retry/version/deletion checks pass. Hosted authenticated status and
cross-owner/retry/version/deletion checks, learner-visible readiness and later
assistant query integration remain pending. Background dispatch remains disabled;
only the named source ran. Native tracker is untouched.

#25 evaluator code is implemented with optional DeepEval 4.2.8, actual retrieval
context, owned current-source collection, local ignored reports and explicit
bounded judge settings. One fresh PDF sample measured recall/precision 1.0 and
faithfulness 0.8571; a judge contradiction requires review. Full baseline coverage
remains in progress. [Evidence](docs/reviews/assistant-baseline-2026-10-07.md).
206 backend/68 web tests and web static/build checks pass. Browser PDF acceptance
is blocked by source-host resolution after a bounded retry. #24/#25 remain open;
#26 tracks indexing. Native/iOS and its tracker unchanged.

## Fresh-source AI baseline — 2026-10-06

**Learner direction:** remove the old audit sources and continue the other agreed
specs using new material. The three exact audit source IDs were removed using
one-owner filtering; subsequent read returned zero. Existing-note repair is
superseded. New-source acceptance of #24 code changes is not yet complete.

**Preparation started:** [GitHub #25](https://github.com/CloudKai/secondBrain/issues/25)
covers the development DeepEval baseline, with a concrete
[execution spec](docs/planning/assistant-evaluation-baseline.md) and 12 authored
seed cases. No fresh captures or scored results yet. Requested test boundaries
and hosted hybrid engine decision remain pending. No dependency install, paid
judge run or unrestricted worker startup. Later retrieval/classifier/streaming
specs remain target behavior. Native/iOS scope is unchanged.

## Saved-source fix implementation — 2026-10-06

**Implemented locally; acceptance pending:** exact catalog-context prompting,
one validation-guided correction for mapping/overview within a shared deadline,
original excerpts in long-note synthesis, full-capture passage selection within
existing assistant source scopes, and graph word wrapping. This is a bounded
follow-up to #24, not the planned shared BM25/semantic retrieval rollout or
semantic claim-checking baseline. Python syntax parse, web typecheck and lint
pass. Requested regression-test approval is pending; saved audit records are
unchanged and the worker remains stopped. Native files/tracker are unchanged.

## Web audit follow-up — 2026-10-06

**Verified evidence:** the current product design audit covers a narrow viewport,
empty-library/import states and curated examples. It does not establish live AI
quality or wide-screen accessibility acceptance.

**Proposed target:** prioritize immediately visible citation evidence, then import
form usability and readability/example clarity, followed by a real-source journey
audit. See [the delivery plan](docs/planning/web-design-improvements.md).
Citation presentation slice 1 is implemented locally under GitHub #21:
dedicated evidence dialog/bottom drawer, shared source content and focus return.
Typecheck/lint and narrow example inspection pass. Broader real-source and
wide-layout acceptance remain pending. Import slice 2 is implemented locally
under GitHub #22: compact guidance, expandable limits/ranges and persistent actions.
Typecheck/lint and narrow form inspection pass; live submission and wider acceptance
remain pending. Readability slice 3 is implemented locally under GitHub #23: brighter secondary
text, larger controls, clear example wording and focused empty states. Static
checks, contrast arithmetic and narrow-state inspection pass; wider accessibility
and full accessibility acceptance remain pending. Slice 4 audit is complete under
GitHub #24: three real public sources generated notes; locator/focus/scoped-answer,
reload, rename and validation paths were checked. Video topic mapping and combined
overview failed; citation-support mismatch, missed retrieval and narrow graph-label
wrapping are recorded in [the report](docs/reviews/web-saved-source-audit-2026-10-06.md).
Broader acceptance is incomplete. Slice 5 AI baseline/retrieval remains planned.
Worker stopped after the authorized audit; no automated tests or native changes.

**Remembered tooling preference:** use `rag-implementation`, official DeepEval
instead of general `llm-evaluation`, and `typesafe-ai` for Jev guidance. No skills
or dependencies installed; classifier/model winners and the shared retrieval
engine remain undecided. Native/iOS scope and progress are unchanged.

Second Brain lets an iOS user share a dense web article, choose one of two
folders, and receive a read-only four-point explanation with an interactive
concept graph and source links. Phase 1–2 delivered and verified that thin
slice. The roadmap thickens it in dependency order with anonymous-first
identity and persistence, durable background processing, vector cross-linking,
and release hardening.

## Stack

- **Current:** Expo/React Native/Expo Router, FastAPI/Pydantic, LangGraph/OpenAI,
  React Flow with Dagre and D3 in a WebView, transient React context.
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
- The API returns typed nodes/edges plus a validated preferred diagram and
  compatible Flow, Hierarchy, or Network options.
- Items are stored only in mobile memory. The folder count includes every item
  in the current session, while the detail screen shows the newest item.

### What got built

- `backend/graph.py` — bounded ingestion, three-node LangGraph pipeline, summary,
  typed graph output, and deterministic diagram compatibility.
- `backend/main.py` and `backend/schemas.py` — strict FastAPI boundary.
- `mobile/app/modal/share.tsx` — native share folder selection and submission.
- `mobile/app/index.tsx` — learning dashboard, library status, recent ideas, and
  an immediately available demo lesson.
- `mobile/app/folder/[id].tsx` — guided Learn, Visual, Recall, and Source modes with
  session mastery and multi-item switching.
- `mobile/components/AdaptiveDiagramViewer.tsx` — React Flow WebView with Dagre
  flow/hierarchy layout and D3 force-directed network layout.
- `mobile/components/LearningDeck.tsx` and `RecallQuiz.tsx` — interactive concept
  cards and graph-derived recall practice.

### Verified on 2026-09-17

- Backend: `15 passed` with
  `uv run --project backend --extra dev pytest backend/tests -q`.
- Mobile TypeScript: passed with `cd mobile && npx tsc --noEmit`.
- Mobile lint: passed with `cd mobile && npm run lint`.
- Expo Doctor: `21/21` checks passed.
- iOS simulator: Safari share → folder selection → processing → detail view;
  four bullets, source link, graph rendering/zoom, and folder count were checked.
- iOS simulator: demo launch, lesson completion, mastery updates, concept-to-visual
  navigation, recall reveal/advance, source expansion, and the redesigned share
  sheet were checked.
- The previously blocked Medium article completed through the live local API.

### Current limitations

- Data is lost when the app process restarts.
- There is no authentication, tenancy, database, queue, or vector search.
- Processing blocks the HTTP request and can be affected by provider latency.
- Diagram assets load from jsDelivr and require network access.
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

## Engineering workflow

- 2026-10-02 — Configured the Matt Pocock engineering skills to use GitHub
  Issues in `CloudKai/secondBrain`, the five default triage labels, and a
  single-context domain layout. `CLAUDE.md` points to the configuration in
  `docs/agents/`; glossary and ADR files are created as decisions are resolved.

## Web learning library — confirmed target specification

- 2026-10-02 — The grill-with-docs interview is designing study notes from web
  articles, selectable-text PDFs, and transcript-backed videos, a shared topic
  graph that grows from saved material, and a study assistant. Deliver this
  target experience in a web browser first; retain the existing iPhone design
  for adaptation after the web experience is well designed.
- Target behavior, source-support UI copy, and acceptance scenarios are
  recorded in `context/learning-library-design.md` and confirmed by the user on
  2026-10-02. GitHub ticket breakdown is in progress. The user is creating the
  UI/UX. On 2026-10-02 the user separately authorized working dark-mode
  browser pages using `ui-ux-pro-max` and this feature specification. The
  frontend slice below is implemented; full target services remain planned.
- The draft GitHub ticket breakdown and dependencies are recorded in
  `docs/planning/web-learning-library-tickets.md`. Publish after breakdown
  approval. The user supplied `web/src` as the UI/UX handoff on 2026-10-02;
  source inspection confirmed the existing browser workspace and service gaps.
  The draft now builds on that frontend, and the design-link gate is removed.
- Provider account connections are excluded. Attempt accessible transcripts;
  inaccessible or private recordings use transcript upload/paste. Access facts
  are recorded in `docs/research/transcript-access.md`.
- Resolved terms and the shared-topic decision are recorded in `GLOSSARY.md`
  and `docs/adr/0001-use-shared-topics-in-library-graph.md`.
- The target delivery order is recorded in
  `docs/adr/0002-deliver-web-before-mobile-redesign.md`.

## Web browser UI slice — 2026-10-02

Status: **verified frontend interactions with curated examples**; all-target
service acceptance is not complete.

- Added `web/` as a separate React/TypeScript/Vite frontend. Mobile, native
  folders, and the v1 backend contract were not changed by this slice.
- Built a dark-default library, study-note workspace with expandable
  Topic/Graph/Sources context, topic graph, and curated reading list. A paired
  light appearance is available.
- Verified search/filter/sort, source evidence, recall reveal/advance and session
  marks, assistant scope/reference/gap behavior, duplicate URL reuse, topic
  rename, connection rejection/restoration, empty state, and narrow-screen routes.
- Topic merging, source assignment correction, and deletion are interactive
  organizational controls. Notes remain read-only.
- The assistant is explicitly a stored-note lookup preview; the reading list is
  curated. Examples carry paraphrased evidence and original-source links.
- Article import validates and adapts the existing synchronous four-point API.
  Transport integration is verified with controlled fixtures; real provider
  ingestion from the browser still needs a running configured backend.
- State is session-only and resets on reload. PDF/video ingestion, richer web
  generation, passage alignment, live AI chat/research, semantic topic comparison,
  changed-source refresh, auth, and persistence remain target work.
- Validation: web production bundle/typecheck and lint pass; 7 web tests pass.
  Backend: 15 tests pass via the project interpreter. The exact repository
  pytest command fails because its copied virtualenv entrypoint has an obsolete
  shebang; `uv run --project backend --extra dev python -m pytest backend/tests -q`
  succeeds. No backend environment or API changes were made.
- Run instructions and boundaries: `web/README.md`. Local visual evidence:
  `output/playwright/`.

## Web library organization refactor — 2026-10-02

Status: **implemented; static checks passed**. Behavioral acceptance was not
rerun for this refactor.

- The user approved session-only library organization and rejected connections
  taking precedence after topic merges. The existing UI and read-only source
  notes are retained.
- Library creation, learner actions, and consistent read views now share one
  module. Topic corrections, source/example removal, and recall cleanup no
  longer coordinate independent library setters in the rendering module.
- Search reads corrected topic names. Merging remaps and deduplicates rejected
  topic pairs and removes self-connections; restoring connections remains an
  explicit learner action. Removing examples preserves surviving corrections.
- Typecheck: `npm --prefix web run typecheck`. Lint:
  `npm --prefix web run lint`. Both pass. No tests were added or run.
- This slice changes only browser code and documentation. Native/mobile,
  backend, persistence, and the pending GitHub publication are unchanged.

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


### Versioned refresh completed — #13, 2026-10-04

User-approved migration applied. Owned reuse/comparison/confirmation, exact saved
capture/note archives, stable source IDs/PDF aliases and worker/reader version
fences pass hosted development checks. Renamed assignments and rejected decisions
persist; unique excerpts reanchor or require current evidence review. Browser
PDF/video comparison, decline/refresh, archived/current citations, duplicate reuse
and reload pass. Controlled fixtures/scoped records cleaned; real note preserved.
123 backend tests, 55 web tests, build/typecheck and lint pass. Both review axes
have zero findings through 2bf070f. Desktop/development only, production and ranges
remain planned. Native/iOS and its tracker untouched. Next draft: planned 13.


## Long sources/ranges selected — planned 13 / #14 (2026-10-04)

Target unit: browser whole-capture section processing with persisted progress and
retry, validated original PDF page/timed-transcript selection, and coherent
final notes with exact capture citations. Preserve stable source/version identity,
learner corrections and one-source graph counts. Existing limits and omitted-text
feedback remain verified; expanded capture budgets, section orchestration and
range controls are pending. Published #14, inspected capture/worker/browser
boundaries, and updated both web records. The TDD skill requires agreed seams;
user agreement requested before test writing. No implementation, migration or
hosted acceptance yet. Native/iOS and its tracker untouched.


### Long-source local implementation — #14

At user-agreed seams, original PDF page/timed-caption selection and whole browser
captures up to 120,000 characters feed bounded section model calls. Private
current-version/lease checkpoints retain successful work across retry. A final
note requires all sections and grounded synthesis. Browser import/refresh controls,
original citation readers and saved progress counts are implemented locally.
140 backend tests pass; initial web 60/61, corrected old Unicode limit assertion
passes focused checks; build/typecheck/lint pass. Independent review, final web
rerun, migration and hosted acceptance remain pending. Native/iOS untouched.


### Long sources review complete — #14

Implementation/review fixes through `4aa30d9` pass 142 backend and 61 web tests
and web build/typecheck/lint. Independent standards/spec re-reviews have no
remaining findings. Migration 010 is staged and awaits browser-warning approval;
it has not run. Hosted worker/model/browser acceptance and fixture cleanup remain
pending. GitHub #14 is open; native/iOS and its tracker untouched.


### Long sources/ranges complete — planned 13 / #14 (2026-10-04)

Migration 010 applied after explicit user approval, matching worker restarted.
Whole captures up to 120,000 characters, original PDF page/timed cue selection,
private current-version checkpoints and coherent final synthesis passed hosted
API/worker/model/browser acceptance. Section failure/retry preserves saved work;
range refresh keeps one source and archived exact citations. Invalid duplicate
ranges reject without modifying captures. Final 144 backend/61 web tests and web
build/typecheck/lint pass; both review axes through e474faf report zero findings.
Controlled sources, archives and section work cleaned; learner note unchanged.
GitHub #14 complete. Next planned 14 assistant is draft, not started; private
providers/OCR/research/production remain planned. Native/iOS/tracker untouched.


## Grounded assistant selected — planned 14 / #15 (2026-10-04)

Selected and published current-note assistant with independent topic/library
scopes and exact passage citations. Existing Postgres notes provide bounded
relevance retrieval; source versions and topic membership fence stale answers.
Unsupported questions offer the existing reading-list preview; live discovery
remains planned 15. User approved API/model HTTP/database/browser test boundaries.
Implementation, migration and acceptance pending. Both web records updated;
native/iOS and its tracker untouched. See docs/assistant-setup.md.

### Grounded assistant local implementation — #15 (2026-10-05)

Current note plus optional confirmed-topic/library evidence implemented through
owned Postgres retrieval and strict bounded server model answers. Live UI cites
exact saved original passages without navigating away from the anchor note.
Changed source/note/map evidence rejects before delivery. Unsupported answers
open the reading-list preview; live research remains planned 15. Focused checks
pass; full checks/review/migration/hosted acceptance pending. Native/iOS untouched.


### Grounded assistant complete — planned 14 / #15 (2026-10-05)

Implementation/review fixes through `fb813e0`: 161 backend tests, 64 web tests,
build/typecheck/lint and both independent re-reviews pass. Migration 011 applied.
Hosted real auth/database/model/browser checks verify current-note default,
combined topic-first/library scopes, exact original PDF/video citations,
unsupported gaps, ownership isolation and changed-evidence rejection. Citation
inspection preserves the note/conversation; reload/reopen clears local chat.
Follow-ups use recent learner questions and current saved evidence. Discovery
remains a labelled preview; its uploaded-PDF empty-URL crash was fixed.
Controlled sources and dependent records removed and verified; existing learner
source not targeted. GitHub #15 closed. Planned 15 live reliable-resource
discovery remains unpublished; production/native work is unchanged. Setup/review:
docs/assistant-setup.md and docs/reviews/ticket15.md.


## Live discovery selected — planned 15 / #16 (2026-10-05)

The user requested continuation after #15 completion. Published #16 for the
final planned slice: on-demand credible resource discovery, verified public
links, honest metadata and explicit article/PDF saving through the existing
note/topic pipeline. Inspected reading-list preview, capture paths and official
TinyFish Search/Fetch contracts. No new database or model provider selected;
results stay external and local until saved. Proposed API/external HTTP/save/
browser TDD boundaries await user confirmation. No implementation/tests/hosted
acceptance yet. Native/iOS and its progress tracker untouched. Setup:
docs/research-discovery-setup.md.


### Live discovery local implementation — #16 (2026-10-05)

The user approved discovery API, external Search/Fetch HTTP, article/PDF save
and browser boundaries. Authenticated on-demand retrieval, bounded verified
results, safe URLs/redirects, honest metadata and external-resource UI are
implemented locally. Explicit saves reuse owned capture/study/topic flows;
search never writes the library. RED→GREEN checks cover the new route, publisher
redirect rejection and web client. Full 179 backend/66 web tests and web
build/typecheck/lint pass. Browser live results left the library empty until
explicit save; a discovered Python documentation article then produced a real
note and four topics. Independent review, remaining hosted/browser checks and
controlled cleanup pending. No migration; native/iOS and tracker untouched.


### Live discovery complete — planned 15 / #16 (2026-10-05)

Implementation `5b14de7` plus fixes `a7500eb` / `fecfb77` passes 182 backend
tests, 66 web tests and build/typecheck/lint. Both independent reviews report
no remaining findings. Authenticated bounded live research, honest metadata,
verified public links/MIME types, preprint labels, safe redirects and blocked-page
omission are implemented. Search/open actions leave library/graph unchanged;
explicit article/PDF saves reuse capture, study and topic comparison.

Real hosted auth/Search/Fetch and browser article/model/worker flows pass. A
discovered documentation article produced a cited note and four topics. Browser
original links, passage inspection, empty/partial results and editable assistant
gap navigation pass. Extensionless PDF save routing, duplicate reuse and owner
isolation pass at the API HTTP boundary; live browser PDF saving was not exercised
for this slice. Controlled article/dependent records removed; browser reload
restored zero sources/topics and original learner source remains present.

No migration. Runtime uses a server-only TinyFish key; a separately launched API
must receive it through its own environment. GitHub #16 closed. All 15 original
planned web slices are complete for development. Production/private provider
access/OCR/linked accounts remain planned. Native/iOS and its tracker unchanged.
Setup/review: docs/research-discovery-setup.md and docs/reviews/ticket16.md.


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


### Citation passage improvement — #17 (2026-10-05)

Implemented the approved complete-thought passage grouping in the backend Source
reference module, with shared browser verification for saved notes and assistant
citations. Exact original text/Unicode offsets, PDF pages and real overlapping
cue times are preserved. Sentence/paragraph cuts, caption pauses/speaker changes
and bounded duration/length grouping are covered. Private per-source-version
policies preserve existing jobs and retries; old claims default to legacy.

Local checks: 198 backend tests and 68 web tests pass; web build/typecheck/lint
pass. The documented uv command selected the global Anaconda pytest without
LangChain; the existing backend virtualenv Python ran the equivalent full suite.
Migration 012 is prepared and tested locally, not applied. Independent review and
hosted activation/acceptance remain pending. No changes to native/iOS or its
progress tracker. Scope/setup: docs/planning/citation-passages.md and
docs/citation-passages-setup.md.


### Citation passages complete — #17 (2026-10-05)

Implementation `df49f05` and review fixes `074f157` pass 200 backend tests,
68 web tests and web build/typecheck/lint. Final independent standards and
specification reviews both report zero findings. Lowercase/Unicode speaker
labels and embedded caption paragraphs are covered without changing legacy
grouping. Migration 012 applied successfully to the AI Study Friends development
project; the matching API, worker and frontend are running.

A controlled six-cue VTT source generated three exact complete-thought references
at 0:00–0:07, 0:06–0:12 and 0:14–0:18, with real overlapping times and original
blank lines. Hosted storage verifies `thought_v1`, exact excerpts and locations.
Browser note/assistant citation inspection and saved-note reload pass. The
temporary source and six dependent record sets were removed and verified; browser
reload restores the original empty acceptance workspace. Existing learner sources
were not targeted. GitHub #17 complete; both web planning/progress records updated.

New studies and changed source versions use the new grouping; existing notes and
previous jobs retain their saved references/policy. This is bounded English
punctuation-based grouping, not semantic topic detection or inferred word times.
Production, OCR and private provider retrieval remain planned. Native/iOS and
its progress tracker untouched. Setup/review: docs/citation-passages-setup.md
and docs/reviews/ticket17.md.


### Existing saved-note citations updated — #17 follow-up (2026-10-05)

The learner requested the improved grouping for existing notes too. Read-only
development inventory found one saved note: Neural networks, source
79b1b905-ebeb-4896-84bc-d55f395070ce, current version 1, 18,430 characters and
286 timed cues. Its 13 legacy references were remapped to 12 exact complete-thought
passages from the same capture. Every claim keeps its original text and receives
all overlapping supporting passage IDs; four existing topic assignments and their
evidence IDs were preserved/remapped together. No overrides or combined overviews
existed for this source. No model call or job requeue was needed.

Applied a one-time owner/source/version/content/note/topic guarded transaction.
A local private rollback snapshot was retained outside Git. Strict note/topic
models and postflight hosted reads verify exact excerpts/times, updated payloads,
unchanged source data, unchanged job/map state and all topic references resolving.
Only note/map citation payloads and their revision timestamps changed. Historical
completed-job policy/checkpoints retain their original generation meaning; current
notes use the improved citation passages. No schema or application code changed,
so the previous 200 backend/68 web checks remain the application baseline.

Ticket #17 and both web records updated. The user's original existing note was
updated; native/iOS and its tracker untouched. Refresh the saved note to load it.


### Mobile repository consolidation — #19 (2026-10-05)

The user requested one repository with the mobile app in its own folder. Imported
all 51 tracked files from mobile commit `c01bfdc` into the regular `mobile/` folder
using a history-preserving subtree import. Removed the gitlink, `.gitmodules` and
nested checkout metadata. Future web, mobile and backend changes are committed
and pushed together from the root of `CloudKai/secondBrain`.

The original application-source bytes and local ignored dependency/native folders
were preserved. A complete mobile Git bundle and the original checkout metadata
are retained locally outside the repository. The former GitHub mobile repository
remains available as historical storage. This task does not add mobile features,
alter native generated files or establish new application acceptance. Repository
checks cover file identity, retained history, normal tracking and ignore rules;
application tests were not run.


### Web assistant AI improvements — design interview (2026-10-05)

The learner selected better answers across saved sources, a target of up to
200 sources per learner, and accuracy/evidence quality as the first priority.
Code inspection found that current retrieval searches generated notes and their
cited excerpts, rather than every captured passage. Exact citation integrity
checks already exist; semantic claim checking and adaptive routing are proposals.

Decisions, open questions and primary references are recorded in
`docs/planning/assistant-rag-improvements.md`. The design interview is in progress;
no new implementation ticket, migration or application acceptance is claimed.
