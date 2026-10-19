# Claim/evidence preparation — development acceptance, 2026-10-08

## What changed

The user approved improving preparation and expanding actual-answer examples
before training either Laya or MiniCheck. This unit changes development evaluation
only. No live checker, model fine-tuning, migration or source reprocessing occurs.

- Collection exports each original claim with only its own cited passages, source
  versions, capture hashes and untouched page/cue locations. Other retrieved or
  cited-by-another-claim material cannot silently support it.
- An offline exporter revalidates actual answer schemas and exact captured spans,
  then produces unreviewed drafts. Labels/review are required before scoring.
- Optional conservative English sentence grouping preserves original character
  spans, qualifiers and code. Dependent sentences retain their antecedent. All
  groups must pass; any incomplete check makes the entire block unscored. Child
  probabilities are retained separately, without a fabricated parent probability.
- Runs preflight at most 20 classifier calls, counting sentence groups. Explicit
  offsets support larger datasets in bounded batches; no automatic retries.

## Dataset and review limits

Added [21 original app blocks](../evaluation/grounding-actual-claims.json) from the
retained 11-question and nine-question runs, with 25 conservative sentence groups.
Three abstentions contribute no factual claims. There are **17 developer-labelled
supported and four not-addressed blocks**, with individual rationales. Original
text, report SHA-256, claim index, reference IDs, source URL/capture hash, character
offsets and physical PDF page or caption times are retained and revalidated.

The four not-addressed labels apply a conservative all-parts/uncertainty policy:
conditional positional extrapolation is asserted as a capability; a small-gradient
motivation is extended to effective learning; the paper's suspected explanation
loses its qualifier; and a video-only citation asserts agreement with the paper.
These are developer judgments, **not independently adjudicated ground truth**.
In particular, whether an attribution adequately conveys uncertainty and whether
an explanatory inference is acceptable require a second reviewer before calibration
or training. Supported paraphrases also require that independent review.

Together with the unchanged 20 controlled cases, this is **41 development
examples**. They reuse the same three public captures and overlapping concepts;
the question groups are not independent source/topic groups. No pooled accuracy,
held-out result, production threshold or training readiness is claimed. The
earlier app `supported` status and retrieval span hit rate are not semantic labels.
An exporter file hash identifies an artifact; it cannot authenticate its origin.

## Paired measurements on the 21 new blocks

Both providers received identical complete compact excerpts for each claim, with
the original claim versus the exact conservative sentence groups. Labels were
written before these measurements. Offsets/limits 0/10 and 10/11 keep every run
below 20 model calls (13 and 12 in sentence mode).

| Candidate / preparation | Scored | Matches developer labels | False support / 4 | False rejection / 17 | Unscored |
| --- | ---: | ---: | ---: | ---: | ---: |
| Laya 1024, whole block | 21 | 18 | 3 | 0 | 0 |
| Laya 1024, sentence groups | 21 | 18 | 3 | 0 | 0 |
| MiniCheck FT5, whole block | 21 | 15 | 1 | 5 | 0 |
| MiniCheck FT5, sentence groups | 21 | 15 | 1 | 5 | 0 |

**No measured accuracy gain from sentence grouping on this sample.** Most blocks
stay together to preserve pronoun/reasoning context, and the unsupported clause
can remain inside one sentence. Sentence grouping is not semantic atomization.
Both models accept the conditional extrapolation overclaim. Laya additionally
accepts the effective-learning extension and the loss of the paper's qualifier.
MiniCheck rejects supported GQA explanations (two blocks), the explicit parallel
heads video cue, the evaluation-dropout explanation and the context-cost explanation.
The common extrapolation error scores 0.8368 in whole Laya and 0.9703 in whole
MiniCheck, illustrating why an uncalibrated high score is insufficient.

This is a failure analysis under the stated review policy, not a model ranking.
Neither candidate is enabled in the assistant. The original 20-case measurements
remain separate; their Laya token setting and dataset differ from this probe.

### Coverage and local runtime

The initial Laya **512-token** first batch scored 8/10 and correctly left two
truncated cases unscored. That artifact is retained. Upstream pinned source permits
a per-request budget override; its loaded ModernBERT encoder configuration has
8192 positions while the Laya checkpoint declares 512. Added an explicit bounded
**1024-token development probe**, keeping 512 as the default and recording the
setting in each report. It supplies complete evidence in this set, but longer
inputs require their own quality acceptance. No excerpt was cut to obtain a verdict.

MiniCheck's first setup failed because upstream automatic device placement wanted
disk offloading while Laya was loaded. The failure is retained with zero scored
cases. Stopping Laya allowed all four MiniCheck batches to complete. Models ran
sequentially in the existing isolated runtime; production dependency locks did
not change. No paid generation/judge requests were made in this unit.

Laya whole/group median per-check samples: **0.247s / 0.244s**; MiniCheck:
**0.311s / 0.284s**. Whole blocks require 21 calls versus 25 group calls across
two batches. MiniCheck per-batch model setup takes **7.54–9.95s**. Laya startup
precedes its health/check timings. These are local warm/setup samples, not hosted
latency percentiles or the app's first-verified-streaming metric. Hosting cost is
unmeasured; no classifier threshold was calibrated.

## Acceptance and artifacts

- **248 backend tests pass**, two existing dependency warnings. New/extended
  tests use the agreed authenticated collection, external model HTTP and exact
  citation boundaries: pair provenance, exclusion of uncited retrieval, preserved
  sentence qualifiers/antecedents/code, all-groups acceptance, incomplete results
  and bounded explicit Laya input settings. Missing export/checker/setting support
  failed before their implementations.
- The exact uv test command was attempted and failed on sandbox cache access;
  `backend/.venv/bin/python -m pytest backend/tests -q` completed the full suite.
- Offline export reproduces all 21 original claims/evidence/provenance; drafts
  are rejected by the reviewed dataset schema. Both datasets validate; sentence
  batches preflight 13/12 calls. Original 20-case dry run still validates.
- No web/mobile code or native progress tracker changes in this unit. No personal
  library writes, migration, unrestricted worker, commit or push. The temporary
  Laya server is stopped; MiniCheck inference processes exited.

Ignored artifacts: `actual-claims-draft.json`,
`prepared-{laya,minicheck}-{whole,sentences}-{0,10}.json`,
`prepared-laya-whole-0-512.json`, and
`prepared-minicheck-whole-0-memory-failure.json` under `output/evaluation/`.
Reproduction and review instructions: [evaluation README](../../backend/evaluation/README.md#actual-answers-and-conservative-sentence-checks).

## Next target gate

Independently adjudicate the conservative labels and collect unseen source/topic
groups, including partial support, negation, numerical constraints and prompt
injection. Separate calibration and final evaluation; evaluate routing separately.
Only consider fine-tuning with enough reviewed independent examples and a measured
regression benefit. Live policy, bounded correction, hosted cost/latency, ambiguous
follow-ups, 200-source capacity and verified streaming remain planned under #25/#27.

GitHub progress synchronized to [#25](https://github.com/CloudKai/secondBrain/issues/25#issuecomment-6051994574)
and [#27](https://github.com/CloudKai/secondBrain/issues/27#issuecomment-6051994804); both remain open.
