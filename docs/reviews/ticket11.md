# Ticket #11 review — combined topic views

Fixed point: `10cb1ac` (selected slice start). Implementation: `409b70e`.
Correction: `0df3d73`. Reviewed committed changes only; unrelated native/v1
working-tree changes were excluded. Two independent code-review agents.

## Standards

No material documented-standard breaches or actionable baseline smells found.
Ownership/RLS, stable job IDs, atomic outbox, bounded retries, leases and stale
result fences follow the documented boundaries. Strict response validation and
request sequencing protect citations and topic state. Scoped cleanup re-review:
zero findings.

## Spec

One initial P2: Combine eligibility used the aggregate topic's uncertainty flag,
which could miss a later uncertain source assignment. The panel now checks every
completed source assignment and shows placement confirmation guidance. Independent
re-review: zero remaining findings; no scope creep.

## Evidence and pending acceptance

117 backend tests via project Python, 39 web tests, build/typecheck and lint pass.
Focused API/model/SQL/client checks also pass after review correction. Exact bare
pytest and uvicorn commands resolve stale Anaconda, so equivalent project Python
module invocations are used. Existing deprecation/bundle warnings remain.

Hosted migration is staged in a new Supabase SQL query. The dashboard warns
about destructive operations because worker functions delete derived outbox
entries. Awaiting user confirmation to click Run query. Original captures,
notes and topic maps are preserved by the reviewed migration and rollback.
Hosted synthesis, browser switching/reload/citations and mixed certainty checks
remain pending. Ticket #11 must stay open until these pass.
