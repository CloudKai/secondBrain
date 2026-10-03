# Supplied video transcripts — GitHub issue #5

## Implemented scope

The browser Video form accepts a recording link plus a transcript uploaded or
pasted by the learner. It does not retrieve transcripts, download audio/video,
watch recordings or connect provider accounts. Notes are generated in English
through the existing authenticated source/study workflow and remain read-only.
Native/iOS code is untouched. Automatic YouTube retrieval remains a later ticket.

Recognized links are specific YouTube videos (watch, short, live, embed or youtu.be),
Teams or SharePoint recording context, Zoom `/rec/share/` or `/rec/play/` recordings,
and Panopto session viewer links with an `id`. HTTPS is required; embedded
credentials, custom ports, platform home pages and Zoom meeting invitations are
rejected. These checks identify a supported URL shape, not access or transcript
availability. Login or access to the original recording remains the learner's job.

## Inputs and coverage

- Upload UTF-8 TXT, WebVTT (`.vtt`) or SubRip (`.srt`) up to 1,000,000 bytes.
- Paste 120–100,000 characters; VTT/SRT are detected from caption structure.
- TXT is untimed. For DOCX and other exports, paste the readable transcript text.
- Timed files allow at most 2,000 cues and times within seven days of the start.
- Capture retains at most 30,000 readable characters. Omitted text is explicitly
  labelled partial. Otherwise coverage is unknown: completeness against the video
  is unverified even when all supplied text was captured.
- Bad encoding, malformed captions, missing text and size limits explain how to
  correct the input. Original file binaries are not retained.

Captured text, filename, format, provider, speaker labels and cue text offsets/
start/end times persist in the learner-owned source. Source identity reuses the
same canonical recording for that learner; re-import is not transcript refresh.
Different learners retain independent captures. Article/PDF records are preserved.

## Citations

Each note citation identifies an exact saved supporting passage. Passages split
within individual cues, so every attached time range comes from that cue in the
supplied transcript. The model selects passage IDs; server code attaches the
excerpt and times. Untimed text never receives invented timestamps. The browser
validates each excerpt and cue range again before displaying a note.

Sources shows the excerpt, supplied time range (when present), input provenance
and full captured transcript. YouTube's Open video button uses a start-time link,
rounding down to a whole second. Other providers open the original recording and
explicitly disclose that seeking is not implemented. Their supplied times remain
visible. Caption speaker names are retained; formatting tags are removed.

Format references: [W3C WebVTT](https://www.w3.org/TR/webvtt1/) documents cue IDs,
times and voice spans; [YouTube sharing help](https://support.google.com/youtube/answer/57741?hl=en)
documents sharing a video from a specific time.

## API and migration

`POST /api/v2/sources/video` requires the learner's bearer token. Send the recording
URL in `X-Video-URL`, optional `title` and upload `filename` as query parameters,
and raw UTF-8 text/file bytes as the request body. Keeping the recording URL out
of the request URL avoids putting recording access codes in standard HTTP access
logs. Request streaming is bounded to 1 MB and 30 seconds. No provider is fetched.

Apply `supabase/migrations/202610030004_video_transcripts.sql` after the PDF
migration. Restart the updated study worker before applying it: worker claim JSON
now includes nullable transcript metadata, and older strict worker models do not
accept that field. Keep the existing API, Redis and worker running. Existing
server-only keys in the ignored backend environment are sufficient; no new key
belongs in the browser. Ownership RLS, authenticated request acceptance and
service-only claim/complete fencing remain in place.

The matching rollback refuses to run while any video capture exists, protecting
saved video notes. When no videos remain it restores the preceding PDF contract;
article/PDF captures are preserved. Do not delete real learner sources to enable a
rollback without a separately authorized data plan.

## Verification status

Local implementation: 22 transcript boundary tests, 93 full backend tests and
28 web tests pass; web
build/typecheck and lint pass. The documented pytest executable resolves to an
unrelated Anaconda interpreter; project Python (`uv run --project backend --extra
dev python -m pytest backend/tests -q`) is used for the full backend suite.
Independent standards/spec reviews are complete with no remaining findings.
The hosted migration succeeded in AI Study Friends on 2026-10-03. Timed VTT
upload generation, both supplied cue citations and reload passed in the browser.
A malformed VTT displayed actionable feedback without saving. Hosted untimed
paste generation produced exact excerpts with no invented times, repeated study
requests reused the result, Panopto parameter variants reused a source, and a
second anonymous learner could neither read, delete nor generate those sources
through the API or bypass ownership through direct REST/RPC. Browser untimed paste, exact excerpt citations and reload also passed. Hosted
Teams recording context and uploaded SRT retained a supplied zero-start cue.
Six disposable acceptance sources and their notes/jobs were removed with the
cascade verified; private test session tokens were discarded.

The browser viewport override did not change the reported 1265px width, so a
phone-width check could not be verified in this environment. Existing responsive
styles were reused; no native layout or CSS was changed in this ticket.
