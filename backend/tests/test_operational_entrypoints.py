"""Existing deployment and worker commands survive the package reorganization."""

import importlib
import os
from pathlib import Path
import runpy
import subprocess
import sys

from dotenv import load_dotenv
import pytest


@pytest.mark.parametrize("entrypoint,implementation,settings_name", [
    ("backend.study_worker", "backend.workers.study", "WorkerSettings"),
    ("backend.retrieval_worker", "backend.workers.retrieval", "RetrievalWorkerSettings"),
])
def test_worker_commands_load_backend_env_from_another_cwd(
    tmp_path, monkeypatch, entrypoint, implementation, settings_name,
):
    module = importlib.import_module(implementation)
    settings = getattr(module, settings_name)
    backend_dir = Path(__file__).resolve().parents[1]
    env_file = tmp_path / ".env"
    values = {
        "REDIS_URL": "redis://127.0.0.1:6379/4",
        "ENABLE_RETRIEVAL_INDEXING": "true",
        "QDRANT_URL": "https://qdrant.test",
        "QDRANT_API_KEY": "test-only",
    }
    env_file.write_text("".join(f"{key}={value}\n" for key, value in values.items()))
    monkeypatch.setattr(os, "environ", os.environ.copy())
    for key in values:
        monkeypatch.delenv(key, raising=False)
    monkeypatch.chdir(tmp_path)
    loads = []

    def local_settings(path, *, override):
        loads.append((path, override))
        return load_dotenv(env_file, override=override)

    workers = []
    monkeypatch.setattr(module, "load_dotenv", local_settings)
    monkeypatch.setattr(module, "run_worker", workers.append)
    monkeypatch.setattr(settings, "redis_settings", None, raising=False)
    runpy.run_module(entrypoint, run_name="__main__")

    assert loads == [(backend_dir / ".env", False)]
    assert workers == [settings]
    assert settings.redis_settings.database == 4


def test_vercel_service_root_bootstrap_works_without_repository_on_pythonpath():
    backend_dir = Path(__file__).resolve().parents[1]
    result = subprocess.run(
        [sys.executable, "-I", "-c", """
import sys
sys.path.insert(0, sys.argv[1])
from vercel_app import app
from fastapi.testclient import TestClient
response = TestClient(app).get('/api/health')
assert response.status_code == 200
assert response.json() == {'status': 'ok'}
""", str(backend_dir)],
        cwd=backend_dir, env=os.environ.copy(), capture_output=True, text=True, timeout=30,
    )
    assert result.returncode == 0, result.stdout + result.stderr


def test_retrieval_setup_command_loads_backend_env_from_another_cwd(tmp_path, monkeypatch):
    import dotenv
    from backend.retrieval import indexing

    backend_dir = Path(__file__).resolve().parents[1]
    env_file = tmp_path / ".env"
    env_file.write_text("QDRANT_URL=https://qdrant.test\nQDRANT_API_KEY=test-only\n")
    monkeypatch.setattr(os, "environ", os.environ.copy())
    for key in ("QDRANT_URL", "QDRANT_API_KEY"):
        monkeypatch.delenv(key, raising=False)
    monkeypatch.chdir(tmp_path)
    loads, setups = [], []

    def local_settings(path, *, override):
        loads.append((path, override))
        return load_dotenv(env_file, override=override)

    async def ensure_collection(client, url, key):
        setups.append((url, key))

    monkeypatch.setattr(dotenv, "load_dotenv", local_settings)
    monkeypatch.setattr(indexing, "ensure_collection", ensure_collection)
    runpy.run_module("backend.retrieval_indexing", run_name="__main__")
    assert loads == [(backend_dir / ".env", False)]
    assert setups == [("https://qdrant.test", "test-only")]
