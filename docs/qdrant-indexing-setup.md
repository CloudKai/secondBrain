# Web retrieval indexing — ticket #26

## Verified locally (2026-10-07)

Qdrant credentials are configured server-side and a connectivity read succeeded
against version 1.19.2. Dedicated collection
`web_sources_recursive_v1_openai_small_1536` has named 1536-dimensional cosine
`dense` vectors, BM25 `idf` sparse vectors, and indexed owner/source/generation/
version fields. Collection setup refuses incompatible existing vector settings.
The learner explicitly approved migration 013 and Supabase reported success on
2026-10-07. One named public PDF baseline source
`2dfc7546-802f-47a2-9b52-79577a48cb79` now has a ready manifest, source version 1
and 2/2 chunks. Original SHA-256/offsets and physical page 6 match; both dense
1536-dimensional vectors and nonempty BM25 sparse vectors exist. A scoped BM25
smoke query for positional encoding returned two correctly owned hits. This is
infrastructure acceptance for one PDF, not a retrieval-quality benchmark.

Background indexing is enabled in local development after explicit user approval.
Redis and `backend.retrieval_worker` are running on the dedicated `arq:retrieval`
queue. Automatic fresh-source indexing and deletion cleanup passed against the
configured hosted services. Authenticated status, cross-owner denial, retry,
refresh and waiting/ready/reload browser checks also pass. See
[the acceptance report](reviews/qdrant-indexing-acceptance-2026-10-07.md).
The assistant now uses the hybrid path locally after migration 014 and hosted
functional acceptance. Hosting the worker and wider quality benchmarks remain
future work.

## Accepted indexing contracts

Migration `supabase/migrations/202610070013_retrieval_index.sql` adds a private
manifest/work table and capture/change/delete trigger. Existing sources receive
queued jobs in the same transaction. Note text, study jobs and citation IDs are
preserved; saving a source does not contact Qdrant or OpenAI.

Manifests retain source version, SHA-256 of captured UTF-8 text, generation,
immutable chunk/embedding settings, attempts and checkpoints. Deletion tombstones
survive source removal and contain no captured text. Learners cannot read this
table or claim worker jobs. The authenticated `/api/v2/sources/{id}/index-status`
endpoint returns only owned current-source progress. Frontend readiness display and hosted API acceptance pass.

Index chunks respect PDF pages and caption cue groups/gaps, then recursively split
oversized paragraphs, sentences, whitespace and finally long words. Maximum chunk
size is 3,000 characters including at most 200 characters of complete-sentence
overlap within one structural group. Exact offsets and actual cue times are kept.
This policy does not change `pNNNN` citation passages or existing saved notes.

Each batch contains at most 16 chunks. OpenAI `text-embedding-3-small` produces
1536-dimensional dense vectors; Qdrant's native `qdrant/bm25` processes sparse text
with English settings. Qdrant payloads store identities/locations, not raw excerpts.
BM25 text is transmitted to Qdrant for indexing. Point IDs are deterministic per
manifest generation and chunk position. Retries resume committed batches.

Lease checkpoints renew a ten-minute lease and reject superseded/expired work.
Retries are bounded to three attempts, then show failure; interrupted leases are
recovered by dispatch. Version replacement/deletion queues new work, waiting for
an old lease deadline when necessary. Stale workers clean only their generation;
old-version cleanup cannot delete a newer version. Query-time owner/scope/current
manifest revalidation is required before any later assistant query integration.
This unit exposes no Qdrant search endpoint and establishes no capacity guarantee.

## Local activation and restart

Migration 013 and collection setup are applied. Server-only credentials stay in
ignored `backend/.env`. `ENABLE_RETRIEVAL_INDEXING=true` is set for this development
project following explicit approval. The template default remains false.

With Redis available, start the dedicated worker from the repository root:

```bash
backend/.venv/bin/python -m backend.retrieval_worker
```

It uses `arq:retrieval` and automatically sends queued/future captured text to
OpenAI and Qdrant. ARQ lifecycle callbacks and safety settings are declared directly
on its settings class; ARQ does not inherit those declarations. This is a local
development process using hosted storage services, not a hosted worker deployment.

A rollback stops workers, removes the capture trigger and revokes the indexing
RPCs while retaining manifests for cleanup/recovery. Qdrant and Postgres captures
are not deleted by the migration or rollback. Re-enable by restoring trigger/RPC
grants deliberately.

## Checks

Python HTTP-boundary tests cover PDF spans, caption timing, authentication, stale
claims, embedding failure, schema mismatch and opt-in dispatch. Full backend
regressions run using the project Python interpreter. The AGENTS `uv ... pytest`
command encountered a uv cache sandbox restriction; the project interpreter is
the verified fallback.

Disposable Postgres 16 applied every repository migration successfully. Rolled-
back `backend/tests/sql/retrieval_acceptance.sql` checks actual authenticated/
service-role calls: queue-on-capture, cross-owner denial, private manifest denial,
worker denial, duplicate claims, checkpoints, incomplete-ready rejection, retries,
refresh generation/lease fencing, expired-lease recovery and deletion tombstones.
It uses `backend/tests/sql/retrieval_bootstrap.sql` as minimal Supabase auth/role
scaffolding; this is not hosted acceptance or a concurrency stress test.

API choices follow [Qdrant hybrid search documentation](https://qdrant.tech/documentation/search-tuning/hybrid-search/)
and [native BM25 documentation](https://qdrant.tech/documentation/search/text-search/full-text-search/).
Later query integration must scope IDF statistics and retrieval independently to
an authenticated learner on this compatible server, and revalidate returned IDs
against Postgres inventory before supplying evidence to a model.

## Hybrid assistant queries — enabled locally

Ticket #27 query integration is enabled with `ENABLE_HYBRID_RETRIEVAL=true` in the
ignored development environment after explicit migration approval and hosted
functional acceptance. The template default remains false. Migration 014 is
applied; it adds authenticated inventory, exact capture loading and revision
validation functions without modifying saved source/note/index rows.

Restart the API to load changes to the environment file. The current server is
bound to localhost:8000. Hybrid queries embed the question, query owned current
Qdrant generations and load exact evidence through the learner's Postgres session.
No browser vector credentials are exposed. Wider retrieval-quality comparisons
and hosted deployment remain pending.

Rollback: disable the query flag and restart API processes before applying the
014 rollback, which drops only its three functions. Background indexing and
manifests remain intact. [Acceptance](reviews/hybrid-retrieval-acceptance-2026-10-07.md).
