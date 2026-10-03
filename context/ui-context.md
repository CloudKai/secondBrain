# UI Context

This is a React Native and Expo Router application. The current visual direction is dark, compact, and native-feeling; do not introduce a second theme during the roadmap work.

## Current design tokens

Use the centralized values in `mobile/constants/theme.ts` rather than repeating colors or spacing in React Native components.

| Role | Token | Value |
| --- | --- | --- |
| App background | `colors.background` | `#090B10` |
| Surface | `colors.surface` | `#121620` |
| Raised surface | `colors.surfaceRaised` | `#191E2B` |
| Border | `colors.border` | `#2A3040` |
| Primary text | `colors.text` | `#F4F6FA` |
| Muted text | `colors.textMuted` | `#98A2B3` |
| Soft accent | `colors.accent` | `#A7F3D0` |
| Strong accent | `colors.accentStrong` | `#34D399` |
| Accent text | `colors.accentInk` | `#062D22` |
| Destructive/error | `colors.danger` | `#FDA4AF` |

Spacing uses `6`, `10`, `16`, `24`, and `32` through `spacing.xs` to `spacing.xl`. Controls and cards use generous 15–20 point rounded corners. Use the native system typeface, clear size/weight hierarchy, and no decorative font dependency.

The WebView graph is an isolated HTML document and intentionally uses a local dark palette. Graph cards use `#1c1c1e`, rounded borders, crisp white labels, and green glowing accent edges to stay visually aligned with the native screen.

## Current layout and interaction patterns

- The dashboard is the root route and shows the two fixed folder cards with item counts.
- Native sharing opens a transparent modal route containing a bottom sheet over the dashboard. The sheet must respect the safe area, expose a visible drag handle, dim the backdrop, and allow pan-down dismissal only while no request is submitting.
- Folder choices behave as a radio group. The selected row changes border/background treatment, and the primary action stays visibly disabled until a folder and valid shared URL exist.
- The detail screen reads top to bottom: concise title, exactly four Feynman Markdown bullets, interactive graph, then source links.
- Graph interaction must preserve pan, pinch-to-zoom, fit-to-view, and smooth node dragging. Dagre may switch between top-to-bottom and left-to-right layout without changing the content model.
- Long content scrolls in the native screen. Do not allow the graph WebView to trap the whole screen or render outside its bounded card.

## Current UI states

- Dashboard: empty folder counts or updated transient counts.
- Share sheet: waiting for selection, selected, submitting, missing URL, request failure, and dismissible idle state.
- Folder detail: empty folder or populated item.
- Graph: loading, interactive, and readable error fallback.
- Network errors: short user-safe message with a retry path; never expose provider exceptions or stack traces.

## Accessibility

- Every pressable has an appropriate accessibility role and descriptive label when visible text is insufficient.
- Folder rows expose selected state; disabled and busy actions expose their state to assistive technology.
- Maintain readable contrast, dynamic text tolerance, at least 44-point practical touch targets, and screen-reader-friendly reading order.
- Do not communicate selection, processing, success, or failure by color alone.
- Test the share sheet and detail flow with iOS VoiceOver before release hardening is considered complete.

## Target roadmap states

These are planned states, not current functionality:

- Silent anonymous-session initialization and a recoverable authentication error.
- Apple identity upgrade that preserves the anonymous user’s existing items.
- Persisted folder and item lists with initial loading, pull-to-refresh, empty, and pagination states.
- `queued`, `processing`, `succeeded`, and `failed` item states, including safe retry behavior.
- Related-knowledge results with clear relevance affordances and no cross-user content leakage.
- Release-build share-extension fallback when processing cannot start immediately.

## Do nots

- Do not add light mode, custom-folder controls, an item editor, or an alternative visual system in the approved roadmap.
- Do not render unvalidated API data or provider error text directly.
- Do not apply web-only styling conventions to native components. React Native styles and centralized TypeScript tokens are authoritative.
- Do not replace native navigation or bottom-sheet behavior with a browser-styled overlay.


## Structured browser notes — ticket #2

The supplied browser design now renders verified read-only structured
article notes: overview, substantive concepts, optional supported examples/
equations and recall answers. Each section's citations open the matching exact
captured passage in Sources, focus it and preserve Open original. Location labels
refer to captured-text characters, not PDF pages/video times. Full captured text
is still available.

Saved sources show queued/processing/retrying/failed/ready states from Postgres.
Pending jobs poll every 5s; reload restores saved notes and status. Generate study
note recovers an unrequested capture, and Retry generation starts a fresh bounded
cycle after failure. Storage errors retain the capture and offer reload. Recall
marks remain session-only. Real-source topic organization is explicitly planned;
new generated concepts do not create fake graph assignments.

