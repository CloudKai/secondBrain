"""Shared default model and compatible parameters for text generation."""

import os
from typing import Literal

import httpx
from langchain_openai import ChatOpenAI
from pydantic import BaseModel

DEFAULT_MODEL = "gpt-6-luna"


def default_model() -> str:
    return os.getenv("OPENAI_MODEL", "").strip() or DEFAULT_MODEL


def reasoning_effort(model: str) -> Literal["none", "low"] | None:
    if model.startswith(("gpt-6-luna", "gpt-6-sol")):
        return "none"
    if model.startswith(("gpt-6.1-sol", "gpt-6-astra")):
        return "low"
    return None


def chat_model(
    *, api_key: str | None, model: str | None = None,
    client: httpx.AsyncClient | None = None, max_tokens: int | None = None,
    timeout: float | None = None, max_retries: int = 2,
) -> ChatOpenAI:
    selected = model or default_model()
    effort = reasoning_effort(selected)
    return ChatOpenAI(
        api_key=api_key, model=selected,
        temperature=None if effort is not None else 0,
        reasoning_effort=effort, max_tokens=max_tokens, timeout=timeout,
        max_retries=max_retries, http_async_client=client,
    )


def structured_chat_model(
    schema: type[BaseModel], *, api_key: str,
    client: httpx.AsyncClient, max_tokens: int, model: str | None = None,
):
    selected = model or default_model()
    # Sol 6.1 requires Responses for tool calling. A schema-only Chat Completions
    # response needs no tool call and keeps this transport compatible with it.
    method = "json_schema" if reasoning_effort(selected) == "low" else "function_calling"
    return chat_model(
        api_key=api_key, model=selected, client=client, max_tokens=max_tokens,
        timeout=60, max_retries=0,
    ).with_structured_output(schema, method=method, strict=True)
