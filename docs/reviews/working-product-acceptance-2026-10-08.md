# Working web product — development acceptance, 2026-10-08

## Verified locally

The browser frontend, FastAPI, Redis and approved development worker are running.
New public article, selectable-text PDF and supplied video captions were imported
through the browser. Each produced a saved study note and a ready Qdrant index.
The video topic map initially failed; after the fix and a visible retry it joined
an existing PDF topic. The fresh browser library has three sources, eleven topics
and two explainable connections. Its combined overview completed and loaded again
after a page reload. This is local development acceptance, not a production launch.

| Browser check | Observed result |
| --- | --- |
| Python asyncio article | Saved note/index; assistant citation opens captured paragraph and character offsets |
| MIT calculus PDF link | Saved note/index; citation opens the supporting passage on PDF page 1 |
| 3Blue1Brown video + creator SRT upload | Saved note/index; assistant quote opens the original cue at 1:07.540–1:19, with a video link at 1:07 |
| Shared calculus topic | Two sources, connected graph, separate original notes and a generated combined overview |
| Reload | Saved notes, index state, graph and combined overview remain available; assistant conversation resets as disclosed |

The browser check used a separate `localhost` origin so the learner's existing
`127.0.0.1` library was preserved. The other fresh acceptance library used a new
anonymous session and pinned public captures. No existing learner source was deleted.
Video testing used the supplied-caption path; it does not establish automatic
caption access on every video or private recording platform.

## Reliable first assistant version

The learner chose exact cited source wording when AI explanations cannot be
verified. The current supported-answer path constructs attributed quotes on the
server from model-selected captured passages. Only whitespace is normalized in the
answer; original excerpts, character offsets, PDF pages and caption times remain
unchanged in the citation. Browser copy says these are source excerpts.

This preserves source qualifications even when a model draft invents a stronger
claim. It establishes captured wording and valid locations, not source truth,
relevance, completeness or a calibrated semantic support score. A model still
selects evidence and decides whether to abstain. AI-generated study notes and
combined overviews still require review of their citations. Generic “Source 1”/
“Source 2” wording in overview prose is also a remaining presentation limitation.
No grounding classifier, trained Laya router or verified answer streaming is enabled.

Selected quotes are bounded by the existing eight answer blocks. Short quotes may
share a block. If a declared comparison cannot include evidence from every side
within the bounds, it returns an evidence gap instead of silently dropping a side.
The public answer contract and source ownership/version fences remain intact.

An initial fresh cleanup question missed its exact passage: lexical rank 1,
combined passage rank 8, outside the eight selected windows. The selector now
reserves two lexical anchors for the current note and one for each additional
source, with deduplication and the same context/coordinate limits. The replay
includes the try/finally and CancelledError wording. This small passage-diversity
rule is separate from Qdrant's upstream BM25/dense hybrid retrieval.

## Existing topic context belongs to the server

The failed video map exposed a redundant model responsibility: copying canonical
context already present in the owned topic catalog. Private drafts now request
`context: null` for a reused topic ID; the server copies its canonical title,
description and context. A redundant model-supplied context is ignored for a known
existing ID. New or uncertain suggested topics still require a nonempty context.
Unknown IDs, uncertain reuse and invented citation IDs remain rejected. Public topic
records and the database schema are unchanged; no migration was needed.

Intermediate probes failed when all contexts were omitted or the model redundantly
echoed an existing context. They are recorded in the evaluation artifacts. The
final live probe succeeded, then the saved browser retry produced the shared topic.
This fixes mechanical copying; semantic topic equivalence is still an AI judgment
that learners can correct. Repair feedback now includes field locations without
input dumps, so a retry can target the affected topic. Retry/deadline bounds remain.

## Checks and measurement limits

- **266 backend tests pass**, including unverified-paraphrase substitution,
  comparison packing/omission, lexical passage selection, canonical context,
  invalid existing IDs and located schema repair at the approved HTTP/API seams.
- **69 web tests pass**; web build/typecheck and lint pass. The build retains the
  existing large JavaScript chunk warning. Two existing backend dependency warnings
  remain.
- The prescribed `uv run --project backend --extra dev pytest backend/tests -q`
  was attempted but sandbox access to the uv cache failed. The complete suite ran
  with `backend/.venv/bin/python -m pytest backend/tests -q`.
- Twelve fresh and eight previous regression questions matched expected answer
  statuses; all returned citation locations were valid. The fresh comparison hit
  one of two annotated spans (0.5): the other selected video span conveys the same
  limit relationship, but the exact annotated-span metric did not pass fully.
- The initial fresh full report was overwritten by the final replay. Its observed
  cleanup miss and comparison metric are preserved in `fresh-product-initial-findings.json`;
  that record explicitly discloses the overwrite.
- Twenty final complete responses took **3.13–6.55 seconds** in single development
  runs. These are complete-response samples, not first verified streamed text,
  latency percentiles, independent held-out quality or a 200-source capacity test.
- Real API fences passed: no session 401; cross-owner source, wrong version and
  unowned topic 404. Comparison HTTP response was 200 with exact citation locations
  and only public claim fields.

## Evidence

- `output/evaluation/fresh-product-manifest.json` — twelve cases with pinned captures.
- `output/evaluation/fresh-product-answers.json` — final fresh replay.
- `output/evaluation/source-wording-regression-eight-final.json` — final previous-case replay.
- `output/evaluation/fresh-product-api.json` and `fresh-product-fences.json` — live API checks.
- `output/evaluation/browser-topic-owned-context.json` — final live topic probe.
- `output/reviews/working-product-2026-10-08/video-citation.jpg` — exact video cue modal.
- `output/reviews/working-product-2026-10-08/topic-overview.jpg` — persisted shared topic view.

Acceptance artifacts contain public test material, never session/provider secrets.
Private session registries stay outside the repository.

## Running and remaining work

The learner explicitly approved leaving the development worker running. For a
restart, use the configured ignored environment files, Redis, the backend API,
`backend/.venv/bin/python -m backend.study_worker`, and `npm --prefix web run dev`.
The worker processes queued development imports using the configured providers.
TinyFish is not used. Mobile/iOS and its progress tracker were untouched.
No commit or push was requested for this unit.

**Target behavior:** hosted deployment, calibrated paraphrase verification,
streaming, independently reviewed retrieval/answer quality, a 200-source workload,
and an explicit measured cost ceiling remain open. GitHub #25/#27 stay open for
those broader gates. Laya remains the requested comparison candidate, not a
selected live checker. This unit makes the local product usable with source quotes
while preserving those production and semantic acceptance limits.

GitHub progress synchronized:
[#25 update](https://github.com/CloudKai/secondBrain/issues/25#issuecomment-6063522492) ·
[#27 update](https://github.com/CloudKai/secondBrain/issues/27#issuecomment-6063522961).
Both issues remain open for the broader target gates above.
