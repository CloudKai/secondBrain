"""User-supplied video transcripts through the owned-source HTTP interface."""

from backend.tests.test_sources import browser_client  # noqa: F401
import pytest


TRANSCRIPT = (
    "Algebra uses symbols to express relationships between quantities. "
    "A variable represents an unknown quantity, and an equation states that two expressions are equal."
)


def test_pasted_video_transcript_reopens_with_supplied_provenance(browser_client):
    headers = {
        "Authorization": "Bearer alice",
        "Content-Type": "text/plain",
        "X-Video-URL": "https://youtu.be/aircAruvnKk?t=5",
    }
    response = browser_client.post(
        "/api/v2/sources/video",
        params={"title": "Algebra"},
        headers=headers,
        content=TRANSCRIPT,
    )
    assert response.status_code == 201, response.text
    source = response.json()
    assert source["source_kind"] == "video"
    assert source["original_url"] == "https://youtu.be/aircAruvnKk?t=5"
    assert source["canonical_url"] == "https://www.youtube.com/watch?v=aircAruvnKk"
    assert source["captured_text"] == TRANSCRIPT
    assert source["capture_origin"] == "pasted"
    assert source["coverage"] == "unknown"
    assert "User-supplied" in source["coverage_detail"]
    assert source["transcript"]["format"] == "text"
    assert source["transcript"]["provider"] == "youtube"
    assert source["transcript"]["segments"] == [
        {"start": 0, "end": len(TRANSCRIPT), "start_ms": None, "end_ms": None}
    ]
    reopened = browser_client.get(f"/api/v2/sources/{source['id']}", headers=headers)
    assert reopened.status_code == 200
    assert reopened.json() == source


def test_uploaded_vtt_retains_real_cue_times_and_speaker_text(browser_client):
    transcript = (
        "WEBVTT\n\nintro\n00:00:05.250 --> 00:00:20.500 align:start\n<v Lecturer>"
        + TRANSCRIPT
        + "\n\n00:00:30.000 --> 00:00:40.000\nCalculus studies how quantities change."
    )
    response = browser_client.post(
        "/api/v2/sources/video",
        params={"filename": "lecture.vtt"},
        headers={
            "Authorization": "Bearer alice",
            "X-Video-URL": "https://www.youtube.com/watch?v=aircAruvnKk",
        },
        content=transcript,
    )
    assert response.status_code == 201, response.text
    source = response.json()
    assert source["capture_origin"] == "upload"
    assert source["transcript"]["format"] == "vtt"
    assert (
        source["captured_text"]
        == "Lecturer: " + TRANSCRIPT + "\nCalculus studies how quantities change."
    )
    assert [(s["start_ms"], s["end_ms"]) for s in source["transcript"]["segments"]] == [
        (5250, 20500),
        (30000, 40000),
    ]
    assert (
        source["transcript"]["segments"][1]["start"]
        == len("Lecturer: " + TRANSCRIPT) + 1
    )


def test_transcript_model_references_receive_only_supplied_cue_times():
    import asyncio
    import copy
    import httpx
    from backend.study_generation import StudyGenerator
    from backend.transcript_models import TranscriptDocument
    from backend.tests.test_study_generation import DRAFT, completion

    second = "Calculus studies how quantities change."
    text = TRANSCRIPT + "\n" + second
    transcript = TranscriptDocument(
        provider="youtube",
        format="vtt",
        segments=[
            {"start": 0, "end": len(TRANSCRIPT), "start_ms": 5250, "end_ms": 20500},
            {
                "start": len(TRANSCRIPT) + 1,
                "end": len(text),
                "start_ms": 30000,
                "end_ms": 40000,
            },
        ],
    )
    draft = copy.deepcopy(DRAFT)
    for claim in [
        draft["overview"],
        *draft["concepts"],
        *draft["examples"],
        *draft["equations"],
        *draft["recall"],
    ]:
        claim["citation_ids"] = ["p0002"]

    async def run():
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(lambda request: completion(request, draft))
        ) as client:
            note = await StudyGenerator(client, api_key="test-key").generate(
                text, transcript=transcript
            )
        reference = note.references[0]
        assert reference.excerpt == second
        assert (reference.start_ms, reference.end_ms) == (30000, 40000)
        assert reference.page is None

    asyncio.run(run())


