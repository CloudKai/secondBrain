"""Long captures and selections at the authenticated capture and model seams."""

from backend.tests.test_sources import browser_client  # noqa: F401
from backend.tests.test_pdf_sources import pdf_bytes, FIRST_PAGE, THIRD_PAGE
import pytest
import asyncio
import copy
import json
import httpx
from backend.study_generation import StudyGenerator, GenerationFailure
from backend.tests.test_study_generation import DRAFT


def model_response(request, draft):
    body = json.loads(request.content)
    name = body["tools"][0]["function"]["name"]
    return httpx.Response(200, json={"id": "chat-long", "object": "chat.completion", "created": 1, "model": "gpt-4o-mini", "choices": [{"index": 0, "finish_reason": "tool_calls", "message": {"role": "assistant", "content": None, "tool_calls": [{"id": "call-long", "type": "function", "function": {"name": name, "arguments": json.dumps(draft)}}]}}]})


def draft_for(ids):
    draft = copy.deepcopy(DRAFT)
    for claim in [draft["overview"], *draft["concepts"], *draft["examples"], *draft["equations"], *draft["recall"]]:
        claim["citation_ids"] = ids
    return draft


def test_pdf_page_selection_reopens_with_original_page_numbers(browser_client):
    headers = {"Authorization": "Bearer alice", "Content-Type": "application/pdf"}
    response = browser_client.post(
        "/api/v2/sources/pdf?filename=selected.pdf&page_start=3&page_end=3",
        headers=headers, content=pdf_bytes(),
    )
    assert response.status_code == 201, response.text
    source = response.json()
    assert source["captured_text"] == THIRD_PAGE.strip()
    assert source["document"]["pages"] == [{"page": 3, "start": 0, "end": len(THIRD_PAGE.strip())}]
    assert source["document"]["selected_pages"] == {"start": 3, "end": 3}
    assert source["coverage"] == "partial"
    assert "3–3" in source["coverage_detail"]
    assert browser_client.get(f"/api/v2/sources/{source['id']}", headers=headers).json() == source
    assert browser_client.get(f"/api/v2/sources/{source['id']}", headers={"Authorization": "Bearer bob"}).status_code == 404


@pytest.mark.parametrize("query", ["page_start=4&page_end=4", "page_start=3&page_end=1", "page_start=2", "page_start=0&page_end=2"])
def test_invalid_pdf_ranges_do_not_save_sources(browser_client, query):
    headers = {"Authorization": "Bearer alice"}
    response = browser_client.post("/api/v2/sources/pdf?filename=range.pdf&" + query, headers=headers, content=pdf_bytes())
    assert response.status_code == 422, response.text
    assert browser_client.get("/api/v2/sources", headers=headers).json()["sources"] == []


def test_timed_selection_preserves_whole_overlapping_cues_without_fetching_video(browser_client):
    headers = {"Authorization": "Bearer alice", "X-Video-URL": "https://www.youtube.com/watch?v=ovrv11testA"}
    transcript = "1\n00:00:06,000 --> 00:00:12,000\n" + FIRST_PAGE + "\n\n2\n00:00:24,000 --> 00:00:42,000\n" + THIRD_PAGE
    response = browser_client.post("/api/v2/sources/video?filename=lecture.srt&start_ms=25000&end_ms=40000", headers=headers, content=transcript.encode())
    assert response.status_code == 201, response.text
    source = response.json()
    assert source["captured_text"] == THIRD_PAGE.strip()
    assert source["transcript"]["selected_time"] == {"start_ms": 25000, "end_ms": 40000}
    assert source["transcript"]["segments"] == [{"start": 0, "end": len(THIRD_PAGE.strip()), "start_ms": 24000, "end_ms": 42000}]
    assert source["coverage"] == "partial"
    assert "overlap" in source["coverage_detail"]


def test_whole_long_pdf_capture_includes_later_pages_with_honest_limit(browser_client):
    headers = {"Authorization": "Bearer alice"}
    text = FIRST_PAGE * 150
    response = browser_client.post("/api/v2/sources/pdf?filename=long-complete.pdf", headers=headers, content=pdf_bytes((text, THIRD_PAGE)))
    assert response.status_code == 201, response.text
    source = response.json()
    assert len(source["captured_text"]) > 30_000
    assert source["captured_text"].endswith(THIRD_PAGE.strip())
    assert source["coverage"] == "complete"
    limited = browser_client.post("/api/v2/sources/pdf?filename=long-limited.pdf", headers=headers, content=pdf_bytes((FIRST_PAGE * 500, THIRD_PAGE))).json()
    assert len(limited["captured_text"]) == 120_000
    assert limited["coverage"] == "partial"
    assert "omitted" in limited["coverage_detail"]


def test_long_source_uses_bounded_sections_then_coherent_grounded_synthesis():
    text = "Calculus studies change and accumulation. " * 1100
    calls, section_ids = [], []

    def external(request):
        payload = json.loads(json.loads(request.content)["messages"][-1]["content"])
        calls.append(payload)
        if "passages" in payload:
            assert sum(len(p["text"]) for p in payload["passages"]) <= 30_000
            assert len(payload["passages"]) <= 100
            ids = [payload["passages"][0]["id"]]
            section_ids.extend(ids)
        else:
            assert len(payload["sections"]) == 2
            ids = section_ids
        return model_response(request, {"text": "Calculus studies change and accumulated quantities.", "citation_ids": ids} if "passages" in payload else draft_for(ids))

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(external)) as client:
            note = await StudyGenerator(client, api_key="test-key").generate(text)
        assert len(calls) == 3
        assert len(note.references) == 2
        assert note.references[0].start == 0
        assert note.references[1].start >= 29_000
        assert all(r.excerpt == text[r.start:r.end] for r in note.references)
    asyncio.run(run())


