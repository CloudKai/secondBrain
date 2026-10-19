# Second Brain web product design audit

Date: 2026-10-06. Live surface: http://127.0.0.1:5173/#library.
Captured through the Codex in-app browser at its existing narrow viewport. No sources were saved, uploaded or deleted. This is an audit of visible onboarding/import states and curated examples, not an acceptance check of the live AI pipeline.

## Verdict

The green dark theme, typography hierarchy and source-oriented learning flow are coherent. The largest usability problem is that citation clicks update evidence outside the visible viewport. Import copy and secondary controls also become difficult to scan at the current width.

## Priorities

1. **High — Show evidence immediately after a citation click (steps 9–11).** Clicking the big-picture citation changes the context tab to Sources but leaves the viewport at the paragraph. The evidence becomes visible only after scrolling several screens. At narrow widths, open a drawer or scroll/focus the evidence heading with a clear return-to-note action. Keep the supporting passage and original-source link together.
2. **Medium — Shorten and stage import guidance (steps 2–5).** Keep accepted input types and the essential restriction next to the relevant field. Move detailed character limits, retention details and extraction caveats into an accessible disclosure. PDF/video dialogs are tall; the video action is below the captured viewport. Consider a persistent action footer within the dialog that does not cover inputs.
3. **Medium — Make example mode unambiguous (steps 8–12).** The Example badge and paraphrase disclaimer are useful. However, the example topic panel says supporting sources are “in your library,” while the original library has zero saved sources. The assistant says open-ended AI chat is planned. Use explicit example-only wording so learners can distinguish this preview from the behavior of their own saved sources.
4. **Medium — Improve secondary text and small controls (steps 1–12).** Filters, graph node labels, metadata and scope chips are visibly small and subdued. Increase their text size/contrast and preserve generous hit areas. Measure contrast and target dimensions before assigning a WCAG failure; screenshots alone do not establish one.
5. **Low — Focus the empty library on one next action (steps 1, 7).** The library repeats the add-source invitation and shows sort/search/filter controls for zero sources. A compact empty state could bring the first import action forward. Say “article, PDF or video” instead of only “article.” The graph also repeats two empty-state messages.

## Captured steps

### 1. Empty library — Healthy, with excess repetition

Clear primary Add source action, private-library indicator and recognizable hierarchy. The repeated invitation, zero-value metrics and empty search/filter row consume space before a learner has any content. Secondary text is small. Persistence messaging does not by itself explain browser-session recovery; that was not checked.

![01 Empty library](/Users/kaiming/Desktop/Hackathon/AI Study Buddy/output/design-audit/2026-10-06/01-library.jpg)

### 2. Article import — Usable, copy-heavy

URL/title labels and pasted-text fallback are discoverable. Technical limits and persistence explanations dominate the supporting copy. The dialog opens with focus on its named close control. Focus trapping, keyboard traversal and error validation were not exhaustively checked.

![02 Article import](/Users/kaiming/Desktop/Hackathon/AI Study Buddy/output/design-audit/2026-10-06/02-import.jpg)

### 3. PDF import — Usable, crowded

Upload/link choices and optional page selection are explicit. The limits/retention paragraph is dense and the action approaches the viewport edge. The file picker was not invoked and upload behavior was not checked.

![03 PDF import](/Users/kaiming/Desktop/Hackathon/AI Study Buddy/output/design-audit/2026-10-06/03-pdf.jpg)

### 4. Video captions — Needs simplification

Automatic captions and manual fallback are separated, with provider/language restrictions stated. The action sits below this viewport, and important help competes with implementation detail. Caption availability and live imports were not checked.

![04 Video captions](/Users/kaiming/Desktop/Hackathon/AI Study Buddy/output/design-audit/2026-10-06/04-video.jpg)

### 5. Transcript fallback — Usable, long form

Paste/upload choices and timestamp-preservation guidance are present. Nested selectors and the tall transcript field extend the form considerably. Consider presenting only the next required input plus expandable guidance. No transcript was submitted.

![05 Transcript fallback](/Users/kaiming/Desktop/Hackathon/AI Study Buddy/output/design-audit/2026-10-06/05-transcript.jpg)

### 6. Navigation — Healthy

Library, graph, study and reading destinations have labels and icons. Close navigation has an accessible name. Secondary footer text is subdued; shortcut discoverability and keyboard behavior were not checked.

![06 Navigation](/Users/kaiming/Desktop/Hackathon/AI Study Buddy/output/design-audit/2026-10-06/06-navigation.jpg)

### 7. Empty graph — Healthy, repetitive

Explains that topics come from sources and that connections need two independent sources. Example topics provide an exploration path. Two empty-state blocks repeat the invitation to add a source.

![07 Empty graph](/Users/kaiming/Desktop/Hackathon/AI Study Buddy/output/design-audit/2026-10-06/07-topics.jpg)

### 8. Example graph — Useful preview

Includes examples is visible; nodes have accessible Explore names and source counts. Narrow-screen node labels are small. Relationship explanations exist below the graph in the observed accessibility tree; no real learner graph or edit persistence was checked.

![08 Example graph](/Users/kaiming/Desktop/Hackathon/AI Study Buddy/output/design-audit/2026-10-06/08-example-graph.jpg)

### 9. Example note — Healthy reading hierarchy

Title, topics, big picture and numbered key ideas create a readable progression. Circular citations match the green theme and sit inline. Icon-only source-management controls have accessible names in the observed tree, but their purpose is less obvious visually.

![09 Example note](/Users/kaiming/Desktop/Hackathon/AI Study Buddy/output/design-audit/2026-10-06/09-example-note.jpg)

### 10. Citation click — Needs improvement

The Sources tab changes, but no evidence appears in the current viewport. Focus remains on the citation. This can look like a failed click at the captured width.

![10 After citation click](/Users/kaiming/Desktop/Hackathon/AI Study Buddy/output/design-audit/2026-10-06/10-citation.jpg)

### 11. Evidence panel after scrolling — Healthy content, poor reachability

The source title, section locator, paraphrased-evidence warning and Open original link are grouped clearly. Reaching them requires scrolling past the note/assistant. These are curated paraphrases; exact PDF page or video timestamp evidence was unavailable in this run.

![11 Evidence panel](/Users/kaiming/Desktop/Hackathon/AI Study Buddy/output/design-audit/2026-10-06/11-evidence-panel.jpg)

### 12. Example assistant — Clear scope controls, ambiguous capability copy

Current note, Ask this topic and Ask my library are visible in the composer. Prompt shortcuts are recognizable. The preview description and example disclaimer should clearly distinguish example lookup from saved-source assistant capabilities. No question was submitted; response streaming, grounding and unsupported-answer handling remain unverified.

![12 Assistant preview](/Users/kaiming/Desktop/Hackathon/AI Study Buddy/output/design-audit/2026-10-06/12-assistant.jpg)

## Evidence limits and next audit

- Current saved library had zero sources. Curated examples were accessed through the visible Example topics control.
- Live generation, jobs, retries, citation accuracy, timestamp/page jumps, source ownership and retrieval quality were not checked.
- Capture used the existing narrow browser surface. Wide desktop layout and other breakpoints remain unverified.
- Accessibility observations cover visible readability and accessible names/state. Contrast measurements, complete keyboard flows, screen-reader announcements and zoom checks remain outstanding.
- Next meaningful audit: use two saved sources on a shared topic, inspect generated notes and real citations, follow a graph connection, then ask one cross-source question and one unsupported question.

Screenshots: `/Users/kaiming/Desktop/Hackathon/AI Study Buddy/output/design-audit/2026-10-06/`.
