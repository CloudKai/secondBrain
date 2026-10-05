# Citation passages — ticket #17 review and acceptance

## Scope / implementation

Approved scope: docs/planning/citation-passages.md. Fixed review point `c2f451a`.
Implementation `df49f05`, fixes `074f157`; unrelated pre-existing working changes
were excluded. Source reference grouping and verification now have one backend
module and one shared browser verifier. Private source-version policies preserve
retry identity. No mobile/native changes or TinyFish calls.

## Standards

Final independent review: **0 findings**. Exact offsets/real times, bounded
captures, strict policy validation, legacy fallback, RLS and worker fences remain.
The reviewer also identified an embedded-caption-paragraph timing edge. It was
fixed before hosted activation by keeping bounded timed groups intact.

## Spec

Initial finding: lowercase/Unicode/long voice labels could miss speaker changes.
The <=200-character recognizer now matches colon-space labels preserved by the
capture adapter; model HTTP regressions cover lowercase labels. A second model
regression covers embedded blank lines. Both failed before the fixes.
Final independent review: **0 findings** through `074f157`.

## Local checks

- Backend: **200 passed** (`backend/.venv/bin/python -m pytest backend/tests -q`).
- Web: **68 passed**, `npm run build`, `npm run typecheck`, `npm run lint` pass.
- Model/assistant interfaces: complete paragraph/sentence endings, PDF soft lines
  and original pages, Unicode, real overlapping times, fabricated time rejection,
  caption pauses/speaker/duration cuts, embedded paragraphs and legacy retries.
- Database interface: existing policies stay legacy, new versions select
  `thought_v1`, retry summaries/policy persist, learner mutation and cross-user
  reads remain denied. Migration compiles/runs in PGlite.
- The mandated uv command selected an Anaconda pytest entrypoint without
  LangChain. The existing backend virtualenv ran the equivalent full suite.
- Existing Vite bundle-size warning remains; no new build/lint errors.

## Hosted development acceptance

- No running API/worker found before activation. Applied reviewed migration 012
  in AI Study Friends; Supabase reported success with no rows returned.
- Started matching API, ARQ worker and Vite frontend with existing ignored env.
- Created one named temporary VTT fixture through the authenticated browser UI,
  using a supplied Zoom recording URL; no recording was fetched/watched.
- Six original cues became three complete thought passages with real ranges
  0:00–0:07, 0:06–0:12 and 0:14–0:18. The first retains the maximum overlapping
  cue end; the second preserves embedded blank lines and the explicit bob label.
- Hosted saved policy is `thought_v1`; all saved excerpts/offsets/times verify
  against the capture. Real OpenAI generation and topic worker completed.
- Browser saved-note and assistant citation clicks show the joined excerpt and
  real range. Reload retains the saved note/references and clears transient chat.
- Deleted only the tracked fixture after guarding its ID/title/URL. Verified the
  source, study, topic map, section, policy, identity and version rows are absent.
  Browser reload restores zero sources/topics in the acceptance workspace.

## Limits

Grouping uses bounded English punctuation, pauses and explicit labels, not
semantic topic inference. Hard limits still split unusually long/unpunctuated
text; long individual cues retain supplied cue-level timestamps. Existing notes
are not regenerated automatically. Production acceptance remains unverified.
