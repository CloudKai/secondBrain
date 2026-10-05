# Combined topic overviews — planned ticket 10 / GitHub #11

## Status

Complete in hosted development on 2026-10-04. The user approved the dashboard
warning and migration 202610040007_topic_overviews.sql was applied. The existing
worker was restarted. Local checks and independent Standards/Spec reviews pass.

## Learner flow

Open a saved topic through its word, card or graph node. Two completed, clearly
assigned sources enable Combine / Keep separate. Combine explicitly queues
synthesis; reading the topic alone does not spend a model request. Keep separate
shows original source-note branches under the parent topic without generation.
The choice is stored per learner/topic and survives reload. Both modes retain
original notes and exact source-passage navigation, including saved PDF pages and
video cue times. Differences retain attribution rather than forcing consensus.

Pending, failed, retry and partial states are visible. Uncertain placements must
be confirmed using the existing topic choices before Combine becomes available.
No original note, source capture or topic map is changed by synthesis.

## Database and worker

Apply reviewed `supabase/migrations/202610040007_topic_overviews.sql` to the same
development project as the source, study and topic migrations. It adds derived
`topic_overviews` and `overview_outbox` tables. Authenticated RPCs derive ownership
from the session; direct learner table access and worker RPCs are denied.
Membership revisions hide outdated results and fence late worker completions.

Restart the existing worker after applying the migration:

```bash
uv run --project backend python -m backend.study_worker
```

The worker uses existing ignored backend credentials; no new key or service is
required. ARQ carries only a stable overview UUID. Durable queued work reconciles
every ten seconds, with three attempts, 10/30-second retry delay, a 120-second
lease and recovery after interruption. Model timeout is 60 seconds (65-second
pipeline bound), inside the existing 90-second job deadline. Synthesis selects
up to 20 sources / 100,000 serialized characters; excluded inputs are reported
as partial. Only exact saved passages cited in topic assignments are eligible.
The model cannot invent citation identities, page numbers, times or excerpts.
Semantic synthesis quality still requires inspecting the evidence.

Rollback `supabase/rollbacks/202610040007_topic_overviews.sql` removes only derived
overview jobs/view choices, preserving original captures, notes and topic maps.

## Checks

Agreed seams: authenticated overview API; synthesis model HTTP responses;
database ownership/view persistence; browser switching and citation navigation.
Local full suite: 117 backend tests via project Python, 39 web tests, web build,
typecheck and lint pass. Exact bare pytest/uvicorn launchers resolve to stale
Anaconda; use `python -m pytest` / `python -m uvicorn` in the project environment.
Vite warns about the existing large single bundle; release pipeline is absent.
Native/iOS and its progress tracker remain untouched.

## Hosted development acceptance — 2026-10-04

Authenticated API checks passed on-demand generation, stable queue identity,
persisted switching, cross-learner denial, denied direct-table/worker access,
exact references, original-note preservation and stale-result hiding after source
removal. Final real-model/worker synthesis succeeded on attempt 1.

Desktop browser checks passed topic-word navigation, visible overlap choices,
source branches, both view choices after reload, conflicting findings, pending/
retry feedback, PDF page 1 and video 0:06–0:12 passage navigation. A mixed-certainty
pair blocked Combine until the learner confirmed the suggested assignment.

The two PDF/video inputs were controlled fictional acceptance fixtures, seeded
with valid saved notes/maps to isolate this slice. These checks used the real
hosted database, worker and model; they do not establish new ingestion/provider
capabilities. Temporary captures and derived queues were removed and verified.
No phone-width acceptance or production release is claimed.

Live output exposed ambiguous source IDs and redundant model citation labels.
The model now receives short whitelisted passage labels; the server resolves
only those labels to exact saved source/passage identities. Known parenthesized
labels already declared by a claim are removed from prose, while literal source
wording and unknown-label rejection are preserved. HTTP regressions and final
independent re-reviews pass. Citation integrity does not guarantee semantic
accuracy; inspect the saved evidence when using a synthesis.
