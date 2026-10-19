# Development assistant evaluation

This tooling collects real authenticated answers with the actual retrieved
passages, then scores them locally using optional DeepEval. It does not run inside
application routes. Results contain source text and stay in ignored
`output/evaluation/`.

## Collect

1. Use a dedicated acceptance library with fresh public sources and ready notes.
2. Add its learner session token as `EVAL_SESSION_TOKEN` in ignored `backend/.env`.
   Never use a service-role key as the learner session.
3. Create a manifest from `manifest.example.json` under `output/evaluation/`.
   Independently review the expected answer and exact supporting spans. Record
   the SHA-256 of UTF-8 captured text, original source version and explicit scope.
   Set `reviewed` only after checking the capture; unreviewed cases are rejected.
   For multi-source cases, add `evidence_sources` with each independently reviewed
   source's ID, version and capture SHA-256. The evaluator checks these against
   the complete authenticated selected-scope inventory before generation. A
   retrieval miss then records zero hits rather than an annotation error.
4. Run from the repository root:

```bash
PYTHONPATH=. uv run --project backend --extra dev python -m backend.evaluation.collect \
  --manifest output/evaluation/manifest.json \
  --output output/evaluation/collected.json --retrieval configured --limit 1
```

Ownership, selected scope and source versions use the production store boundary.
Collection and the HTTP assistant share the same answer pipeline. `configured`
uses the application's feature flag; `legacy` and `hybrid` allow explicit paired
replays and are recorded in every successful result. These development switches
are not part of the public assistant request contract.
Successful reports also export `claim_evidence_pairs`: each original claim with
only its own cited passages, source versions and capture hashes. Retrieved but
uncited passages never become evidence for a claim-support check.
Context is revalidated before a result is saved. Failures are reported as safe
categories and never scored as successful answers. Provider generation token
usage/cost is currently unavailable and recorded as null.

## Score

Select the judge explicitly and keep the first run small:

```bash
PYTHONPATH=. uv run --project backend --extra eval python -m backend.evaluation.score \
  --report output/evaluation/collected.json \
  --output output/evaluation/scores.json \
  --judge-model gpt-4o-mini --max-cost-usd 1 --limit 1
```

DeepEval is optional and locked to 4.2.8. Telemetry is disabled; these scripts do
not publish to Confident AI. Judge execution is limited to 12 calls, 1,000 output
tokens per call, no automatic retries and conservative cost reservations using
SDK token prices. Semantic scoring is score-only until thresholds are calibrated.
Incomplete, failed, unsupported or invalid-location cases are excluded from
semantic totals, with a recorded reason. Abstention cases use explicit status
checks. Keep a manual review of contradictory judge explanations.

The first fresh-PDF result and remaining coverage are in
[the report](../../docs/reviews/assistant-baseline-2026-10-07.md). A single sample
cannot establish overall accuracy, production cost or the 10–15-second verified
streaming target. Current responses are non-streaming; that metric stays null.


The [passage-selection replay](../../docs/reviews/passage-selection-acceptance-2026-10-08.md)
uses the same nine annotations after the local fix. This is a development
regression set used during tuning, not held-out quality measurement.

## Claim support comparison (development only)

The [20 reviewed claims](../../docs/evaluation/grounding-claims.json) retain public
source URLs, capture hashes, original offsets and pages/cue times. Seven are
supported, six contradicted and seven not addressed, including an uncertainty
overclaim. They share seven excerpt groups and are a development regression set,
not independent held-out evidence or calibrated thresholds. Both classifiers
receive identical excerpt/claim strings; binary rejection combines contradiction
and missing evidence. Expected labels/rationales are never sent to providers.

Validate without network or model loading:

```bash
PYTHONPATH=. backend/.venv/bin/python -m backend.evaluation.grounding_compare --provider laya --dry-run
```

Laya replaces Jev as the active local comparison candidate; no TypeSafe key is
needed. Install the pinned open-source package in the isolated runtime used below:

```bash
/tmp/secondbrain-grounding-venv/bin/python -m pip install --no-deps \
  'git+https://github.com/NandhaKishorM/laya.git@3cf26cbcb18725dbc2d127bb8bb2c4c43243ae63'
/tmp/secondbrain-grounding-venv/bin/python -m pip install 'fastapi>=0.115,<1' 'uvicorn>=0.34,<1'
LAYA_HOST=127.0.0.1 LAYA_PORT=8767 LAYA_MODELS=english LAYA_PRELOAD=1 \
  LAYA_REVISION=55cf4c4ebb4ebe31b2550e8bdf3bd21b99753851 LAYA_JEV_STRICT=0 \
  HF_HOME=/tmp/secondbrain-laya-hf-home HF_HUB_DISABLE_TELEMETRY=1 \
  /tmp/secondbrain-grounding-venv/bin/python -m laya.serve
```

