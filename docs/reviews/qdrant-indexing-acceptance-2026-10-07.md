# Qdrant indexing acceptance — 2026-10-07

## Verified behavior

Migration 013 is applied after explicit learner approval. Qdrant 1.19.2 accepts
the dedicated dense/BM25 configuration. The retained public PDF baseline source
`2dfc7546-802f-47a2-9b52-79577a48cb79` has 2/2 ready chunks with original physical
page 6, exact offsets/fingerprint and both vector types. Scoped BM25 smoke queries
return owned points; no answer-quality improvement is claimed yet.

A fresh anonymous learner saved a synthetic disposable article. Authenticated
status read returned queued. Another learner could neither read the owned status
nor claim server worker work; private manifest table reads were denied.
Supabase's raw RPC uses HTTP 500 with `P0002` for an absent/unowned source, while
the FastAPI boundary correctly translates that error to HTTP 404.

A controlled HTTP transport returned 503 only for the second embedding request;
the first batch used the real provider and Qdrant. The manifest retained 16 completed
chunks and queued `provider_unavailable`. After the real 30-second retry delay,
the named job resumed and reached ready with every planned chunk completed.
This tests a simulated outage at the provider HTTP boundary, not a real provider
incident or concurrent load.

Authenticated capture comparison and expected-version refresh produced source
version 2 and a queued current manifest. Indexing the replacement left only
version-2 points under the fixture's owner/source filter. Authenticated source
deletion followed by its named cleanup job removed every fixture point and hid
its owned status. Late lease/completion fencing and expiry recovery were tested
in disposable Postgres earlier; they were not stress-tested concurrently in the
hosted project.

The actual FastAPI application, using real hosted learner authentication and
Supabase HTTP responses, also passed a fresh disposable source check:

| Request | Result |
| --- | --- |
| Owned indexing status | 200, queued |
| Missing learner session | 401 |
| Cross-owner status | 404 |
| Status after owned deletion | 404 |

The complete lifecycle fixture, the API fixture and two fixtures left by the
initial stopped denial checks were removed with exact source/owner boundaries.
Their cleanup tombstones were processed. Generated anonymous auth identities
remain; no learner source was removed. Temporary test sessions stay outside Git.
Only explicitly named jobs ran, not the global dispatcher.

## Remaining work

Ticket #26 remains open for learner-visible indexing progress and browser reload/
status acceptance, then deliberate background activation. The TDD skill's new
web-client/browser seam approval is pending. `ENABLE_RETRIEVAL_INDEXING=false`.
Existing assistant queries still use Postgres; later hybrid query integration must
validate returned identities and scope against authoritative current inventory.

213 local backend tests and disposable Postgres migration/fence checks passed
before this hosted unit; no application implementation changed in this unit.
Native/iOS files and its tracker are unchanged. No commit or push performed.


## Web progress acceptance

The client status check was verified red before implementation, then green.
The source-note display includes checking, queued/preparing, ready, failed and
unavailable states with a Check again action and accessible progress. Source UUID
and expected version must match; incomplete ready responses are rejected.
Queued/processing states poll at five-second intervals; request failures stop
polling and old component requests cannot publish after navigation.

Actual browser capture `60235b64-afe0-4b1c-9f83-ff09d58c446f` showed **Waiting to
prepare search**, then **Search index ready** after a named index job. Reload
restored ready. The imported public Example Domain reader content, rather than
the fallback text, was what the existing capture pipeline saved. This checks
status behavior, not extraction quality. The fixture and derived points were
removed. Screenshots are in `output/design-audit/2026-10-07/indexing-queued.png`
and `indexing-ready.png`. Processing/failure layout branches were not forced in
the browser; schema/HTTP behavior and the prior provider-outage check cover their
contracts. All 69 web tests, typecheck/lint/build and 213 backend tests pass.

A dedicated `python -m backend.retrieval_worker` uses `arq:retrieval`, avoiding
study/topic dispatch. Persistent activation was rejected by automatic approval
review because it exports all queued/future captures to OpenAI and Qdrant. The
attempt did not execute; server flag is still false. Exact activation approval
is pending. #26 remains open for this step.


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

Automatic fresh fixture: `df35f5a5-eb06-4854-b08a-5252af7f89f2`.
Recovered fixture: `22478a5f-dede-4ddf-a77b-ebde05b02879`.
Checks were restricted to each disposable source identity and owner. The retained
public PDF baseline and unrelated learner captures were not removed.
