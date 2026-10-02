"""Study generation at the model HTTP seam; no real provider calls."""

import asyncio
import json
import copy

import httpx
import pytest

from backend.study_generation import (
    GenerationFailure,
    StudyGenerator,
    captured_passages,
)

CAPTURE = "Derivatives measure instantaneous rates of change. Integrals accumulate contributions. The expression distance = speed × time links a constant rate to an accumulated total. "
DRAFT = {
    "overview": {
        "text": "Calculus describes changes and accumulated totals.",
        "citation_ids": ["p0001"],
    },
    "concepts": [
        {
            "title": "Derivatives",
            "text": "A derivative describes an instantaneous rate.",
            "citation_ids": ["p0001"],
        },
        {
            "title": "Integrals",
            "text": "An integral accumulates contributions.",
            "citation_ids": ["p0001"],
        },
        {
            "title": "Constant rates",
            "text": "A constant rate connects time and distance.",
            "citation_ids": ["p0001"],
        },
    ],
    "examples": [
        {
            "title": "Constant speed",
            "text": "Distance accumulates while time passes.",
            "citation_ids": ["p0001"],
        }
    ],
    "equations": [
        {
            "expression": "distance = speed × time",
            "text": "A constant speed determines the accumulated distance.",
            "citation_ids": ["p0001"],
        }
    ],
    "recall": [
        {
            "question": "What does a derivative measure?",
            "answer": "An instantaneous rate of change.",
            "citation_ids": ["p0001"],
        }
    ],
}


def completion(request, draft=DRAFT):
    body = json.loads(request.content)
    assert body["model"] == "gpt-4o-mini"
    assert "p0001" in body["messages"][-1]["content"]
    schema = body["tools"][0]["function"]["parameters"]["properties"]
    assert body["tools"][0]["function"]["strict"] is True
    assert "title" in schema["concepts"]["items"]["required"]
    assert "expression" in schema["equations"]["items"]["required"]
    name = body["tools"][0]["function"]["name"]
    return httpx.Response(
        200,
        json={
            "id": "chatcmpl-study",
            "object": "chat.completion",
            "created": 1,
            "model": "gpt-4o-mini",
            "choices": [
                {
                    "index": 0,
                    "finish_reason": "tool_calls",
                    "message": {
                        "role": "assistant",
                        "content": None,
                        "tool_calls": [
                            {
                                "id": "call-study",
                                "type": "function",
                                "function": {
                                    "name": name,
                                    "arguments": json.dumps(draft),
                                },
                            }
                        ],
                    },
                }
            ],
            "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2},
        },
    )


def test_generated_note_has_substantive_sections_and_real_source_references():
    async def run():
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(completion)
        ) as client:
            note = await StudyGenerator(client, api_key="test-key").generate(CAPTURE)
        assert len(note.concepts) == 3
        assert note.examples[0].title == "Constant speed"
        assert note.equations[0].expression == "distance = speed × time"
        assert note.recall[0].answer == "An instantaneous rate of change."
        assert note.references[0].id == "p0001"
        assert note.references[0].start == 0
        assert note.references[0].end == len(CAPTURE)
        assert note.references[0].excerpt == CAPTURE

    asyncio.run(run())


@pytest.mark.parametrize(
    "mutation", ["unknown_passage", "invented_excerpt", "missing_section"]
)
def test_invalid_provider_output_never_becomes_a_completed_note(mutation):
    draft = copy.deepcopy(DRAFT)
    if mutation == "unknown_passage":
        draft["overview"]["citation_ids"] = ["p9999"]
    elif mutation == "invented_excerpt":
        draft["references"] = [{"excerpt": "invented"}]
    else:
        del draft["recall"]

    async def run():
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(lambda r: completion(r, draft))
        ) as client:
            with pytest.raises(GenerationFailure) as failure:
                await StudyGenerator(client, api_key="test-key").generate(CAPTURE)
        assert failure.value.code == "invalid_output"

    asyncio.run(run())


@pytest.mark.parametrize(
    "status,code", [(503, "provider_unavailable"), (401, "setup_required")]
)
def test_provider_failure_has_safe_actionable_error_and_no_sdk_retry(status, code):
    calls = []

    def response(request):
        calls.append(request)
        return httpx.Response(
            status,
            json={"error": {"message": "private upstream detail", "type": "api_error"}},
        )

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(response)) as client:
            with pytest.raises(GenerationFailure) as failure:
                await StudyGenerator(client, api_key="test-key").generate(CAPTURE)
        assert failure.value.code == code
        assert str(failure.value) == code
        assert len(calls) == 1

    asyncio.run(run())


def test_passage_offsets_reconstruct_unicode_capture_without_loss():
    text = "Calculus 🚀 describes change and accumulation.\n" * 80
    passages = captured_passages(text)
    assert "".join(p.excerpt for p in passages) == text
    assert all(p.excerpt == text[p.start : p.end] for p in passages)
    assert all(len(p.excerpt) <= 900 for p in passages)


def test_provider_timeout_has_one_attempt_and_a_retryable_code():
    calls = []

    def external(request):
        calls.append(request)
        raise httpx.ReadTimeout("private detail", request=request)

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(external)) as client:
            with pytest.raises(GenerationFailure) as failure:
                await StudyGenerator(client, api_key="test-key").generate(CAPTURE)
        assert failure.value.code == "timeout"
        assert len(calls) == 1

    asyncio.run(run())
