# Web learning library — feature specification

Status: product specification confirmed by the user, 2026-10-02.
The decisions below describe target behavior. A separately authorized dark-mode
frontend slice now exists in `web/`, with curated examples and verified browser
interactions. Full target-service acceptance remains open. See the UI-slice
section in `scope.md` for implemented behavior and limitations.

## Current baseline

The current article flow accepts a URL and shared text, produces four bullets
and a diagram for that source, and holds saved items in mobile memory. Dedicated
PDF extraction, video transcripts, a library-wide topic graph, and a study
assistant are target work. See `scope.md` for the verified MVP and roadmap. Ticket #1 adds the browser
source API, anonymous-session adapter, and source-only RLS migration. Local
checks pass; hosted persistence acceptance is pending a Supabase project.

## Agreed target behavior

### Delivery platform

- Deliver a browser-based web experience first.
- The initial browser UI slice was authorized using this specification and
  `ui-ux-pro-max`. On 2026-10-02 the user supplied `web/src` as the UI/UX handoff;
  extend that frontend and its existing design for the target services.
- Build the browser frontend separately from `mobile/` in the parent repository.
  Keep mobile and generated native iOS folders untouched during web work.
- Keep the existing iPhone design for reference and adapt it after the web
  experience is well designed.
- Put notes in the center, an expandable right panel with `Topic`, `Graph`,
  and `Sources` tabs, and the study assistant beneath the notes. Topic and
  evidence views can expand for easier reading.
- Use English for the initial interface, generated notes, and assistant output.
  Source excerpts retain their original wording.

### Sources and user-facing support message

Support public web articles, PDFs with selectable text, and videos with
available transcripts. Accept PDF uploads and links, and video links with a
transcript upload or paste fallback. Video targets are YouTube, Teams
recordings, Zoom recordings, and Panopto.

Do not add recording-provider account connections. Attempt retrieval only when
the app has an accessible transcript path; otherwise request an uploaded or
pasted transcript. Private or blocked recordings use that fallback. A playable
URL alone does not establish transcript access, and connecting an account is
not part of this target. Provider access findings are recorded in
`docs/research/transcript-access.md`.

Target UI copy, to show near source submission controls before capture:

> Supports public web articles, PDFs with selectable text, and videos with
> available transcripts. PDF text must be selectable, and video transcripts
> must be accessible.

Target transcript-fallback copy:

> If we cannot retrieve the video transcript, you can upload or paste it.

Target access-boundary copy:

> Automatic transcript retrieval depends on what the platform makes available.
> For private or restricted recordings, upload or paste an accessible transcript.

Display this copy when the corresponding source support is implemented. For
the current article-only baseline, describe web-article support accurately.

### Study notes and topic overviews

- Keep a separate study note for each saved source.
- Include a short overview, concept explanations, relevant examples or
  equations, and recall questions. Length follows the source material.
- Provide clickable source references to supporting passages, PDF pages, or
  video moments.
- Open the supporting excerpt inside the app with an `Open original` link.
  Use real page numbers and timestamps when available; their absence does not
  justify invented locations.
- Clicking a topic word opens its topic overview. Clicking a citation opens
  source evidence in the contextual panel.
- Cover the whole source by default, processing long sources in sections with
  visible progress. Let learners select page or time ranges for a narrower
  focus, and clearly identify incomplete coverage.
- Reuse an unchanged source when it is added again. Offer a refresh for changed
  material, keep references tied to the captured version, and preserve learner
  corrections. Repeat imports or refreshes do not count as independent sources
  for the graph threshold.
- Provide a combined topic overview across its source notes, preserving
  source attribution and disagreements.

### Topic graph and placement

- Use shared topic nodes, with supporting sources accessible from each topic.
- When multiple sources cover the same topic, explain the overlap and offer
  `Combine` and `Keep separate` under one parent topic. Combine shows the topic
  overview; Keep separate shows individual source-note branches, each with
  its own references. Preserve original source notes in both views. These
  source branches are distinct from the primary shared-topic nodes.
- Build the map from saved material; provide no starting subject outline.
- Identify concise topic titles for a saved source, then compare newly added
  material with the learner's existing material for meaningful relationships.
- Show topic cards immediately. Show a connected graph once at least two saved
  sources support a meaningful connection.
- Sources are related when they share a substantive topic or support an
  explainable relationship such as `uses`, `requires`, or `evaluates`.
- Each connection explains why it exists. Broad subject membership can group
  topics without implying a strong direct relationship between them.
- Map main topics and substantive supporting topics. Passing mentions do not
  imply that a source teaches a topic.
- Broad areas such as AI and Math can emerge and overlap through shared topics.
- Show how newly saved material contributes to the evolving topic map.
  Saved-material coverage does not establish mastery.
- Organize topics automatically when context is clear. Offer suggested
  placements when it is uncertain, and allow learner corrections.
- Allow learners to rename topics, merge duplicate topics, correct a source's
  topic assignments, and accept or reject connections. Organizational
  corrections preserve the underlying source notes.
- When merging topics, carry rejected connections to the surviving topic.
  If a rejected connection overlaps a visible connection after the merge,
  rejection wins until the learner restores connections. A connection that
  collapses into the same topic is removed. Confirmed by the user, 2026-10-02.
- Deleting a source or correcting its topic assignments updates affected topic
  overviews and graph connections. Remove references to deleted material and
  preserve learner corrections for remaining material.
