"""Model defaults and compatible requests at the provider HTTP seam."""

import asyncio
import json

import httpx
import pytest
from pydantic import BaseModel, ConfigDict

from backend.core.model_settings import default_model, structured_chat_model


class ExampleAnswer(BaseModel):
    model_config = ConfigDict(extra="forbid")
    answer: str


def test_luna_is_the_default_and_process_overrides_are_respected(monkeypatch):
    monkeypatch.delenv("OPENAI_MODEL")
    assert default_model() == "gpt-6-luna"
    monkeypatch.setenv("OPENAI_MODEL", "  gpt-4o-mini  ")
    assert default_model() == "gpt-4o-mini"
    monkeypatch.setenv("OPENAI_MODEL", " ")
    assert default_model() == "gpt-6-luna"


@pytest.mark.parametrize("model,effort,method", [
    ("gpt-6-luna", "none", "function_calling"),
    ("gpt-6.1-sol", "low", "json_schema"),
    ("gpt-4o-mini", None, "function_calling"),
])
def test_structured_generation_sends_compatible_model_parameters(monkeypatch, model, effort, method):
    monkeypatch.setenv("OPENAI_MODEL", model)
    requests = []

    def provider(request):
        body = json.loads(request.content)
        requests.append(body)
        assert request.url.path == "/v1/chat/completions"
        assert body["model"] == model
        if effort is not None:
            assert body["reasoning_effort"] == effort
            assert "temperature" not in body
        else:
            assert "reasoning_effort" not in body
            assert body["temperature"] == 0
        message = {"role": "assistant", "content": None}
        if method == "function_calling":
            assert body["tools"][0]["function"]["strict"] is True
            message["tool_calls"] = [{"id": "call-test", "type": "function", "function": {
                "name": "ExampleAnswer", "arguments": json.dumps({"answer": "Grounded answer"}),
            }}]
        else:
            assert "tools" not in body
            assert body["response_format"]["type"] == "json_schema"
            assert body["response_format"]["json_schema"]["strict"] is True
            message["content"] = json.dumps({"answer": "Grounded answer"})
        return httpx.Response(200, json={
            "id": "completion-test", "object": "chat.completion", "model": model,
            "choices": [{"index": 0, "finish_reason": "tool_calls" if method == "function_calling" else "stop", "message": message}],
        })

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(provider)) as client:
            generator = structured_chat_model(ExampleAnswer, api_key="test-key", client=client, max_tokens=200)
            result = await generator.ainvoke([("human", "Use the supplied evidence.")])
            assert result.answer == "Grounded answer"

    asyncio.run(run())
    assert len(requests) == 1
