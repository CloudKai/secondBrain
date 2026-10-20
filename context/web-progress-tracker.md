# Web Progress Tracker

## Path quiz v1 (Slice 2) — implemented in development, 2026-10-20

**Implemented but not build-verified.** An optional, non-gating end-of-path quiz
for one confirmed learning path revision: single-choice, true/false and
multi-select questions graded on the server, plus up to two short answers with
provisional AI feedback. Results are evidence, not proof of mastery. Design:
[path-quiz-spec.md](../docs/planning/path-quiz-spec.md) (section 20, Revision 3,
is binding; the Revision 3 amendments had no second design-review round). The
work is on branch `feat/path-quiz`; the push is a separate step, so check
`git log main..HEAD` for the current commits.

- Database: migration `supabase/migrations/202610200023_path_quiz.sql` (6
  tables, 19 functions incl. helpers, source-removal trigger, RLS) with a guarded
  rollback, plus `quiz-database.ts` and `quiz-persistence.test.ts`.
  **Migration 202610200023 is NOT applied anywhere and needs owner approval.**
  The shared PGlite fixture loads every migration, so a mistake there would break
  all persistence suites on the first owner run.
- Backend: `quiz_rules`, `quiz_limits`, `quiz_grading`, `quiz_messages` (standard
  library only), `quiz_models`, `quiz_provider`, `quiz_generation`,
  `quiz_short_answer`, `quiz_store`, `quiz` router mounted under
  `/api/v2/learning/collections/{collection_id}/plans/{plan_id}/quiz`;
  `study_store.py` changed additively.
- Web: `quiz.ts`, `quiz-logic.ts`, `quiz-copy.ts`, `use-quiz.ts`,
  `source-client.ts` quiz methods, `components/quiz/*`, `styles/quiz.css`, a Quiz
  tab in `LearningJourney.tsx` and a non-focus end-of-path prompt in
  `LearningLessonView.tsx`.
- Ran (from the repository root):
  - SQL structure script (one-off, not committed): file sorts after
    `202610100022`, `$$` pairing, one `begin;`/`commit;`, 19 functions each with a
    matching revoke and grant, RLS and the 4 owner select policies, raise
    messages equal the fixture, rollback drops everything with
    `quiz_options_valid` last. This is a structural check; the SQL has not
    executed.
  - The three `backend/tests/fixtures/quiz_*.json` files parse with `python3`.
  - `python3 -m unittest backend.tests.test_quiz_rules backend.tests.test_quiz_limits backend.tests.test_quiz_grading backend.tests.test_quiz_messages -v`:
    84 tests, OK; those four modules import only the standard library.
  - `python3 -m py_compile` on all new and changed backend files and
    `python3 -m compileall -q backend`: exit 0.
  - `.env.example` parity script: 12 `QUIZ_*` variables equal the defaults of
    `load_quiz_config`.
  - `node --experimental-strip-types --test web/src/lib/quiz-logic.test.ts web/src/lib/quiz-copy.test.ts`:
    34 pass, 0 fail; `theme`, `shell-nav` and `home` native tests: 23 pass, 0 fail.
  - `prettier --check` on the new web files (including the two SQL test files):
    clean.
  - `tsc -p web/tsconfig.json --noEmit` filtered to `TS1xxx` syntax errors:
    nothing. Weak evidence: the repo config stops at a missing `vite/client`
    type, so semantic checks never ran.
  - Ad-hoc scans: `quiz-*` class names versus `quiz.css`, design tokens used,
    no `any` or `@ts-ignore`, no forbidden vocabulary.
  - Throw-away sanity scripts for the backend run against an in-memory fake with
    permissive stand-ins for pydantic, httpx and fastapi. They are not a
    substitute for pytest.
  - Git identity check (CloudKai on both sides) and no `mobile/` or `.agents/`
    path in any commit.
- NOT run: the migration and rollback and `quiz-persistence.test.ts` (no
  PGlite or Postgres); pytest files `test_quiz_models`, `test_quiz_generation`,
  `test_quiz_short_answer`, `test_quiz_provider`, `test_study_store`,
  `test_quiz_store`, `test_quiz_api` and the whole `backend/tests` suite (no
  pydantic, fastapi, httpx or pytest); `quiz-schema.test.ts`,
  `quiz-client.test.ts` and every existing zod, react or PGlite web suite; `npm
  ci`, typecheck, lint, build and `npm test`; rendering of the React components;
  browser, keyboard, screen-reader, 200% zoom, contrast and light/dark visual
  checks; any real OpenAI call (model availability, strict-schema acceptance,
  truncation at the output cap); hosted function duration of at least 120
  seconds; a real backend round trip. The sandbox gets HTTP 403 from npm and
  PyPI.
