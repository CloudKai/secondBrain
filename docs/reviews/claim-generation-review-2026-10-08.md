# Claim generation — implementation and development review, 2026-10-08

## Verified implementation

This unit improves the saved-source assistant's private generation contract. The
public answer shape remains compatible; existing saved notes are not regenerated.

- New drafts allow at most 600 characters per claim, retaining eight as the upper
  claim count. Instructions ask for only necessary facts, normally two to four
  claims, with named subjects, individual evidence and retained qualifications.
  Length is enforced; semantic independence and support are not established by it.
- Each supplied source has a private label and article/PDF/video kind. Declared
  comparisons require distinct known sources and citations from every declared
  source. The provider schema permits either an empty list or two to nine labels;
  comparisons within one source use the empty list. Unknown/duplicate labels fail.
- Literal `we suspect`, `we hypothesize/hypothesise`, `may`, `might` and `could`
  matches are exposed beside their excerpt as a mechanical reading aid. This is
  not a semantic uncertainty detector. Metadata remains inside the 30,000-character
  context bound; exact excerpts, offsets, pages and caption times are unchanged.
- Private comparison metadata is removed from public claims. Redundant citation
  parentheses are removed only when their source/reference pairs agree with that
  claim's verified citations. Unknown, mismatched or standalone private markers
  fail; source text containing literal labels is preserved. Gap prose also rejects
  private source labels absent from supplied evidence.
- Model, output budget, deadlines and retry count remain `gpt-4o-mini`, 3,500
  output tokens, 60/65-second provider/overall deadlines and no automatic retries.
  No classifier, additional model checker, router or streaming is enabled.

The comparison guard validates **self-declared** comparisons. A model can omit
comparison metadata or misrepresent a cited source; the guard does not identify
all comparisons or prove support. Prompt reminders and literal qualifier matches
also do not guarantee that a qualification applies to the correct proposition.

## Regression loop and retained failures

Tests exercise the agreed authenticated assistant API and external provider HTTP
boundaries. Oversized claims, missing-side comparison evidence, leaked source
labels, missing strict-schema requirements and citation-marker variants failed
before their fixes. Valid comparisons keep both source identities and public
claims expose only `text` and `reference_ids`.

**258 backend tests pass**, with two existing dependency warnings. The prescribed
uv command was attempted earlier in this unit and failed on sandbox cache access;
`backend/.venv/bin/python -m pytest backend/tests -q` ran the complete suite.
`git diff --check` passes.

