# Vercel services deployment

## Prepared configuration — 2026-10-20

The root `vercel.json` defines `backend` (FastAPI in `backend/`) and `web`
(static Vite in `web/`). Import the repository as **one** Vercel project with its
Root Directory set to the repository root. Build settings belong to each service;
do not override the project with a top-level framework or build command.

Public `/api/*` requests route to FastAPI, preserving the complete path. All other
requests route to Vite. Existing `/api/v1` and `/api/v2` handlers and browser
`/api/v2` URLs already agree. `/api/health` is a public health check; `/health`
remains available when running FastAPI directly. FastAPI's unprefixed `/docs` and
`/openapi.json` are not exposed by these rewrites. The web UI uses hash navigation.

`vercel_app:app` loads the existing `backend` Python package from the service
directory, including when the deployment bundle flattens that directory. Python
dependencies are declared in `backend/pyproject.toml` and `backend/uv.lock`.
PDF parsing launches its sibling script by absolute path so its disposable
subprocess also works without the repository parent on Python's import path.

## Calls and bindings

No service bindings are declared: the static web service has no server functions
that call the backend. Browser requests use the public same-origin `/api/*`
route. Vite's `WEB_API_URL` proxy is for standalone development only; it is not a
deployment hostname or a Vercel binding. Do not configure a bound URL as a
`VITE_*` variable: bindings resolve only in runtime functions, not during builds
or in browsers or middleware. Backend calls to Supabase, OpenAI and Qdrant target
external providers, not services in this deployment.

If a server-side web function or another internal service is introduced later,
declare its binding on the caller and read the injected URL in that function.

## Environment and background processing

- Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` before building the
  web service. These are public browser settings; redeploy after changing them.
- Set backend values from `backend/.env.example` in the Vercel project, using
  server-only names. Never prefix privileged values with `VITE_` or
  `EXPO_PUBLIC_`. Do not upload populated environment files or evaluator tokens.
- Use the intended Supabase project and its reviewed migrations/anonymous auth
  setup. Supabase, Redis and Qdrant are external services, not provisioned here.
- Run the existing `backend.study_worker` and, if enabled separately,
  `backend.retrieval_worker` on a persistent worker host with matching database,
  Redis and provider configuration. This configuration deploys HTTP services;
  it does not start ARQ workers or local Docker Compose Redis. Use a reachable
  Redis URL on the worker host rather than the template's localhost default.
- Match worker environments to preview/production data deliberately. An API
  deployment alone cannot complete queued notes, topics or indexes.

## Verify before deployment

From the repository root, run:

```sh
npx vercel@latest dev -L
```

`vercel dev` also works with a linked project and its environment. Use uv 0.9.25
or newer for Vercel's Python builder. Open the URL
printed by the CLI. Check `/`, web assets, `/api/health`, an authenticated
`/api/v2/sources` request, and an unknown `/api/*` route (which must stay an API
404). Verify an import completes with the separately hosted worker. Bare Vite
development remains `npm --prefix web run dev` with the standalone API proxy.

Configuration and local checks do not establish hosted acceptance. Confirm the
service names, public routes, lack of server-to-server bindings, and separate
worker hosting before deploying. Production deployment remains unverified.

Local checks on 2026-10-20: flattened-service imports and API health/auth/404
checks pass; 361 backend tests pass using `backend/.venv/bin/python -m pytest
backend/tests -q`; 134 web tests, web build/typecheck and lint pass. The prescribed
uv test command selects system pytest and fails collection on a missing
`langchain_openai` dependency. Vercel CLI **64.5.0** accepts the services schema,
detects both frameworks and starts Vite. Combined startup fails because the
installed uv **0.7.12** is below the Python builder's minimum **0.9.25**; the CLI
also attempts a saved-login refresh. The validation process was stopped. Upgrade
uv and resolve CLI authentication before repeating the combined smoke test.
Older CLI **54.12.0** rejects service destinations and should not be used here.
No project was deployed, and combined request routing is not verified.

References: [Services](https://vercel.com/docs/services),
[routing](https://vercel.com/docs/services/routing),
[bindings](https://vercel.com/docs/services/bindings).
