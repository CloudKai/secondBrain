# Claim support classifier development comparison — 2026-10-08

**Superseded candidate:** the learner replaced Jev with Laya; its key request is
cancelled. See [Laya comparison](laya-classifier-development-2026-10-08.md).
This report retains the earlier MiniCheck measurements and Jev setup status.

## Current result

**MiniCheck measured; Jev pending credentials. No winner selected or live answer
checker enabled.** The development runner and dataset are implemented; actual
Jev-versus-MiniCheck comparison remains incomplete.

The primary-source [research](../research/grounding-classifier-comparison-2026-10-08.md)
verifies Jev's direct HTTP contract and MiniCheck FT5's code/model identity. The
[evaluation instructions](../../backend/evaluation/README.md#claim-support-comparison-development-only)
include isolated setup and reproducible commands. No TinyFish was used.

## Dataset and method

Twenty manually reviewed single-claim/excerpt pairs use the retained public
Transformer PDF, PyTorch documentation and creator-caption video captures.
The tracked [dataset](../evaluation/grounding-claims.json) records URLs, SHA-256
capture fingerprints, original offsets and physical pages/real cue times. Every
excerpt was checked against the captured text. Labels apply only to the supplied
excerpt: **7 supported, 6 contradicted, 7 not addressed**, over seven groups.
Contradicted and not-addressed both map to binary rejection for this comparison.
Expected labels/rationales are never sent to either model.

Cases test numerical head counts, absence of recurrence, GQA equations, opposite
boolean-mask meanings, parallel heads, causal masking, and preserving the paper's
conditional extrapolation motivation. The set is authored by the developer on
known failure domains; it is neither independently labeled nor held out. It does
not cover adversarial instructions, broad multi-document reasoning or private
learners' sources. No production threshold can be calibrated on these 20 cases.

### Runtime failure retained

The first MiniCheck run loaded the checkpoint but recorded LookupError on all
20 cases because the NLTK runtime lacked `punkt_tab`. Those cases are **unscored**,
not incorrect unsupported predictions or passes. Preparing `punkt` and
`punkt_tab` in a temporary tokenizer cache allowed the unchanged replay to score.
The upstream import initially downloaded `punkt` into its default user NLTK data
cache; subsequent execution uses an explicit temporary cache. No application or
system package installation was changed.

### Successful MiniCheck measurements

Source revision: `b58b9fa69acbd1015ec970fa65dd752413a053d2`.
Checkpoint: `lytang/MiniCheck-Flan-T5-Large`, loaded revision
`96eafd01cee2d16cf81aaa2fb226b14f422a37b3`. Model identity is checked before scoring;
inputs over its 2048-token bound are rejected rather than silently truncated.
The optional isolated runtime selected **mps:0** on this Mac. Reported versions:
torch 2.8.0, transformers 4.52.4, accelerate 1.7.0, sentencepiece 0.2.0,
numpy 2.5.3. These are local measurements, not hosted worker/container acceptance.

| Measurement | Original whitespace | Compacted whitespace |
| --- | --- | --- |
| Scored / requested | 20 / 20 | 20 / 20 |
| Matches expected binary label | 18 | 18 |
| Incorrectly accepts unsupported claim | 0 of 13 | 0 of 13 |
| Incorrectly rejects supported claim | **2 of 7** | **2 of 7** |
| Unscored errors | 0 | 0 |
| Model setup, excluding initial download | 11.87 s | 11.47 s |
| First scored claim | 5.666 s | 0.709 s |
| Subsequent score samples | 0.099–0.657 s | 0.100–0.173 s |

The first asset-load attempt took 106.40 seconds including download. The paired
probe mechanically compacted whitespace without changing words, equations,
labels or original citation data. Scores for the two failures were unchanged;
there is no evidence that layout normalization fixes these classifier mistakes.
Warm-up and device caches differ between runs, so timing differences do not
establish that compaction improves latency. No full-answer or first-verified-text
latency, cost ceiling or hosted throughput was measured.

### Failures that matter

- **Correct GQA constraints rejected:** support score **0.1971**. The opposing
  incorrect claim scored **0.2098**. Simply lowering the cutoff would accept that
  contradiction before accepting the correct claim; threshold tuning alone
  cannot solve this example.
- **Correct explanation of the two APIs' boolean masks rejected:** **0.0902**.
  This is a supported statement, not an evidence gap.
- **Universal extrapolation guarantee rejected:** **0.0853**. The paired cautious
  “may allow” statement was accepted. This useful regression does not establish
  robustness to every uncertainty overclaim.

The upstream `>0.5` decision is recorded as an exploratory baseline, not an app
release policy. A fast classifier can still wrongly block correct explanations.
These observations do not justify enabling FT5 as the sole evidence gate.

## Jev preparation and missing input

The direct HTTP adapter pins `jev-1.13.0` and asks one binary Choice per claim.
It keeps `probabilities.supported` distinct from top-answer `confidence`, requires
valid normalized scores, bounds requests at 20 per run and 20 seconds per call,
uses no automatic retries, and retains known billed usage for Noul/no-verdict
responses. Such failures are unscored; they never become negative support labels.
Cost reservations are conservative estimates, not a provider billing cap.

The user was asked to add server-only `TYPESAFE_API_KEY` to ignored `backend/.env`.
Current setup reports **setup_required**, 20 requested/unattempted cases and zero
provider requests. No Jev quality, latency, cost, classifier winner or threshold
is claimed. A placeholder is included in `backend/.env.example` for this optional
development tool, not an active application dependency.

## Automated and local checks

- Both provider-boundary regressions were observed failing before implementation:
  missing adapter, then missing accounting for a Noul response.
- HTTP tests distinguish unsupported-answer confidence from support probability
  and retain known usage without treating no-verdict as unsupported.
- **240 backend tests pass**, with two existing dependency warnings. The exact uv
  command was attempted but sandbox cache access failed; the existing backend
  environment ran `backend/.venv/bin/python -m pytest backend/tests -q`.
- Both providers' dry-run paths validate all 20 cases without network/model load.
- `git diff --check` passes. No frontend change/checks in this unit.

Ignored artifacts retain `grounding-minicheck.json` (runtime failure),
`grounding-minicheck-fixed-runtime.json`, `grounding-minicheck-compact.json` and
`grounding-jev-setup-check.json`. Reports record requested, attempted, unscored
and unattempted counts; setup failure exits 2, unscored cases exit 3. Optional
model/cache assets and the isolated runtime remain local for reproducible replay.

## Next gate and target behavior

Run Jev on these same original/compact pairs after its key is available. Review
false support and false rejection separately; keep routing evaluation distinct
from evidence support. Add independently labeled sources, partially supported
and adversarial claims, explicit uncertainty checks and multi-source cases before
calibrating thresholds or choosing a live provider. Hosted latency and a concrete
per-answer budget must be established before deployment.

Bounded claim correction, query routing/ambiguity resolution and verified-section
streaming remain target behavior. The production assistant still returns one
complete answer with its existing deterministic citation/version checks.
#25/#27 remain open. No production adapter import, schema migration, unrestricted
study/topic worker, native/iOS change, commit or push occurred.

GitHub progress synchronized to [#25](https://github.com/CloudKai/secondBrain/issues/25#issuecomment-6051290733)
and [#27](https://github.com/CloudKai/secondBrain/issues/27#issuecomment-6051290929).
