"""Topic overviews through authenticated HTTP and model response boundaries."""

import json
import httpx
import pytest
from fastapi.testclient import TestClient
from backend.main import app

ALICE = "11111111-1111-4111-8111-111111111111"
BOB = "22222222-2222-4222-8222-222222222222"
TOPIC = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
SOURCE = "33333333-3333-4333-8333-333333333333"


@pytest.fixture
def overview_client(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://supabase.test")
    monkeypatch.setenv("SUPABASE_PUBLISHABLE_KEY", "public-test")
    state = dict(
        topic_id=TOPIC,
        view_mode="combined",
        source_ids=[SOURCE],
        source_count=1,
        needs_refresh=False,
        record=None,
    )

    def external(request):
        owner = request.headers.get("authorization") == "Bearer alice"
        if request.url.path == "/auth/v1/user":
            return httpx.Response(200, json={"id": ALICE if owner else BOB})
        if request.url.path.startswith("/rest/v1/rpc/"):
            if not owner:
                return httpx.Response(404, json={"code": "P0002"})
            payload = json.loads(request.content)
            assert payload["p_topic_id"] == TOPIC
            if request.url.path.endswith("set_topic_overview_view"):
                state["view_mode"] = payload["p_view_mode"]
            return httpx.Response(200, json=state)
        raise AssertionError(str(request.url))

    original = httpx.AsyncClient
    monkeypatch.setattr(
        httpx,
        "AsyncClient",
        lambda **kw: original(**{**kw, "transport": httpx.MockTransport(external)}),
    )
    return TestClient(app), state


def test_topic_overview_is_owned_and_separate_choice_restores_without_synthesis(
    overview_client,
):
    client, _ = overview_client
    url = f"/api/v2/topics/{TOPIC}/overview"
    response = client.get(url, headers={"Authorization": "Bearer alice"})
    assert response.status_code == 200, response.text
    assert response.json()["record"] is None
    response = client.post(
        url,
        headers={"Authorization": "Bearer alice"},
        json={"view_mode": "separate", "retry": False},
    )
    assert response.status_code == 200, response.text
    assert (
        client.get(url, headers={"Authorization": "Bearer alice"}).json()["view_mode"]
        == "separate"
    )
    assert client.get(url, headers={"Authorization": "Bearer bob"}).status_code == 404
    assert client.get(url).status_code == 401


def test_synthesis_preserves_conflicting_claims_and_exact_source_references():
    import asyncio

    asyncio.run(synthesis_conflicts())


async def synthesis_conflicts():
    from uuid import UUID
    from backend.overview_generation import OverviewGenerator
    from backend.overview_models import OverviewInput
    from backend.study_generation import GenerationFailure

    second = "44444444-4444-4444-8444-444444444444"

    def source_note(sid, text, page=None, start_ms=None, end_ms=None):
        note = {
            "overview": {"text": text, "citation_ids": ["p0001"]},
            "concepts": [{"title": "RAG", "text": text, "citation_ids": ["p0001"]}],
            "examples": [],
            "equations": [],
            "recall": [
                {
                    "question": "What is supported?",
                    "answer": text,
                    "citation_ids": ["p0001"],
                }
            ],
            "references": [
                {
                    "id": "p0001",
                    "start": 0,
                    "end": len(text),
                    "excerpt": text,
                    "page": page,
                    "start_ms": start_ms,
                    "end_ms": end_ms,
                }
            ],
        }
        return OverviewInput.model_validate_json(
            json.dumps(
                {
                    "source_id": sid,
                    "title": "RAG evidence",
                    "topic_title": "RAG",
                    "context": "Machine learning",
                    "citation_ids": ["p0001"],
                    "note": note,
                }
            )
        )

    inputs = [
        source_note(SOURCE, "RAG reduced errors in this evaluated setting.", page=3),
        source_note(
            second,
            "RAG did not reduce errors in this different evaluated setting.",
            start_ms=6000,
            end_ms=9000,
        ),
    ]
    refs = ["ref1", "ref2"]
    draft = {
        "overview": {
            "text": "Results differ across these evaluation settings.",
            "reference_ids": refs,
        },
        "agreements": [],
        "differences": [
            {
                "text": "The first evaluation reports fewer errors; the second does not.",
                "reference_ids": refs,
            }
        ],
    }

    def model_response(request):
        body = json.loads(request.content)
        assert "RAG reduced errors" in json.dumps(body)
        payload = json.loads(body["messages"][1]["content"])
        assert [e["id"] for source in payload for e in source["evidence"]] == refs
        assert SOURCE not in json.dumps(payload) and second not in json.dumps(payload)
        return httpx.Response(
            200,
            json={
                "id": "test",
                "model": "gpt-4o-mini",
                "object": "chat.completion",
                "choices": [
                    {
                        "index": 0,
                        "finish_reason": "tool_calls",
                        "message": {
                            "role": "assistant",
                            "content": None,
                            "tool_calls": [
                                {
                                    "id": "call_test",
                                    "type": "function",
                                    "function": {
                                        "name": "DraftTopicOverview",
                                        "arguments": json.dumps(draft),
                                    },
                                }
                            ],
                        },
                    }
                ],
            },
        )

    async with httpx.AsyncClient(
        transport=httpx.MockTransport(model_response)
    ) as client:
        generator = OverviewGenerator(client, api_key="test-key")
        result = await generator.generate(inputs, source_count=2)
        assert (
            result.differences[0].text
            == "The first evaluation reports fewer errors; the second does not."
        )
        assert result.references[0].passage.page == 3
        assert result.references[1].passage.start_ms == 6000
        assert (
            result.references[1].passage.excerpt == inputs[1].note.references[0].excerpt
        )
        assert result.source_ids == [UUID(SOURCE), UUID(second)]
        assert result.overview.reference_ids == [SOURCE + ":p0001", second + ":p0001"]
        draft["overview"]["text"] = "The evaluations differ (ref1)."
        with pytest.raises(GenerationFailure, match="invalid_output"):
            await generator.generate(inputs, source_count=2)
        draft["overview"]["text"] = "Results differ across these evaluation settings."
        draft["overview"]["reference_ids"] = ["unknown:p0001"]
        with pytest.raises(GenerationFailure, match="invalid_output"):
            await generator.generate(inputs, source_count=2)


def test_unowned_overview_job_is_rejected_at_the_api_storage_boundary(overview_client):
    client, state = overview_client
    state["record"] = {
        "id": "55555555-5555-4555-8555-555555555555",
        "topic_id": TOPIC,
        "user_id": BOB,
        "status": "queued",
        "attempts": 0,
        "max_attempts": 3,
        "error_code": None,
        "overview": None,
        "updated_at": "2026-10-04T00:00:00Z",
    }
    response = client.get(
        f"/api/v2/topics/{TOPIC}/overview", headers={"Authorization": "Bearer alice"}
    )
    assert response.status_code == 503


def test_inconsistent_topic_membership_is_rejected_at_the_api_boundary(overview_client):
    client, state = overview_client
    state["source_ids"] = [SOURCE, SOURCE]
    response = client.get(
        f"/api/v2/topics/{TOPIC}/overview", headers={"Authorization": "Bearer alice"}
    )
    assert response.status_code == 503
