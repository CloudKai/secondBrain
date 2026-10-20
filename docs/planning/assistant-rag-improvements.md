# Study assistant retrieval and evidence quality

Status: testing boundaries and hosted Qdrant engine approved, 2026-10-07. This document separates the
inspected implementation from proposed improvements. The learner authorized continuation of the agreed specs. Current implementation
and measured results are tracked separately from target behavior.

## Confirmed priorities

### Remembered skill selection — 2026-10-06

The learner selected DeepEval in place of the general `llm-evaluation` skill.
The working three-skill set is:

- `wshobson/agents@rag-implementation`: retrieval implementation guidance.
- `confident-ai/deepeval` / `deepeval`: repeatable evaluation suites and datasets.
- `typesafe-ai/skills@typesafe-ai`: Jev classification and routing guidance.

This records a tooling preference, not installation or selection of Jev as the
winning grounding checker. DeepEval initially belongs in development evaluation;
live answer checking remains a separate measured design choice. No skill or
framework dependency was installed for this decision.

The learner selected these priorities in the grill-with-docs interview:

- Q1: improve answers across saved sources first.
- Q2: design the next version for up to 200 saved sources per learner.
- Q3: prioritize answer accuracy and evidence quality, with bounded cost and
  waiting time.
- Q6: resolve clear follow-ups from recent conversation; ask when ambiguous.
- Q9: target the first verified answer text within 10–15 seconds, followed by
  streamed checked sections. Track total completion time separately.
- Q10: preserve source structure first, recursively splitting oversized spans.
  Retrieval chunks and exact display citations serve different purposes.
- Q11: evaluate Jev for routing and compare it with a dedicated grounding
  classifier for claim support. Choose based on accuracy and latency.
- Q12: design for hosted use; validate the implementation in local development.
- Q14: index existing captures in the background, preserving saved note text and
  citations while showing indexing readiness.
- Q15: allow one bounded evidence retrieval/correction attempt for a rejected
  claim; show only supported parts and explain remaining gaps.
- Q16: set a per-answer AI cost ceiling after model comparison and before hosted
  rollout. Hosting and initial indexing costs are separate.

Additional preferences from round two are under investigation:

