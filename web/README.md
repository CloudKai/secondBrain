# Second Brain — browser workspace

A separate React + TypeScript + Vite frontend for the web-first learning-library
specification in `context/learning-library-design.md`. Dark mode is the default;
the sidebar appearance control switches to a paired light theme. Mobile and
native projects are untouched.

## Current development status — 2026-10-05

All 15 planned web slices are complete. Owned article/PDF/transcript captures,
structured cited notes, topics/graph, overviews, corrections, source refresh,
long-source processing, grounded assistant answers and explicit live research
are verified for development. See the [web progress tracker](../context/web-progress-tracker.md)
and [ticket breakdown](../docs/planning/web-learning-library-tickets.md) for
current checks and limits. Research setup is in
[research-discovery-setup.md](../docs/research-discovery-setup.md); it uses the
existing server-only OpenAI key and direct public downloads. TinyFish is not
used. Production deployment is not verified.

The implementation snapshots below describe earlier slices. Their preview,
session-only and future-work statements are historical; use the tracker for
current capability status.

## Run

From the repository root:

```sh
npm --prefix web install
npm --prefix web run dev
```

Open http://127.0.0.1:5173. Routes use the URL fragment: `#library`,
`#note/attention`, `#topics`, and `#discover`. The `/` keyboard shortcut focuses
library search. Browser back/forward works between pages.

The app opens an explicitly labelled example library. Use the workspace badge
(or the profile/about control on small screens) to hide examples and see an
empty library. Captured sources now use the owned-source API described below. Topic corrections,
theme choice, recall progress, and example visibility remain session state and
reset on reload. Without Supabase configuration, saving is disabled and the
app explains that private-library setup is needed.

## Working browser slice

- Search, source-type filters, sorting, and read-only study notes.
- Topic/Graph/Sources context tabs, keyboard tab navigation, panel expansion,
  and original-source links.
- Topic overview and separate-source views; rename, merge, assignment corrections,
  connection rejection/restoration, and source deletion.
- Source-driven topics, with connections requiring two distinct sources covering
  both topics. Large topic collections use readable cards; supported relationships
  remain available in the full graph view.
- Recall reveal/advance and session-only understood marks.
- Assistant preview: retrieves stored note text, supports both scope toggles,
  deduplicates source references, and discloses unsupported questions. It is not
  an open-ended model conversation.
- Curated original-paper/university reading list, with explicit save choice.
- Responsive layout, accessible controls, native dialog focus handling,
  keyboard navigation, and reduced-motion support.

Examples are teaching fixtures checked against the linked papers and Harvard
NLP material. Their evidence is explicitly paraphrased, not a verbatim extraction.
Examples do not claim full-source coverage or invented page/time locations.

## Library organization

Library organization uses one session-only module for learner actions and
derived graph/search views. Renamed topics are searchable by their displayed
names. Merging topics carries rejected connections to the surviving topic;
rejection wins until the learner restores connections. Source deletion and
hiding examples share recall cleanup and retain surviving topic corrections.
Authoritative source hydration removes stale saved records and replaces
URL-matching examples with owned captures. This ticket adds behavioral checks
for that boundary alongside existing library tests.

## Article API integration

Start the existing backend in another terminal:

```sh
uv run --project backend uvicorn backend.main:app --reload
```

Vite proxies `/api` to `http://127.0.0.1:8000`. To use another backend, set the
**server-side** `WEB_API_URL` environment variable before starting Vite. Do not
place provider credentials in browser environment variables.

`Add source` accepts public HTTP(S) article URLs and optional source text up to
30,000 characters. It creates/restores an anonymous Supabase session and calls
`/api/v2/sources` to save/list/reopen/delete owned captures. Follow
[`supabase/README.md`](../supabase/README.md) to configure the project, enable
anonymous sign-ins, and apply the reviewed migration. The backend environment
must be loaded before starting the server; Vite reads `web/.env.local`.

