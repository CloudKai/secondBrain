# Decision: Qdrant for the web hybrid retrieval index

Date: 2026-10-07. Status: indexing accepted; background worker active locally; hybrid assistant queries planned.
Decision source: learner explicitly selected Qdrant and approved testing.

Use a shared Qdrant index for BM25 and dense semantic candidates in the hosted
web application. Supabase remains authoritative for captures, ownership, source
versions, topic assignments and readiness. A local development check must use
the same filtering/version contract as hosted use.

Qdrant data is derived and rebuildable. The browser never receives its API key or
queries it directly. Return current source spans through the authenticated backend
only after validating ownership, selected note/topic/library scope and current
versions in Postgres. Recheck context after generation as the existing API does.

Index manifests must record source version, captured-text fingerprint, chunking
policy, embedding model/version and readiness. Chunk offsets come from the original
capture; source passages keep their existing identities. Structure-first recursive
chunks respect PDF pages and caption cues, with controlled boundary-aware overlap.
Chunks can map to several smaller exact display citations.

Indexing and deletion propagation require durable retryable work. Never depend on
a successful Qdrant write to save a capture in Postgres. Query-time version checks
exclude stale/deleted chunks even while cleanup is delayed. Topic corrections and
combined assistant scopes must retain their ownership and revision fences.

Qdrant was preferred over a second replicated database and standard Supabase full
text ranking because the learner requested shared hosted BM25 plus semantic
retrieval. This does not establish a measured performance/cost advantage.

Next unit covers manifests, chunk/index work and retry/deletion fences; subsequent
query integration fuses BM25/dense rankings and measures them against the baseline.
Embedding settings, fusion candidate counts and any reranker are benchmark choices.
No deployed index, 200-source capacity or production acceptance is claimed.


## Implementation checkpoint — 2026-10-07

Qdrant 1.19.2 connectivity and the dedicated collection configuration are verified.
Local worker/manifest/status code and migration 013 are prepared; automatic
approval review rejected the hosted migration pending exact approval because the
selected Supabase branch is labeled `main PRODUCTION`. No source has been uploaded.
See [setup and check evidence](../../qdrant-indexing-setup.md).


### Hosted checkpoint — 2026-10-07

The learner explicitly approved migration 013; Supabase reported success.
One named public baseline PDF indexed with a ready 2/2-chunk manifest, exact
physical page-6 spans/fingerprint and both dense/BM25 vectors. A scoped BM25 smoke
query returned owned hits. Broader hosted fence/readiness acceptance remains
pending. Background dispatch is disabled; assistant query integration is later work.


## Background indexing activated and verified — 2026-10-07

The user explicitly approved background indexing. Local development now has
`ENABLE_RETRIEVAL_INDEXING=true`, Redis running and the dedicated
`backend.retrieval_worker` process on `arq:retrieval`. It automatically sends
queued and future captured text to the configured OpenAI embedding service and
Qdrant. This worker handles indexing and cleanup; it does not dispatch study or
topic generation. A hosted worker deployment remains future work.

A fresh disposable source reached ready automatically (1/1 chunk), then source
deletion automatically removed its Qdrant points. An earlier queued fixture also
recovered to ready and was deleted and cleaned automatically. Both fixtures have
zero remaining points. ARQ reads settings from the class's own dictionary;
explicit lifecycle and safety settings fixed inherited settings being skipped.
The added regression failed before the fix. All 214 backend tests pass; the
previous 69 web tests, typecheck, lint and build passed.

Ticket #26 indexing acceptance is complete. Assistant BM25/semantic query fusion,
Postgres scope/version revalidation and retrieval-quality comparisons are the
next unit. Earlier activation-pending checkpoints below are superseded.
Native/iOS and its tracker remain unchanged. No commit or push.


## Hybrid assistant retrieval activated locally — 2026-10-07

The user explicitly approved migration 014. Supabase reported success; hosted
learner inventory, current capture loading, snapshot validation, unauthenticated
401 and cross-owner 404 checks pass. A disposable copy of the public page-6 PDF
baseline indexed automatically and produced exact citations through the real
model and hosted storage services. Source removal invalidated its snapshot and
background cleanup left zero derived points.

Three bounded old/hybrid question replays returned expected supported/supported/
unsupported statuses. Hybrid complete-response times were 7.94s, 5.77s and 4.36s.
These are single samples on one PDF page, not latency percentiles, streamed-text
measurements or evidence of improved answer quality. A restarted localhost API
also returned a supported exact-page answer in 5.57s; that second fixture was
removed and cleaned automatically. Reports stay in ignored output/evaluation/.

`ENABLE_HYBRID_RETRIEVAL=true` is set in ignored backend/.env and the localhost
API was restarted. Both background indexing and hybrid answers now run locally
using hosted services. Templates retain false defaults. The previous 232 backend
and 69 web tests pass; git diff --check passes. Broader multi-source/held-out
retrieval comparisons under #25/#27 and semantic claim verification remain
unfinished. Native/iOS and its tracker remain untouched; no commit or push.
