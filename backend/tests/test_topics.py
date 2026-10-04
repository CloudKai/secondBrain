"""Learner topic mapping through authenticated HTTP and provider boundaries."""

import json
import httpx
import pytest
from fastapi.testclient import TestClient
from backend.main import app

ALICE = "11111111-1111-4111-8111-111111111111"
BOB = "22222222-2222-4222-8222-222222222222"
SOURCE = "33333333-3333-4333-8333-333333333333"


@pytest.fixture
def topic_client(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://supabase.test")
    monkeypatch.setenv("SUPABASE_PUBLISHABLE_KEY", "public-test")
    rows = []
    decisions = []

    def external(request):
        user = ALICE if request.headers.get("authorization") == "Bearer alice" else BOB
        if request.url.path == "/auth/v1/user":
            return httpx.Response(200, json={"id": user})
        if request.url.path == "/rest/v1/source_topic_maps":
            assert request.url.params["user_id"] == "eq." + user
            return httpx.Response(200, json=[r for r in rows if r["user_id"] == user])
        if request.url.path == "/rest/v1/topic_connection_decisions":
            return httpx.Response(200, json=[r for r in decisions if r["user_id"] == user])
        if request.url.path == "/rest/v1/rpc/confirm_topic_placement":
            payload = json.loads(request.content)
            assert payload == {
                "p_source_id": SOURCE,
                "p_topic_id": T2,
                "p_target_id": T1,
            }
            if user != ALICE:
                return httpx.Response(404, json={"code": "P0002"})
            return httpx.Response(200, json=rows[0])
        raise AssertionError(str(request.url))

    original = httpx.AsyncClient
    monkeypatch.setattr(
        httpx,
        "AsyncClient",
        lambda **kw: original(**{**kw, "transport": httpx.MockTransport(external)}),
    )
    client = TestClient(app)
    client.decisions = decisions
    return client, rows


def test_empty_library_has_no_prepared_topics_or_graph(topic_client):
    client, _ = topic_client
    response = client.get(
        "/api/v2/topic-library", headers={"Authorization": "Bearer alice"}
    )
    assert response.status_code == 200
    assert response.json() == {
        "maps": [],
        "topics": [],
        "connections": [],
        "graph_ready": False,
        "partial": False,
        "connection_decisions": [],
    }
    assert client.get("/api/v2/topic-library").status_code == 401


T1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
T2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"


def assignment(id, title, citations=["p0001"], uncertain=False):
    return dict(
        id=id,
        title=title,
        context="Machine learning",
        aliases=[],
        groups=["AI"],
        description=title + " is explained in this source.",
        role="main",
        citation_ids=citations,
        uncertain=uncertain,
        suggested_topic_id=None,
        placement_reason="Substantively explained in the saved source.",
    )


def map_row(source_id=SOURCE, topics=None, relations=None):
    return dict(
        source_id=source_id,
        user_id=ALICE,
        status="succeeded",
        attempts=1,
        max_attempts=3,
        next_attempt_at="2026-10-03T00:00:00Z",
        error_code=None,
        analysis=dict(
            topics=topics or [assignment(T1, "RAG")],
            relations=relations or [],
            catalog_partial=False,
        ),
        updated_at="2026-10-03T00:00:00Z",
    )


def test_first_completed_source_has_topic_cards_but_no_graph(topic_client):
    client, rows = topic_client
    rows.append(map_row())
    data = client.get(
        "/api/v2/topic-library", headers={"Authorization": "Bearer alice"}
    ).json()
    assert [t["title"] for t in data["topics"]] == ["RAG"]
    assert data["topics"][0]["source_ids"] == [SOURCE]
    assert data["graph_ready"] is False and data["connections"] == []
    assert (
        client.get(
            "/api/v2/topic-library", headers={"Authorization": "Bearer bob"}
        ).json()["topics"]
        == []
    )


def test_placement_accepts_wire_uuid_strings_and_preserves_owner_boundary(topic_client):
    client, rows = topic_client
    rows.append(map_row())
    url = f"/api/v2/sources/{SOURCE}/topics/placement"
    payload = {"topic_id": T2, "target_id": T1}
    response = client.post(url, headers={"Authorization": "Bearer alice"}, json=payload)
    assert response.status_code == 200, response.text
    assert response.json()["analysis"]["topics"][0]["id"] == T1
    assert "user_id" not in response.json()
    assert (
        client.post(
            url, headers={"Authorization": "Bearer bob"}, json=payload
        ).status_code
        == 404
    )
    assert client.post(url, json=payload).status_code == 401
    assert (
        client.post(
            url,
            headers={"Authorization": "Bearer alice"},
            json={**payload, "topic_id": "invalid"},
        ).status_code
        == 422
    )


def test_explained_relation_needs_two_sources_and_unrelated_topics_stay_separate(
    topic_client,
):
    client, rows = topic_client
    relation = dict(
        source=T1,
        target=T2,
        kind="uses",
        reason="RAG uses retrieval to obtain passages for generation.",
        citation_ids=["p0001"],
    )
    rows.append(
        map_row(
            topics=[assignment(T1, "RAG"), assignment(T2, "Retrieval")],
            relations=[relation],
        )
    )

    def library():
        response = client.get(
            "/api/v2/topic-library", headers={"Authorization": "Bearer alice"}
        )
        assert response.status_code == 200, response.text
        return response.json()

    assert library()["connections"] == []
    rows.append(
        map_row(
            "44444444-4444-4444-8444-444444444444", topics=[assignment(T2, "Retrieval")]
        )
    )
    data = library()
    assert data["graph_ready"] is True
    assert data["connections"][0]["kind"] == "uses"
    assert data["connections"][0]["source_ids"] == [
        SOURCE,
        "44444444-4444-4444-8444-444444444444",
    ]
    assert data["connections"][0]["evidence"] == {SOURCE: ["p0001"]}
    assert "mastery" in data["connections"][0]["reason"]
    client.decisions.append(dict(user_id=ALICE,source=T1,target=T2,state="rejected"))
    assert library()["connections"] == []
    assert library()["connection_decisions"] == [{"source":T1,"target":T2,"state":"rejected"}]
    client.decisions[0]["state"] = "accepted"
    assert len(library()["connections"]) == 1
    rows.pop()
    unrelated = assignment("cccccccc-cccc-4ccc-8ccc-cccccccccccc", "Calculus")
    unrelated.update(context="Mathematics", groups=["Math"])
    rows.append(map_row("44444444-4444-4444-8444-444444444444", topics=[unrelated]))
    assert library()["graph_ready"] is False
    assert library()["connections"] == []


def test_model_topics_use_evidence_merge_clear_aliases_and_keep_uncertainty_distinct():
    import asyncio
    from uuid import UUID
    from backend.topic_generation import TopicGenerator
    from backend.topic_models import TopicDescription
    from backend.study_models import StudyNote
    from backend.study_generation import captured_passages
    from backend.tests.test_study_generation import DRAFT, CAPTURE

    note = StudyNote(**DRAFT, references=captured_passages(CAPTURE))
    candidate = TopicDescription(
        id=UUID(T1),
        title="Calculus",
        context="Mathematics",
        aliases=["Calculus basics"],
        groups=["Math"],
        description="Changes and accumulated quantities.",
    )
    topic = dict(
        key="calculus",
        title="Calculus basics",
        context="Mathematics",
        aliases=[],
        groups=["Math"],
        description="Changes and accumulated quantities.",
        role="main",
        coverage="substantive",
        citation_ids=["p0001"],
        existing_topic_id=T1,
        uncertain=False,
        suggested_topic_id=None,
        placement_reason="Same mathematical topic and scope.",
    )
    draft = dict(topics=[topic], relations=[])

    def completion(request, draft):
        body = json.loads(request.content)
        assert body["tools"][0]["function"]["strict"] is True
        return httpx.Response(
            200,
            json={
                "id": "topic-test",
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
                                    "id": "call-topics",
                                    "type": "function",
                                    "function": {
                                        "name": body["tools"][0]["function"]["name"],
                                        "arguments": json.dumps(draft),
                                    },
                                }
                            ],
                        },
                    }
                ],
                "usage": {
                    "prompt_tokens": 1,
                    "completion_tokens": 1,
                    "total_tokens": 2,
                },
            },
        )

    async def run():
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(lambda req: completion(req, draft))
        ) as client:
            generator = TopicGenerator(client, api_key="test-key")
            result = await generator.generate(
                note, [candidate], UUID(ALICE), UUID(SOURCE)
            )
            assert str(result.topics[0].id) == T1
            topic.update(
                existing_topic_id=None,
                uncertain=True,
                suggested_topic_id=T1,
                placement_reason="Scope may be narrower; learner confirmation needed.",
            )
            result = await generator.generate(
                note, [candidate], UUID(ALICE), UUID(SOURCE)
            )
            assert str(result.topics[0].id) != T1
            assert result.topics[0].uncertain is True
            assert str(result.topics[0].suggested_topic_id) == T1
            mention = {
                **topic,
                "key": "historical-mention",
                "title": "Historical aside",
                "coverage": "mention",
                "uncertain": False,
                "suggested_topic_id": None,
            }
            draft["topics"].append(mention)
            result = await generator.generate(
                note, [candidate], UUID(ALICE), UUID(SOURCE)
            )
            assert len(result.topics) == 1
            topic.update(
                existing_topic_id=T1,
                uncertain=False,
                suggested_topic_id=None,
                context="Computer graphics",
            )
            from backend.study_generation import GenerationFailure

            with pytest.raises(GenerationFailure, match="invalid_output"):
                await generator.generate(note, [candidate], UUID(ALICE), UUID(SOURCE))
            topic["context"] = "Mathematics"
            topic["citation_ids"] = ["p9999"]
            from backend.study_generation import GenerationFailure

            with pytest.raises(GenerationFailure, match="invalid_output"):
                await generator.generate(note, [candidate], UUID(ALICE), UUID(SOURCE))

    asyncio.run(run())
