# Long sources and selected ranges — planned 13 / GitHub #14

## Status

Selected target, 2026-10-04. No implementation or hosted acceptance yet.
Verified behavior remains the preceding bounded capture and versioned-refresh
slices. Native/iOS and its progress tracker stay untouched.

## Selected unit

- Process the whole captured article, selectable-text PDF or transcript in
  bounded sections by default, within published enforceable limits.
- Let the learner request original PDF pages or a timed-transcript interval;
  validate the selection against the actual parsed pages/cues. Untimed TXT
  cannot supply a time range. Preserve original page numbers and whole cue times.
- Persist section progress and successful section work for the current owned
  source version. Retries reuse it; a refresh invalidates obsolete work.
- Synthesize one coherent final note from the successful sections with exact
  original capture references. An unfinished aggregate is never shown as ready.
- Reuse one source identity, including selected ranges, through existing explicit
  compare/confirm refresh. Sections and versions never become graph sources.
- Show missing extraction, capture truncation and section failures honestly.

## Implementation plan

Extend capture metadata to record requested PDF pages or transcript times while
retaining original locations. Expand only the browser capture text budget with
explicit bounds; keep download sizes, PDF page/parser limits and transcript
cue/file limits. Each model call remains bounded. Save successful section
results behind service-only database functions with current version/lease checks;
expose owned progress counts through the study API. Use the existing final-note
and topic pipeline only after validated synthesis. Extend the current mint browser
design with optional ranges and progress, including replacement/version flows.

## Checks and release

Test boundaries proposed to the user: authenticated import/range API, external
capture/model HTTP, database ownership/progress/worker fences, and browser
range/progress/reload/citation flows. TDD requires agreement before test writing.
Then perform focused red/green checks, final backend/web suite, two independent
review axes, reviewed reversible migration and hosted development acceptance.
Update GitHub #14 and both web progress records at each checkpoint.

No schema has been applied for this ticket. Exact enforceable bounds, migration,
rollback and acceptance results will be recorded with the implementation.
Private recording retrieval, OCR, assistant/research and production deployment
remain target work.
