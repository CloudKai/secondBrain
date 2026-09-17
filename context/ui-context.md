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
