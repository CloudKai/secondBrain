# Vercel services deployment

The current production configuration uses the Vercel-only queue transport
described below. The original persistent ARQ/Redis instructions remain useful
for local or separately hosted installations.

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

This repository uses one Vercel project with two services. Services share project
environment variables. In **Project Settings → Environment Variables**, add the
following union of the local web and backend settings for **Production**, and
for **Preview** if preview deployments should use the same intended project.
Use separate preview credentials when preview data must be isolated.

| Variable | Copy its value from | Used by |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Optional browser override; otherwise `SUPABASE_URL` | Browser build |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Optional browser override; otherwise `SUPABASE_PUBLISHABLE_KEY` | Browser build; public key |
| `SUPABASE_URL` | `backend/.env` | API |
| `SUPABASE_PUBLISHABLE_KEY` | `backend/.env` | API; same project/public key as the browser |
| `SUPABASE_SECRET_KEY` | `backend/.env` | Server-only learning/quiz persistence and generated writes |
| `OPENAI_API_KEY` | `backend/.env` | Server-only research and AI generation |

For the production Luna default, set these model variables explicitly:

```dotenv
OPENAI_MODEL=gpt-6-luna
QUIZ_GENERATION_MODEL=gpt-6-luna
QUIZ_FALLBACK_MODEL=gpt-6.1-sol
QUIZ_GRADING_MODEL=gpt-6-luna
QUIZ_REASONING_EFFORT=low
```

Replace an existing `OPENAI_MODEL=gpt-4o-mini` value; it overrides the code default.
The shared default now covers v1 output, notes, topics, overviews, the saved-source
assistant and research. Learning keeps its existing Luna/Sol medium-effort policy.
Quiz generation keeps its existing repair ladder; grading has no automatic Sol
fallback. Other features do not gain new automatic fallback by changing these
variables. Embedding configuration remains separate.

Save values for Production (and Preview if intended), then redeploy the updated
code. Apply `OPENAI_MODEL=gpt-6-luna` on the persistent worker host and restart
that worker as well. Local `.env` edits are not uploaded to Vercel automatically.

Set these explicit initial feature flags until their separate acceptance gates
are complete in the deployment's database:

```dotenv
QUIZ_ENABLED=false
ENABLE_HYBRID_RETRIEVAL=false
ENABLE_RETRIEVAL_INDEXING=false
```

`QUIZ_ENABLED=false` blocks generation/AI feedback; it does not install the quiz
migration or enable reads against a database missing its tables/functions.
Other `QUIZ_*` settings and `OPENAI_MODEL` can use the defaults documented in
`backend/.env.example`. `QDRANT_URL` and `QDRANT_API_KEY` are server-only and are
needed for configured retrieval/indexing and captured-evidence features, rather
than ordinary library reads or external research. Enable these features only
with their database/index setup and acceptance checks.

Do not copy `EVAL_SESSION_TOKEN`, `EXPO_PUBLIC_*`, or development `WEB_API_URL`
into this deployment. `REDIS_URL` belongs on the separately running worker host;
the API commits jobs through the database outbox and does not connect to Redis.
The worker also needs the same Supabase URL/server secret and OpenAI key. Its
Redis URL must be reachable from that host; `127.0.0.1` points at the host itself.

Enter real values in Vercel rather than uploading populated local env files.
Server credentials must retain their unprefixed names; only the two public
Supabase settings belong under `VITE_`. Redeploy after saving variables: existing
deployments do not acquire changed values, and Vite embeds public settings at
build time. See Vercel's [services](https://vercel.com/docs/services) and
[environment variable](https://vercel.com/docs/environment-variables) documentation.

- The web build explicitly maps only `SUPABASE_URL` and
  `SUPABASE_PUBLISHABLE_KEY` into the browser when the corresponding `VITE_*`
  override is absent. Local `.env` files and explicit `VITE_*` settings still
  work. Do not broaden `envPrefix`: private server settings must never be
  published. The build rejects `sb_secret_` values in the public-key slot.
  Redeploy after changing the settings.
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

## Vercel-only background processing — 2026-10-25

The root configuration declares a separate `worker` service with the same
Python dependencies and the `vercel_worker:app` entrypoint. Its service-local
function has an explicit `queue/v2beta` trigger for `secondbrain-work`. No public
rewrite points at this service, so only the queue infrastructure invokes it.
This explicit trigger is used because the Services build did not emit an
automatically discovered pyproject subscriber. No public worker URL or separate
always-running Redis/ARQ host is needed for this transport.
The pinned `vercel-queue[typed]==0.10.0` SDK authenticates with deployment OIDC.
Do not add a queue token to browser configuration. Set the non-secret production
setting `SECOND_BRAIN_QUEUE_TRANSPORT=vercel` to enable API wakeups explicitly.
The callback matches the platform-assigned consumer group and delegates receipt
acceptance, lease renewal and acknowledgement to the SDK.

After an authenticated request commits a study/topic/overview job, the API sends
a small dispatch signal. Status reads also wake queued work, recovering jobs
accepted before queue configuration or during a publish failure. The private
subscriber reuses the existing outbox dispatchers, database leases and generators.
Messages contain task names and UUIDs only. Outboxes are acknowledged only after
queue acceptance; refresh/retry messages are not suppressed by source-ID-only
deduplication. Database claims prevent duplicate model processing. Unfinished
jobs retain their queue delivery, with 130-second redelivery and at most ten
transport attempts. Database processing attempts retain the existing cap of
three. Consumer concurrency is capped at two. Local installations continue to
use ARQ when the transport setting and Vercel runtime marker are absent.

Each processing invocation stops at 240 seconds, leaving headroom under Hobby's
300-second function limit. Persisted section checkpoints survive cancellation;
the existing lease-recovery RPC resumes eligible work after lease expiry. Very
long sources can still exhaust the existing three-attempt budget; this does not
claim unlimited-duration document processing. Large, worst-case workloads need
a separately scoped stepwise Workflow integration or an appropriate worker host.

There is no plan upgrade or fixed server subscription in this change. Vercel
Queues is Beta. Its published Hobby allowance includes the first 1,000,000 queue
API operations; compute and model usage are still metered under their respective
plans. Do not interpret that allowance as unlimited free AI processing.

Sources checked 25 October 2026:
- https://vercel.com/docs/queues/python-sdk
- https://vercel.com/docs/queues/pricing
- https://vercel.com/docs/functions/configuring-functions/duration

Rollback: redeploy the earlier HTTP build and run the existing ARQ worker if
available. Postgres jobs and checkpoints remain authoritative; no schema change
or user-data conversion is required. Hosted subscriber discovery and an actual
source-to-note result must pass before marking the worker accepted.

### Hosted acceptance — 25 October 2026

Production source `f998073` is live in deployment
`dpl_4diCFS38wjo8FgXW26jf3KDjxFeb`. The explicit private worker function was
built, queue handoffs are accepted, and a queued test source succeeded on its
first processing attempt. An independent browser saved a public article,
received a complete study note in about 20 seconds, inspected recall and passage
citations, saw eight mapped topics, and confirmed persistence after reload.
[Browser verification](https://agent.tinyfish.ai/runs/1164c30b-e396-4353-b9f0-13f588dc4831).
This accepts the tested article flow; it does not claim every long-source,
learning, retrieval or quiz feature is tested.