The first eight live requests all failed because the new field had a default and
was missing from the outgoing schema's required list. One diagnostic confirmed
HTTP 400 naming that field. It was made required, including an explicit empty
list for non-comparisons. This matches the official
[Structured Outputs requirement](https://developers.openai.com/api/docs/guides/structured-outputs#all-fields-must-be-required).
A later one-label model draft exposed a second schema issue; empty-or-two-plus
cardinality now appears in the provider schema, rather than only local validation.

Four eight-case rounds followed the schema fix. They reuse known regression
questions on the same three public captures; this is prompt development, not
held-out accuracy. Initial output filled the eight-claim limit with extra facts,
lost source qualifiers and falsely abstained on GQA. A compact prompt restored
GQA and shortened answers, but leaked citation markers. A final reminder still
produced a one-label draft and source parentheses. Those failures are retained.
A separate two-case probe confirmed the one-label issue before the schema fix.

## Final eight-case round and API check

The final round completed seven of eight requests. All seven statuses matched
their expected supported/unsupported state and all returned citation locations
were exact. The comparison draft failed on `(source1, ref2)` formatting; an API
regression then reproduced that comma variant and the normalizer was fixed.
The subsequent actual authenticated API comparison returned **HTTP 200**, with
an exact PDF page 4 citation and video cues **644.000–653.960 seconds**. Public
claim keys were `reference_ids` and `text`. The earlier eight-case failure remains
in its original artifact; the API check is additional evidence, not a replaced run.

The first API attempt could not connect because the local server was stopped.
After starting the API alone, one request returned 200 but its local verification
script failed on capture-field projection. That request is unscored. The corrected
script saved the next response before checking exact captured evidence. No worker
was started by this unit.

| Case | Final round | Claims | Developer review of own cited passages |
| --- | --- | ---: | --- |
| Clear positional follow-up | Supported | 3 | Separates ordering from the sinusoidal rationale; preserves hypothesis and possible extrapolation. |
| PDF scaling | Supported | 3 | Main explanation retains “authors suspect”; another claim adds “helps maintain performance,” which the cited passage does not directly establish. |
| Paper/video comparison | Formatting error; subsequent API 200 | 2 in API | Each source has its own citation. The API draft still attaches suspicion to counteracting the effect rather than clearly qualifying the entire suspected mechanism, and extends the video's stability rationale to large-value issues. Semantic acceptance is pending. |
| Shared-topic GQA | Supported | 2 | Head-count constraints, experimental status and cited platform limits retained. |
| Video alignment | Supported | 4 | Dot-product alignment and the examples match the cited timed cues; the generic “unrelated words” wording still requires caution beyond the source's particular example. |
| Article mask | Supported | 2 | Opposite boolean meanings and inversion guidance match the documentation. |
| Unsupported library attribution | Unsupported | 0 | Expected abstention. |
| Narrow-topic GQA isolation | Unsupported | 0 | Expected abstention in the topic without that documentation. |

Successful final-round completion samples were **2.73–5.25 seconds**, including
retrieval and generation. They are local measurements on a tiny reused library,
not hosted percentiles, verified streaming latency or a cost ceiling. Streaming
metrics remain null. The temporary audit captured some provider usage, but the
collector's usage/cost fields remain null and no complete per-question cost claim
is made. No paid judge or classifier measurement was added in this unit.

These are conservative developer judgments, not independent semantic labels.
“Supported” status and exact citation locations must not be counted as support
accuracy. No overall semantic accuracy, calibrated classifier or training readiness
is established. **Implementation checks pass; semantic acceptance remains open.**

## Artifacts and reproduction

Ignored `output/evaluation/` artifacts retain:

- `claim-generation-manifest.json` and `claim-generation-expectations.json`, written
  before the requests; reviewed source versions/capture hashes remain pinned.
- `claim-generation-eight-schema-failure.json`,
  `claim-generation-diagnostic.json`,
  `claim-generation-eight-initial-quality-failure.json`,
  `claim-generation-eight-compact-prompt-failure.json`,
  `claim-generation-eight-reminder-failure.json`, and `claim-generation-two.json`.
- `claim-generation-eight.json` (final round), `claim-generation-api-response.json`
  and `claim-generation-api.json` (recorded API check and per-claim exact evidence).

Reproduce using the [collection instructions](../../backend/evaluation/README.md)
with this dedicated public library's learner session and pinned manifest. Temporary
HTTP hooks recorded private drafts/partial usage for diagnosis; they are not
application telemetry. Output artifacts contain source excerpts and remain local.
Existing notes and the personal library were untouched; no migration, background
worker, mobile/native change, native tracker edit, commit or push occurred.
The local FastAPI server remains available for development.

## Next target gate

Before claiming stronger grounding, freeze these drafts as regressions, obtain an
independent review of qualifier attachment and unsupported extensions, and add
unseen source/topic groups. Compare Laya and MiniCheck against those reviewed
claims with only their own cited evidence. Neither current development result
justifies a production checker or fine-tuning. Deterministic checks for unambiguous
numerical/scope conditions can be added separately, without treating keyword
matches as semantic proof. Ambiguous follow-ups, routing, 200-source capacity,
hosted latency/cost and checked streaming remain planned under #25/#27.

GitHub progress synchronized: [#25 update](https://github.com/CloudKai/secondBrain/issues/25#issuecomment-6062135742)
and [#27 update](https://github.com/CloudKai/secondBrain/issues/27#issuecomment-6062136530).
Both issues remain open for the stated acceptance gates.