The source viewer explicitly says **Study note pending**. It displays captured
text, original URL, capture time, origin, and coverage, without inventing
concepts, citations, recall questions, or assistant responses. Structured note
generation is ticket #2. The existing strict v1 adapter and native API contract
are preserved, but new browser captures use the separate source API.

Downloads are bounded to 2 MB and captured text to 30,000 characters. A page
reader or substantial pasted-text fallback can handle inaccessible articles;
fallback coverage is unconfirmed and truncation is labelled partial. Private
network URLs and binary sources are rejected. Canonical URL matches reuse the
first capture. Content refresh/version comparison is not implemented.

**Verified locally:** API ownership/capture/validation, SDK session restore
against HTTP fixtures, Postgres RLS, and desktop/narrow-browser flows.
**Verified hosted on 2026-10-03:** anonymous save/list/reload/reopen,
owner deletion, and API/Postgres isolation between separate browser sessions.
Local Supabase environment files are configured and ignored by Git.
The anonymous browser session identifies its owner. Clearing browser data can
remove library access; account linking/recovery is a later slice.

PDF/video tabs explain planned support. Full structured generation, citation
alignment, transcripts, semantic topic placement, live research/chat,
background processing, and production hosting remain target work. Examples
exercise those existing preview controls; they do not claim to be generated
from a newly saved source.

The proxy is a development convenience. Production hosting and API routing need
a separate deployment slice; there is no configured production release pipeline.

## Validate

```sh
npm --prefix web run build
npm --prefix web run lint
npm --prefix web test
```

Boundary tests cover graph thresholds, corrections/search, canonical URLs,
strict v1 adaptation, authoritative source hydration, pending rendering, SDK
session restoration, and the unchanged SQL migration in embedded Postgres. Browser interactions were
checked at desktop and mobile sizes; evidence screenshots are in
`output/playwright/` (local generated artifacts).

The repository's exact backend pytest command currently invokes a copied
virtualenv script with an obsolete absolute shebang. Running the tests through
the project interpreter succeeds:

```sh
uv run --project backend --extra dev python -m pytest backend/tests -q
```

This browser slice does not modify or rebuild the existing backend virtualenv.


## Structured article notes — ticket #2

The browser now requests structured generation after saving a capture and restores
persisted studies independently of source loading. Queued/processing/retry/failed
states are visible; source text remains readable if generation cannot complete.
Completed notes are read-only with a variable number of concepts, optional supported
examples/equations and recall. Citation buttons open exact captured passages with
Open original; the browser checks each excerpt against its saved capture.

Local HTTP/SQL and desktop/narrow browser checks pass. Hosted generation,
citations, reload, ownership isolation and worker recovery passed on 2026-10-03. Follow [`docs/study-note-setup.md`](../docs/study-note-setup.md)
for the migration and worker; only public Supabase settings belong in the browser.
This supersedes the pending-note limitation above. Topic assignment/graphs for
real notes, PDF/video, live chat/research and source refresh remain future work.


## Current verified browser support — 2026-10-03

This supersedes earlier handoff/ticket snapshots above. Articles, selectable-text
PDF uploads/links, supplied video transcripts and anonymously accessible English
YouTube captions now persist in the learner-owned library and generate structured
read-only notes with exact passage/page/cue citations. Retrieval failure opens
upload/paste controls. Setup: [YouTube captions](../docs/youtube-transcript-setup.md),
[PDFs](../docs/pdf-study-setup.md), [supplied transcripts](../docs/video-transcript-setup.md)
and [study worker](../docs/study-note-setup.md). The real captioned Neural networks
note survives reload. 103 backend tests and 30 web tests pass; web build/typecheck
and lint pass. Production deployment, automatic Teams/Zoom/Panopto access, saved
source topics, chat/research and refresh remain planned. Track web acceptance in
[the web tracker](../context/web-progress-tracker.md) and
[the ticket plan](../docs/planning/web-learning-library-tickets.md).
