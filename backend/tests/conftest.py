"""Keep mocked provider tests independent of local model overrides."""

import pytest


@pytest.fixture(autouse=True)
def generation_model_default(monkeypatch):
    monkeypatch.setenv("OPENAI_MODEL", "gpt-6-luna")
