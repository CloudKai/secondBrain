# Assistant evaluation baseline — slice 5a

Status: evaluator implemented and first fresh sample measured, 2026-10-07.
Broader baseline coverage remains in progress under GitHub #25.
This is the next unit authorized by the learner. It does not select a hosted
retrieval engine, classifier winner or production model.

## Current evidence

The three old #24 audit sources were deleted at the learner's request, using
exact source IDs and one-owner filtering. The deletion returned three rows;
a subsequent exact-ID read returned zero. Existing-note repair is superseded.
The earlier audit remains historical evidence. Fresh-source acceptance of the
local fixes remains pending; deletion does not establish that those fixes pass.

## Intended unit

Prepare and then measure a development-only baseline for the authenticated
assistant on fresh public captures. Keep semantic quality separate from exact
location, ownership, revision and scope checks. Retain charcoal/mint web design;
no native/iOS changes, shared search deployment or automatic external research.

[Seed cases](../evaluation/assistant-baseline-cases.json) cover the observed
positional-encoding miss, paraphrase retrieval, explanation, multi-source
attribution, clear follow-ups, unsupported history, unavailable evidence,
PDF/video locators, scope isolation, ownership and stale versions. Expected
answers are independently authored; source text and locator annotations must be
reviewed after fresh capture. Null answers and annotation-needed cases are
incomplete and must be excluded from scored totals, never counted as passes.

## Baseline execution contract

1. Capture fresh public article, selectable-text PDF and English-caption video
   through existing authenticated import paths in a dedicated acceptance library.
   Process only named acceptance jobs; do not start an unrestricted dispatcher.
2. Review expected evidence against captured text. Record source version, capture
   fingerprint, exact offsets and physical page/cue boundaries. No old database
   IDs or generated note wording become the ground truth.
3. Record the context actually supplied to the answer model separately from the
   citations it ultimately selects. Citation-only output cannot establish
   retrieval recall or ranking. Use development instrumentation without exposing
   private retrieval context in the public API.
4. Run deterministic ownership, scope, exact excerpt/location, reference identity
   and stale-context checks at the agreed API/model/browser boundaries.
5. Apply DeepEval semantic metrics to complete labeled cases. Use contextual
   recall/precision and faithfulness where their required fields exist. Keep
   unsupported-answer cases as explicit abstention checks rather than fabricating
   an expected factual answer. Review judge disagreements manually.
6. Record wall-clock answer completion, provider usage when available, model and
   configuration, score reasons, and failures. Existing non-streaming output has
   no first verified streamed block; report that metric as unavailable. Do not
   substitute first unchecked token latency.
7. Report results separately for note/topic/library scope and PDF/article/video.
   No averaged headline score that hides citation or ownership failures.

