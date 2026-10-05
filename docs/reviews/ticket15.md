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

## Review follow-up and hosted API — 2026-10-05

Standards re-review of `0a4a69b` reports zero remaining findings. Final local
checks at that point: 159 backend / 64 web tests and build/typecheck/lint pass.
Migration 011 applied successfully in the development project (no warning).
Initial live provider acceptance exposed supported answers putting limits in
the gap field and redundant `(ref1)` prose metadata. The output instructions
now explicitly state the supported/unsupported contract. A model/API RED→GREEN
regression adds safe normalization of only known parenthesized citation metadata;
unknown and stray IDs still reject. Shared normalization retains existing topic
synthesis behavior. Focused assistant/overview checks: 20 pass.

Hosted real auth/database/model checks pass: current note with PDF page 3, topic
comparison with original video 6–12s, combined topic/library ordering and dedup,
unsupported answer without citations or links, cross-learner denial and real
post-model note-revision rejection (409). API fixture sources cleaned. Browser
acceptance and final rerun/re-review after the provider fix remain pending.
