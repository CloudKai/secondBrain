# Fresh multi-source assistant evaluation — 2026-10-08

## Verified work

The evaluator and authenticated assistant now use one answer pipeline. The
collector records whether configured, legacy or hybrid retrieval actually ran.
Independently reviewed expected sources are pinned by ID, version and capture
SHA-256, checked against the whole owned selected-scope inventory. Missing
retrieved evidence is scored as a miss; invalid or changed annotations fail.
The HTTP request/response contract is unchanged.

A dedicated anonymous acceptance library imported and generated fresh notes from:

- [Attention Is All You Need](https://arxiv.org/pdf/1706.03762), physical pages 4–6.
- [PyTorch functional scaled-dot-product attention](https://docs.pytorch.org/docs/2.14/generated/torch.nn.functional.scaled_dot_product_attention.html).
- [3Blue1Brown's attention video](https://youtu.be/eMlx5fFNoYc), first 15 minutes,
  using the creator's [English SRT archive](https://github.com/3b1b/captions/blob/9aef876b0ed62ce4f099c0a2f0e7a52e8d1058c9/2024/attention/english/captions.srt).

Captures contained 9,124 / 9,671 / 16,168 characters respectively. All three named
study jobs succeeded and background indexes became ready. No unrestricted study
or topic dispatcher was started. Caption coordinates were checked against the
uploaded creator SRT, not independently against audiovisual playback. This uses
transcript upload and does not verify automatic YouTube caption fetching.

## Paired observations

Each question ran once per mode with the same capture, annotation, generator and
scope. This small development set was authored after source inspection; it is
not a held-out benchmark. No ranking changes were tuned during these replays.

| Question / scope | Legacy exact-span hits | Hybrid exact-span hits |
| --- | --- | --- |
| PDF score scaling / note | 1/1 | 1/1 |
| Boolean mask meaning / article note | 1/1 | 1/1 |
| Evaluation dropout / article note | 1/1 | 1/1 |
| Query/key matching / video note | 1/1 | **0/1** |
| Context size cost / video note | 1/1 | 1/1 |
| Find PyTorch dropout from PDF / library | 1/1 | 1/1 |
| Compare paper/video scaling / library | **1/2** | **1/2** |
| PyTorch dropout in PDF-only scope | Expected abstention | Expected abstention |
| Roman emperor invention / library | Expected abstention | Expected abstention |

All 18 answers passed exact citation-coordinate checks and returned the expected
supported/unsupported status. A supported status is not evidence of a correct
answer. Manual review found the hybrid query/key answer describes query-vector
construction instead of the requested dot-product match. Both comparison answers
incorrectly say the video does not explicitly explain scaling, despite its
captured numerical-stability explanation.

Complete-response samples: legacy 2.10–5.03 seconds, hybrid 2.72–5.54 seconds.
These are individual timings, not percentiles or first verified streamed text.
The app remains non-streaming; generation token costs remain unavailable.

## Confirmed failure point

A separate current-snapshot trace found the expected video span in Qdrant's
**rank-1 chunk** in both failed hybrid cases:

- Query/key match: supporting passage is position 21 after chunk expansion;
  current-note model context keeps only the first eight passages.
- Scaling comparison: supporting video passage is position 7; other-source
  context keeps only the first three passages.

Chunk ranking survives, but selecting passage prefixes discards the best
supporting evidence. Broadening the index alone does not fix this. Exact offsets
remain correct even when a selected passage does not answer the question.

## DeepEval and manual review

DeepEval 4.2.8 scored the comparison answer in each mode using `gpt-4o-mini`,
maximum 12 calls and a $1 conservative reservation ceiling per run. Each run
used eight judge calls. SDK-estimated judge costs were $0.002723 legacy and
$0.002645 hybrid; these exclude answer generation/indexing/hosting.

| Metric | Legacy | Hybrid |
| --- | --- | --- |
| Faithfulness | 1.0 | 1.0 |
| Contextual recall | 1.0 | 1.0 |
| Contextual precision | 0.681 | 1.0 |

The recall/faithfulness results disagree with the independently reviewed missing
video evidence and erroneous absence claim. They must not be used as release
passes. A judge can reward a plausible answer or shared theory without checking
which source actually supports each part of a comparison. Keep deterministic
source/span checks and manual claim-to-citation review alongside semantic scores.

## Reproduction and checks

Ignored `output/evaluation/` contains `multisource-captures.json`,
`multisource-manifest.json`, `multisource-legacy.json`, `multisource-hybrid.json`,
`multisource-diagnosis.json` and the paired judge inputs/scores. Sources are
retained in the dedicated acceptance library for replay; its learner credentials
are private and excluded from Git. No personal library was modified.

With that learner's current `EVAL_SESSION_TOKEN` set privately:

```bash
PYTHONPATH=. backend/.venv/bin/python -m backend.evaluation.collect --manifest output/evaluation/multisource-manifest.json --output output/evaluation/multisource-legacy.json --retrieval legacy --limit 9
PYTHONPATH=. backend/.venv/bin/python -m backend.evaluation.collect --manifest output/evaluation/multisource-manifest.json --output output/evaluation/multisource-hybrid.json --retrieval hybrid --limit 9
```

The new collector test failed before expected-source annotation support and
passed afterward. Full backend suite: **234 passed**, two existing deprecation
warnings. The prescribed uv command was attempted but blocked by sandbox access
to its cache; the existing backend virtual environment ran the suite instead.
No frontend code changed in this unit; previous 69 web tests are historical.

## Next intended unit — #27

Rank exact passages by question relevance before applying per-source and total
context limits. Preserve selected-source diversity for comparison questions,
source/page/cue identity and all current ownership/version fences. Add the two
observed regressions at the approved HTTP/API boundaries, then replay this same
annotated library without changing ground truth. Do not simply increase context
limits or claim that new retrieval has improved quality yet.

Broader topic/follow-up, held-out/source-diversity and 200-source capacity checks,
classifier comparison, semantic release thresholds and verified-section streaming
remain planned. #25/#27 remain open. Native/iOS and its tracker are untouched;
no commit or push was made.

GitHub progress synchronized to [#25](https://github.com/CloudKai/secondBrain/issues/25#issuecomment-6041981140)
and [#27](https://github.com/CloudKai/secondBrain/issues/27#issuecomment-6041981495).
