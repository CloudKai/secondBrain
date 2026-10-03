# Zoom transcript availability — GitHub #8, planned ticket 07

## Implemented scope

A recognized Zoom recording share/playback link immediately selects Upload or
paste in the browser Video form. The access panel explains the app's lack of
Zoom authorization, gives cloud-transcript export steps and offers conditional
help for processing, missing, restricted, expired or deleted material. It links
to Zoom's transcript guide and the original recording.

A share/playback URL or passcode alone is not proof of permission to download a
transcript. The app does not determine the specific recording's existence,
permissions, processing, expiry or deletion state. It does not fetch a private
playback page, ask for a passcode, connect a Zoom account, configure webhooks,
scrape or download/transcribe audio/video. No anonymous Zoom retrieval method
has been validated; automatic retrieval is not advertised.

## Export and paste

For an owned cloud recording, open Zoom's web portal → Recordings & Transcripts
→ Cloud recordings → the recorded meeting. If the Audio transcript file is
available to download, save its `.vtt` and upload it. The supplied speaker labels
and cue times are preserved. Shared viewers should ask the host for an export
they are allowed to use. Readable transcript text can be pasted; plain text cites
exact excerpts without invented timestamps.

Conditional guidance offers these actions when the learner/host encounters them:

| Reported situation | Next step |
| --- | --- |
| Transcript processing | Wait for the host to confirm the transcript is ready; recording readiness alone is insufficient. |
| No transcript | Ask the host whether audio transcription was enabled and a transcript was generated. |
| Restricted access | Ask for a permitted transcript export; playback does not establish download permission. |
| Expired link or deleted recording | Ask for a current link or a permitted transcript export the host still has. |

These are guidance branches, not states inferred by this app. No credential or
password form is added. Existing recording recognition and canonical validation
are preserved, including query context and historical saved captures. A fragment
variant reuses the same learner's capture; share and play links are not assumed
to identify the same recording without evidence.

## Inputs, evidence and persistence

The existing [supplied transcript API and limits](video-transcript-setup.md)
apply: UTF-8 TXT/VTT/SRT files up to 1 MB; paste 120–100,000 characters; at most
2,000 timed cues and 30,000 captured readable characters. Omitted text is marked
partial; completeness against the recording is unverified. Only supplied times
are retained. A link or video file alone cannot generate a note through this path.

The authenticated source/study/outbox workflow stores the original URL and
transcript metadata with a read-only note. Exact saved passages open in Sources.
Zoom links open the original without seeking; the supplied time range remains
visible. No new migration, provider adapter or credentials are required.
Native/iOS and v1 behavior are unchanged by this slice.

## Primary sources — checked 2026-10-03

- [Zoom cloud audio-transcription guide](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0064927):
  cloud audio transcripts are separate timed VTT files. They may finish after
  the recording; hosts control whether shared viewers see the transcript. The
  portal path above is documented. These facts concern cloud audio transcription,
  not every newer Zoom transcript product or local recording.
- [Zoom Meetings API, Get a meeting transcript](https://developers.zoom.us/docs/api/meetings/):
  the endpoint exposes `can_download` and a download URL when permitted.
  Downloads require the user's OAuth bearer token with the appropriate scopes.
  Restriction reasons include `DELETED_OR_TRASHED`, `UNSUPPORTED`,
  `NO_TRANSCRIPT_DATA` and `NOT_READY`.
- [Zoom recording download/webhook guide](https://developers.zoom.us/blog/meeting-api-querying-tips-part4/):
  share, play and download URLs serve different purposes. App downloads use
  OAuth or webhook download tokens; the documented webhook token expires after
  24 hours. This does not establish a lifetime for arbitrary share links.

No accessible anonymous transcript fixture was supplied or demonstrated. An
OAuth integration or any independently validated accessible download method
remains target work outside this slice.

## Acceptance record — 2026-10-03

- The browser had no Zoom access panel or transcript input before this change;
  recognized share/play context now opens both immediately, disables YouTube
  import and preserves URL/title. Expanded guidance covers all listed situations
  conditionally, without asserting a recording-specific state.
- A controlled VTT upload generated a hosted saved note with the Lecturer label,
  exact 5.250–20.500 second citation and original recording link after reload.
- Readable text pasted against a playback link with a synthetic passcode query
  generated a note with exact untimed excerpts. Re-import with transcript text
  and a fragment variant reopened the same note.
- All three references match exact saved text and supplied cue metadata. Another
  learner received API404, RESTempty and study RPC denial for both sources.
- 106 backend tests, 30 web tests, build/typecheck and lint pass. The prescribed
  bare pytest launcher uses a stale Anaconda interpreter; the same suite passes
  with `uv run --project backend --extra dev python -m pytest backend/tests -q`.

Fixtures use synthetic text and fictional recording contexts, not real private
Zoom permission or availability probes. No accessible anonymous retrieval method
is demonstrated. Independent Standards/Spec review and fixture cleanup remain
pending. No new phone-width acceptance or production deployment is claimed.
