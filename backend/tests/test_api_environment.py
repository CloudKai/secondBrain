"""API startup loads local settings without replacing deployment settings."""

import os
from pathlib import Path
import subprocess
import sys

import pytest


@pytest.mark.parametrize("process_settings", [False, True])
def test_api_loads_adjacent_env_before_serving_sources(tmp_path, process_settings):
    root = Path(__file__).resolve().parents[2]
    api_dir = tmp_path / "backend"
    api_dir.mkdir()
    entrypoint = api_dir / "main.py"
    entrypoint.write_text((root / "backend/main.py").read_text())
    (api_dir / ".env").write_text(
        "SUPABASE_URL=https://file.supabase.test\n"
        "SUPABASE_PUBLISHABLE_KEY=file-public-key\n"
    )
    env = dict(os.environ, PYTHONPATH=str(root))
    for name in ("SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY"):
        env.pop(name, None)
    if process_settings:
        env.update(SUPABASE_URL="https://process.supabase.test",
                   SUPABASE_PUBLISHABLE_KEY="process-public-key")
    expected_host = "process.supabase.test" if process_settings else "file.supabase.test"
    expected_key = "process-public-key" if process_settings else "file-public-key"
    result = subprocess.run(
        [sys.executable, "-c", """
import runpy
import sys
from unittest.mock import patch
import httpx
from fastapi.testclient import TestClient

app = runpy.run_path(sys.argv[1])["app"]
requests = []
def upstream(request):
    requests.append(request)
    assert request.url.host == sys.argv[2]
    assert request.headers["apikey"] == sys.argv[3]
    assert request.headers["authorization"] == "Bearer learner-test"
    if request.url.path == "/auth/v1/user":
        return httpx.Response(200, json={"id": "11111111-1111-4111-8111-111111111111"})
    assert request.url.path == "/rest/v1/sources"
    assert request.url.params["user_id"] == "eq.11111111-1111-4111-8111-111111111111"
    return httpx.Response(200, json=[])

original_client = httpx.AsyncClient
with patch.object(httpx, "AsyncClient", side_effect=lambda **kw:
        original_client(**{**kw, "transport": httpx.MockTransport(upstream)})):
    response = TestClient(app).get("/api/v2/sources?offset=0",
        headers={"Authorization": "Bearer learner-test"})
assert response.status_code == 200, (response.status_code, response.json())
assert response.json() == {"sources": [], "next_offset": None}
assert len(requests) == 2
""", str(entrypoint), expected_host, expected_key],
        cwd=tmp_path, env=env, capture_output=True, text=True, timeout=30,
    )
    assert result.returncode == 0, result.stdout + result.stderr
