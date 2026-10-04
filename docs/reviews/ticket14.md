# Ticket #14 review

Fixed baseline: `3c984fc` (selected scope checkpoint). Final implementation:
`e474faf`. Spec: GitHub #14 and `docs/long-source-setup.md`. Unrelated
working-tree changes are preserved and excluded.

## Standards

Initial P2: a resumed single-section job synthesized from an abbreviated overview
and could lose supporting evidence. Fixed by retrying the model call from all
original passages while retaining the saved checkpoint. Model HTTP regression
retains both passage references. Independent re-review: no remaining findings;
ownership, version, lease, queue and citation fences remain intact.

## Spec

Initial P2: an accepted dense 2,000-cue transcript could exceed 20 sections before
any model call. Fixed with a 200-passage section budget while retaining the 30,000
source-character bound. Authenticated capture/model regression covers 119,959
characters, original cue locations and successful synthesis. Independent re-review:
no remaining findings or scope creep; 21 focused long-source checks pass.

## Checks

144 backend tests and 61 web tests pass. Web build/typecheck/lint pass. Migration
010 applied after user approval. Hosted API/worker/model and browser acceptance,
section failure/retry, exact citations, range versions, ownership/fences and
controlled-fixture cleanup pass. Native/iOS untouched.

## Live acceptance correction

Reimport of an existing PDF could bypass requested range validation. Explicit
ranges now pass actual bounded PDF extraction / YouTube caption retrieval before
returning the existing source. RED→GREEN regressions preserve stored captures
and reject invalid ranges. Both independent axes re-reviewed
`3c984fc...e474faf`: zero remaining findings; 21 focused long-source tests pass.
