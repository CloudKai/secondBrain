# Citation passage improvement

## Target behavior

Approved by the learner on 2026-10-05: implement the architecture report's
complete-thought passage grouping recommendation for the web learning library.

- Prefer blank-line paragraph boundaries and complete English sentence endings
  within the existing 900-character excerpt budget. Treat single PDF line breaks
  as potential layout wraps. Keep each PDF reference within its original page.
- Join adjacent timed caption cues into a complete explanation. Break at sentence
  endings, pauses over 1.5 seconds, explicit speaker labels that change, 45 seconds
  of cue coverage, or the character budget. Keep the exact original capture,
  including newlines; do not rewrite rolling captions or infer word timestamps.
- A joined reference uses the first included cue's real start and the maximum
  included end (cues may overlap). An oversized individual cue can be split into
  text passages, each retaining that cue's full time range.
- Centralize exact-location verification in the backend Source reference module
  and a matching browser module. Notes and assistant answers accept both existing
  single-cue references and new contiguous multi-cue spans. Reject fabricated
  text, offsets, pages, timestamps, and missing intervening cues.
- Pin an immutable passage policy per source version in Postgres. Existing study
  jobs retain legacy grouping. Newly requested studies and refreshed versions
  use the new policy after migration. Missing policy fields from older databases
  mean legacy grouping. Resumed section summaries keep their original meaning.
- Existing saved notes, topic overviews, source archives, ownership and stale
  worker protections remain valid. This change does not automatically regenerate
  saved notes or reconstruct article HTML structure.

## Acceptance boundaries

Use the already agreed model HTTP, authenticated assistant API, database
ownership/worker, and browser saved-note/assistant citation interfaces. Include
paragraph and sentence endings, Unicode offsets, caption pauses/speaker changes,
real overlapping cue times, PDFs, dense/long sources, legacy retry compatibility,
policy persistence, and cross-user denial. No native/iOS changes.

## Verified implementation

Implementation and review fixes through `074f157` pass 200 backend and 68 web
tests plus web build/typecheck/lint. Both review axes are clear. Migration 012
applied in development; the real model/worker/browser flow produced three exact
references from six supplied cues, including overlapping times and blank lines.
Note and assistant inspection and note reload passed. The temporary source and
its dependent records were cleaned. Production acceptance is not claimed.


## Existing-note follow-up

The learner explicitly requested existing-note updates after the implementation.
The sole saved Neural networks note was updated in a guarded atomic transaction:
13 prior references map to 12 exact complete-thought passages, with original
prose, source/version and four topic assignments retained. Claim and topic
evidence IDs resolve to the new passages. Strict models and hosted postflight
reads pass; no model generation, schema change or application change was needed.