- The user supplied `https://roadmap.sh/ai-engineer` as an overview-map
  reference. Its exact hierarchy and interactions were not verified during
  research. The source-driven decision supersedes the earlier starting-outline
  proposal; this reference illustrates orientation within a broad overview.

### Study assistant and further research

- Provide suggested prompts and free-text conversation.
- Default to the current note as the assistant scope.
- Put selectable `Ask this topic` and `Ask my library` buttons in the textbox.
  Both can be selected together.
- Always include the current note. When both buttons are selected, prioritize
  material from the current topic and bring in relevant material elsewhere in
  the library, with supporting references and source deduplication.
- When selected saved material cannot support an answer, explain what it can
  support and offer `Find reliable sources` for the missing information. Cite
  answers grounded in saved material.
- Run additional research on demand and suggest resources for deeper study.
- Research discovery can suggest papers and credible documents, with links
  learners can open to inspect the original resource.
- Prioritize original research papers, official documentation, and university
  teaching materials. Show the author or organization, date, source type, and
  relevance; identify preprints as preprints.
- A discovered resource enters the library only when the learner chooses to
  save/share it in. It then follows the source-note and topic-comparison flow.

## Acceptance scenarios — target, not yet run

| Scenario | Required result |
| --- | --- |
| Empty library | No preloaded subject outline; source submission and accurate support copy are visible. |
| Public article | Produces an English structured study note with concepts, examples where relevant, recall questions, and inspectable source excerpts. |
| Selectable-text PDF upload or URL | Processes the requested pages and preserves real page references. A scanned-only PDF receives an actionable unsupported-source message. |
| YouTube/Teams/Zoom/Panopto link | Retrieves a transcript only through an accessible path. Missing or restricted transcripts show upload/paste controls; no provider login is requested. |
| Supplied transcript | Produces a note tied to the original video and the supplied transcript. Real times are retained; untimed text is cited by excerpt. |
| Long source or selected range | Shows processing progress and actual coverage. A partial result is clearly marked and never claims full-source completion. |
| First source | Produces immediate topic cards without fabricating a broader outline. |
| Two related independent sources | Shows supported shared topics or explainable connections. Passing mentions and broad subject membership alone do not create strong direct links. |
| Same-topic overlap | Explains the overlap and offers Combine/Keep separate. One topic parent is retained, source branches are distinct, and both views preserve original notes and citations. |
| Cross-subject material | Can connect across emergent subjects such as AI and Math through meaningful shared concepts. |
| Uncertain topic placement | Presents suggested placements for learner correction rather than presenting a guess as certain. |
| Topic corrections or source deletion | Updates affected overviews and connections, removes deleted-source citations, and preserves corrections for surviving material. |
| Repeated or refreshed source | Reuses unchanged material or offers refresh for changed content; it does not inflate the independent-source threshold. |
| Clickable topic or citation | Opens the matching topic overview or source evidence in the right panel, with expansion and Open original where available. |
| Assistant scope buttons | Default is current note. Either or both buttons can be selected; both prioritize topic material while including relevant library evidence without duplicate sources. |
| Unsupported assistant claim | States the evidence gap and offers Find reliable sources; source-grounded claims cite their support. |
| On-demand research | Returns inspectable papers/documents with author or organization, date, type, relevance, and preprint labelling where applicable. Saves only after explicit learner action. |
| Browser work | Uses a separate frontend in the parent repository. Mobile and native iOS files remain untouched. |

## Implementation boundaries and planning

- Establish the browser frontend separately in `web/` and adapt the existing
  backend deliberately. Do not treat the Expo web script as an accepted web app.
- Keep generated notes read-only. Topic corrections and graph view choices are
  the approved editing surfaces.
- Preserve the current v1 mobile API until a documented coordinated migration.
  The four-bullet v1 summary is the baseline contract; the new browser study
  notes need their own explicit structured contract.
- Apply existing code standards and the selected backend ownership, validation,
  persistence, and background-work principles. Supabase, Redis/ARQ, and Qdrant
  remain planned services until their slices pass acceptance checks.
- The web target uses topics for organization; the existing mobile's two fixed
  folders are retained with the native baseline. A migration from the older
  folder-based target schema to topic/source relationships must be specified
  before database work. Ticket #1 uses a browser-only owned `sources` table
  with capture metadata and pending study status; it does not migrate native
  folders or introduce topic relationships. Those schema extensions remain
  work for their selected tickets.
- Set and publish supported file formats, size/range limits, and available
  transcript adapters during implementation. These are validation work, not
  evidence that every provider URL is automatically readable.
- Verify provider support with accessible and blocked fixtures. Verify source
  provenance, graph corrections, duplicate detection, and deletion with actual
  data before describing the new experience as implemented.
- Hosting selection, account provisioning, and implementation slices follow
  final confirmation; this specification does not select a hosting provider.

## Confirmation and implementation handoff

The user confirmed the product specification on 2026-10-02 and requested
GitHub tickets. Ticket breakdown approval and publishing follow the to-tickets
workflow. The user separately requested working dark-mode browser pages from
this specification using ui-ux-pro-max. That frontend slice is documented in
`scope.md`; richer generation, ingestion, retrieval, and persistence still follow
their implementation and acceptance plans.

## Domain records

- Vocabulary: `GLOSSARY.md`.
- Shared-topic decision: `docs/adr/0001-use-shared-topics-in-library-graph.md`.
- Web-first decision: `docs/adr/0002-deliver-web-before-mobile-redesign.md`.
