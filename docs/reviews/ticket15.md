# Ticket 15 — grounded assistant review

Baseline `3ae8f60`, implementation `6df300e`. Committed diff only; unrelated
working changes and native/iOS files excluded. Review date: 2026-10-05.

## Standards

Independent reviewer found one documented breach: assistant generation failures
returned a generic 503 without safe backend diagnostic categories. Fixed by
logging the bounded failure code and operation name only, never raw questions,
source text, provider messages or credentials.

Two judgment calls: repeated assistant-evidence selection predicate in App is
now derived once. Assistant and topic-overview citation translation remain
separate intentionally: one accepts single-source answers and rejects private
labels, the other requires independent multi-source synthesis and permits
normalizing redundant metadata. A shared helper would couple different contracts.

## Spec

Independent reviewer found no confirmed mismatches, missing implementation
requirements or scope creep. Current-note default, combined independent scopes,
confirmed-topic selection, owned bounded topic-first retrieval, exact original
citations, post-model evidence fences and preview-only research navigation match
#15. Hosted migration/browser acceptance was pending at review time.

## Checks and remaining acceptance

Initial full checks: 158 backend, 64 web tests, build/typecheck/lint pass; the
additional bounded-context API check passes, bringing focused assistant checks
to 15. Review fixes and final rerun pending. Migration 011 and hosted acceptance
are not yet verified.
