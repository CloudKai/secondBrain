# AI Second Brain backend

Python 3.11 FastAPI service implementing the Deep Feynman LangGraph pipeline.

From the repository root:

```bash
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
export OPENAI_API_KEY="your-key"
uvicorn backend.main:app --reload
```

Process a link:

```bash
curl -X POST http://127.0.0.1:8000/api/v1/process-link \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com/article","folder_id":"learning"}'
```

Interactive API documentation is available at `http://127.0.0.1:8000/docs`.

Run the test suite with `pytest backend/tests` from the repository root.

Alternatively, `uv sync --project backend --extra dev` creates the environment
directly from `pyproject.toml`.
