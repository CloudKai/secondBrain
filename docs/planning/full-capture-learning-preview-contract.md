# U3a2 — Full-capture initial learning previews

Part of #29, follows accepted #35. Target until acceptance is recorded.

## Unit

Prepare independently reviewed, synthetic teaching development cases before changing
generation. Add a full-capture option to new source-based path previews. Keep the
existing note-only API default for compatibility, and offer an explicit UI choice.
Multi-source revisions, stable outcomes/check identities, calibration and production
rollout remain separate units.

The full-capture selector uses the source title plus a provided goal, existing
BM25+dense RRF and exact original passages. A ready index is required. No matches
or unready indexes produce an evidence error before generation. No source text is
invented; diagrams and missing pages are excluded. Cap selection at 24 references
and 16,000 excerpt characters, with a 35-second deadline. Preserve original
offsets, PDF pages and caption timestamps; revalidate capture/index snapshots after
generation and again in the persistence transaction.

The generated response contains a teaching draft plus a versioned, bounded
concept/coverage manifest mapping concepts, prerequisites, examples and qualifications
to selected reference IDs. This is a manifest of sampled evidence, not an exhaustive
source map. Entries and teaching use only supplied IDs; generated background and
examples remain explicitly labelled. Persist the manifest, selector policy and
index/capture snapshot alongside new immutable plans. No existing note, plan,
attempt, draft or conversation is regenerated or rewritten.

Use Luna medium with the existing one bounded Sol medium structural repair. Missing
evidence is not repaired by escalating. Do not introduce new providers or classifiers.
Bound the complete provider input to 30,000 characters, including instructions.

## API / data

The existing preview API accepts `evidence_mode: "note" | "capture"` (default note).
Capture previews are initial paths only (`path_id` must be null). Existing difficulty
and multi-source revisions continue with their current policy and are labelled as
such. A request ID cannot replay under a different evidence mode.

Migration 022 adds request evidence mode and nullable plan teaching metadata, plus
owned request and service-only finish functions. Keep the old note request/writer
compatible. Validate every new reference against original capture coordinates,
location metadata, source version and ready index snapshot; reject stale/deleted
captures. Plan reads expose optional teaching metadata, including historical
manifest labels. Source deletion clears manifest text as well as reference excerpts.
New previews require explicit confirmation through the existing plan API.

## UI / failures / recovery

New-path form offers Full captured source and Saved note passages. Show that only
retrieved text informs the path, that indexing may require waiting, and that other
collection sources do not participate in this initial path. Show the manifest and
its evidence links in path preview and coverage panels. Retrieved references use consistent display numbers across the lesson, manifest and tutor, retaining their original stored IDs and callbacks. Old plans retain their existing labels and remain readable.
Unready/missing evidence, stale source/index, malformed generation and storage outage
preserve current learning and allow retry. Retain the goal and evidence choice.

Rollback disables capture request/finish functions, retaining reads, new metadata,
old plans, note-mode generation and deletion redaction. The UI can explicitly use
Saved note passages; do not drop learner data.

## Acceptance

Use the previously approved seams. Test hidden article/PDF/transcript details,
qualifications, Unicode/formulas/code, sparse/conflicting evidence, missing figures,
incorrect references, generation/source/index races, cross-owner denial, same-request
replay and mixed-mode rejection. Verify reload/confirmation/exact citations and no
progress from preview. Run backend/web tests, typecheck/lint/build and separate
standards/spec reviews; update web trackers/GitHub. UI checks cover both themes,
narrow/desktop and keyboard focus. Actual zoom/screen reader gates must be recorded
honestly. Independent agent-reviewed synthetic cases are a development rubric, not
an educator validation, held-out benchmark or calibrated teaching/assessment score.
