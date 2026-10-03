# Saved-source topic graph — planned 09 / GitHub #10

Status: local implementation and checks complete; independent review complete; hosted migration approval and acceptance pending.
This is the selected target slice, not yet a verified hosted capability.

## Behavior

Completed source notes queue separate topic mapping. Main and substantive
supporting topics cite saved passages; passing mentions are discarded. Clear
contextual aliases share topic identity. Uncertain matches stay distinct with
an explanation and optional existing-topic suggestion. The learner can confirm
the suggestion or keep the topic separate. Notes and their references remain
read-only and unchanged.

The empty saved library has no subject outline. Topic cards appear when its
first map completes; a connected view requires two independent saved sources
supporting a shared topic or a uses/requires/evaluates relationship. Relations
name their basis and supporting passages. Broad subject badges emerge from the
source, can overlap and create no edges by themselves. Coverage is not mastery.
Saved topics are separate from the explicitly selected example graph. Topic
navigation lists original source notes and opens their exact evidence.
Combined synthesis and broad rename/merge/rejection workflows remain tickets
10 and 11.

## Setup and recovery

Apply reviewed `supabase/migrations/202610030006_topic_maps.sql` to the development
project. It adds owned source maps, transient outbox delivery, learner retry/
placement RPCs and server-only claims/completion. An atomic trigger queues topic
work when a source note completes and backfills existing completed notes. It
preserves existing sources and study notes. Rollback removes the topic trigger,
functions and topic tables while preserving source/study tables.

Restart the existing study worker after migration. It also dispatches topic IDs;
Postgres owns bounded three-attempt retries, 120-second leases, late-result fences
and outbox recovery. Matching is serialized per learner so simultaneous sources
do not race catalog decisions. Topic failure leaves the completed note available.
No new credentials or vector-search service are required. Native/iOS and v1 stay
unchanged by this slice.

## Processing limits

The library snapshot maps at most 500 sources. The model compares at most 200
existing topics within a 100,000-character input, with a 65-second generation
deadline and no SDK retries. It emits at most 12 topics and 24 evidence-backed
relations per source. Partial mapping/catalog coverage is explicitly flagged;
material outside those limits is not claimed as fully mapped. A shared-topic
view can have one primary topic with multiple supporting sources; no self-edge
is fabricated to draw a connection. Aliases and groups remain contextual.

## Checks

User agreed topic API, model HTTP, database ownership/persistence and browser
navigation boundaries. RED→GREEN checks cover empty library, first-source cards,
related/unrelated sources, contextual aliases, uncertainty and ownership. SQL
checks cover automatic enqueue, worker claim, placement, leases/retries and
rollback. 112 backend tests through project Python, 34 web tests, build/typecheck and
lint pass. Review fixes passed focused API/model and SQL/client checks, build and lint. Independent Standards and Spec re-review have zero remaining findings. Hosted/browser acceptance awaits migration approval. Controlled fixtures establish implementation behavior; model quality
still depends on captured source coverage and should be checked against evidence.