- Owner commands: `npm --prefix web install && npm --prefix web run typecheck && npm --prefix web run lint && npm --prefix web run build && npm --prefix web test`
  and `uv run --project backend --extra dev python -m pytest backend/tests -q`.
- Environment (server-only, see `backend/.env.example`): `QUIZ_ENABLED`,
  `QUIZ_GENERATIONS_PER_USER_PER_DAY`, `QUIZ_GRADINGS_PER_USER_PER_DAY`,
  `QUIZ_MAX_QUESTIONS`, `QUIZ_MAX_SHORT_ANSWER`, `QUIZ_MAX_OUTPUT_TOKENS`,
  `QUIZ_GRADING_MAX_OUTPUT_TOKENS`, `QUIZ_SHORT_ANSWER_MAX_CHARS`,
  `QUIZ_REASONING_EFFORT`, `QUIZ_GENERATION_MODEL`, `QUIZ_FALLBACK_MODEL` and
  `QUIZ_GRADING_MODEL`; `OPENAI_API_KEY` and
  `SUPABASE_SECRET_KEY` must already be configured.
- Models: `gpt-6-luna` by default, `gpt-6.1-sol` only after a completed but
  invalid Luna output survived one repair; short-answer feedback uses the
  separate `QUIZ_GRADING_MODEL`. **Model availability is unverified** (no live
  call was made).
- Needs your attention before enabling spend:
  - Per-user daily limits can be bypassed by creating new anonymous accounts
    (spec R1/U5). A global cap and per-IP limits are not built, so do not expose
    the quiz endpoints publicly until they are. Consider shipping with
    `QUIZ_ENABLED=false` and switching it on when ready.
  - Explanations are not overlap-checked against the cited excerpts (the guard
    covers correct options, true/false prompts and model answers). Citation ids are
    lesson-bound and the prompt is excerpt-only, and the UI says the quiz is
    AI-generated, but an explanation can say more than its passage.
  - The daily counter is one guarded upsert, but no test runs two parallel
    connections (the PGlite burst test is single-connection). Run a two-connection
    smoke test against a real Postgres before enabling.
- Default limits: 3 quiz generations and 20 AI feedback requests per user per UTC
  day, 8 questions (up to 2 short answers), short answers capped at 1500
  characters, 20 attempts per quiz. Raise `QUIZ_MAX_OUTPUT_TOKENS` to at least
  6000 before raising `QUIZ_MAX_QUESTIONS` above 8.

## Web design foundation (Slice 1) — implemented in development, 2026-10-20

**Implemented but not build-verified.**

- Split `styles.css` into ordered stylesheets with a token layer (light and dark
  palettes), a system/light/dark theme with a persisted override, typed UI
  primitives, a simplified Shell and sidebar, a calm Home (`#library`) and a
  lesson-first collection workspace. Routes, API calls and data shapes are
  unchanged.
- Ran: prettier parse of changed files, `tsc --noEmit` filtered to syntax
  errors (TS1xxx, none), CSS selector comparison (no selector removed), the
  contrast script (all pairs pass in both themes) and the native pure tests
  `theme`, `shell-nav` and `home` (23 pass, 0 fail).
- NOT run: typecheck, lint, build, `npm test` (including
  `ui-primitives.test.ts`, `learning-view` and `collection-workspace` tests),
  Playwright screenshots, light/dark visual check, keyboard and screen-reader
  checks, 200% zoom and narrow layout. The sandbox gets HTTP 403 from the npm
  registry, so dependencies could not be installed.
- Owner command: `npm --prefix web install && npm --prefix web run typecheck && npm --prefix web run lint && npm --prefix web run build && npm --prefix web test`
- README corrected: the library starts empty and curated examples load on
  request.
- Continue learning uses only the existing learning summary: it shows the saved
  current lesson from the resume cursor when present, never mastery or a
  recommendation, and shows an empty state or the newest saved source otherwise.
- Home shows studied-lesson and practice-attempt counts only. The
  `provisional_checks`, pending and failed feedback counts remain on the
  collection learning summary (`#collection`), not on Home.
- While example material is loaded, Home does not fetch the learning summary and
  shows Start here instead of Continue learning, even if a saved path exists.

## Vercel services configuration prepared — 2026-10-20

- Added root `vercel.json`: FastAPI `backend` at `/api/*`, static Vite `web` for
  remaining paths. No server-to-server calls exist between these services;
  browser requests already use the public same-origin API, so no bindings apply.
