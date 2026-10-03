# Panopto caption access — GitHub #9, planned ticket 08

## Implemented scope

A recognized Panopto viewer link immediately selects Upload or paste in the
browser Video form. The access panel shows the actual site hostname and offers
conditional caption-export, lecturer/administrator and unreadable-export help.
It links to the original lecture. The hostname is source context; the app does
not infer an institution name, discover its policies, sign into it or inspect a
particular lecture's permissions, existence or caption availability.

No anonymous caption-download path for a concrete lecture has been validated.
Automatic Panopto retrieval is not advertised. A playable viewer link is not
proof that this app can download captions. No account connection, authentication
cookies, private-page scraping, bypass or audio/video processing is introduced.

## Export and correction

Open the lecture in your usual browser. If your site offers caption export,
upload a supported SRT or VTT file. If captions/export are unavailable or access
is restricted, ask the lecturer or site administrator for a transcript you are
allowed to use. This guidance does not promise a specific menu or learner role:
Panopto support pages could not be retrieved during this research.

If a file is unreadable or uses an unsupported format, obtain UTF-8 TXT/SRT/VTT
or paste readable transcript text. The error explains correction while the form
retains the recording URL and topic title. Plain text cites excerpts without
invented timestamps. Only speaker labels and times actually supplied are retained.

The existing [transcript API and limits](video-transcript-setup.md) apply: files
up to 1 MB, paste 120–100,000 characters, at most 2,000 timed cues and 30,000
captured readable characters. Omitted text is marked partial; completeness
against the lecture is unverified. No original file binary is retained.

## Identity, evidence and persistence

Panopto identity retains the site, viewer path and session `id`; presentation
parameters are ignored for reuse while the original URL is kept separately.
The same session ID on different sites remains distinct. These URL checks identify
supported context, not access or caption availability. Existing validators and
historical captures remain compatible.

Supplied captions use the authenticated source/study/outbox pipeline and produce
read-only notes. Citation badges open exact stored excerpts and actual supplied
cue ranges. The original Panopto link opens without seeking; the range remains
visible. No new migration, remote adapter or credentials are required.
Native/iOS and v1 behavior are unchanged by this slice.

## Primary-source findings — checked 2026-10-03

- [Panopto public API documentation](https://demo.hosted.panopto.com/Panopto/api/docs/index.html)
  describes a tenant-specific API base and OpenID/OAuth discovery location.
- The [live public schema](https://demo.hosted.panopto.com/Panopto/api/v1/panoptoApi.json)
  documents `CaptionDownloadUrl` as available when the session has a caption
  download. Session lookup documents authorization, permission and missing-session
  responses. The field alone does not establish anonymous access to its content.
- A [January 2025 first-party forum reply](https://community.panopto.com/discussion/2561/downloading-video-transcripts-via-api-for-use-by-an-llm)
  describes session-specific caption links and a blank link when no captions exist.
- A [June 2023 Panopto platform-developer reply](https://community.panopto.com/discussion/2057/pulling-captions-transcripts-through-api-without-admin-role)
  mentions SRT download through session metadata and cautions against automation
  at that time. This dated guidance is not a verified current universal contract.
- The official ASR-caption and viewer support pages were unreachable during the
  fetch. Their search snippets are not treated as verified export instructions.

Tenant OAuth/SSO arrangements, viewer export roles and the authentication of
caption URLs remain unverified for a concrete institution. An institutional
integration or independently validated accessible path remains target work.

## Acceptance record

Browser guidance was absent before the change; recognized context now shows the
site and upload/paste immediately and disables YouTube import. Existing API checks
cover SRT speaker/times, site separation, canonical reuse, ownership and correction
of unreadable exports without saving bad input. Hosted correction/generation,
reload/citations, canonical reuse and second-learner API/REST/RPC denial passed.
All three generated references match stored text/cues. Full checks: 108 backend
tests through project Python, 30 web tests, build/typecheck and lint pass. The
bare pytest launcher retains its stale external interpreter. Independent
Standards/Spec review and controlled-fixture cleanup are pending.
Controlled synthetic transcripts and fictional site/session URLs verify supplied
intake; they do not establish real private lecture access or automatic retrieval.
