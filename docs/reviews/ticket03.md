# Ticket #3 review

Fixed point: `20d98c0af6aebc05c07de8918817924716c9f65c`.
Implementation: `d647da1`; fixes: `1e18b46`.
Diff: `git diff 20d98c0...HEAD`.
Spec: [GitHub issue #3](https://github.com/CloudKai/secondBrain/issues/3).
Two independent agents reviewed the committed changes.

## Standards

Two documented breaches were found and fixed:

- HTTPX decompressed encoded responses before enforcing the download limit,
  outside the resource-limited parser. Article and PDF downloads now share an
  identity-encoding, raw-byte-bounded downloader that rejects encoded responses
  before consuming their body and preserves public-address redirect pinning.
- Parser failures discarded useful diagnostics. Safe exit, timeout, memory and
  exception categories are now logged without tokens or source content.

The shared downloader also removes duplicated security logic; an unused page
constant was removed. Re-review found no remaining material standards issue or
migration blocker. Existing RLS, service-only worker claims and article captures
are preserved. The updated worker was restarted before the reviewed migration
was applied. Rollback refuses while PDF captures exist.

## Spec

No material spec defect or scope creep was found. Uploads and public PDF URLs use
the existing owned source and study workflow. Physical page identity, exact page
references, actionable unsupported-file messages and published limits match the
ticket. Uploaded binaries, OCR, selected page ranges and videos remain outside
this slice; filename and captured page text are retained.

Hosted acceptance subsequently passed: real upload and public URL generation,
exact page-bound references, browser reload, digest reuse and second-learner
API/RLS isolation. A blank second page preserves the calculus citation on page 3.
A 15-page public PDF captures 30,000 characters with partial coverage. Temporary
acceptance sources and their study/outbox rows were removed.

Final checks: 71 backend tests and 24 web tests passed; web build/typecheck and
lint passed. The backend module command avoids a pre-existing stale pytest
executable shebang. Two dependency deprecation warnings and a nonfatal 552 KB
web bundle warning remain. Narrow-screen and unsupported-file browser fixture
checks also passed. Native files were not changed by this ticket.

Summary: Standards — 2 findings resolved, no remaining material issue.
Spec — 0 findings; local and hosted acceptance passed.
