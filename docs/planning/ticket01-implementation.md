# Ticket #1 implementation record

Originating spec: [Save and reopen a public article](https://github.com/CloudKai/secondBrain/issues/1).
Only ticket 01 is selected. Other proposed tickets are unpublished drafts.

## Completed locally

- Supplied browser library/source viewer extended; native code untouched.
- Supabase anonymous-session client restores browser sessions; API validates
  tokens with Auth, derives owner IDs, and enforces ownership in queries and RLS.
- Immutable captured sources preserve identity, original/canonical URLs, text,
  capture time, provenance, and honest coverage. Duplicates reuse the first
  capture. Owned listing/reopening/deletion uses the browser source API.
- Downloads ≤2 MB, text ≤30,000 characters, combined capture deadline 60 seconds.
  Private and unsupported binary sources are rejected; reader/paste fallback
  is labelled with unconfirmed coverage.
- Captured sources display **Study note pending** without fabricated generated
  content. Existing examples/corrections remain session-only previews.

## Validation

- `npm --prefix web run build`: pass (includes strict typecheck).
- `npm --prefix web run lint`: pass.
- `npm --prefix web test`: 13 pass, including unchanged migration in embedded
  Postgres with cross-owner denial, read-only captures, and anonymous-role denial.
- Exact repository `uv run --project backend --extra dev pytest backend/tests -q`:
  fails collection because the copied pytest entrypoint uses an external
  interpreter without project dependencies (`langchain_openai`).
- `uv run --project backend --extra dev python -m pytest backend/tests -q`:
  31 pass, including 16 source API and 15 legacy pipeline checks. A separate
  export of the committed backend also passes its source and original v1 tests,
  independently of pre-existing working-tree changes.
- Desktop and 390×844 browser checks: save, read captured text, open-original
  URL identity, reload/reopen, storage errors and disabled saving.
- Real public-page extraction at `https://www.example.com/`: direct capture
  passed. No hosted storage or model call was made.
- Generated browser evidence is ignored under `output/playwright/`.

## Pending external acceptance

The user answered **not set up yet** for Supabase. No project/schema is deployed
and no populated configuration is committed. See `supabase/README.md` for setup
and two-session live ownership/save/reload checks. Keep issue #1 open until
those checks pass. Local fixtures are not hosted acceptance.

## Repository boundary

The supplied `web/` baseline was untracked when this task started and is included
as a dependency of this browser implementation. Pre-existing native changes,
backend graph/schema changes, skills, and unrelated documentation remain in the
working tree; this ticket does not stage them. The native v1 route receives only
source-router registration in the commit.

## Standards

Review found a Unicode length mismatch, missing sanitized backend diagnostics,
and duplicated URL normalization that could alter query values. All three were
fixed; regression checks reproduce the Unicode/identity failures before the
fixes. Re-review found no unresolved Standards findings.

## Spec

Review found two correctness defects: altered URL identity and rejection of
valid supplementary Unicode text. Both are fixed and checked. Re-review found
no remaining actionable Spec findings. Hosted acceptance is still pending.
