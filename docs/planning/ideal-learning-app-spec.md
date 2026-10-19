# Build coherent topic collections with deeper teaching and reliable continuity

Status: **U1 implemented in development; its remaining visual/accessibility acceptance is open. U2–U5 are specified target behavior, not implemented.**  
Date: **2026-10-09**  
Delivery: five ordered units, extending the development foundation of GitHub #28.
Published: [GitHub #29](https://github.com/CloudKai/secondBrain/issues/29), labelled **ready-for-agent**.

U1 delivery: [#30](https://github.com/CloudKai/secondBrain/issues/30), migration 018
applied after approval; 296 backend / 99 web tests and web lint/typecheck/build pass.
See [acceptance](../reviews/learning-continuity-acceptance-2026-10-09.md). Target
behaviors below describe the whole specification, not current capability claims.

## Implementation status — 2026-10-09

U1 continuity and U2a independent identity/backfill are implemented in development. U2b focused collection navigation/workspace is implemented locally; #32 retains actual zoom and screen-reader gates. U2c durable drafts/chat and U3–U5 remain target behavior. Detailed results: [web tracker](../../context/web-progress-tracker.md).

## Problem Statement

Learners can save sources, inspect citations and begin lessons, but their learning is still organized around the document they opened first. Returning to the library may choose the newest source instead of their unfinished lesson. Reopened notes can show unrelated topic context, old and current plans can have identical labels, and unfinished answers and tutor conversations are temporary.

The app also underuses saved material: teaching takes passages selected for a source note rather than retrieving relevant evidence throughout the capture. A useful detail omitted from the note may never reach a lesson. Practice feedback exists, but outcomes lack stable identities and the next useful learning action is not consistently clear. The topic graph and discovery experience provide only a limited view of how a growing collection supports a learner's goal.

Learners need a coherent topic collection where their goals, sources, learning paths, practice and wider conceptual structure remain connected over time. They must be able to trust what is supported, what is suggested, what they have attempted and what remains uncertain.

## Solution

Make the topic collection an independent learning destination. Library resumes its actual selected path and lesson. The workspace brings teaching, practice, voluntary review and a scoped study assistant together, with supporting sources, maps and version history available through secondary panels.

Use the learner's goal and full captured material to identify teachable concepts and retrieve exact evidence for each learning outcome. Keep original source notes available as summaries. Lessons explain and demonstrate concepts, invite learner responses and give specific provisional feedback with useful next actions. New sources strengthen a path through a contribution preview and confirmation; changed goals can branch without erasing previous work.

Show two coordinated views: a teaching map for the learner's chosen sequence and a topic graph for source-supported relationships and broader overlapping groups. Discovery starts from a concrete coverage gap and explains what a resource could add. Strengthen the shared AI policy and operational controls, then measure teaching quality, costs, latency and workload before making public reliability claims.

## User Stories

1. As a learner, I want a topic collection to have its own destination, so that I do not need to remember which document started it.
2. As a learner, I want Library to resume my selected collection, path and lesson, so that I can continue my actual work.
3. As a learner, I want direct links and browser navigation to restore my learning place, so that I can return reliably.
4. As a learner, I want a note's context to reflect its own topics, so that unrelated material does not appear to support it.
5. As a learner, I want deliberate exploration of another topic to be clearly labelled, so that I can distinguish it from the current lesson's evidence.
6. As a learner, I want one clearly identified current plan per path, so that I know which version I am continuing.
7. As a learner, I want previous versions labelled with dates, difficulty and changes, so that I can inspect their history without confusion.
8. As a learner, I want my selected difficulty and previous-level work retained, so that I can adjust challenge without losing progress.
9. As a learner, I want studied lessons, attempts and provisional feedback shown separately, so that activity is not presented as mastery.
10. As a learner, I want opening pages and citations to leave my progress unchanged, so that it reflects deliberate learning actions.
11. As a learner, I want a collection to begin with one saved source, so that I can learn before building a large reading list.
12. As a learner, I want to begin with a topic and discover sources, so that I can explore a new interest inside the app.
13. As a learner, I want unsupported starting suggestions clearly labelled, so that I do not mistake them for saved coverage.
14. As a learner, I want a few useful starting paths, so that I can choose a direction that interests me.
15. As a learner, I want an editable learning goal, so that my journey can change with my needs.
16. As a learner, I want to preview a changed goal or branch before opening it, so that I control my direction.
17. As a learner, I want new sources to leave my goal unchanged unless I confirm a change, so that importing material does not redirect me.
18. As a learner, I want the current lesson and next useful action prominent, so that I spend less time managing plans.
19. As a learner, I want sources, maps and revision details in secondary panels, so that they remain accessible without overwhelming the lesson.
20. As a learner, I want original source notes accessible from a collection, so that I can inspect each source's perspective.
21. As a learner, I want existing source links to keep working, so that saved links survive the collection migration.
22. As a learner, I want learning history accessible after its original source is deleted, so that my answers and decisions are not lost.
23. As a learner, I want unavailable evidence clearly marked, so that retained history does not imply a deleted source is still accessible.
24. As a learner, I want unfinished answers saved, so that refreshing or reopening does not erase my thinking.
25. As a learner, I want visible save and retry states, so that I know when my work is safely stored.
26. As a learner, I want conflicting drafts from two tabs presented clearly, so that one does not silently overwrite the other.
27. As a learner, I want tutor conversations restored within their original lesson and scope, so that follow-up questions retain context.
28. As a learner, I want one study assistant entry with explicit lesson, collection and library scopes, so that I know which material it uses.
29. As a learner, I want generated explanations and original excerpts visibly distinguished, so that I understand their provenance.
30. As a learner, I want useful exact source wording or a clear evidence gap when an explanation cannot be supported, so that I can still inspect the available material.
31. As a learner, I want lessons to find relevant details throughout captured sources, so that learning is not limited to the summary.
32. As a learner, I want concepts, prerequisites, examples and qualifications mapped to evidence, so that the lesson has a meaningful structure.
33. As a learner, I want source capture and plan coverage limits disclosed, so that I know what the app has actually considered.
34. As a learner, I want each lesson to state a concrete outcome, so that I know what I am trying to understand or do.
35. As a learner, I want concise explanations and appropriate worked examples, so that the app teaches rather than lists sections.
36. As a learner, I want equations, code and qualifications preserved, so that simplification does not change their meaning.
37. As a learner, I want exact page and timestamp citations, so that I can inspect the original support.
38. As a learner, I want generated examples and optional background identified, so that I do not mistake them for source quotations.
39. As a learner, I want stable outcomes across revisions, so that relevant earlier learning remains recognizable.
40. As a learner, I want new application questions and harder requirements tracked separately, so that earlier work does not falsely complete them.
41. As a learner, I want to answer in my own words, so that I can practise explanation and application.
42. As a learner, I want feedback to consider valid alternative reasoning, so that it does not require a memorized answer.
43. As a learner, I want criterion-specific feedback and uncertainty labels, so that I know what to improve and what needs review.
44. As a learner, I want a useful next action after feedback, so that I can retry, request a hint, inspect evidence or revisit a prerequisite.
45. As a learner, I want to choose a different next action, so that recommendations do not lock my exploration.
46. As a learner, I want voluntary review and separate retries, so that revisiting concepts does not overwrite earlier attempts.
47. As a learner, I want conflicting sources presented separately, so that the app does not invent agreement.
48. As a learner, I want new source contributions previewed before a revision, so that I understand what will change.
49. As a learner, I want collection membership and plan evidence counts distinguished, so that I know which sources informed a lesson.
50. As a learner, I want repeated membership to count once, so that duplicates do not inflate coverage or corroboration.
51. As a learner, I want a teaching map separate from source-supported topic relationships, so that suggested order is not confused with factual dependence.
52. As a learner, I want broader groups that emerge from saved topics and can overlap, so that I can locate my learning within a wider field.
53. As a learner, I want topic search, focus and expansion controls, so that I can navigate a growing map.
54. As a learner, I want suggested branches labelled and previewed before confirmation, so that they do not appear to be established coverage.
55. As a learner, I want my topic renames, merges, assignments and rejected connections respected, so that the map reflects my corrections.
56. As a learner, I want discovery to begin with my goal and a coverage gap, so that recommendations have a specific purpose.
57. As a learner, I want research results to explain prospective contribution, publication type, provenance and limitations, so that I can judge them before saving.
58. As a learner, I want to choose a collection when saving a resource, so that interesting material strengthens the intended journey.
59. As a learner, I want unavailable resources and failed operations explained with useful recovery actions, so that I can continue without losing work.
60. As a learner using a keyboard or screen reader, I want every learning, map and panel action accessible, so that I can use the full journey.
61. As a learner, I want readable narrow and desktop layouts in both themes and at 200% zoom, so that I can learn comfortably.
62. As a learner, I want private evidence and learner work protected by ownership, so that another user cannot access my collection.
63. As a learner, I want an account recovery and export journey specified before long-term public use, so that my learning is not dependent on one browser session.
64. As a maintainer, I want effective AI policies and safe operational status visible, so that I can diagnose failures without exposing secrets.
65. As a maintainer, I want bounded requests, retries, concurrency and spending, so that generation cannot create uncontrolled usage.
66. As a maintainer, I want reviewed teaching cases and paired policy measurements, so that model changes are justified by evidence.
67. As a maintainer, I want reproducible releases and worker/index recovery, so that hosted operation preserves learner work.
68. As a learner, I want performance and learning-quality claims based on measured scenarios, so that I can trust the app's stated capabilities.

## Implementation Decisions

1. **Delivery boundaries:** implement five ordered units: U1 continuity; U2 collection workspace; U3 teaching evidence/practice; U4 map/discovery; U5 shared AI policy and release readiness. Each unit has its own acceptance and recovery record. Operational protection applies before public exposure even if U5 delivery is later.
2. **Current versus target:** extend the existing development implementation of source capture, citations, confirmed learning plans, retained attempts and branches. This specification does not claim those capabilities already form the complete target journey. Practice feedback remains provisional.
3. **U1 context and resume:** resolve context from the active source's valid topic assignments and distinguish unrelated explicit exploration. Use the owned saved learning place for resume. Introduce a summary read and cursor timestamp/version only where existing records are insufficient. Missing or stale places show an honest choice/history state.
4. **U1 progress and versions:** use persisted study, attempt and feedback aggregates with documented event semantics. Navigation, answer revelation and assistant messages do not create mastery. Show one current confirmed revision per path; identify previous versions by date, level and reason. Selecting historical work does not silently reactivate it.
5. **U2 collection identity:** add an owned topic collection independent of its originating source, with title, goal, membership and current place. Backfill one collection per owned legacy learning root, including removed anchors. Preserve path, plan and attempt IDs. Make the mapping unique and migration idempotent.
6. **Compatibility and source removal:** original source notes and routes remain available; old learning entry points resolve through owned legacy mappings. Unique source membership prevents duplicate counting. Retain learner history after removal while honoring existing captured-text redaction and cleanup rules; unavailable evidence is explicit.
7. **Workspace:** provide Learn, Practise and Review as the primary task flow. Secondary panels contain source management, teaching map, topic graph and revision history. A topic-only collection may offer discovery and suggested direction, but teaching coverage requires substantive captured evidence.
8. **Drafts and conversation:** persist unfinished answers and conversation with owner, collection, revision, lesson and scope identity. Use optimistic concurrency, explicit save state and visible conflicts. Preserve unsent text on failure; clear user-scoped pending cache on sign-out. Define retention/deletion/export behavior in U2's detailed contract before enabling stored conversations.
9. **Study assistant:** provide one entry with explicit lesson, collection and library scopes. Initially reuse existing response policies and explain provenance. Retained conversation is context, never source evidence. Send bounded recent context, validate scope before and after generation, and preserve excerpt/gap fallback.
10. **U3 teaching evidence:** add a versioned source concept/coverage manifest and outcome-specific retrieval across captures using existing BM25+dense retrieval. Map concepts, prerequisites, examples and qualifications to original passages. Preserve offsets, versions, pages and timestamps; validate owner and freshness before generation and persistence.
11. **Bounds and coverage:** initially retain the maximum of eight supporting sources per generated plan. A collection may contain more, but each plan discloses its participating subset and gaps. Indexing pending/failure cannot silently become comprehensive coverage. Captured text does not imply extracted images or diagrams.
12. **Outcome/check identity:** assign stable outcome identities and versioned understanding checks. Preserve historical wording and attempts. Conservative legacy lineage mappings can link proven matches; ambiguous equivalence stays separate or requires review. New applications or changed requirements never inherit prior completion.
13. **Teaching and next action:** each lesson contains an outcome, concise explanation, justified example, understanding check and feedback criteria. Generated examples/background are labelled. Recommend a specific retry, hint, evidence inspection, prerequisite or continuation from observable state; review and exploration remain voluntary.
14. **U4 topic structure:** shared topics remain primary graph nodes, as the accepted domain decision requires. Add overlapping broader groups, search/focus/expand controls and a list alternative. Grouping and teaching-order arrows do not establish factual prerequisites. Avoid unrelated filler nodes and preserve learner corrections/rejections.
15. **Branch suggestions:** show accessible suggested-state labels and previews. Confirmation opens a path; opacity or color alone cannot communicate its status. Suggested branches do not increase saved coverage or completed learning.
16. **Discovery:** include collection goal and a named gap in a bounded discovery request. Explain prospective contribution separately from verified captured coverage. Saving chooses a collection, while incorporating evidence into teaching still requires contribution preview and confirmation. Readable links and metadata do not imply independent quality review.
17. **U5 AI policies:** create a shared backend task policy recording model, reasoning effort, input/output limits, deadline, retries, escalation triggers and policy version. Preserve Luna-medium for learning and Sol-medium as a bounded candidate. Structural repair is not semantic confidence. Evaluate other generators before changing their models.
18. **Evidence failures:** distinguish absent support, stale evidence, invalid generation, setup failures, timeout and provider outage. Escalation cannot repair missing evidence. Keep current confirmed plans during failed revisions and offer useful excerpts or a gap when an explanation cannot meet support policy.
19. **Configuration and usage:** validate settings for enabled capabilities, identify unused names, distinguish liveness from readiness and expose sanitized diagnostics. Add authenticated idempotent usage accounting, concurrency limits and spending reservation/reconciliation. Select the hosted per-question cost ceiling after paired measurement; record it explicitly before rollout.
20. **Operations and recovery:** document production API routing, worker supervision, leases, durable indexing/cleanup recovery, migration verification and release compatibility. Review the legacy unauthenticated generation route before public exposure without silently breaking the native development contract. Keep Postgres authoritative and Qdrant derived/rebuildable.
21. **Account recovery/export:** specify and accept a detailed contract before implementation. The recommended starting option is linking an email identity to the existing anonymous owner; collision, verification and merge behavior must be explicit. Portable export retains provenance and learner history without resurrecting deleted captures. Provider choice is not established by this umbrella spec.
22. **Rollout compatibility:** prefer additive migrations, feature flags and forward repair. Once new collection data exists, rollback must preserve its API/history access. Validate migration counts and mappings per owner; never drop learner data as a default rollback. Version generation/evidence policies so new requests can return to a prior policy while existing plans remain readable.
23. **UI and domain boundaries:** retain web charcoal/mint and light-theme tokens. Extract focused route/context and learning-domain controllers as affected behavior changes. Respect existing shared-topic and web-first architecture decisions; mobile and native folders remain outside these units.
24. **Evaluation gates:** prepare independently reviewed baseline cases before changing teaching. Compare Luna-only, Sol-only and routed policies on the same evidence/cases. DeepEval supports review; it does not replace reviewed labels. New classifiers, providers or streaming require measured benefit and a separate support/failure contract.

## Testing Decisions

1. Reuse the user's previously approved boundaries: authenticated learning API, model/provider HTTP responses, Postgres ownership/version/worker functions and the browser learning journey. These remain the highest useful seams; tests should exercise observable results rather than private helpers or component structure.
2. Follow existing learning API/provider-response tests for schema validation, unauthorized access, leases, confirmation, attempts and provider failures. Follow existing database-backed learning persistence tests for actual RPC/RLS behavior; API mocks alone cannot establish migration correctness.
3. Test context, resume and metrics through direct links, reload, browser history and evidence return. A source with unrelated global topic selection must restore its own context. Choosing a branch lesson must change the resume destination without awarding learning progress.
4. Test duplicate-title versions by visible and accessible labels, current selection and history behavior, rather than inspecting rendering internals.
5. Run collection backfill twice against multiple owners, removed roots, branches and difficulty histories. Assert preserved IDs/counts, cross-owner denial, deduplicated membership and compatibility of old source entry points.
6. Test drafts/conversation across reopen, failed saves, conflicting tabs, changed evidence and source removal. An unsubmitted draft is not an attempt; a failed send is not a completed reply or duplicated retry.
7. Use saved article/PDF/transcript fixtures where relevant support exists outside the note. Confirm teaching retrieves it and citations still open the original passage. Cover missing diagrams, sparse/conflicting evidence, code, formulas, Unicode and stale index generations.
8. Test source change/removal during retrieval and generation. Stale confirmation fails safely, current confirmed plans survive failures, removed captures are not exposed from retained history, and cleanup remains retryable.
9. Test stable outcome mapping and separately versioned checks. Rephrasing cannot silently create equivalent assessment; harder applications and changed criteria retain independent attempts.
10. Review criterion feedback for valid alternative, partial, incorrect and ambiguous answers. Include unsupported conclusions and source conflicts. Assess explanation clarity, semantic support, feedback fairness and next-action usefulness separately from JSON/citation validity.
11. Test growing-map correction, overlapping groups, search/focus restoration, suggested branch labels, rejected connections and the accessible list alternative. Test discovery from a gap through inspection, collection saving and separately confirmed incorporation.
12. Test missing/unused settings, secret-free diagnostics, authenticated public generation, request/concurrency/spending limits, idempotent usage reconciliation and provider outages. Test worker restart and rebuilding derived indexes from authoritative state.
13. Independently review labels/rubrics and freeze development thresholds before held-out comparison. Record actual model/policy versions, source snapshots, tokens, retries, escalation, duration, costs, false support and false rejection. Inspect DeepEval/human disagreements.
14. Measure a documented 200-source mix under stated concurrency and cold/warm conditions. Report indexing/recovery, retrieval, summary reads and graph rendering with sample counts, p50/p95 and failures. Measure first useful supported content and total completion separately; progress indicators do not satisfy the 10–15-second target.
15. Verify keyboard operation, dialog focus return, screen-reader order/announcements, both themes, narrow/desktop, actual 200% browser zoom and long-content scrolling. Record the browser and assistive technology; narrow screenshots are not a zoom or screen-reader pass.
16. Each application unit runs applicable backend/web tests, web typecheck/build and lint, plus migration and live scenarios. Record exact results, screenshots and remaining gates. This specification-writing task requires document checks, not rerunning app tests or making provider calls.

## Out of Scope

- Implementing application changes, applying migrations or deploying through this specification-writing task.
- Mobile/iOS redesign, native-share changes or changing the fixed native folders.
- A preloaded universal syllabus, rich-text source-note editing or regeneration of every saved note.
- Automatic mastery, calibrated grades or passing harder checks from earlier attempts.
- Silent source imports, automatic goal replacement or unconfirmed plan incorporation.
- Replacing Qdrant, introducing TinyFish, or adopting a classifier/new provider without evaluation.
- Claiming verified streaming, 200-source capacity, educational effectiveness, hosted cost or latency targets before measurement.
- Selecting a numeric educational threshold, hosted cost ceiling or final account-recovery provider without the prescribed evidence/sub-spec.

## Further Notes

This specification synthesizes the accepted product direction and completed audit. It extends #28; it does not invalidate its preserved source/learning implementation or close its outstanding acceptance gates. The current reviewed baseline is local HEAD `1835298305d50f6a9042a1ef9b7c4a56c8ca242e` plus the dirty working tree recorded in the audit.

Delivery order and completion conditions:

| Unit | Prerequisite | Completion condition |
| --- | --- | --- |
| U1 Continuity | Current development baseline | Correct context/resume, persisted meaningful activity and unambiguous version history, with migration compatibility where needed. |
| U2 Collection workspace | U1 | Independent owned collections, preserved legacy history/routes, focused workspace and durable unfinished work with conflict/failure handling. |
| U3 Teaching evidence/practice | U2 and reviewed baseline cases | Outcome-specific full-capture evidence, stable outcomes/checks, useful next actions and reviewed improvements without weakened citation integrity. |
| U4 Map/discovery | U3 | Navigable wider structure, corrected suggestion semantics and gap-to-resource-to-contribution flow. |
| U5 Policy/operations | Prior units and paired measurements | Reproducible protected deployment, safe usage controls, measured cost/quality/latency/capacity, accepted recovery/export contracts and recorded accessibility gates. |

Release invariants permit no ownership leaks, fabricated source coordinates, deleted-text resurrection, silent goal replacement or progress awarded by navigation. Educational thresholds and cost ceilings become explicit recorded decisions after measurement. Feedback remains provisional until evidence supports a stronger product claim.

After U1 development delivery, the next implementation unit is U2. Each unit should receive an independently reviewable delivery ticket when broken down for execution. Public rollout and the remaining U1 visual/accessibility acceptance are gated throughout; the order does not authorize exposing an unprotected development service.

Update the web tracker, web ticket document, scope and GitHub progress per completed unit. Keep the iOS tracker separate. Companion documents: [audit](../reviews/ideal-learning-app-audit-2026-10-09.md) and [roadmap with per-unit compatibility, failure and recovery scenarios](ideal-learning-app-roadmap-2026-10-09.md).