@pytest.mark.parametrize(
    "url,provider",
    [
        ("https://tenant.sharepoint.com/:v:/s/lecture/recording", "teams"),
        ("https://teams.microsoft.com/l/recording/lecture", "teams"),
        ("https://school.zoom.us/rec/share/recording?pwd=fixture", "zoom"),
        (
            "https://school.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=33333333-3333-4333-8333-333333333333",
            "panopto",
        ),
    ],
)
def test_recording_context_is_owned_without_provider_access(
    browser_client, url, provider
):
    response = browser_client.post(
        "/api/v2/sources/video",
        headers={"Authorization": "Bearer alice", "X-Video-URL": url},
        content=TRANSCRIPT,
    )
    assert response.status_code == 201, response.text
    source = response.json()
    assert source["original_url"] == url
    assert source["transcript"]["provider"] == provider
    assert "No video was fetched" in source["coverage_detail"]
    bob = {"Authorization": "Bearer bob"}
    assert (
        browser_client.get(f"/api/v2/sources/{source['id']}", headers=bob).status_code
        == 404
    )
    assert (
        browser_client.delete(
            f"/api/v2/sources/{source['id']}", headers=bob
        ).status_code
        == 404
    )
    assert (
        browser_client.get(
            f"/api/v2/sources/{source['id']}", headers={"Authorization": "Bearer alice"}
        ).status_code
        == 200
    )


def test_srt_paste_preserves_zero_time_and_reuses_one_owned_video(browser_client):
    content = "1\n00:00:00,000 --> 00:00:20,125\n" + TRANSCRIPT
    headers = {
        "Authorization": "Bearer alice",
        "X-Video-URL": "https://youtu.be/aircAruvnKk",
    }
    first = browser_client.post(
        "/api/v2/sources/video", headers=headers, content=content
    )
    assert first.status_code == 201, first.text
    source = first.json()
    assert source["transcript"]["format"] == "srt"
    assert source["transcript"]["segments"][0]["start_ms"] == 0
    assert source["transcript"]["segments"][0]["end_ms"] == 20125
    duplicate = browser_client.post(
        "/api/v2/sources/video",
        headers={
            **headers,
            "X-Video-URL": "https://www.youtube.com/watch?v=aircAruvnKk&t=10s",
        },
        content=content,
    )
    assert duplicate.json()["id"] == source["id"]
    bob = browser_client.post(
        "/api/v2/sources/video",
        headers={**headers, "Authorization": "Bearer bob"},
        content=content,
    )
    assert bob.status_code == 201
    assert bob.json()["id"] != source["id"]


@pytest.mark.parametrize(
    "filename,data,detail",
    [
        ("lecture.docx", b"PK" + b"x" * 200, "paste"),
        ("lecture", TRANSCRIPT.encode(), "TXT"),
        ("lecture.txt", b"\xff" * 200, "UTF-8"),
        ("lecture.txt", b"\x00" * 200, "readable"),
        (
            "lecture.vtt",
            ("WEBVTT\n\n00:00:60.000 --> 00:01:10.000\n" + TRANSCRIPT).encode(),
            "time",
        ),
        (
            "lecture.srt",
            ("1\n00:00:10,000 --> 00:00:05,000\n" + TRANSCRIPT).encode(),
            "times",
        ),
        (
            "lecture.srt",
            (
                "1\n00:00:10,000 --> 00:00:15,000\n"
                + TRANSCRIPT
                + "\n\n2\n00:00:05,000 --> 00:00:08,000\nEarlier"
            ).encode(),
            "source order",
        ),
        ("lecture.txt", b"x" * 1_000_001, "1 MB"),
        ("lecture.txt", b"short", "120"),
    ],
)
def test_unsupported_transcripts_receive_correction_without_saving(
    browser_client, filename, data, detail
):
    response = browser_client.post(
        "/api/v2/sources/video",
        params={"filename": filename},
        headers={
            "Authorization": "Bearer alice",
            "X-Video-URL": "https://youtu.be/aircAruvnKk",
        },
        content=data,
    )
    assert response.status_code in (413, 422)
    assert detail in response.json()["detail"]
    assert (
        browser_client.get(
            "/api/v2/sources", headers={"Authorization": "Bearer alice"}
        ).json()["sources"]
        == []
    )


def test_long_transcript_marks_partial_and_limits_captured_cue_span(browser_client):
    content = "WEBVTT\n\n00:00:05.000 --> 00:02:00.000\n" + TRANSCRIPT * 250
    response = browser_client.post(
        "/api/v2/sources/video",
        params={"filename": "long.vtt"},
        headers={
            "Authorization": "Bearer alice",
            "X-Video-URL": "https://youtu.be/aircAruvnKk",
        },
        content=content,
    )
    assert response.status_code == 201, response.text
    source = response.json()
    assert source["coverage"] == "partial"
    assert len(source["captured_text"]) == 30000
    assert source["transcript"]["segments"] == [
        {"start": 0, "end": 30000, "start_ms": 5000, "end_ms": 120000}
    ]


