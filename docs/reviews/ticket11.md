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

## Hosted findings and final review

Real model output initially used source UUIDs instead of complete passage IDs.
Commit 7eadd1e introduced whitelisted short passage labels resolved server-side
to the original references. Redundant private labels in prose led to guards and
normalization (38a3342, 2f7d2f6, a9c4507). A Standards low finding about substring
matching (ref1 versus ref10) was corrected with complete-token comparisons.
Only redundant parenthesized labels already declared by a claim are normalized;
unknown labels remain invalid and literal source wording remains intact.
HTTP regressions followed RED→GREEN. Final independent Standards and Spec
re-reviews through a9c4507: zero remaining findings on either axis.

## Acceptance evidence

117 backend tests via project Python, 39 web tests, build/typecheck and lint pass.
Exact bare pytest/uvicorn commands resolve stale Anaconda; equivalent project
Python module invocations work. Existing deprecation/bundle warnings remain.

The approved migration was applied to hosted development and the worker
restarted. Authenticated API checks passed ownership, direct-table/worker denial,
queue idempotence, on-demand synthesis, persisted choice, exact page/times,
original-note equality, stale-result hiding and the single-source threshold.
Final real-model API and browser synthesis each completed on attempt 1.

Desktop browser checks passed mixed-certainty placement gating, topic-word
navigation, source branches, Combine/Keep separate and both choices after reload.
Combined citations opened PDF page 1 and video 0:06–0:12. Conflicting controlled
findings retained attribution and qualifications. Fixtures were fictional saved
PDF/video contexts, not newly fetched research/recordings. Agent-created sources
and derived queues were removed and verified. Native/iOS and its tracker remain
unchanged; no production or phone-width acceptance is claimed.
