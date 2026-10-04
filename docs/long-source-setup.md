# Long sources and selected ranges — planned 13 / GitHub #14

## Status — 2026-10-04

Verified in the hosted development project at the user-approved boundaries.
Migration 010 is applied and the matching worker is running. Browser/API
acceptance and controlled-fixture cleanup pass. Production release is unconfigured. Native/iOS
and its progress tracker are untouched.

## Learner behavior

Whole supported capture is the default. PDF import and Source versions & refresh
can select inclusive original PDF page numbers. Timed VTT/SRT and accessible
YouTube captions can select a time interval; whole overlapping cues retain their
original times, which can extend slightly beyond the selected interval. Untimed
TXT cannot offer time selection. Out-of-range, reversed, empty or missing ranges
save nothing or leave the current saved version unchanged.

Range changes go through existing compare/confirm refresh with one stable source
ID. Old notes/citations stay attached to their own captures. Ordinary refresh
inherits the saved selection; explicit Whole source clears it. PDF upload identity
uses the file digest, and selected pages never create extra independent sources.

The worker processes every captured passage in sections, persists successful
section summaries and progress, and synthesizes one coherent cited note. Final
synthesis must use evidence from every section. A failed section or invalid
aggregate never publishes an unfinished note. Automatic retry and explicit Retry
resume successful section work for that current source version. The browser shows
completed section counts and the combining stage; counts survive reload.

## Enforced limits

| Boundary | Limit |
| --- | --- |
| Browser captured text / supplied article text | 120,000 Unicode code points |
| Article download | 2 MB, public addresses only, bounded redirects/timeouts |
| PDF download/upload | 10 MB, 1–100 pages; existing CPU/memory/stream/15-second parser limits |
| Transcript upload | 1 MB UTF-8 TXT/VTT/SRT, up to 2,000 ordered timed cues |
| Pasted transcript | 120–100,000 input characters |
| Cue time | Within seven days from recording start; original times only |
| Section model input | At most 30,000 source characters and 200 passages |
| Per-source processing | At most 20 sections; each summary at most 1,200 characters |
| Synthesis input | At most 30,000 serialized summary characters |
| Model call | 60-second provider / 65-second wall deadline, no SDK retries |
| Worker transport job | 1,500 seconds; existing 3 attempts, 120-second leases renewed at checkpoints |
| Version history / comparison | Existing 20-version limit, 24-hour candidate; candidate at most 1.1 MB |

Text beyond the capture limit is labelled omitted. Blank/scanned PDF pages and
missing selectable text are labelled partial; OCR, images and layout are not
extracted. Supplied/retrieved captions never establish whole-video coverage.
Existing source correction and smaller/export/paste fallback paths remain.
Native input and its 30,000-character model budget are unchanged.

## Migration and worker

Apply reviewed `supabase/migrations/202610040010_long_sources.sql` after 009.
It expands capture/metadata validators while accepting earlier metadata without
selection fields. Private RLS-protected study_sections cascade with study/source
removal. Only the service role can plan/save sections or claim/finish studies.
Owned study reads expose total/completed counts. Checkpoints require the current
version and live lease under the existing owner lock; refresh deletes old study
work atomically. Source/graph identities and learner correction rules are unchanged.

Deploy/restart the matching worker only after applying the migration. Its stable-ID
queue resumes checkpoints; no additional key, provider, vector service or account
connection is required. Use the existing ignored backend environment.

Rollback: `supabase/rollbacks/202610040010_long_sources.sql` revokes section work
and requires stopping the matching worker. It retains existing captures, notes,
archives, ranges and fences. Stored long captures cannot safely be narrowed by
reverting old DDL/code. To resume, restore service-role EXECUTE for plan/save
functions and restart the matching worker; do not reapply table DDL.

## Acceptance record

Agreed seams: authenticated import/range API, external capture/model HTTP,
database ownership/progress/worker fences, browser range/progress/reload/citations.
Focused RED→GREEN checks cover original PDF pages, timed overlap selection,
whole long capture, bounded synthesis and saved retry. Local database checks cover
ownership, incomplete synthesis, stale leases, refresh/deletion cascades, selected
metadata and unchanged legacy comparisons. Full backend: 144 pass. Full web: 61 pass. Build/typecheck/lint pass.
Independent review and live acceptance findings were fixed in `4aa30d9` and `e474faf`: dense supported
transcripts fit the section budget and short-source retries retain full original
passage evidence. Explicit PDF/YouTube ranges are also validated before saved
source reuse. Final standards/spec re-reviews report no remaining findings.
A single-section retry repeats its one model call from the original passages;
long-source retries reuse completed section summaries. Existing backend deprecations and Vite chunk warning remain.

Migration 010 applied successfully after explicit user approval in Supabase query
`ed60e2b8-f928-4a56-909d-41ef114fa4af`. Restarted the matching worker. Hosted
checks cover selected original PDF pages and overlapping transcript cues,
partial labels, cross-owner denial, private section-table/worker RPC denial,
invalid ranges including reimports and stable source identities. A controlled
external provider outage saved section 1/2, published no unfinished note and
rejected a stale checkpoint. The real worker/model resumed on attempt 2 without
changing the saved first summary and completed coherent notes with exact excerpts.

Browser acceptance: whole three-page 42,899-character PDF synthesized in two
sections; later page-3 citations open the exact saved passage. Selected page 3
refresh stays under one source ID, preserves the old whole-source note/citations,
and restores selection defaults. A supplied SRT selection at 25–50 seconds
retains original overlapping cues at 24–42 and 44–55 seconds and generates a
coherent note. Reload restores progress and explicit Retry resumes saved 1/2
section work. Controlled failed state is a browser fixture, not a real provider
outage; the API worker check separately exercises the external failure path.

All controlled API/browser sources, archives and section work were removed;
an existing learner note was verified unchanged. Desktop development acceptance
only; browser uploads were slow, and concurrent stress/mobile layout checks were
not run for this slice. Private recording retrieval, OCR, assistant/research and
production remain planned. GitHub #14 is complete.
