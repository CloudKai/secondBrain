# Second Brain web architecture

This map describes the current development web app. It is a component map,
not a production deployment plan. The separate native app is outside its scope.

![Web architecture](architecture.svg)

Download the [interactive Archify map](architecture.html) and open it in a browser
to inspect components, follow connections, zoom and switch themes. GitHub shows
the HTML source rather than running the interactive viewer. The
[JSON specification](architecture.archify.json) is the editable diagram source.

## How the parts work together

1. The React browser restores or creates an anonymous Supabase session and sends
   its bearer token with library requests.
2. FastAPI verifies that session, captures public articles, selectable-text PDFs
   or available captions, and accepts supplied transcripts. Ownership filters
   and Postgres Row Level Security restrict learner-facing library access.
3. Postgres stores captures, generated studies, topic evidence, source versions
   and durable job state. The API accepts generation requests without waiting
   for a model to finish.
4. The worker's dispatcher publishes due job IDs to Redis. ARQ consumes those
   jobs; the worker claims work in Postgres, calls the LangGraph/OpenAI pipeline
   and saves results. Redis transports work rather than owning saved notes.
5. The browser retrieves saved notes and topic relationships. Combined overviews
   are generated on demand by the worker. Assistant questions use the selected
   saved evidence through the API; research uses OpenAI search and bounded
   public downloads. Research results enter the library only after explicit saving.

The diagram consolidates note, topic and overview processing into one worker
node and consolidates OpenAI generation and search into one external provider
node. It shows architectural dependencies; response traffic and every internal
function call are omitted.

## Data and access boundaries

- The browser receives public Supabase settings and its learner session.
- The API verifies learner identity and uses learner-token database access.
- Worker database credentials and OpenAI keys remain server-side. Worker RPCs
  use job claims, leases and source-version fences to prevent stale completion.
- Citations refer to exact captured text and supplied page/cue locations.
  Their IDs retain meaning across retries and source versions.
- Public capture and research downloads have URL, redirect, size and deadline
  checks. Private recording authorization is not implemented.

The map does not depict the worker as subject to learner RLS: the worker uses
privileged server credentials, with its access restricted by the worker contracts.
It also does not describe network segmentation or production infrastructure.

## Current limits and planned work

**Verified development behavior:** owned saved sources, structured citations,
background generation, topics, overviews, corrections, versioned refresh,
grounded assistant answers and explicit research. Retrieval uses saved Postgres
evidence; there is no separate vector database in this web implementation.

**Planned:** production deployment, linked accounts and recovery, scanned-PDF
OCR, and automatic access to private Teams, Zoom and Panopto transcripts.
YouTube caption retrieval depends on anonymously accessible English captions.

## Diagram provenance

- Repository: `CloudKai/secondBrain`, branch `main`.
- Source revision: `310e74782824dca6b3ff5a4feb4092be88cab978`.
- The working tree contains unrelated edits; diagram source links reference
  verified files at the pinned revision rather than representing a clean checkout.
- Renderer: Archify 2.16.0, architecture mode.
- Showcase validation and delivery: 9/9 checks, zero errors and warnings.
- Desktop containment: passed at 1440×900, 1600×1000, 1920×1080 and 2048×1320.
- Light and dark rendered screenshots inspected: `visual_review: passed`.
- Geometry correction rounds: 2.
- Specification SHA-256: `34ed9444c9bc99d0832711524fcf11485d1ba022001a24e8c7e4b286031f5bdb`.
- HTML SHA-256: `3898047cec9913d3d79d4157cbeb197c174f0bc4e0b3796088e44d6e94a02f19`.

The README image is Archify's canonical dual-theme SVG export from the delivered
HTML. It contains the complete diagram without viewer controls. Exporting does
not modify the validated HTML or establish production acceptance.
