# Passage-selection acceptance — 2026-10-08

## Implemented locally under #27

The hybrid assistant now ranks exact passages after expanding owned Qdrant hits,
before preparing the answer context:

- Lexical preselection followed by one bounded `text-embedding-3-small` request
  for the question and at most 128 passage candidates. Sources are interleaved
  when choosing that batch. Timeout: 10 seconds; malformed embedding identities,
  non-finite/zero vectors and provider failures reject generation safely.
- Semantic passage similarity retains a bounded original chunk-rank prior
  (`0.2 / (1 + rank)`). This development weight was adjusted using the observed
  failures, so these results are development acceptance, not held-out validation.
- Adjacent captions provide ranking context. Selected caption anchors can retain
  up to four following passages, stopping at a capture gap, a >1.5-second cue gap,
  45 seconds or 900 characters. Each sentence retains its own immutable excerpt,
  source ID/version, reference ID and timestamp; no saved note/citation is edited.
- Eight current-note / three other-source anchor windows, at most 1,000 excerpt
  characters per window in the per-source aggregate, and the existing 30,000
  serialized-character answer-context limit. PDFs/articles retain individual
  ranked passages. Selected-source scopes and final Postgres revision checks
  remain in place. The public assistant API contract is unchanged.

Pure passage similarity repaired the query/key case but still confused score
scaling with context-capacity scaling. Keeping chunk relevance alone was also
insufficient. Bounded caption continuations supplied the missing mathematical
explanation without enlarging the overall answer-context limit.

## Regression checks and real replay

Three new API/provider-boundary checks cover late caption evidence, paraphrased
semantic relevance and invalid boolean embedding indices. The checks failed
before their respective fixes and pass afterward. Existing ownership, revision,
PDF/video locator and provider-outage checks remain green.

Full backend suite: **237 passed**, two existing deprecation warnings. The exact
prescribed uv command was attempted but could not read its sandboxed cache; the
existing backend virtual environment ran the suite. `git diff --check` passes.
No frontend code changed or frontend tests ran in this unit.

The same retained fresh acceptance library and unchanged nine-case annotations
from the [preceding evaluation](assistant-multisource-evaluation-2026-10-08.md)
were replayed through hybrid retrieval after the final fix:

| Case | Earlier hybrid exact-span hits | Final exact-span hits | Complete response |
| --- | --- | --- | --- |
| PDF score scaling | 1/1 | 1/1 | 6.11s |
| Article mask semantics | 1/1 | 1/1 | 5.14s |
| Article dropout | 1/1 | 1/1 | 3.36s |
| Video query/key matching | **0/1** | **1/1** | 5.78s |
| Video context cost | 1/1 | 1/1 | 4.97s |
| Library dropout from PDF | 1/1 | 1/1 | 5.24s |
| Paper/video scaling comparison | **1/2** | **2/2** | 6.22s |
| PDF-only scope isolation | Expected abstention | Expected abstention | 3.84s |
| Unsupported library question | Expected abstention | Expected abstention | 4.39s |

All nine final responses have valid citation locations and expected statuses.
Manual review confirms the two original failures now explain the dot product
and cite both the paper's gradient rationale and the video's numerical-stability
explanation. The video scaling citation points to **10:44–10:53.960**, and the
paper citation to physical **page 4** in the focused replay. The local HTTP API
also returned the supported comparison with both sources and exact locations.

Timings are individual samples, not latency percentiles. There is still no
verified-section streaming. Additional passage embeddings add provider work;
answer-generation and indexing costs remain unmeasured here. No DeepEval judge
was rerun: its previous inaccurate high scores remain documented, and this
acceptance uses independently annotated spans plus manual claim review.

Ignored artifacts: `output/evaluation/passage-ranked-hybrid.json` (final nine),
`passage-context-hybrid.json` (focused final replay),
`passage-ranked-live-api.json` (actual localhost API), and
`passage-ranked-intermediate.json` (earlier incomplete attempt).
Acceptance sources and credentials remain in the dedicated private test library;
no personal sources were edited or removed.

## Remaining target work

Broader held-out questions, topic/follow-up coverage, capacity at 200 sources,
comparison-source relevance, ranking/cost calibration and semantic claim checking
remain unfinished. #25/#27 stay open. Next planned AI unit is the Jev versus
specialist grounding-classifier comparison after the remaining evaluation gates.
No migration, production rollout, commit or push occurred. Native/iOS and its
progress tracker are untouched.

GitHub progress synchronized to [#25](https://github.com/CloudKai/secondBrain/issues/25#issuecomment-6042604979)
and [#27](https://github.com/CloudKai/secondBrain/issues/27#issuecomment-6042605481).
