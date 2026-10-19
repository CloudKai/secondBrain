# Web design improvement plan

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

Date: 2026-10-06. Status: slices 1–3 implemented locally, full acceptance pending;
slice 4 audit completed with blockers; slice 5a baseline preparation started.

## Verified baseline and evidence limits

The original web feature slices are development-complete according to the web
tracker. The [product design audit](../reviews/web-product-design-audit-2026-10-06.md)
observed the current narrow browser viewport, an empty saved library and curated
example notes. It did not verify wide desktop layouts, real citation support,
live assistant responses or complete keyboard/accessibility behavior.

Keep the existing charcoal/mint visual direction and circular inline citations.
The audit supports targeted interaction improvements; a wholesale redesign is
not justified by the captured evidence.

## Proposed slices — target behavior, not current capabilities

### 1. Visible citation evidence

Priority: first. Audit steps 9–11.

**Implementation:** [GitHub #21](https://github.com/CloudKai/secondBrain/issues/21).
Shared evidence content opens in a dedicated native dialog (bottom drawer on
narrow screens), including archived source evidence. The existing context panel
remains available. Topic citations keep their originating route. Closing restores
focus to the opener. Desktop also uses the dialog for a consistent return-to-reading
interaction.

**Checks:** web TypeScript and ESLint pass. The narrow curated example shows
immediate evidence and closes with focus on the original citation.
[Screenshot](../../output/design-audit/2026-10-06/13-citation-drawer.jpg).
No automated tests were added or run. Real saved-source, assistant, overview,
archive, wide-layout, zoom and complete keyboard acceptance remain pending.

- On narrow layouts, a citation opens an accessible evidence drawer containing
  the passage, source title, locator and original-source action.
- On wide layouts, retain the context panel and bring the selected evidence
  into view. Inspect the current wide layout before choosing exact mechanics.
- Preserve paragraph reading position; closing returns focus to the citation.
- Keep existing exact-text, source-version, PDF-page and supplied cue-time
  validation. Surface unavailable/stale evidence clearly.
- Use the same presentation contract for notes, topic overviews and assistant
  citations, while respecting archived-version context.

Acceptance to verify: the selected passage is visible immediately; keyboard
opening/closing and focus return work; PDF/video locators remain accurate; long
passages and narrow screens do not hide controls; repeated clicks do not reset
the learner's reading position unexpectedly.

### 2. Shorter, navigable import forms

Priority: second. Audit steps 2–5.

**Implementation:** [GitHub #22](https://github.com/CloudKai/secondBrain/issues/22).
The import dialog now separates scrolling fields from its action area. Essential
instructions stay visible; detailed restrictions/retention use a disclosure.
Optional page/time ranges have a disclosure with the active interval in its
summary. Native invalid fields reveal their enclosing disclosure. Transcript
inputs visibly explain that VTT/SRT preserve supplied times and plain text is untimed.

**Checks:** TypeScript and ESLint pass. Narrow article/PDF/caption/transcript
forms inspected; the long transcript body scrolls while actions stay visible.
No sources submitted and no automated tests added or run. Live busy/error/provider
flows, wide layouts, zoom and complete keyboard/native validation remain pending.
[Screenshot](../../output/design-audit/2026-10-06/17-transcript-import.jpg).

- Keep one short input-specific instruction beside the field.
- Keep essential restrictions visible: public articles, selectable-text PDFs,
  accessible English YouTube captions, or supplied transcripts.
- Put detailed size limits, retention and extraction caveats in an accessible
  disclosure; retain the actual enforced limits.
- Group advanced page/time-range options separately from the default path.
- Keep the submit/cancel controls reachable in a constrained dialog, with a
  footer that does not obscure fields or errors.
- Label submit outcomes clearly: save source or import captions, as appropriate.

Acceptance to verify: article/PDF/video/fallback routes remain available; keyboard,
zoom, small viewport and validation-error navigation work; file restrictions and
timestamp-preservation guidance remain discoverable before submission.

### 3. Readability, examples and empty states

Priority: third. Audit steps 1, 6–9, 12.

**Implementation:** [GitHub #23](https://github.com/CloudKai/secondBrain/issues/23).
Secondary text tokens are brighter, small reading text and graph labels larger,
and filter/scope controls have 44px minimum height. Example topics, sources and
assistant behavior are explicitly labelled. The empty library hides zero metrics,
unused controls and repeated invitations; the graph has one primary empty-state
invitation and preserves the connection explanation.

**Checks:** TypeScript and ESLint pass. Narrow example-topic, empty-library and
empty-graph states inspected. Token contrast arithmetic for five base surfaces
improved dark secondary-text contrast from 2.95–4.57:1 to 4.92–7.62:1; light
secondary text also calculates above 4.5:1 for those surfaces. This is not a full
accessibility-compliance claim. No automated tests added or run. Wide layout,
light visual inspection, zoom, complete keyboard/screen-reader and saved-source
journey acceptance remain pending.
[Screenshot](../../output/design-audit/2026-10-06/19-empty-library.jpg).

- Measure secondary text contrast and control dimensions, then adjust shared
  tokens/components where needed. Keep citation numbers visually compact while
  giving the interactive control an adequate hit area.
- Describe curated material as example sources, not sources in the learner's
  saved library. Identify example-only assistant behavior explicitly.
- Use one compact first-source invitation covering articles, PDFs and videos.
  Hide unnecessary empty search/sort/filter controls until sources exist.
- Consolidate repeated graph-empty messages while preserving the explanation
  that connections require substantive support from independent sources.
- Recheck light appearance, focus states and long labels as well as dark mode.

Acceptance to verify: saved and example content cannot be confused; no measured
contrast or keyboard regressions; controls tolerate zoom; the first import action
is obvious without repeated prompts.

### 4. Audit the real learning journey

**Audit complete, acceptance incomplete:** [GitHub #24](https://github.com/CloudKai/secondBrain/issues/24),
[current report](../reviews/web-saved-source-audit-2026-10-06.md). Three real public
sources (PDF, article, video captions) saved and generated notes. Current checks
cover wide/narrow evidence, exact page/cue links, focus return, cross-source
assistant and topic-branch citations, combined scope toggles, stale-evidence retry,
unsupported answer, reload, reversible rename, hidden-field validation, light and
constrained layouts. Worker stopped after the approved audit; sources retained.
Video topic mapping and combined overview failed. Citation support mismatch,
missed retrieval and long graph-label wrapping are recorded. Successful overview,
archive and edge acceptance, actual zoom and full accessibility remain pending.
No code changes or automated tests in this audit.

Priority: before claiming the redesigned journey is complete.

- Use a dedicated acceptance library with at least two related saved sources,
  including selectable PDF text and timed transcript evidence.
- Inspect capture/processing, note reading, real citations, topic connections,
  corrections, reload, scoped assistant answers and unsupported questions.
- Include wide desktop and narrow layouts, keyboard focus, zoom and error states.
- Keep AI correctness findings separate from layout findings; examples cannot
  establish retrieval quality.

Acceptance to verify: each important state has current screenshots or a named
blocker, and unresolved issues are recorded in the web tracker.

### 5. AI quality baseline, then retrieval upgrade

**Preparation started:** [GitHub #25](https://github.com/CloudKai/secondBrain/issues/25),
[baseline execution spec](assistant-evaluation-baseline.md) and 12 seed cases.
The learner authorized fresh material and deletion of the three old audit sources.
No scored results yet; test boundaries and shared engine choice are requested.

Separate follow-on work; see [RAG design](assistant-rag-improvements.md).

1. Establish a curated DeepEval baseline on representative questions, expected
   evidence and follow-ups. Include unavailable evidence and scope isolation.
   Track retrieval recall/ranking, claim support, citation validity, first checked
   text, full completion time and cost. Exact offsets/pages/times need deterministic
   checks alongside semantic metrics.
2. Decide the hosted shared retrieval engine; Q13 remains open. Do not assume
   Qdrant approval from this UX plan.
3. Implement structure-first recursive chunks over captured source text, BM25
   plus semantic retrieval and background indexing that preserves saved notes.
4. Compare Jev and a grounding classifier using the same labeled evidence.
   Add routing/reranking only when they improve the measured baseline.
5. Add checked-section streaming after the evidence contract is reliable.
   The 10–15-second first verified text goal remains a target, not a guarantee.
   Set cost and timeout limits from measurements before hosted rollout.

Selected skill guidance: `rag-implementation`, official `deepeval`, and
`typesafe-ai`. None is installed by this planning task.

## Tracking and delivery

- Implement one slice at a time. Slice 4 audit is complete with blockers in #24;
  resolve generation and citation support findings before marking broader acceptance complete.
- Slices 1–3 are tracked in GitHub #21–#23, kept open for remaining acceptance checks.
  Publish later slice criteria when each unit starts.
- Update `docs/planning/web-learning-library-tickets.md` and
  `context/web-progress-tracker.md` as each web slice progresses.
- This plan makes no changes to native/iOS behavior or its progress tracker.