def test_worker_retry_keeps_successful_sections_and_never_publishes_failed_aggregate():
    from backend.study_store import StudyStore
    from backend.study_worker import build_source_study
    source = "33333333-3333-4333-8333-333333333333"
    lease = "44444444-4444-4444-8444-444444444444"
    text = "Calculus studies change and accumulation. " * 1100
    summaries, finishes, plans, model_inputs = [], [], [], []
    failing = {"enabled": True}

    def external(request):
        body = json.loads(request.content)
        if request.url.host == "supabase.test":
            name = request.url.path.rsplit("/", 1)[-1]
            if name == "claim_source_study":
                return httpx.Response(200, json={"source_id": source, "source_version": 1, "user_id": "11111111-1111-4111-8111-111111111111", "lease_token": lease, "attempt": 1 if failing["enabled"] else 2, "captured_text": text, "completed_sections": summaries})
            if name == "plan_source_study":
                plans.append(body["p_total"])
            elif name == "save_study_section":
                assert body["p_source_version"] == 1 and body["p_lease_token"] == lease
                assert body["p_index"] == len(summaries)
                summaries.append(body["p_summary"])
            else:
                assert name == "finish_source_study"
                finishes.append(body)
            return httpx.Response(200, json=True)
        payload = json.loads(body["messages"][-1]["content"])
        model_inputs.append(payload)
        if "passages" in payload:
            ids = [payload["passages"][0]["id"]]
            if ids != ["p0001"] and failing["enabled"]:
                return httpx.Response(503, json={"error": {"message": "upstream failure"}})
            draft = {"text": "Calculus studies change and accumulated quantities.", "citation_ids": ids}
        else:
            draft = draft_for([s["citation_ids"][0] for s in summaries])
        return model_response(request, draft)

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(external)) as client:
            ctx = {"store": StudyStore(client, "https://supabase.test", {"apikey": "sb_secret_test"}), "generator": StudyGenerator(client, api_key="test-key")}
            await build_source_study(ctx, source)
            assert len(summaries) == 1
            assert finishes[0]["p_note"] is None
            assert finishes[0]["p_error_code"] == "provider_unavailable"
            failing["enabled"] = False
            await build_source_study(ctx, source)
        assert plans == [2, 2]
        assert len(summaries) == 2
        assert len(model_inputs) == 4  # two initial sections, remaining section and synthesis
        assert finishes[1]["p_error_code"] is None
        assert len(finishes[1]["p_note"]["references"]) == 2
    asyncio.run(run())


@pytest.mark.parametrize("query", ["start_ms=0&end_ms=50000", "start_ms=15000&end_ms=18000", "start_ms=25000", "start_ms=42000&end_ms=24000"])
def test_missing_or_invalid_transcript_time_ranges_save_nothing(browser_client, query):
    headers = {"Authorization": "Bearer alice", "X-Video-URL": "https://www.youtube.com/watch?v=ovrv11testA"}
    transcript = "1\n00:00:06,000 --> 00:00:12,000\n" + FIRST_PAGE + "\n\n2\n00:00:24,000 --> 00:00:42,000\n" + THIRD_PAGE
    result = browser_client.post("/api/v2/sources/video?" + query, headers=headers, content=transcript.encode())
    assert result.status_code == 422, result.text
    assert browser_client.get("/api/v2/sources", headers=headers).json()["sources"] == []


def test_untimed_transcripts_offer_whole_text_instead_of_inventing_a_time_range(browser_client):
    headers = {"Authorization": "Bearer alice", "X-Video-URL": "https://www.youtube.com/watch?v=ovrv11testA"}
    result = browser_client.post("/api/v2/sources/video?start_ms=0&end_ms=1000", headers=headers, content=FIRST_PAGE.encode())
    assert result.status_code == 422
    assert "real VTT/SRT" in result.json()["detail"]
    assert browser_client.get("/api/v2/sources", headers=headers).json()["sources"] == []


def test_public_pdf_link_selection_keeps_original_pages(browser_client):
    result = browser_client.post("/api/v2/sources/pdf-link", headers={"Authorization": "Bearer alice"}, json={"url": "https://article.test/pdf-file", "pages": {"start": 3, "end": 3}})
    assert result.status_code == 201, result.text
    assert result.json()["document"]["pages"][0]["page"] == 3
    assert result.json()["capture_origin"] == "direct"


@pytest.mark.parametrize("boundary", ["plan_source_study", "save_study_section"])
def test_stale_worker_stops_without_publishing_sections_or_a_final_note(boundary):
    from backend.study_store import StudyStore
    from backend.study_worker import build_source_study
    calls = []
    def external(request):
        if request.url.host != "supabase.test":
            return model_response(request, draft_for(["p0001"]))
        name = request.url.path.rsplit("/", 1)[-1]
        calls.append(name)
        if name == "claim_source_study":
            return httpx.Response(200, json={"source_id": "33333333-3333-4333-8333-333333333333", "source_version": 2, "user_id": "11111111-1111-4111-8111-111111111111", "lease_token": "44444444-4444-4444-8444-444444444444", "attempt": 1, "captured_text": FIRST_PAGE})
        return httpx.Response(200, json=name != boundary)
    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(external)) as client:
            await build_source_study({"store": StudyStore(client, "https://supabase.test", {"apikey": "sb_secret_test"}), "generator": StudyGenerator(client, api_key="test-key")}, "33333333-3333-4333-8333-333333333333")
        assert "finish_source_study" not in calls
        assert calls[-1] == boundary
    asyncio.run(run())
