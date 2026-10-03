# Accessible YouTube captions — GitHub #6 (planned ticket 05)

## Implemented scope and verification

The browser Video form offers **Import YouTube captions** or **Upload or paste**.
Automatic import uses `youtube-transcript-api` 1.2.4 to fetch anonymously accessible
English captions; manual English tracks are preferred before auto-generated tracks.
No learner account, authentication cookies, proxy bypass, audio/video download or
speech transcription is used. Anonymous response cookies are discarded; consent-cookie-dependent access is
rejected with a fallback.
Availability can vary by video, region and deployment IP. A playable link alone
never establishes caption availability or official caption-download permission.

A real public retrieval of [3Blue1Brown’s neural network introduction](https://www.youtube.com/watch?v=aircAruvnKk)
returned 286 real cues and 18,430 text characters in this development environment.
Controlled API and database checks pass. Hosted persistence, browser generation
and independent reviews are pending; this document does not yet claim end-to-end
acceptance. Native/iOS and `/api/v1/process-link` are unchanged by this ticket.

Missing, restricted, blocked, unreadable or oversized captions return an actionable
422 response; the browser keeps the URL/title and opens supplied-transcript controls.
Authentication and storage failures remain retry errors. No source is saved for a
failed retrieval. Supplied TXT/VTT/SRT and paste continue supporting YouTube,
Teams/SharePoint, Zoom and Panopto. Their automatic access remains planned.

## Access method and limits

The maintained [library documentation](https://github.com/jdepoix/youtube-transcript-api)
describes the anonymous client and its IP-blocking limitations.
[YouTube transcript help](https://support.google.com/youtube/answer/15930243?hl=en)
describes transcripts on captioned videos. This implementation uses the library’s
public-caption path; it does not use the official captions download API, which
requires authorization for the video. Recheck the deployed network before claiming
production availability. Do not add account credentials or proxies to bypass a block.

- Four concurrent retrievals; four requests maximum per retrieval.
- HTTPS `www.youtube.com` watch/player/timedtext paths only, with no redirects.
  Caption URLs must identify the requested video; learner tokens are not forwarded.
- Eight seconds maximum per HTTP request, 30-second retrieval deadline and
  35-second async deadline including admission. Network reads are asynchronous
  with an interruptible wall-clock timeout; SDK execution retains its concurrency
  slot until it finishes even when the request is cancelled.
- Two MB decoded per response, four MB aggregate, and bounded streaming.
- English `en`, `en-US` or `en-GB`; no automatic translation.
- Existing transcript decoder limits: 1 MB UTF-8, 2,000 cues, at least 120
  readable characters, times within seven days and 30,000 captured characters.
  Omitted text is partial; otherwise coverage remains unknown against the video.

Only normalized caption text and metadata are retained. Source origin is `direct`,
format is `vtt`, provider is `youtube` and filename is null. Coverage detail identifies
retrieved publisher-provided or auto-generated English captions. Supplied captures
remain `upload` or `pasted`. Caption starts and ends are retained to milliseconds;
passages and citation times are attached by server code, not invented by the model.
YouTube links seek to the cited start rounded down to a whole second.

## API, deployment and rollback

`POST /api/v2/sources/youtube` accepts `{ "url": "https://youtu.be/VIDEO_ID", "title": "Topic title" }`
with the learner’s verified Supabase bearer token. Ownership and canonical reuse
happen before retrieval. The existing learner-owned source/study/outbox/worker
pipeline generates the note. Re-import opens the saved capture; it is not refresh.

Install the locked backend dependencies and run the updated API/worker. Apply
`supabase/migrations/202610030005_youtube_transcripts.sql` after migrations 001–004.
It replaces only source identity validation to admit retrieved YouTube captions;
RLS, grants, worker claims and existing captures are preserved. No new key is needed.
The matching rollback refuses while retrieved video captures exist; otherwise it
restores the previous supplied-transcript constraint without deleting sources.

## Checks

The agreed seams are authenticated capture API, YouTube external HTTP responses,
model HTTP responses, database ownership/worker functions and browser citation flow.
Current checks: 103 backend tests and 30 web tests; web build/typecheck and lint pass.
The prescribed `uv run --project backend --extra dev pytest backend/tests -q`
resolves an obsolete Anaconda entrypoint and fails collection. The project interpreter
`uv run --project backend --extra dev python -m pytest backend/tests -q` passes.
The dev API likewise uses `python -m uvicorn` with `--env-file backend/.env`.
