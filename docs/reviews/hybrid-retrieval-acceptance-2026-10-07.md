# Hybrid assistant retrieval — 2026-10-07

Status: migration 014 applied after explicit approval; hosted functional acceptance
passes and hybrid retrieval is enabled in local development. The live localhost
API uses Qdrant and the configured model service. Wider retrieval-quality
acceptance remains pending; #27 is open for those comparisons. Templates default
to disabled. Background indexing remains enabled locally.

## Implemented behavior

- An authenticated Postgres inventory includes only current completed owned
  sources within the selected note/topic/library scope. It detects more than
  200 sources rather than silently truncating the scope. This is a request bound,
  not a measured capacity guarantee.
- Ready index generations must match the current capture fingerprint, version,
  chunk policy, embedding model/dimensions and collection. Unready sources are
  represented without a searchable generation.
- One bounded question embedding and native English BM25 search use identical
  owner/source/version/generation filters. Each prefetch requests 40 candidates;
  reciprocal rank fusion returns at most 24. BM25 IDF statistics use an indexed
  owner filter independent of the narrower retrieval filter.
- Results must have valid deterministic point IDs and match authoritative owner,
  source, generation, version, fingerprint and policy metadata. Original capture
  loads are bounded to the current note plus four topic and four library sources.
- Exact source passages are derived from ranked chunk overlaps. Saved citation
  IDs are retained for matching spans; otherwise the existing offset-based
  assistant namespace is used. Physical PDF pages and actual video cue times
  are verified against the original captured source.
- Postgres validates selected snapshots before loading evidence and again after
  generation, including study/topic revisions and index generations. Existing
  assistant context validation also remains. No provider failure silently
  switches to unscoped retrieval. Unready evidence sets the existing partial flag;
  no hits yields an evidence gap without a model call.
- Query-provider work has a 20-second total timeout with 10-second HTTP bounds.
  Existing 30,000-character model context and generation bounds are preserved.
  No verified streaming or semantic claim classifier is introduced.

## Checks and evidence

The user explicitly agreed Qdrant/OpenAI HTTP, authenticated assistant questions
and Postgres ownership/scope/current-version boundaries.

1. The hybrid HTTP test failed because the retrieval module did not exist, then
   passed after implementation. The assistant test failed to find a late original
   passage omitted from its note, then passed using the ranked library source.
2. Eighteen new HTTP/API checks cover hybrid filters/IDF scope, article/PDF/video
   attribution, cross-owner/out-of-scope hits, wrong generation/version/hash,
   invalid locations, provider outages, changed captures/indexes, corrupt saved
   locators, empty hits, partial indexing and missing server credentials.
3. The disposable SQL test initially failed for missing inventory functions.
   It now checks original capture loads, cross-owner and anonymous denial,
   unselected scopes, readiness, generation replacement, study revision changes,
   capture refresh, removal and topic revision changes. Fixture writes roll back.
4. A UTC timestamp equivalence test failed before the fix. Revision timestamps
   are compared as typed timestamps, while other snapshot fields remain exact.
5. A hosted Qdrant/OpenAI smoke query against the retained public PDF baseline
   returned two owned current page-6 hits with native BM25, dense prefetch and
   per-learner IDF. No learner captures were changed. This confirms provider
   compatibility, not semantic recall or answer quality.
6. Full backend suite: **232 passed**, two existing dependency warnings. The
   prescribed `uv run --project backend --extra dev pytest backend/tests -q`
   hit a uv-cache sandbox restriction. Verified fallback:
   `backend/.venv/bin/python -m pytest backend/tests -q`.
7. Web suite: **69 passed**. Its public response/citation schema is unchanged.
   `git diff --check` passes.

## Remaining acceptance

Migration 014, hosted authenticated inventory/context/revision checks and local
activation are complete. Run wider held-out retrieval comparisons
against the baseline; do not claim an answer-quality improvement from smoke
checks. First verified text within 10–15 seconds, cost ceilings, classifier
selection, follow-up resolution, verified streaming and hosted worker deployment
remain later work.

Native/iOS and its tracker are untouched. No commit or push.

## API references

The request follows Qdrant's documented
[hybrid prefetch and RRF](https://qdrant.tech/documentation/search-tuning/hybrid-search/)
and [per-tenant IDF corpus filters](https://qdrant.tech/documentation/manage-data/multitenancy/).
Hosted compatibility was verified on the configured Qdrant 1.19.2 service.

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

### Manual comparison limits

Both routes supplied the correct core positional-order rationale and abstained
on the Roman-emperor question. A paraphrase answer in both routes describes the
paper's hypothesized benefits more strongly than the original uncertainty. Exact
citation coordinates do not establish semantic claim support. This observation
belongs in the next grounding-check evaluation; no classifier winner or semantic
release threshold is established here.

Functional fixtures `71902cc5-d300-4458-8ce4-3cdcd90fe7f3` and
`6231c3d7-7741-49be-a4cd-835539461017` were restricted to the dedicated acceptance
learner and removed with zero remaining Qdrant points. The retained baseline
and unrelated learner sources were not modified. Its saved note was copied for
these disposable read-path checks; this does not validate fresh note generation.
