# Broader assistant evaluation — 2026-10-08

**Follow-up:** the two failures below were subsequently fixed and replayed. See
[generation reliability acceptance](generation-reliability-acceptance-2026-10-08.md).
This report preserves the original failed observations.

## Unit and method

Eleven newly annotated questions ran against the retained fresh public PDF,
PyTorch article and creator-caption video library. The questions were authored
and their exact evidence spans frozen after the passage-selection fix; they were
not used to adjust its ranking. This is new-question coverage on the same three
sources, not an independently curated benchmark or new-source generalization.
No application code, model, prompt or ranking configuration changed in this unit.

Only the three named acceptance topic jobs were processed. PDF and article maps
succeeded and share the confirmed Scaled Dot-Product Attention topic. The video
map failed structured-output validation twice, including one bounded retry; it
remains queued with `invalid_output`, two attempts recorded. No unrestricted
study/topic dispatcher was started and no more retries were performed.

## Observed questions

| Question | Scope | Exact expected evidence found | Answer status |
| --- | --- | --- | --- |
| Benefit of multiple representation subspaces | PDF note | Yes | Supported, expected |
| This paper's reported head count | PDF note | Yes | Supported, expected |
| Token order without recurrence/convolution | PDF note | Yes | Supported, expected |
| “Why are they necessary?” after positional-encoding question | PDF note + history | Yes | Supported, expected |
| GQA head-count constraints | Article note | Yes | Supported, expected |
| Find GQA head-count requirements from PDF's shared topic | Topic | **Yes** | **Unsupported, incorrect** |
| GQA requirements with only positional-encoding topic | Narrow topic | Not annotated: deliberately unavailable | Unsupported, expected |
| Same narrow topic plus explicit library scope | Topic + library | Yes | Supported, expected |
| Sequential versus parallel attention heads | Video note | Yes | Supported, expected |
| Preventing later tokens influencing earlier ones | Video note | Yes | Supported, expected |
| “How is True handled here?” after boolean-mask question | Article note + history | Yes | Supported, expected |

All ten annotated supporting spans reached the model. Ten of eleven answers
returned the expected status. Every emitted citation had exact original text,
source version and page/cue coordinates. The narrow topic's selected context
contained only the current PDF, so its abstention did not leak the article.
Individual completion times were 2.79–6.85 seconds. No streaming or generation
cost measurements were added.

### Repeatable false abstention

The shared-topic GQA question returned an evidence gap although the retrieved
article contains both the GQA heading and its two explicit head-count equations.
Repeating that one question once, without any changes, produced the same gap
again (4.16 seconds). This is an answer-generation/answerability failure, rather
than a missing source or failed index. The original failure remains in the
report; the repeat does not replace it or count as a separate baseline pass.

Both article-note and topic-plus-library formulations answered those constraints
correctly. Different question wording/context can change the outcome. The small
set does not isolate whether topic labels, wording or other context is causal.

### Remaining semantic risk

The positional follow-up answered its main question correctly, but its extra
claim describes extrapolation to longer sequences more confidently than the
paper's conditional motivation. Exact citations and span recall do not establish
claim support or preservation of uncertainty. The earlier DeepEval high-score
mismatch remains relevant; no semantic judge was rerun in this unit.

Two clear follow-ups worked in these samples. Retrieval still embeds the latest
question directly; it does not implement explicit conversation-reference
resolution or ambiguous-reference clarification. These results do not establish
that the planned follow-up router is implemented.

## Real API boundary checks

The localhost assistant using hosted storage returned:

- Missing learner session: **401**.
- Source owned by another acceptance learner: **404**.
- Unavailable current source version: **404**.
- Unconfirmed topic UUID: **404**.
- Narrow-topic selected context: current PDF only.

The unavailable-version check does not replace the earlier deterministic tests
that change a revision during generation; those remain historical acceptance.

## Artifacts and reproduction

Ignored `output/evaluation/` contains `broader-manifest.json`,
`broader-hybrid.json`, `broader-topic-replication.json`,
`broader-scope-checks.json` and `topic-evaluation-library.json`. Raw captured
sources and learner credentials remain in the dedicated acceptance library and
private local files; no personal library was changed.

With that learner's current session set privately as `EVAL_SESSION_TOKEN`:

```bash
PYTHONPATH=. backend/.venv/bin/python -m backend.evaluation.collect --manifest output/evaluation/broader-manifest.json --output output/evaluation/broader-hybrid.json --retrieval hybrid --limit 11
```

No implementation or automated test code changed, so the preceding **237 passing
backend tests** are a historical baseline, not a new suite run. Live provider/API
checks above were executed for this unit. `git diff --check` passes.

## Remaining gates and next unit

#25/#27 remain open. Next: address and reproduce the topic false abstention,
then diagnose invalid video topic-map output. Preserve these annotations and
failed runs when developing fixes. Do not treat the 10/11 status result as a
production accuracy estimate or hide the remaining failure with aggregate recall.

Independent-source/held-out coverage, ambiguous follow-ups, 200-source capacity,
ranking/cost calibration, Jev versus specialist grounding-classifier comparison,
and verified-section streaming remain target work. No migration, production
rollout, commit or push occurred. Native/iOS and its tracker are untouched.

GitHub progress synchronized to [#25](https://github.com/CloudKai/secondBrain/issues/25#issuecomment-6043022399)
and [#27](https://github.com/CloudKai/secondBrain/issues/27#issuecomment-6043022812).