After the loopback-only server reports ready, in another terminal:

```bash
PYTHONPATH=. backend/.venv/bin/python -m backend.evaluation.grounding_compare \
  --provider laya --output output/evaluation/grounding-laya.json --limit 20
```

The HTTP adapter requires the expected English model route and loaded revision,
uses one binary Choice per claim, caps runs at 20 calls with 20-second timeouts
and no retry, and distinguishes support probability from answer confidence.
Truncated state/questions, collapsed options, malformed responses and outages
are unscored errors, never supported or unsupported verdicts. Keep strict Jev
compatibility mode disabled because it hides required truncation metadata.
There is no paid classification API; local/server hosting cost is not measured.
Stop the temporary server with Ctrl+C when the comparison finishes.

MiniCheck is optional and must remain in an isolated environment. Its source is
pinned and the loaded FT5 model revision is checked; it never selects the default
Bespoke model. Initial weights require approximately 3.13 GB. Example setup:

```bash
python -m venv /tmp/secondbrain-grounding-venv
/tmp/secondbrain-grounding-venv/bin/python -m pip install \
  'torch==2.8.0' 'transformers==4.52.4' 'accelerate==1.7.0' \
  'sentencepiece==0.2.0' 'nltk==3.9.1' 'httpx==0.28.1' \
  'pydantic>=2.10,<3' 'python-dotenv>=1,<2'
/tmp/secondbrain-grounding-venv/bin/python -m pip install --no-deps \
  'git+https://github.com/Liyan06/MiniCheck.git@b58b9fa69acbd1015ec970fa65dd752413a053d2'
mkdir -p /tmp/secondbrain-grounding-nltk
/tmp/secondbrain-grounding-venv/bin/python -c "import nltk; nltk.download('punkt', download_dir='/tmp/secondbrain-grounding-nltk', raise_on_error=True); nltk.download('punkt_tab', download_dir='/tmp/secondbrain-grounding-nltk', raise_on_error=True)"
NLTK_DATA=/tmp/secondbrain-grounding-nltk HF_HOME=/tmp/secondbrain-grounding-hf-home \
  HF_HUB_DISABLE_TELEMETRY=1 PYTHONPATH=. \
  /tmp/secondbrain-grounding-venv/bin/python -m backend.evaluation.grounding_compare \
  --provider minicheck --allow-model-download \
  --output output/evaluation/grounding-minicheck.json --limit 20
```

CPU/device selection follows the upstream package; no speed guarantee is claimed.
The runner records loaded device, runtime versions, model revision, setup time and
individual score times. It rejects inputs exceeding the FT5 token bound rather
than silently scoring truncated text. Local inference is synchronous and has no
hard per-call CPU timeout: run this standalone CLI, never inside the app. Compare
false support, false rejection and unscored cases separately. No averaged result
should hide failures. MiniCheck's default `>0.5` cutoff and Laya's selected Choice
are exploratory decisions, not production thresholds. Hosting cost and full
answer/streaming latency are not measured by this claim-level runner.

See [Laya primary-source research](../../docs/research/laya-classifier-2026-10-08.md)
and [MiniCheck research](../../docs/research/grounding-classifier-comparison-2026-10-08.md)
for contracts, license distinctions, source pins and limitations. Neither adapter
is imported by production routes, and no automatic answer checking is enabled.

Use `--evidence-layout compact` for an explicitly recorded paired whitespace
probe; it only normalizes whitespace, never changes stored evidence or labels.
Compare both candidates with the same layout. Results record the exact classifier
document string. Exit 2 indicates setup failure; exit 3 means at least one case
was unscored. Valid but incorrect predictions are measured results, not runtime
errors. Partial runs record requested and unattempted counts explicitly.

## Actual answers and conservative sentence checks

