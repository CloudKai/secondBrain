# Generation reliability acceptance — 2026-10-08

## Implemented and verified locally

This unit fixes the repeated shared-topic GQA false abstention and the video
canonical-context validation failure recorded in the
[broader evaluation](assistant-broader-evaluation-2026-10-08.md).
It uses the same dedicated three-source acceptance library, frozen evidence
annotations, hosted Supabase/Qdrant and real configured model. Earlier failed
results are retained. No personal library or saved note text was changed.

### Line-wrapped equations and false abstention

The original failure reproduced with both head-count equations present in model
context. Controlled model-boundary probes removed the PDF, compacted equation
whitespace, or changed the topic label. Article-only and compacted-equation probes
answered; relabeling alone did not. These observations support a layout/context
sensitivity diagnosis, not a universal causal claim about the model.

Prompt guidance alone passed a direct probe but still abstained in the full
pipeline. The implemented payload now includes `reading_text` for multiline
excerpts: a mechanical whitespace-normalized copy. The original `excerpt`,
reference IDs, offsets, pages and caption times remain authoritative and unchanged.
The prompt explains this rendering and requires reviewing all eligible sources.
Both fields count toward the existing 30,000-character serialized context limit.
There is no extra assistant generation call or new semantic checking service.

The public API/model-HTTP regression failed before the payload change and passes
now: it checks the independent expected equation rendering and unchanged returned
citation. A focused full-pipeline replay passed in 6.29 seconds. A subsequent real
local API request returned **200 / supported**, with exact original article text
and version attribution, in **7.06 seconds**.

### Reusing canonical topic context

The video draft repeatedly replaced an owned catalog topic's stored context with
a new explanation. Strict equality correctly rejected it. The repair payload now
supplies exact context requirements copied from the owned selected catalog, and
the structured-output field descriptions explicitly require copying the chosen
entry's context when reusing its ID. The existing two-call repair bound, deadline,
UUID/context/evidence/relation validators remain in force.

Targeted repair feedback alone, then repair-wrapper instructions alone, still
failed live non-persisting probes. With the explicit field descriptions, the
original video replay succeeded on its first model call. These probes did not
consume persisted worker attempts. The final **named video job succeeded at
persisted attempt 3 of 3**; PDF/article maps stayed succeeded. All saved video topic
citation IDs resolve to exact original note excerpts, and reused contexts match
the current owned catalog. The common Scaled Dot-Product Attention topic now has
all three acceptance sources. No unrestricted study/topic dispatcher was started.
The external-model regression requires the exact owned repair requirements and
continues to reject an uncorrected mismatch after two calls.

## Checks and measured results

| Check | Observed result |
| --- | --- |
| Full backend suite | **238 passed**, two existing dependency warnings |
| Frozen broader question replay | **11/11** expected statuses; all ten annotated spans found; all citation locations valid |
| Prior question regression replay | **9/9** expected statuses; all seven annotated spans found; all citation locations valid |
| Broader complete-response samples | 3.52–6.32 seconds |
| Prior complete-response samples | 3.74–6.12 seconds |
| Actual authenticated API | Shared-topic GQA supported; exact original citation text/version |
| Saved video topic map | Succeeded, attempt 3; contexts and evidence references valid |
| Whitespace check | `git diff --check` passes |

The repository's uv command was blocked by sandbox access to its global cache;
the existing environment ran the equivalent full suite:

```bash
backend/.venv/bin/python -m pytest backend/tests -q
```

No frontend code changed in this unit; frontend checks were not rerun. Native/iOS
and its progress tracker remain untouched. No migration, production rollout,
commit or push occurred.

## Artifacts and reproduction

Ignored `output/evaluation/` retains `false-abstention-diagnosis.json`,
`false-abstention-fixed-replay.json`, the `video-topic-diagnosis*.json` probes,
`broader-fixed-hybrid.json`, `generation-fixed-nine.json`,
`generation-fixed-api.json` and the saved `topic-evaluation-library.json`.
Diagnostic adapter probes are not scored evaluation runs. Request/response bodies
contain source data but no HTTP authorization headers. Learner credentials remain
in private local files outside tracked source.

With this acceptance learner's current session supplied privately as
`EVAL_SESSION_TOKEN`, replay the frozen broader manifest without overwriting the
historical failure:

```bash
PYTHONPATH=. backend/.venv/bin/python -m backend.evaluation.collect --manifest output/evaluation/broader-manifest.json --output output/evaluation/broader-fixed-replay.json --retrieval hybrid --limit 11
```

## Remaining target behavior

These are development regressions on three sources, not held-out benchmark,
accuracy percentage, latency percentiles or evidence of capacity for 200 sources.
Model nondeterminism can still produce failures. Adding the reading rendering
uses more context budget and may exclude later evidence in larger captures; the
existing partial flag and bounds remain.

Exact citation integrity does not establish semantic claim support. Manual review
still finds an overconfident extrapolation implication in the positional follow-up.
Jev versus a specialist grounding-classifier comparison remains the next planned
unit, with explicit claim-level annotations and uncertainty checks. Independent
sources, ambiguous follow-up resolution, ranking/cost calibration, hosted worker
rollout, capacity and verified-section streaming remain unverified. #25/#27 stay
open for these gates.

GitHub progress synchronized to [#25](https://github.com/CloudKai/secondBrain/issues/25#issuecomment-6043601298)
and [#27](https://github.com/CloudKai/secondBrain/issues/27#issuecomment-6043601728).
