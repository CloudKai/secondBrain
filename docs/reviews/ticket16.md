# Ticket 16 — live research discovery review

Date: 2026-10-05. Baseline `318b3ec`; implementation `5b14de7`, fixes
`a7500eb` and `fecfb77`. Committed diff only; unrelated working changes and
native/iOS excluded. Approved public API/external HTTP/save/browser boundaries.

## Standards

Independent review found no documented standards breaches. A repeated saved-URL
lookup was consolidated into `findSavedResource`, preserving empty-URL safety.
Final review through `fecfb77` reports no remaining findings. Discovery uses
strict contracts, bounded provider responses/deadlines, authenticated requests,
public DNS validation, safe diagnostic categories and server-only credentials.
Challenge detection checks bounded validated page fields and preserves partial
results feedback. No persistent discovery table or model-generated URL was added.

## Spec

Initial review found two P2 mismatches: extensionless PDF URLs used the article
capture path, and university-hosted papers could receive a teaching-material
label. Fixed with public response MIME verification and classification that
retains indexed paper status and labels other university content neutrally.
Known first-party documentation hosts receive the documentation label.
Re-review through `a7500eb` and `fecfb77` reports no remaining findings.

A live Fetch result returned a bot-check page as a paper. The authenticated API
regression reproduced this before the fix; blocked-page filtering now omits it
and reports partial results. Final real Search/Fetch acceptance returned two
checked resources and no library/graph mutation.

## Final checks

- `uv run --project backend --extra dev python -m pytest backend/tests -q`:
  **182 passed**. Two existing dependency deprecation warnings.
- `cd web && npm test`: **66 passed**.
- `cd web && npm run build`: typecheck and build pass; existing >500KB chunk warning.
- `cd web && npm run lint`: pass.
- 21 focused discovery API checks and two web client checks are included above.

Tests cover auth, bounded query/response/URL handling, redirect rejection,
provider failure, metadata/preprints, challenge omission, verified response
type, six-result priority/dedup, explicit article/PDF capture, duplicate reuse,
ownership denial and unchanged saved state before capture. Initial route,
publisher redirects, client transport, MIME routing and challenge cases had
recorded RED→GREEN checks at the agreed public seams.

## Hosted and browser acceptance

Real anonymous auth, TinyFish Search/Fetch and development Supabase library/topic
reads pass. Unauthenticated and invalid requests reject. Search alone creates
no sources. Browser Python documentation search showed three checked resources
with missing author/date labelled, opened the original, and retained zero saved
sources until explicit capture. Saving produced a real model/worker note and
four mapped topics. Reopening the note and inspecting a numbered citation showed
the original captured passage. A saved-note unsupported question opened an
editable research query without automatic search. Empty/partial result feedback
was verified with real searches.

The controlled browser article and dependent study/topic/version/identity/section
records were removed and verified; browser reload restored zero sources/topics.
The original learner source remained present. Temporary API search learners
created no source records. No migration was necessary.

Live browser PDF saving was not exercised for this slice: the new API tests
exercise discovered extensionless PDFs through the existing real capture API,
and that capture path has prior hosted PDF acceptance. Link checks establish
readability at check time, not truth, peer review or future access. Provider and
direct-public-header failures can yield honest partial/empty results. Desktop
development acceptance only; production/load acceptance remains unverified.

Evidence screenshots: `/private/tmp/ticket16-discovery.png` and
`/private/tmp/ticket16-saved-note.png`. These show verification data removed
afterward. GitHub #16 completes the original 15 planned web slices.