Hosted generation, citations, reload, ownership isolation and worker recovery
passed on 2026-10-03. Local desktop/narrow browser checks cover note-to-evidence, reload and
failed-note recovery. Setup: `docs/study-note-setup.md`.


## PDF browser controls — ticket #3

Verified with deterministic browser fixtures and real hosted upload/reload. Add source → PDF offers Upload PDF and
PDF link, published limits, and unsupported-file feedback. PDF sources have a
separate filter and reuse the read-only note viewer. Sources shows physical page
numbers and exact excerpts after citation clicks; full text is grouped by page.
Linked PDFs open the cited original page; uploads explain that only captured
page text and filename are retained. Video controls remain labelled planned.
The live three-page upload preserves its blank second page and opens the page-3
calculus excerpt after reload. Narrow-screen fixture checks also passed.


## Browser transcript form — issue #5 (2026-10-03)

Verified locally and against hosted Supabase. Video in Add material now
accepts a supported recording URL and either a supplied transcript file or pasted
text, with Topic title and visible limits. Saved videos filter as Video. Inline
mint citation badges open Sources with the exact transcript excerpt, supplied
cue range if present, provenance and original recording link. Full text groups
timed cues with their supplied times. Untimed TXT has no fabricated time labels.
YouTube uses a supplied start-time link; other providers explicitly open without
seeking. Source notes stay read-only. Native screens are untouched.


## YouTube caption import — issue #6 (2026-10-03)

Verified with real hosted generation and desktop browser checks. Video in Add
material offers Import YouTube captions and Upload or paste. The automatic choice
accepts a YouTube URL without requiring transcript text and explains accessible
English captions and limits. A retrieval failure preserves URL/title and opens
paste/upload controls; authentication/storage errors remain retry errors. Sources
distinguishes retrieved captions from user-supplied transcripts, preserving real
cue times and exact passage citations. Notes remain read-only; reload and canonical
reuse restore the same note. Native UI is untouched; no new phone-width check is
claimed. Other automatic recording providers remain planned.


## Teams transcript access — issue #7 (2026-10-03)

The Video form immediately selects upload/paste for recognized Teams/SharePoint
context. A mint access panel explains that the app lacks Teams authorization,
links to the original recording/recap and expands VTT export/DOCX paste steps.
It avoids claims about the specific recording's availability or permission state.
Existing transcript controls, limits, read-only notes and citation styles remain.
Desktop hosted checks verified timed VTT citations after reload and untimed text
paste/reuse. No new phone-width check is claimed; native UI is unchanged.
Automatic Teams retrieval is unvalidated and is not advertised.


## Zoom transcript availability — issue #8 (2026-10-03)

Zoom recording share/play links now immediately select Upload or paste. The
existing mint access-panel style explains that transcript download needs access
the app lacks, even when a learner has a playback link or passcode. Expandable
cloud VTT export instructions provide conditional next steps for processing,
missing, restricted, expired/deleted material without claiming to inspect status.
Original and official-guide links remain available. Existing transcript limits,
read-only notes and citation styling are preserved. Hosted controlled VTT and
untimed paste, exact citations, reload/reuse passed at desktop width. Native UI
is untouched; no automatic Zoom or new phone-width acceptance is claimed.


## Panopto caption access — issue #9 (2026-10-03)

Recognized Panopto viewer links immediately select Upload or paste. The existing
mint access-panel style displays the actual hostname and offers expandable,
conditional caption-export, lecturer/site administrator and unreadable-export
help, plus the original lecture link. No specific menu or lecture status is
inferred. UTF-8 errors retain URL/title for correction. Controlled hosted SRT
and untimed paste, exact citations, reload and canonical reuse passed at desktop
width. Existing limits and read-only notes remain. Automatic access is
unvalidated; no new phone-width acceptance or native UI change is claimed.


## Saved-source topics — issue #10 (2026-10-03)

Local implementation uses the existing browser design; hosted acceptance is
pending. Empty libraries start without an outline. Saved topics and explicitly
selected examples are separate. Topic cards precede the supported graph; broad
groups appear as overlapping badges without implied edges. Topic details list
original source notes, mapping reasons and passage links. Uncertain assignments
offer Use suggested topic or Keep this topic separate; notes remain read-only.
The graph shows processing/retry/error and partial-coverage feedback. Combined
overviews and broad correction workflows remain planned. Native UI is unchanged.
