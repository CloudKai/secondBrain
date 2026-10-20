"""OpenAI Responses client for the quiz, behind a small protocol so tests inject fakes.

The request shape matches learning_generation.structured (Responses API,
store=false, strict json_schema, trust_env=False). Models, token caps and the
reasoning effort come from QuizConfig only. Every started call is recorded in the
ProviderLedger; the refund decision itself is quiz_rules.classify_outcome.
"""

import logging
import os
from dataclasses import dataclass
from typing import Literal, Protocol

import httpx
from pydantic import BaseModel

from backend.quiz_limits import ProviderLedger, QuizConfig, get_quiz_config
from backend.quiz_rules import refundable_error_type

logger = logging.getLogger(__name__)
RESPONSES_URL = "https://api.openai.com/v1/responses"

ProviderReason = Literal["setup_required", "provider_unavailable", "timeout"]


class ProviderError(Exception):
    """A transport or HTTP failure; `code` is the learner-facing category."""

    def __init__(self, code: ProviderReason):
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class ModelResponse:
    """`outcome` is exactly one of completed / incomplete / refused."""

    outcome: Literal["completed", "incomplete", "refused"]
    model: str
    text: str = ""
    reason: Literal["truncated", "refused"] | None = None
    tokens_in: int = 0
    tokens_out: int = 0


class QuizModel(Protocol):
    async def call(
        self, *, model: str, instructions: str, input: str, schema: type[BaseModel],
        max_output_tokens: int, timeout: float, ledger: ProviderLedger,
    ) -> ModelResponse: ...


def exception_kind(exc: BaseException) -> str:
    """Class-name string for quiz_rules.classify_outcome.

    ConnectTimeout is a TimeoutException, so it must be tested first.
    """
    if isinstance(exc, httpx.ConnectTimeout):
        return "ConnectTimeout"
    if isinstance(exc, httpx.ConnectError):
        return "ConnectError"
    return type(exc).__name__


def provider_code(exc: BaseException) -> ProviderReason:
    if isinstance(exc, (httpx.TimeoutException, TimeoutError)):
        return "timeout"
    return "provider_unavailable"


def parse_response(body: object, model: str) -> ModelResponse:
    """Turn a 2xx Responses API body into a ModelResponse (never inspected elsewhere)."""
    if not isinstance(body, dict):
        raise ProviderError("provider_unavailable")
    usage = body.get("usage") if isinstance(body.get("usage"), dict) else {}
    tokens = {"tokens_in": int(usage.get("input_tokens") or 0), "tokens_out": int(usage.get("output_tokens") or 0)}
    parts = [part for item in body.get("output") or [] if isinstance(item, dict) and item.get("type") == "message"
             for part in item.get("content") or [] if isinstance(part, dict)]
    status = body.get("status")
    if status == "incomplete":
        details = body.get("incomplete_details") if isinstance(body.get("incomplete_details"), dict) else {}
        refused = details.get("reason") == "content_filter"
        return ModelResponse("incomplete", model, reason="refused" if refused else "truncated", **tokens)
    if any(part.get("type") == "refusal" for part in parts):
        return ModelResponse("refused", model, reason="refused", **tokens)
    if status != "completed":
        raise ProviderError("provider_unavailable")
    text = "".join(part.get("text", "") for part in parts if part.get("type") == "output_text" and isinstance(part.get("text"), str))
    return ModelResponse("completed", model, text=text, **tokens)


class OpenAIResponsesModel:
    def __init__(self, client: httpx.AsyncClient | None = None, config: QuizConfig | None = None):
        self.client = client
        self.config = config

    async def call(
        self, *, model: str, instructions: str, input: str, schema: type[BaseModel],
        max_output_tokens: int, timeout: float, ledger: ProviderLedger,
    ) -> ModelResponse:
        key = os.getenv("OPENAI_API_KEY", "")
        if not key or key.startswith("YOUR_"):
            raise ProviderError("setup_required")  # no request is started: nothing to ledger
        config = self.config or get_quiz_config()
        body = {
            "model": model, "reasoning": {"effort": config.reasoning_effort},
            "store": False, "max_output_tokens": max_output_tokens,
            "instructions": instructions, "input": input,
            "text": {"format": {"type": "json_schema", "name": schema.__name__,
                                "strict": True, "schema": schema.model_json_schema()}},
        }
        headers = {"Authorization": f"Bearer {key}"}
        ledger.begin()  # recorded immediately BEFORE the request is sent
        try:
            if self.client is not None:
                response = await self.client.post(RESPONSES_URL, headers=headers, json=body, timeout=timeout)
            else:
                async with httpx.AsyncClient(trust_env=False) as client:
                    response = await client.post(RESPONSES_URL, headers=headers, json=body, timeout=timeout)
        except (httpx.HTTPError, TimeoutError) as exc:
            ledger.settle(exception_kind(exc))
            logger.warning("Quiz provider call failed: %s", type(exc).__name__)
            raise ProviderError(provider_code(exc)) from exc
        try:
            payload = response.json() if response.content else None
        except ValueError:
            payload = None
        if response.is_error:
            ledger.settle("http", response.status_code, refundable_error_type(payload))
            logger.warning("Quiz provider answered HTTP %s", response.status_code)
            raise ProviderError("setup_required" if response.status_code in (401, 403, 404) else "provider_unavailable")
        ledger.settle("http", response.status_code)  # 2xx: tokens were generated, so spent
        return parse_response(payload, model)


def get_quiz_model() -> QuizModel:
    return OpenAIResponsesModel()