The [additional 21 answer blocks](../../docs/evaluation/grounding-actual-claims.json)
come from the retained nine-question and eleven-question app runs. They preserve
original claim text, report hashes, claim indices, citation IDs and exact capture
locations. Developer review labels 17 supported and four not addressed under a
conservative all-factual-parts policy. These judgments require independent review;
they are not imported from the app's `supported` status or a classifier verdict.
Together with the original 20 cases, this is 41 development examples on the same
three public captures, with overlapping facts. It is not a held-out set or training
corpus. Split future independent evaluation by source/topic, not random sentences.

Export future reports as **unreviewed drafts** without making model calls:

```bash
PYTHONPATH=. backend/.venv/bin/python -m backend.evaluation.prepare_grounding \
  --report output/evaluation/broader-fixed-hybrid.json \
  --report output/evaluation/generation-fixed-nine.json \
  --captures output/evaluation/multisource-captures.json \
  --output output/evaluation/actual-claims-draft.json
```

The exporter revalidates answer schemas, source versions and every exact passage,
page and cue time against supplied captures. It cannot authenticate historical
files or prove their authorship; report hashes identify the reviewed artifacts.
Failures stop export. Drafts lack labels and cannot enter classifier totals.
Review the claim against its own evidence, add a rationale/label, then set
`reviewed: true`. Keep private captures/drafts out of Git; the committed examples
use only the dedicated public-source acceptance library.

Use `--claim-layout sentences` to compare exact sentence groups with the default
`whole` block. Pronoun/dependent sentences remain with the preceding group;
abbreviations, decimal points and inline code do not create extra boundaries.
This is a conservative English heuristic, not semantic atomization. Each group
receives the parent claim's citations unchanged; sentence-specific attribution
is not inferred. Parent labels are never copied to the individual groups.

A block passes only if **every** group passes. One failed/truncated check makes
the block unscored. Child support scores are retained individually; no aggregate
probability is invented. The runner preflights a maximum of 20 classifier calls
including all groups, with no automatic retries. Reduce `--limit` when necessary
and use `--offset` for subsequent batches.

For the actual-answer set, run offsets/limits **0/10** and **10/11** in each layout
with each provider. The first batch has 13 sentence groups; the second has 12:

```bash
PYTHONPATH=. /tmp/secondbrain-grounding-venv/bin/python \
  -m backend.evaluation.grounding_compare --provider laya \
  --dataset docs/evaluation/grounding-actual-claims.json \
  --claim-layout sentences --evidence-layout compact --laya-max-tokens 1024 \
  --offset 0 --limit 10 --output output/evaluation/prepared-laya-sentences-0.json
```

Laya defaults to its checkpoint's 512-token budget. The explicit **1024** option
is a development coverage probe: the pinned ModernBERT encoder has an 8192-position
configuration and upstream permits a per-request budget override, but the Laya
checkpoint declares 512. Longer inputs therefore need separate quality acceptance;
encoder capacity does not establish classifier accuracy. Input byte, timeout,
call and truncation guards still apply. Reports record the chosen token budget.
Both candidates receive identical complete compact evidence and claim groups;
their architectures/token budgets differ and are not normalized into one score.

Run the large local models sequentially on memory-limited machines. A concurrent
Laya/MiniCheck setup caused upstream MiniCheck automatic device placement to request
disk offloading and fail; stopping Laya allowed the pinned MiniCheck run. No runtime
failure is counted as a negative label. Dependencies and weights remain isolated.

[Preparation acceptance and comparison](../../docs/reviews/claim-evidence-preparation-2026-10-08.md).

## Concise generation regressions

[Current implementation review](../../docs/reviews/claim-generation-review-2026-10-08.md)
records retained schema/formatting failures and unresolved semantic extensions.
The private provider draft caps claims at 600 characters and declares cross-source
comparisons; public answers keep their prior shape. Literal uncertainty hints are
mechanical source matches, not support verdicts. Review each claim against only
its own exported evidence, including which proposition each qualifier modifies.

With the dedicated acceptance session configured, replay the pinned manifest:

```bash
PYTHONPATH=. backend/.venv/bin/python -m backend.evaluation.collect \
  --manifest output/evaluation/claim-generation-manifest.json \
  --output output/evaluation/claim-generation-reproduced.json --retrieval hybrid --limit 8
```

This makes eight bounded generation requests plus retrieval/embedding requests;
it does not launch a worker or change saved notes. Preserve every failed round.
Reused regression questions are not held-out accuracy. Do not mark all claims
supported solely because response status and citation locations pass. Independent
review and new source/topic groups are required before classifier calibration.
