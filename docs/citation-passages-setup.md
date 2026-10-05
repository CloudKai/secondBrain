# Citation passage grouping

## Implemented locally

The Source reference module owns exact passage text, paragraph/sentence cuts,
caption grouping and location verification. Browser notes and assistant answers
share the corresponding location verifier. This is English punctuation-based
segmentation; it does not infer semantic topic changes or add punctuation.

Text references stay at most 900 characters and within one PDF page. Blank lines
are paragraph clues; single PDF line wraps are preserved inside a passage.
Oversized unpunctuated text falls back to a whitespace boundary, then the hard
limit when a token itself is oversized. Original offsets and text remain exact.

Timed captions join until a sentence ends, a pause exceeds 1.5 seconds, an
explicit speaker label changes, a group would exceed 45 seconds, or its text
would exceed 900 characters. An oversized individual cue may still exceed
45 seconds: its text can be split, but every piece retains the full supplied
cue time. A joined reference uses its first cue's start and the latest included
end; overlapping cues are supported. These are cue timestamps, not inferred
word timestamps. Untimed transcripts never receive times.

The immutable `thought_v1` policy and the original `legacy` policy coexist.
Policy identity is pinned per source version in private Postgres rows. The exact
capture, policy and existing section budgets deterministically reproduce IDs
and generation sections across retries. Future algorithm or budget changes
must use a new policy/version rather than modifying these implementations.

## Development activation

1. Stop existing study workers so old code cannot consume new policy claims.
2. Apply `supabase/migrations/202610050012_citation_passages.sql` in the existing
   AI Study Friends development project. The transaction preserves all existing
   studies with the legacy policy, including unfinished and queued jobs.
3. Restart workers and the API with the matching backend; refresh the browser.
4. A newly requested study or a genuinely changed source refresh uses
   `thought_v1`. Existing saved notes are not regenerated automatically.

Before migration, older claims omit the policy; the worker deliberately uses
legacy grouping. Applying this migration changes only worker-private storage
and the worker claim RPC; public source/study response fields do not change.
Ownership, leases, source versions and section-progress fences remain intact.

## Rollback

Keep the updated readers and both policy implementations for notes or jobs
already using `thought_v1`. To suspend new grouping, change only the new-policy
selection in the claim RPC to `legacy`, preserving stored policy rows and the
claim field. Stop workers during this change. Do not drop policy rows or run
old workers against unfinished `thought_v1` jobs: their saved citation IDs must
retain their meaning. Existing captures and completed notes need no data rewrite.

## Verification

Local model HTTP, assistant API, database worker/ownership and browser citation
checks are recorded in the web progress tracker and ticket #17. Hosted migration
activation and real model/browser acceptance are recorded separately.
