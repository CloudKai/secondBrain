from fastapi.testclient import TestClient

import pytest
from pydantic import ValidationError

from backend.main import app
from backend.schemas import ProcessLinkResponse


class StubGraph:
    async def ainvoke(self, state, config):
        assert state == {
            "raw_text": "Article title https://example.com/article",
            "simplified_summary": "",
            "diagram_type": "network",
            "diagram_options": ["network"],
            "nodes": [],
            "edges": [],
        }
        assert config["configurable"]["source_url"] == "https://example.com/article"
        return {
            "raw_text": "Dense source text",
            "simplified_summary": "- One\n- Two\n- Three\n- Four",
            "diagram_type": "flow",
            "diagram_options": ["flow", "hierarchy", "network"],
            "nodes": [
                {"id": "A", "label": "One"},
                {"id": "B", "label": "Two"},
            ],
            "edges": [{"id": "A-B", "source": "A", "target": "B", "label": None}],
        }


def test_health() -> None:
    response = TestClient(app).get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_process_link_returns_typed_pipeline_result(monkeypatch) -> None:
    monkeypatch.setattr("backend.main.deep_feynman_graph", StubGraph())
    response = TestClient(app).post(
        "/api/v1/process-link",
        json={
            "url": "https://example.com/article",
            "raw_text": "Article title https://example.com/article",
            "folder_id": "learning",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body == {
        "folder_id": "learning",
        "source_url": "https://example.com/article",
        "raw_text": "Dense source text",
        "simplified_summary": "- One\n- Two\n- Three\n- Four",
        "diagram_type": "flow",
        "diagram_options": ["flow", "hierarchy", "network"],
        "nodes": [
            {"id": "A", "label": "One"},
            {"id": "B", "label": "Two"},
        ],
        "edges": [{"id": "A-B", "source": "A", "target": "B", "label": None}],
    }


def test_process_link_rejects_unknown_fields() -> None:
    response = TestClient(app).post(
        "/api/v1/process-link",
        json={
            "url": "https://example.com/article",
            "folder_id": "learning",
            "unexpected": True,
        },
    )
    assert response.status_code == 422


def test_response_rejects_incompatible_diagram_default() -> None:
    with pytest.raises(ValidationError, match="must be included"):
        ProcessLinkResponse.model_validate(
            {
                "folder_id": "learning",
                "source_url": "https://example.com/article",
                "raw_text": "Dense source text",
                "simplified_summary": "- One\n- Two\n- Three\n- Four",
                "diagram_type": "hierarchy",
                "diagram_options": ["flow", "network"],
                "nodes": [
                    {"id": "one", "label": "One"},
                    {"id": "two", "label": "Two"},
                ],
                "edges": [
                    {"id": "edge", "source": "one", "target": "two"}
                ],
            }
        )


def test_response_rejects_unknown_diagram_type() -> None:
    with pytest.raises(ValidationError):
        ProcessLinkResponse.model_validate(
            {
                "folder_id": "learning",
                "source_url": "https://example.com/article",
                "raw_text": "Dense source text",
                "simplified_summary": "- One\n- Two\n- Three\n- Four",
                "diagram_type": "mindmap",
                "diagram_options": ["mindmap"],
                "nodes": [
                    {"id": "one", "label": "One"},
                    {"id": "two", "label": "Two"},
                ],
                "edges": [
                    {"id": "edge", "source": "one", "target": "two"}
                ],
            }
        )


def test_process_link_rejects_blank_folder_id() -> None:
    response = TestClient(app).post(
        "/api/v1/process-link",
        json={"url": "https://example.com/article", "folder_id": "   "},
    )
    assert response.status_code == 422
