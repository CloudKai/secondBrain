# U3a1 — Goal-specific teaching evidence preview

Part of ideal learning app #29. U3a1 accepted in development under #35; see
`docs/reviews/teaching-evidence-acceptance-2026-10-10.md`. Further U3 behavior remains target work.

## Delivery boundary

Add an authenticated, read-only evidence preview for a confirmed collection plan.
This prepares full-capture lesson evidence selection without changing generation,
stored plans, checks, outcomes, attempts, conversation or the web interface.
The versioned concept manifest and teaching integration follow in U3a2; stable
outcomes/check identities follow in U3b. Independently reviewed teaching cases
remain a prerequisite to changing lesson generation.

## API and evidence policy

`POST /api/v2/learning/collections/{collection_id}/plans/{plan_id}/evidence-preview`
accepts `query` (trimmed, nonblank, at most 2,000 Unicode code points) and
`allow_partial` (false by default). Ownership and participating source versions
come from the confirmed plan, never client-supplied source or owner IDs.

Use the existing Qdrant BM25+dense RRF search and Postgres inventory/capture/version
RPCs. Limit scope to the plan's unique participating sources (maximum eight).
Legacy single-source plans use their anchor/version. A removed, unconfirmed,
unrelated or stale plan is unavailable. Do not search the rest of the library.

Return `teaching_evidence_v1`, collection/plan/query identities, collection and
participating-source counts, per-source readiness/selected-passage counts, and
up to 24 exact `LearningEvidence` references, within 16,000 excerpt characters.
Interleave source groups fairly while retaining their fused hit order. References
point to exact captured passages, including material absent from the saved note.
Retrieval ranking does not establish semantic support or exhaustive coverage.

Default: any unavailable index returns a retryable coverage error without searching.
Explicit `allow_partial=true` searches ready sources only and reports exclusions.
No ready sources returns a coverage error. No matches returns an empty preview
with an explicit evidence gap, never a generated lesson or invented evidence.
Every response discloses sampled retrieval, any excluded collection members,
and that diagrams/images/uncaptured material are not evidence.

Validate owned source versions, capture fingerprints, index generations and exact
original offsets/page/time locations before exposing passages. Revalidate all
participating inventories (including unready sources) and collection/plan membership
after search. Reject source changes/removal or indexing-generation changes with 409.
Provider/setup/malformed data failures return 503. Bound the complete selection
to 35 seconds; no retries or model escalation. Only the query embedding is generated.
No captured text is sent to a generation model by this endpoint.

## Compatibility, tests and recovery

No new migration or persisted schema. Existing retrieval migrations 013/014 are
required; the development project already applied them. Preserve stored notes and
plans; this preview cannot be confirmed into a lesson. Disabling/removing the new
route restores prior behavior with no data recovery work.

Use previously approved authenticated learning API and external provider/storage
HTTP seams. Cover article/PDF/video details omitted from notes; Unicode/formulas;
ownership, unrelated plans, stale captures/indexes, no matches, partial indexing,
fair bounds and outages. Reuse current RPC ownership/version guarantees; record
live authenticated preview and unauthenticated/cross-owner failures. No claim of
teaching quality, measured 200-source capacity or 10–15-second response percentiles.

Run backend/web tests, typecheck, lint and build. Review standards and contract
separately. Record acceptance and update web trackers/GitHub. Mobile/iOS unchanged.
