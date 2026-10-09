# Source-backed topic learning journeys

Status: **all three delivery phases implemented in development on 2026-10-09**.
Published as [GitHub #28](https://github.com/CloudKai/secondBrain/issues/28), which
remains open for the full phased target. See the [development acceptance record](../reviews/learning-journey-acceptance-2026-10-09.md).
Goal branches, teaching maps and separate graph activity indicators are implemented
in development; full rollout acceptance remains open.
See the [branch acceptance record](../reviews/learning-branches-acceptance-2026-10-09.md).
See the [collection acceptance record](../reviews/learning-collections-acceptance-2026-10-09.md). Practice feedback is provisional; semantic confidence routing,
verified assessment, public rollout and remaining acceptance checks are not complete.

## Problem Statement — baseline before this implementation

Learners can collect useful articles, PDFs and videos, but reading a description
of their contents does not provide a coherent way to learn them. The current web
app saves cited source notes and combined topic overviews, offers source discovery
and displays topic relationships. Recall reveals an answer and keeps only a
session self-report; it does not capture learner responses or give practice
feedback. There is no durable learner goal, teaching sequence, difficulty history
or learning progress. Current assistant answers display attributed source excerpts;
calibrated semantic verification remains unfinished.

A learner wants to turn even one document into teachable concepts, examples and
interactive practice. As they bring in more sources, they want those sources to
strengthen a goal-driven topic collection, improve its learning structure and
show how their understanding connects to a broader field. They need to distinguish
what they saved, what they studied and what they demonstrated through practice.

## Solution

Make the topic collection the main learning home, retaining individual source
notes and inspectable evidence. A collection can begin with one saved source.
Suggest several source-informed starting paths and editable goals. Before opening
a path, show its outcomes, prerequisites, source coverage and any additional
background teaching. The learner confirms through “Start this path.” Unlocking
means opting into a path; prerequisite completion is not a compulsory gate.

Teach through short explanations, worked examples, learner attempts, feedback,
hints and application exercises, with a tutor available throughout. Let learners
explore freely and change difficulty per path without losing previous-level work.
Persist activity, answers and check results; offer voluntary in-app review.

Find further-study resources inside the collection using the existing discovery
capability. Save them only through learner action. New saved sources produce a
contribution preview and proposed plan revision, not a silent rewrite. Changed
goals can create branches that preserve earlier paths and reuse relevant learning.
The graph distinguishes suggested teaching order, source-supported relationships
and learning progress. Source coverage never establishes mastery by itself.

## User Stories

1. As a learner, I want a topic collection to bring together sources, teaching and progress, so that I can study a subject coherently.
2. As a learner, I want one saved source to start a collection, so that I can begin before collecting a whole reading list.
3. As a learner, I want to keep individual source notes available, so that I can inspect each source's perspective.
4. As a learner, I want teachable concepts identified from substantive source content, so that passing mentions do not become unsupported lessons.
5. As a learner, I want several starting paths for a broad topic, so that I can choose an area that interests me.
6. As a learner, I want the app to suggest a goal I can edit, so that the journey reflects what I want to understand or do.
7. As a learner, I want sources to leave my goal unchanged unless I choose a change, so that my focus stays under my control.
8. As a learner, I want to preview learning outcomes and prerequisites, so that I know what a path involves.
9. As a learner, I want to see which saved sources support a path, so that I can judge its coverage.
10. As a learner, I want missing coverage and generated background teaching disclosed, so that I understand the basis of the material.
11. As a learner, I want to confirm before opening a suggested path, so that I choose which routes to pursue.
12. As a learner, I want optional prerequisite lessons previewed before opening, so that I can decide whether I need them.
13. As a learner, I want short explanations tied to learning outcomes, so that teaching goes beyond listing source sections.
14. As a learner, I want worked examples appropriate to the concept, so that I can see how an idea is used.
15. As a learner, I want equations, code and qualifications preserved accurately, so that simplification does not change their meaning.
16. As a learner, I want source references on supported explanations, so that I can inspect the original evidence.
17. As a learner, I want original page and timestamp citations, so that I can return to the exact passage or video moment.
18. As a learner, I want generated teaching examples identified as examples, so that I do not mistake them for source quotations.
19. As a learner, I want a tutor available during a lesson, so that I can ask about the concept or my difficulty without leaving the journey.
20. As a learner, I want to answer questions in my own words, so that I can practise explaining a concept.
21. As a learner, I want application problems and quick questions, so that I can practise using ideas as well as recalling them.
22. As a learner, I want specific feedback against clear criteria, so that I know which parts of my answer need work.
23. As a learner, I want a hint and an opportunity to retry before a worked answer, so that I can continue thinking for myself.
24. As a learner, I want uncertain feedback labelled Needs review, so that an unreliable judgment does not become a confident grade.
25. As a learner, I want revealing an answer distinguished from passing a check, so that progress reflects what I actually did.
26. As a learner, I want to skip lessons or try practice first, so that I can choose how to study.
27. As a learner, I want suggested prerequisites without compulsory locks, so that I can explore advanced ideas.
28. As a learner, I want a difficulty setting for each path, so that my level in one topic does not determine my level in another.
29. As a learner, I want difficulty changes to adjust upcoming explanations and practice, so that material is neither too easy nor too hard.
30. As a learner, I want previous-level attempts and results retained, so that changing difficulty does not erase my work.
31. As a learner, I want harder-level requirements shown separately, so that easier checks do not falsely complete harder challenges.
32. As a learner, I want progress and attempts restored when I reopen the app, so that I can continue where I left off.
33. As a learner, I want reading activity and understanding checks shown separately, so that completion is not confused with comprehension.
34. As a learner, I want to review what I learned inside the app, so that I can revisit concepts when I choose.
35. As a learner, I want fresh practice attempts recorded separately, so that I can see change over time without overwriting earlier work.
36. As a learner, I want to search for credible sources by topic inside a collection, so that I can fill gaps without losing my focus.
37. As a learner, I want to inspect a suggested resource before saving it, so that research suggestions do not silently enter my library.
38. As a learner, I want to add interesting material I found elsewhere, so that it strengthens my existing learning journey.
39. As a learner, I want a new source's contribution explained, so that I can see new concepts, examples, prerequisites or disagreements.
40. As a learner, I want to preview and confirm a proposed plan revision, so that a new import does not unexpectedly reorder my studies.
41. As a learner, I want previous attempts and completed work preserved through revisions, so that my learning history remains available.
42. As a learner, I want a changed goal to branch from my path, so that I can pursue a new direction while retaining the original journey.
43. As a learner, I want relevant shared understanding reused across branches, so that I do not repeat equivalent work unnecessarily.
44. As a learner, I want new branch-specific application checks, so that conceptual familiarity is not mistaken for practical capability.
45. As a learner, I want a concept map from my first source, so that I can orient myself within its suggested learning paths.
46. As a learner, I want the broader topic graph to grow with related saved sources, so that I can revisit the structure of my learning.
47. As a learner, I want teaching-order links distinguished from evidence relationships, so that the graph's meaning is clear.
48. As a learner, I want graph progress to describe activity and checks without claiming whole-topic mastery, so that it reflects its actual evidence.
49. As a learner, I want conflicting sources represented as differing perspectives, so that the app does not invent agreement.
50. As a learner, I want affected lessons flagged when evidence changes or is removed, so that outdated support is not presented as current.
51. As a learner, I want history retained when a lesson needs review, so that my earlier work is preserved without falsely completing revised material.
52. As a learner, I want failures to retain my submitted work and offer recovery, so that network or generation errors do not force me to start over.
53. As a learner, I want only my owned sources and learning records used, so that another learner's material never appears in my journey.
54. As a learner using a keyboard or a narrow screen, I want lessons, answer fields, feedback, previews and evidence to remain usable, so that I can complete the same journey accessibly.

## Implementation Decisions

### Delivery and existing boundaries

- Extend the browser experience and authenticated FastAPI backend; retain the native API and mobile application. Use existing charcoal/mint and light-theme tokens, shared reading components and source evidence views.
- Keep captured sources, read-only study notes and combined topic overviews intact. A learning plan is a new teaching artifact, not a relabelled study note or destructive merge.
- **First delivery:** one owned source → collection → editable goal → path suggestions/preview → confirmed path → guided teaching/practice/feedback → durable progress and voluntary review. The existing supported article, selectable PDF and transcript types must remain compatible; no new ingestion providers are required.
- **Later delivery:** collection-integrated discovery and multi-source contribution/revision previews, followed by retained goal branches and broader graph learning indicators. Full target behavior stays in this specification; completion of the first delivery does not imply these later phases are available.

### Teaching and interaction

- Produce outcome-oriented teaching units from substantive captured concepts. An explanation, worked example and practice activity must serve a stated outcome rather than mirror headings alone. Do not force unsupported examples/equations into a lesson.
- Give several relevant starting choices when material supports them; do not fabricate an entire syllabus to satisfy a fixed count. Preview sparse coverage and gaps honestly.
- Before confirming a path/background lesson, expose outcomes, prerequisites, supporting sources and generated background content. Confirmation opens the chosen route, not every suggested route, and does not save external resources.
- A learner may skip, explore advanced material, request help or attempt checks first. Difficulty belongs to a path and changes upcoming teaching/practice; previous attempts retain their original level.
- Support short written answers, application problems and quick questions appropriate to the concept. Preserve attempted answers before provider evaluation so a timeout cannot discard them. Retrying appends a new attempt; request retries must not duplicate the same submission.
- Feedback addresses identifiable criteria with evidence, then offers hints, retry and a worked answer. Answer revelation/self-reports are activity, not passed checks. Unjudgeable responses remain Needs review. Do not infer topic mastery from a single successful check.
- Distinguish source quotations, source-backed explanations, generated teaching examples and background lessons. Generated material must not borrow a saved-source citation that does not support its claims. Unsupported gaps offer optional discovery instead of fabricated attribution.
- Preserve exact captured text, offsets, PDF pages, transcript times and source-version identifiers. Render source text safely through existing readers.

### Authoritative learning state and contracts

- Supabase Postgres remains authoritative for owned collections, goal/plan revisions, paths, lesson/check definitions, attempts, feedback status, difficulty and progress. Qdrant remains a derived evidence-retrieval index, not the authority for learning results.
- Add strict authenticated learning contracts for path suggestions/preview, confirmation, plan/lesson reads, difficulty changes, attempt submission/feedback retrieval and progress/review reads. Later contracts cover source contribution/revision confirmation and branching. Exact endpoint names/table layouts are implementation choices, not decided by this spec.
- Every lesson/check version records its outcome, difficulty, assessment criteria and supporting source versions. Every attempt records the learner response, relevant lesson/check version, original difficulty, feedback/result state and timing. Do not overwrite historical answers/results when plans change.
- Stable outcomes permit reuse of relevant prior understanding between branches only where the outcome and evidence of learning remain applicable. A new practical requirement, changed difficulty or revised check is not automatically completed by an earlier conceptual answer.
- Generation uses existing background/status conventions where needed. Ownership, authoritative versions and job leases must fence late writes. Browser code never receives provider secrets or accesses Qdrant directly.
- Failures remain readable and retryable; pending or failed feedback does not create a successful check. Reopening restores progress under the same owned identity, without adding a new sign-in/linking requirement.

### Collection changes and graph semantics

- A source save and acceptance of a learning-plan revision are different actions. Present new concepts/examples/prerequisites/disagreements and proposed ordering changes; apply plan changes after confirmation without silently changing the goal.
- Goal changes can create retained path branches. Shared sources do not become duplicated independent evidence; branch paths and source branches are distinct domain concepts.
- A one-source learning map may show suggested concept order and confirmable routes. Preserve the existing shared-topic graph and its two-independent-source threshold for library relationships. Label teaching-order edges separately; a path suggestion is not a new factual topic relationship.
- Show saved-material coverage separately from reading/practice activity and understanding checks. Retain textual labels and inspectable reasons, rather than relying on color alone. Do not create a preloaded broad subject outline.
- New contradictions, refreshes, removed sources and topic corrections invalidate current support where affected. Preserve history but mark affected lessons/checks for review. A pending confirmation must not leave deleted or obsolete evidence usable as current support.
- Archived evidence may open only through existing authorized version readers while available. History records missing/deleted support and must not resurrect removed captures or broken citations. Previous completion does not complete revised teaching/checks.

### Model routing

- Select models per request through a shared versioned backend routing policy. Start new learning generation with GPT-6 Luna at medium reasoning; GPT-6.1 Sol at medium reasoning is the requested escalation candidate. Keep secrets in the server environment. Do not silently replace this with GPT-6 Sol or enable Pro mode.
- Use Responses consistently for these new routes. A model choice is separate from retrieval, validation and a calibrated decision to escalate. Do not migrate unrelated legacy generation or rewrite saved notes as a side effect of this feature.
- **Proposed conservative routing default:** with adequate source evidence but an inadequate evaluated Luna output, allow one Sol-medium escalation within a bounded time/cost budget. Apply the same quality checks to both. Missing evidence invokes a gap/discovery path. Ownership/version failures fail closed; provider outages use recovery, not speculative escalation.
- Routing must not rely solely on a model's claimed confidence percentage or a retrieval similarity score. Exact citations and strict JSON are necessary checks, not proof of semantic correctness. No current classifier is calibrated for accepting this teaching or feedback.
- Compare Luna-only, Sol-only and routed outputs on the same reviewed learning cases. Select thresholds and an explicit hosted cost ceiling from measured results before hosted rollout; do not invent a price advantage or confidence threshold in this spec. Inconclusive teaching/assessment remains clearly labelled.
- The earlier 10–15-second first-useful-verified-text goal is a measurement target, not an achieved promise. Bound generation/escalation time, display progress and retain learner work when a request times out. Verified streaming remains separate unfinished work; do not stream unvalidated grades or claim it is already available.

## Testing Decisions

**Boundary check:** the learner confirmed authenticated learning API, OpenAI
HTTP responses and browser learning journey testing on 2026-10-09. The existing
Postgres ownership/version/retry RPC patterns are exercised through public functions.

- Prefer public external behavior through the authenticated learning API: owned suggestions and previews, explicit confirmation, learner submissions, feedback states, saved progress, difficulty changes and source/version invalidation. Assert returned behavior and persisted results rather than prompt strings, private functions or a particular SQL layout.
- Reuse OpenAI HTTP-response fixtures for Responses output, invalid/unsupported claims, hints, model selection, at-most-once escalation, timeout and recovery. Deterministic fixtures test the routing contract; live reviewed evaluation tests whether its quality signals are useful.
- Reuse existing Postgres ownership, version, retry and mutation acceptance patterns underneath the authenticated contract. Include cross-owner denial, stale confirmations, repeated requests, removal during generation and late completion. Add direct database checks only for invariants that cannot be exercised reliably through the public boundary.
- Use browser journeys for preview/confirmation, free navigation, response entry, hints/retry, evidence inspection, difficulty preservation and reload restoration. Cover dark/light appearance, narrow/desktop layout, keyboard navigation/focus, 200% zoom and long-content scrolling.
- Prior art includes authenticated saved-assistant API/model-response tests, source refresh and topic correction ownership/version tests, persisted generation status/retry checks, and browser/client citation readers. Reuse their existing transport and ownership fixtures.
- Extend the DeepEval direction with reviewed teaching/assessment cases. Measure source support, outcome alignment, explanation/example correctness, actionable feedback, hint usefulness, difficulty suitability and handling of uncertainty. Include partially correct, alternate valid, incorrect, ambiguous and unsupported learner responses. Automated evaluator scores alone are not a gold standard.
- Use held-out sources/topics and independent review for semantic acceptance; record false acceptances/false rejections and inconclusive cases. Benchmark both escalation benefit and cost/latency at the complete-request level. Preserve the existing 200-source design target without claiming its capacity has been tested.

### Acceptance scenarios

| Scenario | Required observable result |
| --- | --- |
| One source with teachable content | Offers source-supported outcomes/path choices and a meaningful explanation-example-practice loop, not just a concept list. |
| Sparse or partial capture | Describes actual coverage and missing support; does not claim a complete syllabus. |
| Preview declined | Does not activate the path, save external resources or award progress. |
| Path confirmed | Opens the chosen path with its goal, difficulty, evidence and learning activities. |
| Optional background teaching | Preview exposes its provenance and purpose; opens only after confirmation. |
| Learner answer submitted | Retains the answer, produces criteria-specific feedback or Needs review, and never loses work on provider failure. |
| Hint/retry/worked answer | Preserves separate attempts; revealing the answer does not pass the check. |
| Alternate valid or ambiguous answer | Evaluates against the outcome/criteria; insufficient judgment stays inconclusive. |
| Difficulty changed | Adjusts upcoming teaching; retains original-level history and leaves new requirements incomplete. |
| App reopened | Restores the owned path, settings, attempts and progress without another learner's records. |
| Source citation opened | Resolves the exact owned saved version/passage/page/time through existing evidence readers. |
| Source changed/deleted during work | Rejects stale current support and late writes; retains truthful history and flags affected learning for review. |
| New related source saved — later delivery | Previews contribution and plan changes; no silent reorder or goal replacement. |
| Goal branch — later delivery | Retains both paths and applicable shared learning; new practical checks remain distinct. |
| Graph — later delivery | Distinguishes coverage, teaching order and learning activity/check evidence; does not assert mastery or inflate source counts. |
| Model escalation | Uses the selected request-level models, respects one proposed escalation, validates both results and handles missing evidence without invented support. |
| Responsive/accessibility | Core learning, feedback, previews and evidence are usable by keyboard at narrow/desktop widths, both themes and 200% zoom. |

Run applicable web tests, typecheck/build and lint, backend API tests and
database-boundary checks during implementation. Record live source/model/browser
acceptance separately from deterministic tests. No application tests or model
requests are part of this specification-writing task.

## Out of Scope

- Mobile/iOS redesign, generated native changes or alterations to the native four-point API.
- Rich-text editing of generated source notes, custom native folders or destructive source-note merges.
- Compulsory prerequisite completion, paid unlocking, certification or claims of whole-topic mastery.
- Automatic saving of discovered resources, external notifications, new provider account connections or new authentication flows.
- OCR, private recording retrieval or other new ingestion providers.
- Executing learner code, sandbox infrastructure or a specialist symbolic math grader; text/code/equation explanations remain possible without claiming executable verification.
- Replacing the shared topic graph with source/path nodes or removing its evidence threshold.
- New embedding/vector providers, training a classifier, adopting an uncalibrated checker as authoritative, or globally migrating legacy models.
- Promised model pricing, fixed numeric routing thresholds, achieved latency/capacity, verified streaming or production deployment before evaluation and acceptance.
- New scheduled review algorithms or timed reminders; initial review is voluntary and in-app.

## Further Notes

- This is a phased specification. Begin with the complete one-source delivery; later collection-growth/branch features require separate implementation units. Do not close the full specification when only the first delivery passes.
- Test boundaries were approved on 2026-10-09. Exact routing-quality signals, thresholds and hosted cost limits require measurement; they are implementation gates, not additional product interviews.
- Existing source-driven shared topics, retained source branches, web-first delivery, authoritative Postgres and derived Qdrant decisions still apply. The new one-source teaching map is a separate presentation of learning order.
- The requested Codex conversation preference is Luna. The application's per-request routing does not switch the running Codex conversation; this session has no tool for that switch.
- Track implementation and acceptance in GitHub Issues and web-specific progress records. Keep current capability claims separate from this target specification.