def test_video_capture_requires_session_and_supported_recording(browser_client):
    assert (
        browser_client.post(
            "/api/v2/sources/video",
            headers={"X-Video-URL": "https://youtu.be/aircAruvnKk"},
            content=TRANSCRIPT,
        ).status_code
        == 401
    )
    for url in [
        "http://youtu.be/aircAruvnKk",
        "https://youtube.com/@channel",
        "https://school.zoom.us/j/12345",
        "https://youtube.com.evil.test/watch?v=aircAruvnKk",
        "https://user:password@youtu.be/aircAruvnKk",
    ]:
        response = browser_client.post(
            "/api/v2/sources/video",
            headers={"Authorization": "Bearer alice", "X-Video-URL": url},
            content=TRANSCRIPT,
        )
        assert response.status_code == 422


def test_untimed_transcript_can_contain_a_literal_arrow(browser_client):
    response = browser_client.post(
        "/api/v2/sources/video",
        headers={
            "Authorization": "Bearer alice",
            "X-Video-URL": "https://youtu.be/aircAruvnKk",
        },
        content=TRANSCRIPT + "\nInput --> Output is an illustrative relationship.",
    )
    assert response.status_code == 201, response.text
    assert response.json()["transcript"]["format"] == "text"
    assert response.json()["transcript"]["segments"][0]["start_ms"] is None


def test_panopto_presentation_parameters_reuse_the_recording(browser_client):
    base = "https://school.hosted.panopto.com/Panopto/Pages/Viewer.aspx"
    first = browser_client.post(
        "/api/v2/sources/video",
        headers={
            "Authorization": "Bearer alice",
            "X-Video-URL": base + "?id=session-id&start=5",
        },
        content=TRANSCRIPT,
    )
    second = browser_client.post(
        "/api/v2/sources/video",
        headers={
            "Authorization": "Bearer alice",
            "X-Video-URL": base + "?start=30&id=session-id&isLive=false",
        },
        content=TRANSCRIPT,
    )
    assert first.status_code == second.status_code == 201
    assert first.json()["id"] == second.json()["id"]
    assert first.json()["canonical_url"] == base + "?id=session-id"


def test_saved_video_contract_rejects_inconsistent_identity(browser_client):
    from backend.source_models import CapturedSource
    from pydantic import ValidationError
    import json

    response = browser_client.post(
        "/api/v2/sources/video",
        headers={
            "Authorization": "Bearer alice",
            "X-Video-URL": "https://youtu.be/aircAruvnKk",
        },
        content=TRANSCRIPT,
    )
    row = {**response.json(), "user_id": "11111111-1111-4111-8111-111111111111"}
    CapturedSource.model_validate_json(json.dumps(row))
    for update in [
        {"canonical_url": "https://example.com/unrelated"},
        {"original_url": "https://school.zoom.us/rec/share/different"},
        {"transcript": {**row["transcript"], "provider": "panopto"}},
        {"coverage": "complete"},
    ]:
        with pytest.raises(ValidationError):
            CapturedSource.model_validate_json(json.dumps({**row, **update}))


def test_teams_recap_vtt_preserves_original_context_speaker_and_real_times(
    browser_client,
):
    url = "https://teams.cloud.microsoft/l/meetingrecap?threadId=meeting-fixture&organizerId=organizer-fixture"
    caption = "WEBVTT\n\n00:00:05.250 --> 00:00:20.500\n<v Lecturer>" + TRANSCRIPT
    headers = {"Authorization": "Bearer alice", "X-Video-URL": url}
    first = browser_client.post(
        "/api/v2/sources/video",
        headers=headers,
        params={"filename": "teams-export.vtt", "title": "Algebra"},
        content=caption,
    )
    assert first.status_code == 201, first.text
    source = first.json()
    assert source["original_url"] == url
    assert source["canonical_url"] == url
    assert source["transcript"]["provider"] == "teams"
    assert source["transcript"]["filename"] == "teams-export.vtt"
    assert source["captured_text"] == "Lecturer: " + TRANSCRIPT
    assert source["transcript"]["segments"] == [
        {"start": 0, "end": 173, "start_ms": 5250, "end_ms": 20500}
    ]
    assert source["capture_origin"] == "upload"
    assert "User-supplied" in source["coverage_detail"]
    assert "No video was fetched" in source["coverage_detail"]
    assert (
        browser_client.get("/api/v2/sources/" + source["id"], headers=headers).json()
        == source
    )
    duplicate = browser_client.post(
        "/api/v2/sources/video",
        headers={**headers, "X-Video-URL": url + "#recap"},
        params={"filename": "teams-export.vtt"},
        content=caption,
    )
    assert duplicate.json()["id"] == source["id"]
    assert (
        browser_client.get(
            "/api/v2/sources/" + source["id"], headers={"Authorization": "Bearer bob"}
        ).status_code
        == 404
    )
