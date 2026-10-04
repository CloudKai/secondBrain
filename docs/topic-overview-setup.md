# Combined topic overviews — planned ticket 10 / GitHub #11

## Status

Local implementation and checks pass. Independent Standards/Spec review is complete. Hosted migration and
browser acceptance are pending; this is not yet part of the verified web MVP.

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
