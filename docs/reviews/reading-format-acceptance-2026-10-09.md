# Learning content reading format — local acceptance, 2026-10-09

## Verified implementation

This display-only unit implements the learner-approved format-original-wording
plan. Existing material benefits without regenerating notes or source captures.
No backend, API/schema, database, model or retrieval changes were made.

- Assistant answers render source cards from structured references instead of the
  combined quote string. Contiguous references from the same source/version share
  a title; original reference order and global citation numbers are retained.
- A shared reading renderer separates existing paragraphs and safely reflows plain
  source prose. Code, equations, lists, fences and ambiguous layouts stay literal.
  Wording, punctuation and non-whitespace characters are preserved. No headings,
  emphasis, missing PDF layout or explanations are invented.
- Simplified source wording exposes an expandable original captured-text view.
  Source excerpts are distinct from existing generated explanations.
- Citation evidence has a clear source heading and prominent PDF page, video cue
  interval or captured-character label. Original-source links, page links, video
  seeking and full capture remain available. The dialog has one content scroller.
- Full articles use existing paragraph breaks; PDFs use saved page boundaries.
  Timed transcript groups retain adjacent cues within 45 seconds and 900 Unicode
  code points, stopping at gaps over 1.5 seconds. Overlapping cue ends use the
  latest end. Original individual cues and their exact supplied times are inspectable.
- Saved notes, examples/equations, recall answers, topic descriptions, combined
  overviews, separate source branches and archived notes use shared reading styles.
  Archived full captures also use the page/caption reader.
- Primary reading text is 16px with 1.75 line height and a maximum width of 70ch,
  using the existing dark/light tokens. Optional raw-capture inspection is 14px.

Stored excerpts, source versions, character offsets, pages and caption times are
unchanged. Location checks continue against the original capture. Text is escaped
by React; captured markup is not interpreted as HTML. Public types are unchanged;
new interfaces are frontend display projections only. There is no note editing.

## Tests

**81 web tests pass**, including twelve new formatter/rendering checks. The first
prose, literal-layout, caption-group and source-card checks failed before their
implementations. A later whitespace-only case exposed lost citation controls;
that was fixed and its regression now passes.

Coverage includes paragraphs, qualification retention, code/equations/lists/fences,
Unicode code-point bounds, caption gaps/overlaps/length limits, exact original text,
HTML escaping, packed assistant references and numbering, existing generated prose,
PDF page links and a retained version-2 capture. Existing source/version validation,
revision clients and authenticated API boundary tests also pass.

Commands: `npm --prefix web test`, `npm --prefix web run typecheck`,
`npm --prefix web run build`, `npm --prefix web run lint`, and `git diff --check`.
Build/typecheck and lint pass. The existing large JavaScript chunk warning remains
(~630.55 kB). No mobile or backend commands were run for this frontend-only unit.
The previous unit's 266 backend passing tests are a historical result, not a new run.

## Browser acceptance

The same three public saved sources from the working-product acceptance were
reopened; no source was imported, deleted, refreshed or regenerated.

| Check | Observed result |
| --- | --- |
| Video assistant | A live car-example answer shows a single source card, original wording, citation 1 and 1:07.540–1:19 |
| Original wording | Expanding original text shows the source's original line breaks; readable prose differs only in whitespace |
| Video citation | Exact interval retained; original video action opens at 1:07 |
| PDF citation/full text | Selected passage on PDF page 1; full capture shows pages 1 and 2 |
| Article citation | Enter opens the exact p0002 capture at characters 770–1579 |
| Closing evidence | Escape closes the modal and restores focus to the originating note/overview/assistant citation |
| Recall | Existing answer/citations preserved, computed reading font 16px |
| Topic combined/separate views | Existing explanations and citations retained; separate branches show their concept headings. Combined mode restored after the check |
| Desktop/light/narrow | 1280×900 and 390×844 checked; source cards/dialog have no horizontal overflow. Default viewport and dark appearance restored |
| Long PDF evidence | Computed 16px/28px reading style; one overflowing vertical area, `evidence-dialog-content` |
| 200% magnification | Same-origin iframe fixture uses a 640×450 logical viewport at CSS zoom 2 inside 1280×900; note/evidence reflow without horizontal overflow and keyboard focus returns |

The in-app browser's native zoom shortcut had no effect. The 200% fixture establishes
magnified reflow, not native browser zoom or full accessibility compliance. It was
removed after use, and its temporary tab was closed. No screen-reader certification
is claimed. Archived rendering was checked with a retained version-2 fixture and
existing client tests; the fresh browser library has no older archive for a live
archive journey. These remaining broader checks keep #21/#23 open.

## Screenshots

In `output/reviews/reading-format-2026-10-08/` (the unit began before midnight):

- `assistant-cards-desktop.jpg`, `assistant-cards-light.jpg`, `assistant-cards-narrow.jpg`
- `video-citation.jpg`, `video-citation-light-narrow.jpg`
- `pdf-desktop.jpg`, `article-narrow.jpg`, `reading-200-percent.jpg`

These use public development material. They contain no credentials or private
learner sources.

## Limits and progress

Some captures contain navigation fragments, broken code extraction or flattened
PDF figure labels. This renderer keeps ambiguous content intact; it does not
reconstruct missing original layout or change the capture/index. Generated notes
and overviews retain their previous wording and semantic limitations.

The web progress tracker, scope, UI context and ticket document are updated.
GitHub #21/#23 were updated with this implementation and acceptance progress; they remain
open for live archived-version/native-zoom/screen-reader checks. #25/#27 retain
their separate hosted and semantic AI gates. Mobile/iOS and its tracker are untouched.
The approved development services remain running. No commit or push was requested.

GitHub progress published:
[#21 update](https://github.com/CloudKai/secondBrain/issues/21#issuecomment-6064090399) ·
[#23 update](https://github.com/CloudKai/secondBrain/issues/23#issuecomment-6064090981).
