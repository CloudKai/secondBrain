# Transcript access for video sources

Research date: 2026-10-02, Asia/Singapore. Status: primary-source findings for
target design; no provider integration is implemented or acceptance-tested.
Scope: YouTube, Microsoft Teams, Zoom, and Panopto transcript retrieval and
transcript upload/paste fallback. No accounts, recordings, or credentials were
accessed. Research used TinyFish search and static content fetching.

## Findings that affect the product

A playable recording link does not establish permission for an application to
download its transcript. Automatic retrieval must depend on an available
transcript and an authorized access path. The details below support that
constraint; they do not establish support for every link on these platforms.

The current backend only ingests HTML/plain text plus shared-text fallback
(`backend/graph.py`); all transcript behavior here is target work.

## YouTube

**Verified:** YouTube's viewer can show a transcript for a video that has
captions. Clicking a transcript line jumps to the corresponding video moment.
This establishes a user-visible transcript experience, not a general download
API for any viewer. [YouTube Help: View video transcripts](https://support.google.com/youtube/answer/15930243?hl=en).

**Verified:** The official Data API's `captions.list` returns caption-track
metadata, not the transcript text, and requires authorization. The separate
`captions.download` endpoint explicitly requires the authenticated user to
have permission to edit the video; its authorization scopes include
`youtube.force-ssl` or `youtubepartner`. It supports VTT, SRT, SBV, SCC, and TTML
export. [Caption listing](https://developers.google.com/youtube/v3/docs/captions/list),
[Caption download](https://developers.google.com/youtube/v3/docs/captions/download).

**Implication:** Public visibility and visible captions alone do not satisfy
the official download API's authorization requirement. Connecting a learner's
YouTube account does not establish edit access to someone else's lecture.
Automatic retrieval of arbitrary public videos needs a separately evaluated
access method; it is unverified by this research. Keep transcript upload/paste
as a usable fallback. Timed caption formats can preserve real moments; plain
pasted text must not acquire invented timestamps.

## Microsoft Teams

**Verified:** Microsoft Graph can retrieve transcript content after a meeting
or call. Work/school delegated access requires
`OnlineMeetingTranscript.Read.All` for online meetings or
`CallTranscripts.Read.All` for ad hoc calls. Personal Microsoft accounts are
unsupported by this API. Application access requires the relevant permissions;
the documentation also requires tenant administrators to configure an
application access policy for application access. Meeting-specific
`OnlineMeetingTranscript.Read.Chat` uses resource-specific consent and is
limited to scheduled private-chat meetings. Invited meeting users can also
access the API, subject to its other requirements. The content endpoint
returns timestamped WebVTT or timestamped text without speaker attribution.
The latter is available when speaker attribution is disallowed.
[Microsoft Graph: Get callTranscript](https://learn.microsoft.com/en-us/graph/api/calltranscript-get?view=graph-rest-1.0).

**Verified:** Current tenant controls can disable Graph transcript access even
when an app has permissions; Microsoft says this access is off by default.
Speaker attribution is a separate admin setting.
[Manage transcript API access](https://learn.microsoft.com/en-us/microsoftteams/meeting-transcript-api-access).

**Verified:** Teams allows organizers and co-organizers to download `.docx` or
`.vtt` transcripts by default. Permission to let other participants download
depends on IT policy. Microsoft's participant table does not grant anonymous
participants transcript access and does not grant cross-tenant participants
post-meeting access by default. Transcripts include names and timestamps, and
are stored in the organizer's OneDrive for Business.
[Microsoft Support: Start, stop, and download transcripts](https://support.microsoft.com/en-us/teams/meetings/start-stop-and-download-live-transcripts-in-microsoft-teams-meetings).

**Implication:** A Teams recording URL is not an anonymous transcript download
contract. Institution-approved account/API access is a distinct delivery
dependency. A learner who can watch a lecture may still lack export or API
permission. VTT upload is the clearest fallback for retaining times; DOCX or
paste must retain only locations actually present in the supplied material.

## Zoom

**Verified:** Zoom's cloud-recording audio-transcription feature requires a
Pro, Business, Education, or Enterprise account, cloud recording enabled, and
audio transcription enabled. A transcript can finish processing after the
recording is available. It is a separate VTT file with timed sections; the
recording owner can enable or disable whether shared viewers see it.
[Zoom Support: Audio transcription for cloud recordings](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0064927).

**Verified:** Current Meetings API documentation includes
`GET /meetings/{meetingId}/transcript`. It returns transcript information and
a download URL only when `can_download` is true. Restrictions include
`DELETED_OR_TRASHED`, `UNSUPPORTED`, `NO_TRANSCRIPT_DATA`, and `NOT_READY`.
Downloading requires the user's OAuth bearer token; the granular read scopes
include `cloud_recording:read:meeting_transcript` and its admin variant.
The separate recording-files endpoint requires recording read permissions and
documents bearer-token access to password-protected files.
[Zoom Meetings API: transcript and recording endpoints](https://developers.zoom.us/docs/api/meetings/).

**Verified:** Zoom distinguishes share URLs, playback URLs, and API download
URLs. Its first-party guide uses OAuth access tokens or webhook download
tokens, with webhook tokens expiring after 24 hours. The guide also references
the `recording.transcript.completed` event.
[Zoom developer guide: Download recordings using webhooks](https://developers.zoom.us/blog/meeting-api-querying-tips-part4/).

**Implication:** Automatic access requires a permitted transcript and an
authorized app/download path, rather than just a share-link password. Do not
generalize the cloud-recording feature's prerequisites to every newer Zoom
transcript product without checking that endpoint/product. Local recordings,
viewer-only links, account role mappings, and the newer endpoint's exact
download format remain unverified here. VTT export/upload remains a documented
fallback for the cloud-recording feature.

## Panopto

**Verified:** Panopto's public API documentation points to tenant-specific
OpenID/OAuth discovery. Its live demo schema provides
`GET /api/v1/sessions/{id}` and a session `CaptionDownloadUrl` field described
as a caption download URL when available. The session endpoint documents
unauthorized and insufficient-permission responses.
[Panopto API documentation](https://demo.hosted.panopto.com/Panopto/api/docs/index.html),
[Live API schema](https://demo.hosted.panopto.com/Panopto/api/v1/panoptoApi.json).

**First-party guidance, dated:** A January 2025 reply on Panopto's own forum
states that the session endpoint returns a caption link when captions exist
and a blank link otherwise. An older June 2023 reply from a named Panopto
platform developer mentions SRT download links and warns that the download
could not be automated at that time. The newer schema confirms a download
field but does not resolve every access/automation requirement.
[January 2025 discussion](https://community.panopto.com/discussion/2561/downloading-video-transcripts-via-api-for-use-by-an-llm),
[June 2023 developer discussion](https://community.panopto.com/discussion/2057/pulling-captions-transcripts-through-api-without-admin-role).

**Unverified:** The exact learner role, tenant settings, OAuth client creation
policy, SSO consent, caption-link authentication, public anonymous behavior,
and current viewer export permissions. The official support pages for caption
download, OAuth clients, and user tokens were unreachable through TinyFish;
their search snippets are not treated as verified requirements. No sample
caption file was downloaded, so SRT format/timing is dated guidance rather
than an acceptance-tested current contract.

**Implication:** Select and validate a concrete Panopto institution/tenant
access arrangement before promising automatic private-lecture imports. Keep
upload/paste available when captions can be obtained by the learner but cannot
be retrieved by the app.

## Product decisions still required

These are implications and proposed boundaries, not implemented capabilities:

- Decide whether the first delivery includes account connections and required
  institution/admin cooperation, or attempts accessible links and routes private
  sources to transcript upload/paste. Required provider targets can stay the
  same while delivery scope is chosen explicitly.
- Distinguish missing captions, processing, blocked permission, expired/deleted
  material, and unsupported source variants in capture feedback.
- Retain the original video URL, transcript origin, language, and real time
  ranges. Transcript upload/paste must not imply that the app retrieved or
  watched the original video.
- Prefer VTT and SRT upload where available. Confirm whether DOCX import is
  included for Teams exports; paste can remain the common fallback. If input
  has no times, cite an excerpt without claiming a precise video moment.
- Validate public and permitted private fixtures per selected provider before
  marking support verified. Transcript availability, language support, and
  recording/deep-link resolution require provider acceptance cases.

No account connection, transcript scraping, speech-to-text, or media processing
was implemented during this research.