DeepEval's [RAG quickstart](https://deepeval.com/docs/getting-started-rag),
[test-case contract](https://deepeval.com/docs/evaluation-test-cases),
[contextual recall](https://deepeval.com/docs/metrics-contextual-recall) and
[faithfulness](https://deepeval.com/docs/metrics-faithfulness) are the SDK references.
These semantic metrics use model judging; they are development evaluation, not
selection of a second generative model for live claim checking. Jev versus a
specialist grounding classifier remains a later comparison.

## Gates and acceptance

- The learner approved testing on 2026-10-07: authenticated assistant API, model
  HTTP, deterministic page/cue checks and browser scope/citation flows.
- Qdrant is approved as the shared hosted BM25 + semantic engine; the learner
  hosted indexing and hybrid retrieval passed bounded acceptance and are enabled locally. Broader evaluation is tracked separately from indexing.
- Optional DeepEval 4.2.8 tooling is implemented. One fresh public-PDF case ran
  with explicit `gpt-4o-mini` judge, $1 conservative budget and eight calls.
  [Results and limits](../reviews/assistant-baseline-2026-10-07.md).
- Semantic release thresholds and production model/cost winners remain unset.
- Baseline completion requires fresh annotated cases, reproducible commands,
  observed results, failure breakdown and an explicit remaining-coverage list.
  This seed set does not establish capacity for 200 sources or production safety.

Indexing and scoped hybrid retrieval are implemented locally under #26/#27.
Next units, after broader baseline: compare grounding classifiers;
resolve/rout questions; introduce checked-section streaming. Each gets its own
acceptance criteria and updates to the web tickets/tracker.


## Broader measured coverage — 2026-10-08

Eleven fresh question annotations on the retained three-source corpus exercise
new facts, topic-only versus topic-plus-library scope and two clear follow-ups.
Ten of eleven expected statuses match; one topic false abstention repeats despite
its evidence reaching the model. The video topic map failed two named attempts.
These are unresolved acceptance failures, not missing annotations or successful
quality gates. [Full results](../reviews/assistant-broader-evaluation-2026-10-08.md).


## Generation reliability fixes — 2026-10-08

Implemented a whitespace-normalized reading rendering for multiline evidence while
preserving exact citation text/coordinates. Topic schema instructions and owned
canonical-context repair requirements fix the rejected video mapping without
weakening validation or adding retry attempts.

**Verified locally:** 238 backend tests pass; all 11 broader and all nine prior
question statuses, annotated spans and citation locations pass. Actual API GQA
answer returned supported with an exact article citation. The named video map
saved successfully at attempt 3; all three acceptance source maps now succeed.
No unrestricted study/topic dispatcher ran.

[Acceptance and limits](../reviews/generation-reliability-acceptance-2026-10-08.md). #25/#27 remain open. Next planned unit: compare
Jev with a specialist grounding classifier using claim-level support/uncertainty
annotations. Explicit ambiguous follow-up handling, independent-source coverage,
200-source capacity, cost calibration and verified streaming remain planned.
Native/iOS and its tracker untouched; no migration, commit or push.


## Grounding classifier comparison — 2026-10-08

Implemented a development-only direct Jev adapter, optional pinned MiniCheck FT5
runner and 20 manually reviewed public claim/evidence cases. **240 backend tests
pass**; dry-run validation covers all cases. Production answers are unchanged.

MiniCheck scored all 20 on this Mac's MPS device: zero false support among 13
unsupported claims, but **two false rejections among seven supported claims**.
Original/compacted-whitespace probes retain both failures: GQA equations and
opposite boolean-mask semantics. Failed initial tokenizer setup is retained as
unscored runtime evidence. These are development regressions, not held-out
accuracy or calibrated thresholds.

**Needs input:** add server-only `TYPESAFE_API_KEY` to ignored backend/.env; the
focused question is pending. Jev has made zero requests. No winner or live checker
is selected. [Results, reproduction and limits](../reviews/grounding-classifier-development-2026-10-08.md).
#25/#27 remain open; follow-up/routing, broader labels, hosted cost/latency and
verified streaming remain planned. Native/iOS and its tracker untouched; no
migration, commit or push.


## Laya replaces Jev — 2026-10-08

The learner selected open-source Laya. Replaced the active development Jev adapter
with pinned local Laya English HTTP classification; removed its provider option
and TypeSafe placeholder requirement. No API key is needed. Production answers
are unchanged; the temporary model server was stopped after measurement.

**Measured:** unchanged 20 cases in original/compact layouts. Laya matches 17/20,
with three false acceptances and no false rejections; MiniCheck matches 18/20,
with no false acceptances and two false rejections. Scope generalization, GQA
negation and reversed mask semantics fail in Laya. No threshold was tuned or
winner/live checker selected. **240 backend tests pass**.

[Results and next gates](../reviews/laya-classifier-development-2026-10-08.md). #25/#27 remain open. Routing and broader grounding
calibration, hosted latency/cost and verified streaming remain planned. The earlier
TypeSafe-key request is superseded. Native/iOS tracker untouched; no migration,
commit or push.


## Claim/evidence preparation — development acceptance, 2026-10-08

Implemented private per-claim citation export, an offline unreviewed-draft exporter,
and optional exact sentence groups with all-groups acceptance and fail-closed
unscored results. Added 21 original app answer blocks to the existing 20 controlled
cases: **41 development examples** on the same three public captures. Labels are
developer-reviewed under a conservative uncertainty/all-parts policy; independent
adjudication and unseen source/topic groups are still required.

**Measured on the new 21 blocks:** Laya's explicit 1024-token probe matches 18,
with three false acceptances and no false rejections; MiniCheck matches 15, with
one false acceptance and five false rejections. Whole/sentence results are identical
for both candidates: **no demonstrated accuracy gain from grouping**. Original
512-token truncation and concurrent-memory setup failures remain unscored artifacts.
No classifier is enabled in the assistant; no model was trained. **248 backend tests
pass**, with two existing dependency warnings. Temporary model processes stopped.

[Preparation, measurements and limits](../reviews/claim-evidence-preparation-2026-10-08.md). #25/#27 remain open for independent
review/calibration, routing, hosted latency/cost, ambiguous follow-ups, capacity and
verified streaming. No application source reprocessing, migration, mobile/native
tracker change, commit or push.

## Claim generation — implementation verified; semantic acceptance pending, 2026-10-08

Implemented 600-character private draft claims, concise per-claim instructions,
literal source-qualifier hints, private source identity and declared-comparison
citation guards. Public answers remain compatible; citation marker cleanup keeps
exact attribution. **258 backend tests pass**. Seven of eight final regression
requests completed with expected statuses and exact citations; a comma-marker
failure was then fixed, and an actual API comparison returned 200 with exact PDF
and video locations. Earlier failed rounds remain recorded.

Qualifier attachment and unsupported extensions still fail conservative developer
review in scaling/comparison answers. **Semantic acceptance remains open**; shorter
claims and valid locations are not proof of support. No classifier, training,
routing or streaming is enabled. Independent review and unseen-source groups are
next. [Implementation, failures and next gates](../reviews/claim-generation-review-2026-10-08.md). #25/#27 stay open.
Native/iOS tracker untouched; no migration, worker, commit or push.
