# Ticket #14 review

Fixed baseline: `3c984fc` (selected scope checkpoint). Final implementation:
`4aa30d9`. Spec: GitHub #14 and `docs/long-source-setup.md`. Unrelated
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
no remaining findings or scope creep; 19 focused long-source checks pass.

## Checks

142 backend tests and 61 web tests pass. Web build/typecheck/lint pass. Migration
010 is staged in Supabase query `ed60e2b8-f928-4a56-909d-41ef114fa4af`; the browser
warning awaits user approval. It has not run. Hosted browser/model/worker acceptance
and controlled-fixture cleanup remain pending. Native/iOS untouched.
