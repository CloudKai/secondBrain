# Laya replaces Jev in the development comparison — 2026-10-08

## Implemented

The learner selected [Laya](https://github.com/NandhaKishorM/laya) instead of Jev.
The active runner now compares **local Laya English versus MiniCheck FT5**; the
Jev adapter/provider choice and TypeSafe placeholder requirement are removed.
Earlier Jev research and setup-failure artifacts remain historical evidence.
No vendor key is needed for this public Laya checkpoint. Verified contracts and
license information are in the [primary-source research](../research/laya-classifier-2026-10-08.md).

Laya runs in the isolated temporary model environment, with its official HTTP
server bound only to `127.0.0.1:8767`. Only the English checkpoint is preloaded.
Source revision `3cf26cbcb18725dbc2d127bb8bb2c4c43243ae63` and checkpoint revision
`55cf4c4ebb4ebe31b2550e8bdf3bd21b99753851` are pinned. Hosted deployment and live
answer checking are not implemented by this unit.

The evaluator checks the loaded checkpoint revision and explicit English route,
separates support probability from entropy-based answer confidence, uses at most
20 HTTP requests per run with 20-second timeouts/no retry, and rejects truncated
state/questions or collapsed options. Strict Jev compatibility mode stays off
because it would hide truncation metadata. No cost is fabricated for local
inference; hardware/hosting cost remains unmeasured.

## Same-case comparison

The unchanged [20-case dataset](../evaluation/grounding-claims.json) contains seven
supported, six contradicted and seven not-addressed claims from the same three
public captures. Labels and citations were not altered. Both candidates were
measured on original and mechanically compacted whitespace; expected labels are
never sent to the classifiers. These are manually authored development
regressions, not independently labeled held-out accuracy or threshold calibration.

| Result | Laya original / compact | MiniCheck original / compact |
| --- | --- | --- |
| Scored | 20 / 20 in both | 20 / 20 in both |
| Matches expected label | 17 in both | 18 in both |
| False support among 13 unsupported claims | **3 in both** | 0 in both |
| False rejection among 7 supported claims | 0 in both | **2 in both** |
| Unscored / truncated | 0 in both | 0 in both |

This table is a failure breakdown, not evidence of a production winner. Laya's
better recall comes with false acceptance; MiniCheck wrongly blocks correct GQA
and boolean-mask explanations. Neither result justifies an uncalibrated sole
checker. [MiniCheck measurement details](grounding-classifier-development-2026-10-08.md).

### Laya failures

1. **Universal head-count requirement:** accepts “Every Transformer model must
   use eight attention heads” from a passage about one paper's configuration.
   Support score **0.6198** in both layouts.
2. **Contradictory GQA divisibility:** accepts the claim that query heads must
   **not** be divisible by key/value heads. Scores **0.9715 / 0.9674**. The
   original correct claim scores 0.9592, so simply increasing the cutoff cannot
   preserve that correct example while rejecting the higher-scoring contradiction.
3. **Reversed boolean-mask meaning:** accepts “True marks values to be masked
   out in scaled_dot_product_attention.” Scores **0.9692 / 0.9152**, despite the
   excerpt explicitly saying True participates in this API.

The conditional extrapolation motivation and rejection of its universal guarantee
passed in both layouts. This narrow success does not establish general uncertainty
handling. Whitespace compaction did not change the three failures. No threshold,
model prompt or label was tuned to make these failures disappear.

### Local execution and timings

The health endpoint confirms **MPS**, only English loaded, the pinned revision,
and zero CPU fallbacks. Original first score: **4.259s**; subsequent score samples
**0.091–0.530s**, median **0.146s**. Compact first score: **1.416s**; subsequent
samples **0.093–0.175s**, median **0.114s**. Model loading happened before these
HTTP timings and is not included. Warm-up differs; these numbers do not prove a
layout speed improvement or the app's 10–15-second first verified answer target.
Both runs reported 0 generated output tokens; no paid Jev requests were made.

The package warned at startup that its 11-or-more-choice temperature was outside
its accepted range and was clamped. This comparison uses two choices; confidence
remains uncalibrated on this app regardless. Vendor speed/benchmark claims are
not substituted for these local results.

## Checks and artifacts

Two replacement external-model HTTP tests cover confidence versus support score
and rejection of truncated results. Missing adapter and missing truncation guard
were observed failing before implementation. **240 backend tests pass**, two
existing dependency warnings. The exact uv command failed on sandbox cache access;
`backend/.venv/bin/python -m pytest backend/tests -q` ran the equivalent full suite.
Both provider dry runs validate all 20 cases. `git diff --check` passes.

Ignored reports: `grounding-laya-original.json`, `grounding-laya-compact.json`,
plus the retained MiniCheck and Jev setup artifacts. Dependencies/weights remain
outside production backend locks. The temporary Laya server is stopped after
measurement; restart instructions are in the [evaluation README](../../backend/evaluation/README.md#claim-support-comparison-development-only).

## Current decision and next gate

Laya is the user-selected open-source **comparison and future routing candidate**.
This unit does not enable it as a live support gate given the measured false
acceptances. Add independent partial-support, scope, negation, numerical and
adversarial cases; evaluate routing separately from grounding and calibrate only
on a designated calibration split before testing held-out examples. A concrete
support policy, bounded correction behavior, hosted deployment and full-answer
latency/cost still require acceptance.

The assistant's existing production citation/ownership/version checks and complete
JSON response are unchanged. Native/iOS and its tracker untouched. No personal
library change, migration, unrestricted worker, commit or push. #25/#27 remain
open for broader gates; the TypeSafe-key question is superseded.

GitHub progress synchronized to [#25](https://github.com/CloudKai/secondBrain/issues/25#issuecomment-6051693286)
and [#27](https://github.com/CloudKai/secondBrain/issues/27#issuecomment-6051693505).
