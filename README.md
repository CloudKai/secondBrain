# Second Brain

AI Second Brain is a mobile knowledge-capture app built for the Shipathon
hackathon. Share a web article from iOS, choose a folder, and the backend turns
it into a four-point Feynman summary and an interactive concept graph.

## Repository layout

- `backend/` — FastAPI and LangGraph processing API.
- `mobile/` — Expo Router application, tracked as the
  [`CloudKai/mobile`](https://github.com/CloudKai/mobile) submodule.

Clone both repositories with:

```bash
git clone --recurse-submodules https://github.com/CloudKai/secondBrain.git
```

If the main repository is already cloned:

```bash
git submodule update --init --recursive
```

See `backend/README.md` and `mobile/README.md` for setup and run commands.
