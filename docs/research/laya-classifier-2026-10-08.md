# Laya classifier contract research

Research date: 2026-10-08. Primary-source inspection for the development claim-support comparison. This note does not establish production suitability or Second Brain acceptance. No model execution, installation or application changes were performed by this research agent; actual local replay results belong in the comparison report.

## Reproducibility and checkpoint

Pin code to **`3cf26cbcb18725dbc2d127bb8bb2c4c43243ae63`**, whose package metadata declares **Laya 0.4.0**, Python >=3.10, Apache-2.0 code license. A source installation specification is `laya[serve] @ git+https://github.com/NandhaKishorM/laya.git@3cf26cbcb18725dbc2d127bb8bb2c4c43243ae63`. Install in an isolated development environment; source version is not evidence that PyPI contains identical code. Declared minimums: torch 2.0, transformers 4.48, safetensors 0.4, huggingface_hub 0.20, numpy 1.20; `serve` adds FastAPI >=0.110, uvicorn >=0.27 and python-multipart >=0.0.9. [Pinned metadata](https://github.com/NandhaKishorM/laya/blob/3cf26cbcb18725dbc2d127bb8bb2c4c43243ae63/pyproject.toml), [code license](https://github.com/NandhaKishorM/laya/blob/3cf26cbcb18725dbc2d127bb8bb2c4c43243ae63/LICENSE)

For the English baseline, use `convaiinnovations/laya` at **`55cf4c4ebb4ebe31b2550e8bdf3bd21b99753851`**, the package's opt-in reviewed pin. The public model is not gated/private and its card declares **Apache-2.0**. The Hub API lists 421,293,830 parameters, mostly F16 stored weights; the card describes ModernBERT-large, 421M. Configuration fixes `max_len=512`, `head_max_len=192`. Public downloads do not require an application/provider key; optional HF_TOKEN is accepted by the loader. Root English weights must not be confused with the multilingual/typed-decisions bundled subdirectories. [Pinned model card](https://huggingface.co/convaiinnovations/laya/blob/55cf4c4ebb4ebe31b2550e8bdf3bd21b99753851/README.md), [configuration](https://huggingface.co/convaiinnovations/laya/resolve/55cf4c4ebb4ebe31b2550e8bdf3bd21b99753851/rl_agent_config.json), [Hub metadata](https://huggingface.co/api/models/convaiinnovations/laya/revision/55cf4c4ebb4ebe31b2550e8bdf3bd21b99753851), [reviewed pins](https://github.com/NandhaKishorM/laya/blob/3cf26cbcb18725dbc2d127bb8bb2c4c43243ae63/laya/revisions.py)

`Router(revisions={"english": SHA})` pins English explicitly. `LAYA_REVISION=reviewed` selects each repository's recorded reviewed SHA. With no explicit/environment pin, runtime follows the Hub default revision. Default Router downloads English from the root bundle and other models from its subfolders. Standalone multilingual's reviewed revision is `e4e9ddf21a7b1903b7acffd8814ad4307bf63a67`; typed-decisions is `1a793eb568e6718f15941d08f85432581df534e3`. [Router](https://github.com/NandhaKishorM/laya/blob/3cf26cbcb18725dbc2d127bb8bb2c4c43243ae63/laya/router.py), [revision resolution](https://github.com/NandhaKishorM/laya/blob/3cf26cbcb18725dbc2d127bb8bb2c4c43243ae63/laya/revisions.py)

## Python inference and response

Minimal proposed binary support question, to be evaluated on the same labeled cases as MiniCheck:

```python
from laya import Router

router = Router(device="cpu", max_loaded=1,
                revisions={"english": "55cf4c4ebb4ebe31b2550e8bdf3bd21b99753851"})
questions = {"support": {
    "type": "choice",
    "instructions": "Does document support all parts of claim using only document?",
    "criteria": {
        "supported": "Document states or directly implies every part of claim",
        "unsupported": "At least one part is contradicted or not supported"
    }
}}
result = router.predict({"document": document, "claim": claim}, questions,
                        model="english", max_len=512, head_max_len=192)
if result["usage"]["truncated"] or result["usage"].get("options"):
    raise ValueError("Evaluation input or options lost information")
support_probability = result["answers"]["support"]["probabilities"]["supported"]
```

The root response is `{model, answers, usage, routing}`. **`model` is the literal `laya-rl-agent`**, so checkpoint identity must be taken from routing and loaded revisions, not this field. Explicit English routing is `{model:"english", repo:"convaiinnovations/laya", reason:"explicit model='english'", detection:null, workflow:null}`. Choice answers contain `type`, selected `choice`, label-to-probability mapping, `confidence`, `answer_confidence`, and `action:{act_probability}`. Probabilities are rounded to four decimals. Score additionally returns expected zero-based `score` and `legend`; noul returns P(true) in `noul`. No generated explanation/evidence citation is returned. [Answer decoder and usage](https://github.com/NandhaKishorM/laya/blob/3cf26cbcb18725dbc2d127bb8bb2c4c43243ae63/laya/agent.py), [routing response](https://github.com/NandhaKishorM/laya/blob/3cf26cbcb18725dbc2d127bb8bb2c4c43243ae63/laya/router.py)

For Choice/Score, `confidence = 1 - H(p)/log(k)` describes normalized entropy. `answer_confidence` normally equals max probability; optional fitted binning can map it. Noul confidence is max(P(true), P(false)). None establishes calibration on this corpus. The source expressly says calibration depends on held-out validation for the checkpoint/option count and warns that shipped weights can be overconfident. Use `probabilities.supported` for support scoring and retain all raw fields; do not compare Jev/Laya confidence thresholds as though their formulas match. [Confidence functions](https://github.com/NandhaKishorM/laya/blob/3cf26cbcb18725dbc2d127bb8bb2c4c43243ae63/laya/common.py)

## Exact local HTTP surface

The installed `laya-serve` command builds a Router and serves **`POST /v1/systemone`**, **`POST /v1/systemone/batch`**, and **`GET /health`**. Configure `LAYA_HOST=127.0.0.1`, a separate `LAYA_PORT`, `LAYA_MODELS=english`, `LAYA_DEVICE=cpu` or `mps`, `LAYA_REVISION=reviewed`, `LAYA_JEV_STRICT=0`. Preload defaults on; selecting English avoids loading all three checkpoints. `LAYA_API_KEY` is optional; when unset the local server requires no Authorization header. [Pinned HTTP implementation](https://github.com/NandhaKishorM/laya/blob/3cf26cbcb18725dbc2d127bb8bb2c4c43243ae63/laya/serve.py)

Single request JSON is:

```json
{"model":"english","state":{"document":"Evidence","claim":"Claim"},"questions":{"support":{"type":"choice","instructions":"Does document support all parts of claim using only document?","criteria":{"supported":"Document states or directly implies every part of claim","unsupported":"At least one part is contradicted or not supported"}}},"max_len":512,"head_max_len":192}
```

Response equals the full Python result above. Optional controls include `task`, `lang`, `lang_guess`, and `min_confidence`. The batch endpoint uses `{states:[...], questions:{...}, model:..., ...}`. A Jev ID such as `jev-1` means automatic routing, **not** a fixed English checkpoint; send `english`. `LAYA_JEV_STRICT=1` strips routing, action, answer_confidence and truncation usage to mimic the narrower Jev shape, so it is inappropriate for auditing truncation. The server emits inference timing headers. Invalid/missing state or malformed JSON gets 400, oversized inputs 413, invalid question/budget 422, authentication failure 401, busy server 503 and unexpected inference failure 500. [HTTP implementation](https://github.com/NandhaKishorM/laya/blob/3cf26cbcb18725dbc2d127bb8bb2c4c43243ae63/laya/serve.py)

Unkeyed `/health` returns `status`, `loaded`, `revisions`, actual `device`, `device_is_preference`, `checkpoint_devices`, and `cpu_fallbacks`; optional idle-unload details may appear. With a configured key, unauthenticated health returns only `{status:"ok"}`. Record the detailed English revision/device after preload and replay; requested GPU may fall back to CPU. HTTP limits include 2 MB body, 50,000 state characters, 64 questions and token-budget overrides capped at 8,192 by default. A character cap does not prove token fit. [Health and limits](https://github.com/NandhaKishorM/laya/blob/3cf26cbcb18725dbc2d127bb8bb2c4c43243ae63/laya/serve.py)

## Truncation, safety and hardware

Each question's rendered head consumes part of `max_len`; state receives only `max_len - actual_head_tokens - 1`. Ordinary string/object input keeps the prefix and drops the end; conversation lists keep the end. Usage reports `state_tokens`, worst `state_tokens_dropped`, `truncated`, and `truncated_questions`, alongside `input_tokens` and `output_tokens=0`. Question descriptions themselves are budgeted/truncated; `usage.options` appears if option spans collapse. Fail the benchmark call when any state is truncated or options collapse. Tokenize the actual serialized document/claim with the selected checkpoint to preflight all 20 cases; any exceeding the real per-question room needs a documented strategy before replay. Increasing an English model budget arbitrarily is not evidence of long-context quality. Multilingual supports up to 8,192 with an explicit model/budget, but that is a different candidate. [Sequence construction](https://github.com/NandhaKishorM/laya/blob/3cf26cbcb18725dbc2d127bb8bb2c4c43243ae63/laya/common.py), [state encoding/usage](https://github.com/NandhaKishorM/laya/blob/3cf26cbcb18725dbc2d127bb8bb2c4c43243ae63/laya/agent.py)

The core loader filters downloads to config, safetensors, tokenizer and encoder files; constructs local AutoConfig/AutoModel and loads `safetensors` with strict shape checks. It does not pass `trust_remote_code=True`. Optional `expected_sha256`/`LAYA_SHA256_DIGESTS` can verify artifact bytes. This limits downloaded model-code execution, but installing the source package still executes ordinary third-party Python, and dependency security remains separate from pinned weights. [Loader](https://github.com/NandhaKishorM/laya/blob/3cf26cbcb18725dbc2d127bb8bb2c4c43243ae63/laya/agent.py), [integrity controls](https://github.com/NandhaKishorM/laya/blob/3cf26cbcb18725dbc2d127bb8bb2c4c43243ae63/laya/revisions.py)

CPU and MPS are supported fp32 inference paths; no CUDA requirement. The maintainer reports CPU/MPS runs on an Intel Mac Pro with AMD GPU, using torch 2.2.2, transformers 4.57.6, numpy 1.26.4, safetensors 0.8.0 and huggingface_hub 0.36.2. This is a verified upstream environment, not a validated minimum for this Mac. Existing torch 2.8/transformers 4.52 satisfy package bounds, but their exact compatibility requires the local replay. Estimate ~1.69 GB raw fp32 parameter storage for English before activations/runtime overhead; this is not a measured memory minimum. Limit residency to one model; preloading all three raises residency and defeats that saving. Benchmark latency on the user's actual hardware including warmup separately; published T4/macOS timings cannot establish it. [Upstream local setup](https://github.com/NandhaKishorM/laya/blob/3cf26cbcb18725dbc2d127bb8bb2c4c43243ae63/LOCAL_SETUP.md), [device and precision handling](https://github.com/NandhaKishorM/laya/blob/3cf26cbcb18725dbc2d127bb8bb2c4c43243ae63/laya/agent.py)

## Capability evidence and comparison boundary

Laya is a general typed decision model with routing, email, guardrail and other application evaluations. It also reports **XNLI English 0.860** for English weights and 0.843 for multilingual; thus primary sources include natural-language-inference evidence, not only intent routing. That does not establish document-to-claim factual grounding performance on the Second Brain cases. The benchmark document warns that its Jev numbers are third-party published with different prompts/sample sizes. Do not repeat advertised relative speed/calibration as an identical-corpus local result. No MiniCheck-equivalent acceptance or production winner follows from these sources. Retain the existing 20 evidence/claim pairs and measured MiniCheck results; score Laya on those exact inputs, log revision/device/truncation and false-support cases, and report the scope as development comparison. [Pinned benchmark inventory and limitations](https://github.com/NandhaKishorM/laya/blob/3cf26cbcb18725dbc2d127bb8bb2c4c43243ae63/BENCHMARKS.md)
