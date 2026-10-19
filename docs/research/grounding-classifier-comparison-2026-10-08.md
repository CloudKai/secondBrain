# Grounding classifier comparison

Research date: 2026-10-08. Primary sources only. This is development research, not production integration or measured Second Brain acceptance. During this research step, no provider calls, model downloads or dependency installations were performed; local measurements are documented separately.

## Verified TypeSafe / Jev contract

The direct vendor endpoint is `POST https://api.typesafe.ai/v1/systemone`, with `Authorization: Bearer <key>` and JSON content. Required fields are `model`, `state` (string/object/array), and named `questions`. Responses contain the resolved `model`, matching `answers`, and `usage.input_tokens` / `usage.output_tokens`. Noul answers contain `type` and `noul`; Choice answers contain `type`, `choice`, `probabilities`, and `confidence`. Validation errors are 422, authentication errors 401, rate limits 429, overload 529. [HTTP reference](https://docs.typesafe.ai/api)

Illustrative binary support request; this wording is an evaluation proposal, not a vendor-approved accuracy guarantee:

```json
{
  "model": "jev-1.13.0",
  "state": {"document": "Supplied evidence", "claim": "One claim"},
  "questions": {
    "support": {
      "type": "choice",
      "instructions": "Does document support all parts of claim using only document?",
      "criteria": {
        "supported": "Document states or directly implies every part of claim",
        "unsupported": "At least one part is contradicted or not supported"
      }
    }
  }
}
```

The Python SDK is `typesafe-sdk`, imported as `typesafe_sdk`; `TypeSafeClient` and `AsyncTypeSafeClient` read `TYPESAFE_API_KEY`. Create a vendor key through the linked TypeSafe console. A direct HTTP harness needs no SDK. [Official SDK quickstart](https://docs.typesafe.ai/sdk/python)

Current pinned identifier is `jev-1.13.0`; `jev-latest` and `jev-preview` currently resolve to it. Price is **$0.042 per million input tokens**, with free output tokens. At that published rate, 1,000 billed input tokens cost $0.000042; actual charges depend on reported usage. Context is 64k total request tokens, with 32k for state plus the longest question. Inputs are text only. Posted limits are 100k tokens/second and 80 requests/second, explicitly subject to change. Log resolved model and usage; pin versions when evaluating thresholds. [Models and pricing](https://docs.typesafe.ai/models)

Choice can select among up to 255 options. Score uses ordered rubric levels; Noul expresses P(yes). These are decision outputs, not generated explanations or evidence citations. [Choice primitive](https://docs.typesafe.ai/primitives/choice), [Noul primitive](https://docs.typesafe.ai/primitives/noul)

### Probability and confidence

Choice confidence is `(p_max - 1/n) / (1 - 1/n)`, where `n` is the number of options. It describes concentration relative to an even distribution, not the support probability. In a binary Choice, a selected unsupported answer can have high confidence. Use `probabilities.supported` for a binary support threshold. Noul has no separate confidence; its optional derived certainty is `abs(2*p - 1)`. Vendor calibration claims do not establish calibration on this application's corpus. Thresholds require empirical tuning. [Confidence semantics and formulas](https://docs.typesafe.ai/confidence)

The official citation cookbook demonstrates checking quote existence deterministically, then asking a three-way supports/contradicts/says-nothing Choice against the relevant section. Its published eight-example results are cached **jev-1.12**, dated 2026-08-16; they are not a benchmark for the current model or this app. [Citation cookbook](https://docs.typesafe.ai/cookbooks/citation_check)

Vendor-documented limitations include distractors in large state, literal reading, numeric/date reasoning, option order effects, and adversarial instructions embedded in state. Filter evidence first and include adversarial cases in evaluation. [Jev 1.13 limitations, reviewed 2026-10-02](https://docs.typesafe.ai/model-jaggedness/jev-1.13)

## Verified MiniCheck contract

MiniCheck is a document-to-claim factual support classifier. The original paper reports MiniCheck-FT5 at 770M parameters and benchmark performance comparable to GPT-4 at lower evaluation cost. Those 2024 benchmark comparisons are not current API pricing, latency measurements or an accuracy result for this app. [MiniCheck paper](https://arxiv.org/abs/2404.10774)

Explicitly select the small model, because the current wrapper defaults to Bespoke 7B:

```python
from minicheck.minicheck import MiniCheck

scorer = MiniCheck(model_name="flan-t5-large", cache_dir="./ckpts")
labels, support_probs, used_chunks, probs_per_chunk = scorer.score(
    docs=[document], claims=[sentence]
)
```

Accepted original model names map to `lytang/MiniCheck-RoBERTa-Large`, `lytang/MiniCheck-DeBERTa-v3-Large`, and `lytang/MiniCheck-Flan-T5-Large`. `Bespoke-MiniCheck-7B` maps to `bespokelabs/Bespoke-MiniCheck-7B`. [Checkpoint mappings in inference source](https://github.com/Liyan06/MiniCheck/blob/main/minicheck/inference.py)

The wrapper returns labels (0 unsupported / 1 supported), maximum support probabilities, used chunks, and per-chunk probabilities. The original models classify support only when probability is **strictly greater than 0.5**. FT5 defaults to maximum input length 2048 and chunk size 500; RoBERTa defaults to 512/400 and DeBERTa to 2048/400. These defaults are configuration, not a recommendation to accept at 0.5 in this app. [Wrapper source](https://github.com/Liyan06/MiniCheck/blob/main/minicheck/minicheck.py)

FT5 chunk size counts whitespace words. Combined document/claim tokenization uses `predict: ` plus document, EOS and claim, with `truncation=True`. It computes support probability by softmax over decoder token logits 3 (unsupported) and 209 (supported), then takes the maximum across document chunks. Multi-sentence claims are not split by the original-model Inferencer; split them before calling. Model loading uses `device_map="auto"`; tensors follow `self.model.device`, rather than hardcoded CUDA. CPU or Apple device performance is unmeasured here. The Bespoke path uses vLLM and remote model code; its current aggregation splits claims, takes the best chunk per sentence, then the weakest sentence score. Record implementation revision to avoid conflating this with FT5 behavior. [Inference implementation](https://github.com/Liyan06/MiniCheck/blob/main/minicheck/inference.py)

Support probabilities are model scores. The inspected sources do not establish calibrated probabilities for this application, and the binary label does not distinguish contradiction from absent evidence. A classifier verdict also does not verify source identity, offsets, citation ownership or external truth.

### Dependencies, hardware and licenses

Reproducibility pins observed in official histories: MiniCheck source `b58b9fa69acbd1015ec970fa65dd752413a053d2` (2025-08-27), package version 0.1.0; FT5 checkpoint revision `96eafd01cee2d16cf81aaa2fb226b14f422a37b3` (2024-12-20). The official FT5 file listing shows `pytorch_model.bin` at 3.13 GB and the repository at 3.14 GB. Pin both code and checkpoint; the wrapper does not expose a model-revision argument, so a runner must arrange a pinned snapshot or record the resolved cache revision. [Source commit](https://github.com/Liyan06/MiniCheck/commit/b58b9fa69acbd1015ec970fa65dd752413a053d2), [Checkpoint revision](https://huggingface.co/lytang/MiniCheck-Flan-T5-Large/commit/96eafd01cee2d16cf81aaa2fb226b14f422a37b3), [Official file listing](https://huggingface.co/lytang/MiniCheck-Flan-T5-Large/tree/main)

Package metadata requires Python >=3.8 and lists torch, transformers, datasets, nltk, pandas, numpy and openai; optional `llm` adds vllm. Dependencies are unpinned. Transformers automatic device placement may require additional runtime packages; inspect the resolved environment before selecting versions. [Package metadata](https://github.com/Liyan06/MiniCheck/blob/main/pyproject.toml)

The README describes optional vLLM inference as Linux-only and first-run Hugging Face checkpoint downloading. CUDA is demonstrated but is not an explicit FT5 minimum. Its throughput examples use an NVIDIA A6000 with 48 GB VRAM; this is benchmark hardware, not a verified minimum memory requirement. Do not extrapolate those figures to this Mac. [Official README](https://github.com/Liyan06/MiniCheck)

The repository code license is Apache 2.0. The FT5 checkpoint card lists **MIT**. These licenses are distinct from Bespoke 7B weights, whose card states **CC BY-NC 4.0**, with commercial licensing requested through `company@bespokelabs.ai`. Do not interpret README wording about commercial usability as an unconditional commercial grant. [Code license](https://github.com/Liyan06/MiniCheck/blob/main/LICENSE), [FT5 model card](https://huggingface.co/lytang/MiniCheck-Flan-T5-Large), [Bespoke license](https://huggingface.co/bespokelabs/Bespoke-MiniCheck-7B#license)

### Hosted and local alternatives

Hugging Face cards currently say neither FT5 nor Bespoke 7B is deployed by an Inference Provider. No stable paid MiniCheck hosted API contract or price was verified in this research. The README's old Bespoke playground link currently opens a Jev/Nimble comparison arena, so it cannot serve as evidence of an available MiniCheck hosted endpoint. [FT5 deployment status](https://huggingface.co/lytang/MiniCheck-Flan-T5-Large), [Bespoke deployment status](https://huggingface.co/bespokelabs/Bespoke-MiniCheck-7B), [Current playground](https://playground.bespokelabs.ai/)

Ollama officially provides `bespoke-minicheck:7b` / `bespoke-minicheck:latest`, currently 4.7 GB and 32k context. The documented prompt is `Document: ...\nClaim: ...`; the output is Yes/No. This is a local quantized Bespoke alternative, not FT5 or a drop-in probability interface; commercial weight restrictions remain relevant. [Ollama model entry](https://ollama.com/library/bespoke-minicheck)

## Application inference and evaluation proposal

Jev is naturally suited to closed-set question/intent routing: define routes in Choice and apply uncertainty policy in application code. Its official routing pattern supports that use. MiniCheck's document/claim interface is naturally suited to checking declarative answer sentences against supplied evidence. Turning an interrogative question into an entailment claim changes the task and needs its own evidence. [Official Jev routing pattern](https://docs.typesafe.ai/patterns/intent-routing)

For a fair development comparison, evaluate both on identical human-labeled single-claim/evidence pairs, retaining supported, contradicted, absent, partially supported, numerical, misleading and adversarial cases. Measure false support first, then recall, abstention, calibration, latency and usage. Keep routing evaluation separate because MiniCheck does not expose arbitrary choice labels. Preserve deterministic citation checks regardless of classifier choice. These are research recommendations, not implemented or verified behavior.

Required credentials: direct Jev needs a server-only `TYPESAFE_API_KEY` with vendor access and any required account credit. Public MiniCheck FT5 weights do not document an API key requirement; local execution needs a compatible isolated runtime, model cache and network access for initial downloads. Hosted MiniCheck credentials/costs remain unverified. Keep keys outside mobile and source control. This research establishes neither a classifier winner nor production integration; live development measurements are recorded separately.