- Q4: BM25 plus semantic search. Qdrant approved for the shared hosted engine.
- Q5/Q8: evaluate a classifier instead of a second generative reviewer. The
  learner identified [Jev Ultrafast](https://github.com/browser-use/jev-ultrafast);
  its underlying TypeSafe API, rather than the browser package, is the relevant
  candidate. Jev has not been selected as the winning checker.

The source-count target is not a measured capacity guarantee. Passage count,
source length and simultaneous learners still affect storage and latency.

## Inspected implementation

Baseline inspected on `main` at `002ff6c`. No application tests were run for
this interview.

| Area | Current code | Implication to investigate |
| --- | --- | --- |
| Source retrieval | `get_assistant_context` searches completed note JSON using Postgres full-text search. It always includes the current note, with at most four topic notes and four additional library notes. | Original details omitted from notes may never reach the answer generator. |
| Passage selection | `AssistantGenerator` now considers captured passages plus validated saved references, ranks them by punctuation-aware token overlap, and selects at most eight current-source excerpts and three from each additional source within a 30,000-character context. This local #24 fix is awaiting acceptance. | Paraphrases can still miss evidence. Additional-source selection is unchanged; shared hybrid retrieval remains planned. |
| Follow-ups | Retrieval uses the latest question. The answer model receives recent user turns as context. | A follow-up such as “How does it compare?” can search without resolving its subject first. |
| Citation integrity | Backend and browser verify saved source identity/version and exact text, offsets, PDF pages and real video cue coordinates. Context revisions are checked again after generation. | These checks establish where a citation comes from, not whether its passage supports the claim. |
| Long-source notes | Bounded sections become short checkpointed summaries before final synthesis. | Some useful source detail can be lost before the assistant searches the final note. |
| Models and orchestration | Web note generation defaults to `gpt-4o-mini`; topics, overviews and assistant fix that model. Research fixes `gpt-4.1-mini`. Web LangGraph flows are linear. | There is no adaptive retrieval or model router. `OPENAI_MODEL` currently configures the native pipeline, not these web tasks. |

Code evidence:

- [Assistant SQL](../../supabase/migrations/202610050011_assistant_context.sql)
- [Assistant generation](../../backend/assistant/generation.py)
- [Assistant store and revision checks](../../backend/assistant/store.py)
- [Note generation and reference pruning](../../backend/studies/generation.py)
- [Shared source reference construction](../../backend/sources/references.py)
- [Browser citation verification](../../web/src/lib/assistant-answer.ts)
- [Web worker construction](../../backend/study_worker.py)

The expected learner impacts above are inferences from the code, not measured
retrieval or live-model quality results. Existing boundary tests do not establish
passage recall or semantic claim support on real questions.

The assistant currently returns one complete JSON response after generation and
revision checks; the browser renders it after receiving that response. Streaming
requires a new validated backend/browser event contract. The existing `partial`
field means evidence was omitted; it must not be reused to mean unfinished or
unchecked output. See [API](../../backend/assistant/routes.py),
[answer contract](../../backend/assistant/models.py),
[client](../../web/src/lib/source-client.ts) and
[assistant component](../../web/src/components/SavedAssistant.tsx).

Each capture is bounded to 120,000 characters. Two hundred maximum-sized sources
can contain 24 million characters. Source count alone therefore does not bound
index memory, embedding work, passage count or query latency.

## Proposed improvements — not implemented

1. **Search original source passages.** Build a complete passage inventory from
   captured text using the existing exact-location rules. Search only owned,
   current material within the selected assistant scope. Preserve existing
   source-version and topic-correction checks.
2. **Combine BM25 and meaning search.** Use real BM25 and dense embeddings, then
   fuse candidate rankings. For hosted use, assess Qdrant as a shared derived
   index. Existing Postgres `ts_rank_cd` is not BM25. Evaluate a small reranker
   against the simpler hybrid baseline before adding it.
3. **Check factual claims against their cited passages.** Distinguish exact
   citation location from semantic support. Evaluate an independent checking
   classifier step, comparing Jev with a dedicated grounding classifier. Allow
   at most one correction attempt within time and cost limits. Return
   supported parts or an evidence gap. A checker is fallible and requires
   labeled evaluation.
4. **Resolve conversational queries before retrieval.** Expand clear follow-ups
   into standalone search questions. Ask when the subject is ambiguous. Prior
   conversation supplies intent, never factual evidence.
5. **Route work according to question needs.** A simple explanation and a
   comparison across sources may need different retrieval strategies. Keep
   routes bounded and preserve explicit note/topic/library controls. External
   research remains an explicit learner action.
6. **Evaluate model routing after evidence retrieval.** Centralize task model
   settings, then compare a stronger model for difficult synthesis or checking
   against the same questions, latency and cost limits. Model names, providers
   and escalation rules remain undecided.

### Search engine options

| Option | Fit and limits |
| --- | --- |
| Qdrant BM25 + dense vectors | Recommended shared hosted index, with Supabase authoritative. Requires an added service, indexing jobs, deletion propagation and rebuild/version manifests. |
| ParadeDB BM25 + vector retrieval | Supabase's documented integration replicates into a separate database; it does not establish `pg_search` availability inside this hosted Supabase project. Adds a second database and synchronization. |
| Supabase FTS + pgvector | Fewer services and row-level filtering, but its standard keyword ranking is not the requested BM25. |
| SQLite FTS5 BM25 + pgvector | Viable local/single-host candidate. A local file is not a shared index for independent hosted replicas. |
| Python `rank_bm25` | Useful comparison baseline; full-corpus scoring and per-process caches need memory/cold-start measurement. Not recommended solely because there are 200 sources. |

Qdrant was approved on 2026-10-07. The shared index is accepted and its background worker is running locally; assistant hybrid queries remain planned. The web decision will not implicitly
implement or change the native roadmap's separate related-knowledge feature.

### Chunk and citation contract

- Search the complete captured source rather than only note-cited excerpts.
- Prefer original PDF pages, caption thought/speaker/pause groups and reliable
  paragraphs. Recursively split oversized spans by paragraph, complete sentence,
  whitespace and finally characters. Single PDF newlines may be layout wraps.
- Retain exact original offsets as chunks are built; do not recover positions
  afterward by looking for repeated text.
- Separate the retrieval policy/version from the existing immutable citation
  policy and `pNNNN` IDs. Existing learner notes and job checkpoints keep their
  meaning.
- Larger retrieval chunks can map to several smaller source passages. Preserve
  the existing citation size limit and cite separate PDF-page spans when needed.
  Video references use supplied cue times; untimed text remains untimed.
- Evaluate chunk size and boundary-aware overlap; no optimum or performance
  result is claimed.

### Classifier and streaming contract

TypeSafe's citation cookbook checks quote existence deterministically, then
classifies whether the surrounding evidence supports, contradicts or does not
address the claim. Its eight cached RFC examples establish a pattern, not quality
on this app. Evaluate its underlying API directly without the browser agent.

TypeSafe confidence describes the concentration of its answer probabilities;
it is not a guarantee that a claim is correct. Require a support verdict and
calibrate thresholds on representative evidence. Its documented weaknesses
include numerical precision, indirect reasoning and adversarial text. Keep
arithmetic and exact source-coordinate checks in code. MiniCheck is a specialist
comparison candidate; its paper notes limited evaluation across multiple
documents.

Proposed streaming flow:

```text
Question + explicit learner scope
  → resolve clear follow-up intent
  → retrieve owned current BM25 + semantic candidates
  → fuse / optionally rerank and select original source passages
  → generate a complete claim block with citation IDs
  → exact citation checks + semantic classifier
  → recheck current ownership, source versions and scope
  → emit checked block and its citations
  → final context validation and completion event
```

Buffer incomplete or unchecked prose. Validate every emitted event and use stable
claim IDs/sequence numbers. An evidence change invalidates the streamed answer;
the browser must not retain it as a current supported answer. Checker outage,
timeout and rejection need explicit gap/error outcomes. Previously verified text
is a snapshot, not a promise that sources can never change after emission.

The 10–15-second first-text goal is not verified. Measure first checked block,
full completion, warm/cold runtime, complex comparisons, correctness and cost.

## Design tree

- Answer quality across saved sources: confirmed.
  - Scale target of 200 sources: confirmed.
  - Accuracy/evidence priority: confirmed.
  - Retrieval: BM25 + semantic requested; structure-first recursion confirmed.
    - Shared engine: Qdrant approved on 2026-10-07.
    - Existing-source indexing: background indexing, confirmed.
  - Semantic answer check: compare Jev and a grounding classifier, confirmed.
    - Bounded correction: one attempt within limits, confirmed.
    - Thresholds, evaluation and provider configuration remain implementation
      choices to assess before rollout.
  - Conversation interpretation: resolve clear follow-ups, confirmed.
    - Recent-history bounds and ambiguity behavior need a later round.
  - Latency and streaming: first checked text in 10–15 seconds, confirmed target.
    - Cost ceiling: decide after model comparison, before hosted rollout.
    - Overall timeout will be set from measurements before rollout.
- Retrieval approach, model choices, evaluation scope and delivery order remain
  proposals until the relevant product decisions and shared understanding are
  confirmed.

## Current implementation frontier

- Q13 resolved: use Qdrant as the shared derived BM25 + dense index.
- Agreed testing boundaries: authenticated assistant API, model HTTP responses,
  deterministic PDF/video citation locations and browser scope/citation flows.
- Development baseline collection/scoring is implemented; the first fresh-PDF
  sample is recorded in [the baseline report](../reviews/assistant-baseline-2026-10-07.md).
- Qdrant cluster credentials are requested through ignored server configuration.

The hosted search engine is settled; deliver indexing and retrieval in explicit
units with ownership/version/deletion acceptance. Model winners, calibrated thresholds and the final latency/cost
limits are measurements required during the planned work, not silently selected
values or current guarantees.

## Primary references

- Supabase documents combining Postgres keyword search with vector search and
  reciprocal rank fusion: [Hybrid search](https://supabase.com/docs/guides/ai/hybrid-search).
- Postgres vector retrieval can use row-level access restrictions:
  [RAG with Permissions](https://supabase.com/docs/guides/ai/rag-with-permissions).
- Query complexity can determine which retrieval strategy runs. The paper's
  open-domain results are not app-specific acceptance evidence:
  [Adaptive-RAG, NAACL 2024](https://aclanthology.org/2024.naacl-long.389/).
- Choosing between models is a separate routing problem. Its reported cost
  savings are not a forecast for this app:
  [RouteLLM](https://arxiv.org/abs/2406.18665).
- Native BM25 generation and fusion are documented by Qdrant:
  [BM25](https://qdrant.tech/documentation/inference/inference-bm25/),
  [hybrid search](https://qdrant.tech/documentation/search-tuning/hybrid-search/).
- Supabase's ParadeDB integration uses a separate database:
  [integration](https://supabase.com/partners/paradedb).
- SQLite's lexical option and same-host concurrency constraints:
  [FTS5 BM25](https://www.sqlite.org/fts5.html#the_bm25_function),
  [WAL](https://www.sqlite.org/wal.html).
- Source-aware recursion builds on the splitter's ordered separators:
  [LangChain recursive splitter](https://docs.langchain.com/oss/python/integrations/splitters/recursive_text_splitter).
- Jev support checking, confidence interpretation and current documented limits:
  [citation cookbook](https://docs.typesafe.ai/cookbooks/citation_check),
  [confidence](https://docs.typesafe.ai/confidence),
  [Jev 1.13 limits](https://docs.typesafe.ai/model-jaggedness/jev-1.13).
- Specialist grounding-classifier research:
  [MiniCheck, EMNLP 2024](https://aclanthology.org/2024.emnlp-main.499/).

No new ADR is warranted yet: implementation choices and their trade-offs have
not been settled. General terms such as embeddings and RAG do not belong in the
product glossary.

## Hybrid assistant retrieval started — 2026-10-07

Planned unit [#27](https://github.com/CloudKai/secondBrain/issues/27) connects the
accepted Qdrant index to assistant questions. It will search the selected
note/topic/library inventory, combine BM25 and semantic candidates with RRF,
load bounded ranked sources and map chunks to exact citation passages. Postgres
ownership, scope, current version and index generation must be revalidated
before model input and after generation. Per-learner BM25 IDF prevents other
learners' corpora from affecting sparse scoring.

Inspection confirmed the existing `get_assistant_context` selects at most nine
sources using note-text search. Hybrid retrieval needs a bounded metadata
inventory before ranking, then exact source loads; querying only those nine
legacy candidates would retain the same source-discovery limitation.

The TDD skill requires agreement before new tests. The focused question covering
Qdrant/OpenAI HTTP, authenticated assistant questions and Postgres ownership/
scope/current-version seams is pending. No #27 implementation or tests have been
written or run. Hybrid answers remain target behavior; background indexing from
#26 continues locally. Native/iOS and its tracker remain untouched.


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

## Working first web version — local acceptance, 2026-10-08

**Verified:** fresh article/PDF/video-caption imports generate saved notes and ready
search indexes. Browser checks cover page/timestamp citations, reload, a shared
two-source topic, two graph connections and a completed combined overview. The
approved development worker is running. Mobile/iOS and its tracker are untouched.

The assistant now returns attributed captured-source wording with whitespace
simplified. This avoids displaying unverified draft paraphrases; evidence relevance
and completeness are still model judgments. A lexical passage reservation fixes
the fresh cleanup retrieval miss. Existing topic context is copied from the owned
catalog by the server, fixing the video mapping retry without changing public
records or database schema.

**Checks:** 266 backend tests, 69 web tests, web build/typecheck and lint pass.
Twenty final live regression requests matched expected statuses and had valid
citation locations, taking 3.13–6.55 seconds per complete response in single local
runs. One comparison selected an equivalent alternate caption and hit only one of
two annotated exact spans; this is not independently measured semantic accuracy.

**Target:** hosted rollout, calibrated verified paraphrases, streaming, 200-source
capacity and a measured cost ceiling remain open under #25/#27. Study notes and
combined overviews remain AI-generated and should be inspected through citations.
See [acceptance, failures and limits](../reviews/working-product-acceptance-2026-10-08.md).