- Added a service-root Python entrypoint, independent PDF subprocess path and
  `/api/health`; documented project
  root/environment setup and separate ARQ worker hosting in
  [Vercel deployment](../docs/vercel-deployment.md).
- Verified isolated flattened-bundle imports, health/auth/API 404 checks,
  361 backend tests through `backend/.venv/bin/python`, 134 web tests, and web
  build/typecheck/lint. Exact uv test command fails on the previously recorded
  system-pytest dependency problem (`langchain_openai`).
- Vercel CLI 64.5.0 accepts both services and starts Vite; backend startup needs
  uv >=0.9.25 (installed 0.7.12). CLI also attempts saved-login refresh; validation
  stopped. Combined local and hosted acceptance remain unverified; service names, public routing,
  absence of bindings and external worker hosting await user confirmation.
  No deployment, push, database change or native work.

## U3a2 implemented in development — 2026-10-10

[#36](https://github.com/CloudKai/secondBrain/issues/36) under #29: initial source paths can use full captured material through existing BM25/semantic retrieval. New immutable plans have a cited, sampled concept/coverage manifest; explicit Saved note passages remains compatible. Original spans/pages/times, ownership, capture/index snapshots and failed-preview recovery are enforced. No existing learning is regenerated; multi-source revisions still use their existing saved-note policy.

Migration **022 applied after exact approval**; live MIT PDF previews persist Luna-generated lessons and exact original page references without activation. The current lesson, draft, conversation and 0 studied / 2 attempts / 2 provisional checks remain intact. **361 workspace backend / 134 web; 295 isolated backend / 121 web tests**, web typecheck/lint/build pass. Exact uv runner still has the system-pytest dependency issue. Separate reviews clear. See [acceptance](../docs/reviews/capture-teaching-acceptance-2026-10-10.md).

#36 stays open for actual 200% zoom/screen-reader checks. Independently reviewed synthetic cases and one live PDF do not calibrate teaching or grading. **Next target U3a3**: outcome-specific full-capture evidence for multi-source contribution previews, then U3b stable outcomes/practice. U4/U5 remain target work. No push/mobile/iOS/TinyFish; older WIP stays separate. Checkpoint before the next unit.

## U3a1 completed in development — 2026-10-10

[#35](https://github.com/CloudKai/secondBrain/issues/35) under #29: read-only, goal-specific teaching evidence preview across confirmed path captures. Existing BM25+dense RRF, exact original page/time spans, owner/version/hash/generation fences, explicit partial-index choice, bounded 8-source/24-passage/16,000-character selection and post-search validation. Existing lessons still use note evidence; no generation or schema change. Retrieval 013/014/helper prerequisites included in the scoped commit, without reapplying migrations.

344 workspace backend / 126 web; 278 isolated backend / 113 web; typecheck/lint/build pass. Two separate reviews have no actionable findings. Live PDF/video preview: 24 exact passages, 14 absent from notes, unchanged learning snapshot, 401 unauthenticated and 404 unrelated plan; single response 3,931 ms, not a latency benchmark. API session91730; approved worker/Vite retained. See [acceptance](../docs/reviews/teaching-evidence-acceptance-2026-10-10.md).

Next target **U3a2 reviewed teaching baseline plus concept/coverage manifest and lesson integration**, then U3b stable outcomes/checks. U3 is not complete. Older U2 accessibility/download gates remain open. Preserve unrelated WIP; no push, mobile/iOS or TinyFish. Checkpoint before the next unit.


## U2c2 completed in development — 2026-10-10

- #34 under #29: owned saved lesson exchanges, same-send retry and stale-tab fences, bounded server context, actual model/policy provenance, source-change rejection/removal redaction, clear/export and pending recovery implemented.
- Migration 021 applied; live Luna hint/citations survive reload. Exact 8:17.740–8:30.140 video evidence and focus return pass. Activity stays0 studied / 2 attempts / 2 needs review. 124 web / 324 backend tests plus web typecheck/lint/build; isolated 111 web / 258 backend pass. Exact uv runner still has the system-pytest dependency issue.
- Reviews clear; actual 200% zoom, screen reader and native download completion remain open in #34. See docs/reviews/learning-conversations-acceptance-2026-10-10.md.
- Next U3 full-capture teaching/stable outcomes; U4/U5 targets. No push; mobile/iOS tracker unchanged. Compact/checkpoint before starting U3.

## U2c1 unfinished learning drafts — implemented in development, 2026-10-10

[GitHub #33](https://github.com/CloudKai/secondBrain/issues/33), part of #29, adds owned answer/question drafts per collection, immutable plan and lesson. Autosave shows Saved/Unsaved/Retry/conflict states; tab-private pending recovery survives same-tab reload/navigation. Revision checks and idempotent save IDs protect retries and multiple tabs, including opener clones. Changed/removed source evidence retains learner-authored writing. Clear is a checked empty save; Download exports this draft’s versioned JSON. Drafts never count as attempts/activity. Existing tutor replies remain view-local.

**Migration 020 applied** successfully to AI Study Friends. Live lesson-two answer/question drafts survived reload and were then cleared; the collection remained at 0 studied, 2 attempts and 2 provisional checks. Exact timed video evidence and keyboard focus return still work. **118 workspace web / 311 backend tests pass**, plus web typecheck/lint/build. Backend uses its existing virtual environment because the exact uv runner selects system pytest missing a dependency. Spec and standards review findings are resolved. Isolated HEAD + this unit passes 105 web / 245 backend tests and web typecheck/lint/build. Measured 1440×900 dark and 390×844 light live layouts have no horizontal overflow.

See [U2c1 acceptance](../docs/reviews/learning-drafts-acceptance-2026-10-10.md). #33 remains open for actual 200% zoom, screen-reader acceptance and native download completion; the actual export payload is verified at the browser boundary. **Next target:** U2c2 completed tutor exchanges, with its own provenance/retention/redaction/send/recovery contract before implementation. U3–U5 remain target work. Earlier WIP is separate; no push or mobile/iOS changes.

## U2b collection workspace — implemented in development, 2026-10-09

[GitHub #32](https://github.com/CloudKai/secondBrain/issues/32), part of #29, adds an owned `#collection/<id>` learning destination and collection home. Library resume, source entries and topic learning actions open the same saved path/lesson. Teaching, practice and review are primary; sources, plan coverage, map and dated version history are secondary. Removed anchors retain goals/answers without fabricated evidence. Metadata refreshes after confirmation without remounting the lesson; initial snapshots avoid duplicate reads.

**113 workspace web / 299 backend tests pass**, web lint/typecheck/build pass. Isolated commit files also pass 100 web tests, typecheck/build and lint. Backend used its existing virtual environment; the exact uv command still selects system pytest missing `langchain_openai`. Spec/standards review findings are resolved. Live PDF/video collection resume/reload, retained practice, exact timed evidence and keyboard focus return pass. Measured 1440×900 and 390×844 dark/light layouts fit without horizontal overflow. Unknown IDs fail safely; navigation leaves persisted activity unchanged. Fixture HTTP confirmation verifies fresh goal/counts without live model or database writes.

No new migration, model or retrieval policy. See [U2b acceptance](../docs/reviews/collection-workspace-acceptance-2026-10-09.md). #32 stays open for actual 200% zoom and screen-reader acceptance. **Next target:** U2c durable unfinished answers/tutor conversations; U3–U5 remain target work. Earlier unrelated WIP remains separate. Local changes only; no push and mobile/iOS untouched.

## U2a collection identity — implemented in development, 2026-10-09

[GitHub #31](https://github.com/CloudKai/secondBrain/issues/31) delivers the identity/backfill subunit of #29. Owned collection IDs survive removal of the original capture. Repeatable backfill retains paths, plans, attempts, branches, exact citations and cursor metadata. Confirmed source membership is deduplicated; pending previews do not increase coverage. Authenticated collection reads, legacy aliases and checked selection are implemented.

**Migration 019 applied** to AI Study Friends. Hosted backfill mapped 2 collections, 3 paths, 5 plans, 1 place and 3 attempts with zero unmapped records. Live authenticated list/detail/alias reads match legacy learning snapshots; no-auth reads return 401 and unknown IDs return 404. Saved lesson two, cursor revision and activity remain unchanged by reads. **299 backend / 106 web tests pass**, plus web typecheck/lint/build. Backend used its existing virtual environment because the exact uv runner selected system pytest without a project dependency. Spec/standards reviews have no remaining actionable findings. Recovery retains reads/history and legacy writers while disabling new selection.

See [U2a acceptance](../docs/reviews/collection-identity-acceptance-2026-10-09.md). Local implementation commit `ee2f0c4`; no push. **Next target:** U2b collection workspace/navigation, then U2c durable drafts/chat; U3–U5 remain target work. U1's exact viewport, actual 200% zoom and screen-reader gates remain open under #30. Mobile/iOS untouched.

## U1 learning continuity — implemented in development, 2026-10-09

Delivery: [GitHub #30](https://github.com/CloudKai/secondBrain/issues/30), part of #29.
Note routes restore source-related topic context. Library resumes the persisted
selected path/plan/lesson and uses saved study/attempt/feedback counts. Previous
plan versions have distinct labels and a history disclosure; viewing them does
not reactivate them. A save finishing after returning to Library refreshes resume.

Migration **018 applied after explicit approval**, preserving sources, plans and
answers. Unknown legacy selection timestamps are not fabricated. New selection
writes include expected revisions; stale writes return 409. Summary is owned and
read-only. **296 backend / 99 web tests pass**, plus web lint/typecheck/build.
Backend used the existing virtual environment because the exact `uv` invocation
selected a system pytest missing a project dependency. Recovery RPC checks pass.

Live saved PDF/video branch resume, history labels, unchanged activity, exact timed
citation, keyboard opening and Escape focus return pass. Compact dark/light checked;
the viewport override did not produce the requested dimensions. Exact desktop/narrow
matrix, actual 200% browser zoom and screen-reader acceptance remain pending; #30
stays open. See [acceptance](../docs/reviews/learning-continuity-acceptance-2026-10-09.md).
**Next target:** U2 independent collection workspace. U2–U5 remain unimplemented.
Changes remain local; no push and no mobile/iOS change in this unit.
GitHub results: [#30 progress](https://github.com/CloudKai/secondBrain/issues/30#issuecomment-6082539917).

## Ideal learning specification — published, 2026-10-09

**Target, not implemented:** [GitHub #29](https://github.com/CloudKai/secondBrain/issues/29)
is published with `ready-for-agent`. The [specification](../docs/planning/ideal-learning-app-spec.md)
synthesizes the audit/roadmap into 68 user stories and five ordered units: continuity,
independent collection workspace, teaching evidence/practice, map/discovery and AI
policy/operations. It preserves the approved learning API, provider HTTP, database
ownership/version and browser test boundaries. Per-unit compatibility, failure,
recovery and acceptance requirements remain explicit; first implementation is U1.

**Checks:** publication body and label verified; specification sections, numbered
stories and local links checked; whitespace passes. This is a documentation/tracker
unit, so app tests and migrations were not run. #28 retains its existing development
acceptance gates; #29 does not mark the target behavior implemented. Mobile untouched.

## Ideal learning experience audit — completed, 2026-10-09

**Delivered:** an evidence-based product/configuration audit and a proposed five-unit
roadmap: repair continuity; establish an independent collection workspace; improve
teaching evidence/practice; connect the wider map/discovery; harden AI policy and
operations. These are planning deliverables, not implemented improvements.

Reviewed local HEAD `1835298305d50f6a9042a1ef9b7c4a56c8ca242e` plus the existing dirty
working tree. Fresh browser evidence reproduces unrelated topic context on a
reopened calculus note, duplicate revision labels, and a library resume card that
chooses the newest source. Exact transcript evidence and Escape focus return work.
Six screenshots capture desktop and narrow views. Code review identifies selected
note evidence as the lesson-generation bottleneck and temporary drafts/chat state.

**Checks:** both new documents' relative links/assets and whitespace checked;
application tests were not rerun for this documentation-only unit. Full teaching
calibration, hosted cost/latency/200-source capacity, screen-reader and actual 200%
zoom remain gates. #28 stays open. App changes wait for roadmap acceptance.

See [audit](../docs/reviews/ideal-learning-app-audit-2026-10-09.md) and
[implementation roadmap](../docs/planning/ideal-learning-app-roadmap-2026-10-09.md).
GitHub progress: [#28 audit update](https://github.com/CloudKai/secondBrain/issues/28#issuecomment-6081844590).

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
Needs review. #28 remains open for full acceptance. See [branch acceptance](../docs/reviews/learning-branches-acceptance-2026-10-09.md).


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
open. See [collection acceptance](../docs/reviews/learning-collections-acceptance-2026-10-09.md).


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
stays open. See [acceptance](../docs/reviews/learning-journey-acceptance-2026-10-09.md).
Mobile/iOS and its progress tracker are untouched.

## Topic learning journey — specification published, 2026-10-09

**Target, not implemented:** [GitHub #28](https://github.com/CloudKai/secondBrain/issues/28)
is published with `ready-for-agent`. The specification includes 54 user stories,
guided teaching/practice/feedback, editable goals, per-path difficulty and retained
progress, source contributions, branches, transparent path previews and graph
semantics. First delivery is a complete one-source journey; later collection
growth and branching remain part of the full target.

Model selection is per request in backend code: Luna medium initially, Sol 6.1
medium as escalation candidate. The conservative escalation policy and semantic
quality/cost acceptance gates are identified as proposed/measured decisions.
API, model HTTP and browser testing boundaries await the focused skill-required
check. No model/runtime change, application tests, implementation, commit or push.
Documentation whitespace check passes. Mobile/iOS and its tracker are untouched.
Local [specification](../docs/planning/topic-learning-journey-spec.md) and interview
record are synchronized with the web ticket document.

## Topic learning journey — design interview, 2026-10-09

**Target, not implemented:** the learner confirmed topic collections as the main
learning home, in-app topic source discovery, an expanding graph, editable goals
and optional background lessons with a transparent preview before confirmation.
Further target decisions confirm guided teaching with a tutor, confirmed plan
revisions, separate activity/understanding evidence, several starting paths,
free exploration, adjustable difficulty and goal changes that branch from the
existing path. Relevant understanding is shared across branches; difficulty
is set per path with previous-level results retained; one-source learning maps
can suggest paths that open after a transparent preview and confirmation.
Practice mixes explanations, application problems and quick questions.
Further decisions confirm evidence-based feedback/hints/retries with inconclusive
checks labelled Needs review, durable progress and voluntary in-app review, and
review flags when supporting evidence changes while retaining learning history.
The first delivery unit is a complete one-source teaching/practice journey with
saved progress. The learner proposes application Luna-first routing with Sol
medium escalation and prefers Luna for this conversation. Routing signals/limits
await confirmation; no model changed. This is an interview, not implemented
functionality.
Decisions: [topic learning journey](../docs/planning/topic-learning-journey.md).
No tests, application changes or new GitHub implementation ticket for this unit.
Mobile/iOS and its tracker are untouched.

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
#25/#27 retain their AI quality/hosted targets. See [acceptance and limits](../docs/reviews/reading-format-acceptance-2026-10-09.md).

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
See [acceptance, failures and limits](../docs/reviews/working-product-acceptance-2026-10-08.md).

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
next. [Implementation, failures and next gates](../docs/reviews/claim-generation-review-2026-10-08.md). #25/#27 stay open.
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

[Preparation, measurements and limits](../docs/reviews/claim-evidence-preparation-2026-10-08.md). #25/#27 remain open for independent
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

[Results and next gates](../docs/reviews/laya-classifier-development-2026-10-08.md). #25/#27 remain open. Routing and broader grounding
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
is selected. [Results, reproduction and limits](../docs/reviews/grounding-classifier-development-2026-10-08.md).
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

[Acceptance and limits](../docs/reviews/generation-reliability-acceptance-2026-10-08.md). #25/#27 remain open. Next planned unit: compare
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
worker dispatcher started. [Results and remaining gates](../docs/reviews/assistant-broader-evaluation-2026-10-08.md).

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
native/iOS and its tracker untouched. [Acceptance and limits](../docs/reviews/passage-selection-acceptance-2026-10-08.md).
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

[Results and next unit](../docs/reviews/assistant-multisource-evaluation-2026-10-08.md): fix question-aware passage selection under #27
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
See [acceptance evidence](../docs/reviews/hybrid-retrieval-acceptance-2026-10-07.md).


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
warning); 213 backend tests pass. [Evidence](../docs/reviews/qdrant-indexing-acceptance-2026-10-07.md).
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
were removed; only named jobs ran. [Evidence](../docs/reviews/qdrant-indexing-acceptance-2026-10-07.md).

Web progress display and its browser/client tests await the requested TDD seam
approval. Background indexing remains disabled; assistant hybrid queries are
later work. #26 stays open; native tracker untouched.


## Latest work — 2026-10-07

**#26 hosted checkpoint:** the learner explicitly approved migration 013, and
Supabase reported success on 2026-10-07. Qdrant 1.19.2 and its dedicated BM25/dense
collection are configured. The named public baseline PDF
`2dfc7546-802f-47a2-9b52-79577a48cb79` indexed successfully: ready, version 1,
2/2 chunks, exact original offsets/fingerprint, physical page 6, correct owner and
both dense/sparse vectors. A source/owner-filtered BM25 smoke query returned two
owned hits. This verifies indexing infrastructure, not answer quality.

**Locally checked:** durable manifests/tombstones, structure-first recursive
chunking, bounded embeddings, resumable batches, lease/version fences, opt-in
ARQ dispatch and authenticated owned readiness API. Seven HTTP checks and all
213 backend tests passed. All migrations and actual ownership/retry/refresh/
expiry/deletion calls passed in disposable Postgres 16; fixtures were rolled back
and the container stopped. [Setup/checks](../docs/qdrant-indexing-setup.md).

**Remaining in #26:** hosted authenticated status/cross-owner/retry/version/delete
acceptance and learner-visible readiness. `ENABLE_RETRIEVAL_INDEXING` remains
false; only the named index job ran. No unrestricted dispatcher started. The
assistant still uses existing Postgres retrieval; hybrid query integration and
Postgres ID revalidation are later work. Native/iOS files/tracker unchanged.
No commit/push performed.

**Implemented:** development-only authenticated baseline collection and bounded
local DeepEval scoring under #25. It records actual model retrieval context,
reviewed capture fingerprints, exact citations and post-generation revision
validation. Raw reports stay ignored. Optional DeepEval 4.2.8 is locked and was
installed into an isolated temporary environment; production routes do not import it.

**Measured:** one fresh public PDF page-6 case answered the positional-encoding
question in 5.62 seconds. Exact span hit, semantic recall and precision: 1.0;
faithfulness: 0.8571, with a suspected contradictory judge explanation recorded
for manual review. Eight judge calls; SDK estimate $0.0017205. This is a preliminary
sample, not the complete 12-case baseline or a streaming/capacity guarantee.
[Current report](../docs/reviews/assistant-baseline-2026-10-07.md).

**Checks:** 206 backend and 68 web tests pass; web typecheck/lint/build and diff
whitespace checks pass. The uncited-PDF regression fails against original HEAD
and passes with the fix. Browser Retry connection restored the library; fresh
PDF capture then failed and a bounded retry reported source-host resolution
failure. No fresh note was created in that browser library. Browser/overview/video/
graph acceptance and broader baseline remain pending; #24/#25 stay open.
Only the named public acceptance study job ran; no dispatcher started. Native/iOS
files and native tracker unchanged. No commit/push performed.

## Current status — 2026-10-06

**Verified MVP:** all planned tickets 01–15 are complete with development
acceptance. GitHub #1–#16 cover the plan plus the extra citation/title polish
in #4. Current web behavior includes owned captures, cited notes, topics/graph,
overviews, corrections, versioned refresh, bounded long sources, grounded
assistant answers and on-demand external research with explicit saving.

**Last completed application work:** citation passage improvement / [GitHub #17](https://github.com/CloudKai/secondBrain/issues/17),
including the learner-requested existing-note citation update. Exact text,
PDF pages and real caption timing are preserved. Planned ticket 15 / GitHub #16
previously completed external discovery with explicit article/PDF saving.

**Latest application checks:** 200 backend tests and 68 web tests plus web
build/typecheck/lint pass through citation review fixes `074f157`. Both citation
review axes are clear; migration 012 and controlled caption/browser acceptance
passed in development. These are previous results; no tests were run for the
current design interview.
Hosted real OpenAI search/direct-fetch/auth/database and original browser article/model/worker flows pass;
controlled sources cleaned. PDF discovery/save routing is checked at the API
HTTP boundary. Desktop development only; production and concurrent stress
acceptance remain unverified.

**Latest learner direction:** delete old audit material and use fresh captures,
then continue the agreed AI specs. Only the three named #24 audit sources were
deleted with one-owner filtering; exact-ID read confirmed zero remaining.
Existing-note repair is superseded; fresh-source fix acceptance is still pending.

**Next unit started:** [GitHub #25](https://github.com/CloudKai/secondBrain/issues/25),
DeepEval baseline preparation. [Execution spec](../docs/planning/assistant-evaluation-baseline.md)
and [12 seed cases](../docs/evaluation/assistant-baseline-cases.json) are prepared.
No framework installed, runnable tests added, fresh captures imported or semantic
evaluations run. Test-boundary approval and the shared search engine decision
have been requested. Model judging configuration/cost must be recorded before
live baseline scoring. No worker restarted; native tracker unchanged.

**Current fix follow-up:** #24 code changes are implemented locally, awaiting
acceptance. Scoped read-only replay confirmed canonical-context mismatch and
single-source combined claims. Added one bounded validation correction, original
excerpts for long-note synthesis, full-capture assistant passage selection and
word-boundary graph labels. Python syntax, web typecheck and lint pass. Regression
and browser checks await the requested test-scope approval. The old audit notes/jobs were subsequently removed at the learner's request;
worker remains stopped. Details are in the
[audit follow-up](../docs/reviews/web-saved-source-audit-2026-10-06.md).

**Current unit:** UX slices 1–3 are implemented locally under GitHub #21–#23.
Slice 4 real-source audit is completed with blockers under
[#24](https://github.com/CloudKai/secondBrain/issues/24), with
[current screenshots and findings](../docs/reviews/web-saved-source-audit-2026-10-06.md).
Three public sources generated notes. Browser checks cover wide/narrow citation
presentation, PDF/video locators, focus return, scoped/cross-source answers,
evidence-gap and stale recovery, reload, reversible rename, validation and light/
constrained layouts. Video topic mapping and combined overview failed. A PDF
citation-support mismatch, missed retrieval and graph-label wrapping remain.
Successful overview/archive/edge checks, actual zoom and full accessibility are
pending; #21–#23 stay open. No code changes or automated tests in slice 4. The
approved worker was stopped; three audit sources retained. Native tracker unchanged.
AI slice 5 has not started. DeepEval, RAG and Jev guidance remain selected tooling.
The learner selected cross-source answer quality, up to 200 sources, and accuracy
first. Proposed retrieval, checking and routing changes are recorded in
[the discussion](../docs/planning/assistant-rag-improvements.md). Implementation
has not started; the original 15-slice web plan remains complete.

**Target behavior:** Automatic Teams/Zoom/Panopto access, PDF OCR,
linked accounts and production deployment remain planned. YouTube support is
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


### Long sources complete — planned 13 / #14, 2026-10-04

Migration 010 applied after user approval; matching worker restarted. Final code
`e474faf` passes 144 backend and 61 web tests plus build/typecheck/lint and both
review axes. Hosted original page/cue selection, invalid duplicate ranges,
ownership/private worker denial, saved section failure/retry and real synthesis
pass. Browser whole/selected PDF, unchanged source counts, old citations, timed
transcript evidence, progress reload and explicit Retry pass. API/provider outage
check preserves exact successful checkpoint on attempt 2; browser failed state
was controlled fixture setup. All controlled sources, archives and section work
removed; existing learner note unchanged. GitHub #14 closed. Planned 14/15 remain
draft/unpublished; native/iOS and its tracker untouched. Evidence: setup and review
records in docs/long-source-setup.md and docs/reviews/ticket14.md.


## Grounded assistant selected — planned 14 / #15, 2026-10-04

Inspected existing preview assistant, completed notes, corrected topics, citation
readers and current source-version fences. Published and claimed #15. User agreed
to authenticated question/scope API, external model HTTP, database ownership/
retrieval/version checks and browser scope/citation/gap flows. Selected scope:
current note plus optional topic/library evidence, Postgres relevance retrieval,
strict grounded English answers and original passage citations. Live discovery
remains planned 15. Implementation/checks/migration/acceptance pending. Setup:
docs/assistant-setup.md. Native/iOS and its tracker untouched.

### Grounded assistant local implementation — #15, 2026-10-05

Approved API/model HTTP/database/browser boundaries are in use. Authenticated
questions, current-note default, independent combined topic/library scopes,
exact saved page/cue citations, stale-context fencing, unsupported-answer gaps,
bounded recent conversation and preview-only research navigation are implemented.
14 focused API/model tests and three client/database tests pass; typecheck/lint
pass. Full checks, independent review, migration 011 and hosted acceptance remain
pending. GitHub #15 open. Native/iOS and its tracker untouched.


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


### Shared repository layout — #19 (2026-10-05)

At the user's request, `mobile/` became a regular folder alongside `web/` and
`backend/` in `CloudKai/secondBrain`. Its tracked files and Git history were
preserved; application code and generated native content were unchanged. This
repository-organization task is tracked in GitHub #19 and the native tracker.
The completed web feature acceptance remains unchanged. No application tests
were run for the folder import.


### Readability and example clarity — #23 (2026-10-06)

Implemented locally: brighter secondary-text tokens, larger small text/graph
labels, 44px minimum filter/scope controls, explicit curated-example wording,
and focused library/graph empty states. TypeScript and ESLint pass. Narrow
example-topic and empty-library/graph screens inspected. Token contrast against
five base backgrounds is above 4.5:1 in both palettes; rendered/composited states
and full accessibility remain unverified. No automated tests added or run.
GitHub #23 remains open for broader acceptance. Real-source journey audit is next.


### Saved-source learning journey — #24 (2026-10-06)

Completed current-run audit with real arXiv PDF, Harvard article and accessible
YouTube captions in a separate anonymous library. All three saved and generated
notes. Report and screenshots linked above distinguish working presentation from
semantic AI quality. Sampled focus, locator, scope, reload, rename, validation and
responsive checks passed. Topic mapping failed after one manual retry and combined
synthesis failed; no fabricated edges or revisions introduced. Sources retained.
Worker stopped (exit 0), dark appearance restored and viewport reset. Static checks
from slices 1–3 remain prior results; no automated suite run for this audit.
