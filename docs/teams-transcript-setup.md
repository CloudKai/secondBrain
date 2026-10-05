# Teams transcript access — GitHub #7, planned ticket 06

## Implemented scope

A recognized Teams or SharePoint recording context immediately selects Upload or
paste in the browser Video form. The access panel explains the app's lack of
Teams authorization, offers export instructions and links to the original
recording/recap and Microsoft's guide. This is a supplied-transcript path;
automatic Teams retrieval has not been validated and is not advertised.

The link alone does not establish that a transcript exists, has finished
processing, was deleted or is accessible. The app does not inspect these states,
connect a Microsoft account, request tenant admin consent, scrape private pages,
or download/transcribe media. Existing supported URL shapes and saved-source
validation are preserved, including historical captures.

## Export and paste

In Teams, open the past meeting chat → Recap → Transcript. If Download is
available, choose `.vtt`. Upload that export to preserve its supplied speaker
labels and cue times. A DOCX export is not an accepted file: copy its readable
transcript text and use Paste transcript. Plain text supports exact excerpt
citations without invented timestamps. If access is unavailable, ask the
organizer for an export you are allowed to use.

The existing [supplied-transcript limits and API](video-transcript-setup.md)
apply: UTF-8 TXT/VTT/SRT up to 1 MB, paste 120–100,000 characters, at most 2,000
timed cues and 30,000 captured characters. Coverage against the video remains
unverified. Imports preserve the original URL, use the existing authenticated
source/study/outbox workflow and reuse a learner's canonical capture. Notes
remain read-only. Teams citation links open the original without seeking;
the actual supplied cue range remains visible. No migration or new credentials
are required. Native/iOS code is unchanged.

## Primary-source findings — checked 2026-10-03

- Microsoft's [Graph transcript content API](https://learn.microsoft.com/en-us/graph/api/calltranscript-get?view=graph-rest-1.0)
  requires a bearer token and appropriate delegated/application permissions.
  Application access can require a tenant administrator's access policy.
- [Tenant transcript API controls](https://learn.microsoft.com/en-us/microsoftteams/meeting-transcript-api-access)
  can block Graph access despite granted application permissions; transcript API
  access is disabled by default under the documented tenant setting.
- The [Teams transcript download guide](https://support.microsoft.com/en-us/teams/meetings/start-stop-and-download-live-transcripts-in-microsoft-teams-meetings)
  documents the Recap/Transcript download path and VTT/DOCX options. Organizers
  and co-organizers can download by default; other participants depend on IT policy.

A playable recording URL does not prove this app can retrieve its transcript.
No anonymous retrieval path or automatic Teams fixture has been demonstrated.
Authenticated Graph integration remains target work and is outside this slice.

## Acceptance record — 2026-10-03

Hosted development checks passed using controlled supplied transcripts and
fictional recording context URLs. They do not establish access to a real private
Teams recording or test a specific recording's actual permissions.

- VTT upload generated a persistent note, preserving the Lecturer label and
  5.250–20.500 second cue; citation and source text survived browser reload.
- Readable export text pasted against a Teams recap link generated a note with
  exact excerpt references and no timestamps. Re-import with the transcript and
  a fragment variant reopened the same note.
- All three references matched exact saved text and their supplied cue metadata.
  A second learner received API 404, no REST row and denial of the study RPC.
- The access/export panel was absent before this change and visible afterward;
  upload/paste opened immediately for SharePoint and Teams recap context.
  Restricted-access guidance states the app's authorization limitation without
  claiming to have checked the specific recording.
- 104 backend tests, 30 web tests, build/typecheck and lint pass. The repository's
  bare pytest launcher points at a stale interpreter; tests pass using
  `uv run --project backend --extra dev python -m pytest backend/tests -q`.

Independent Standards/Spec review found no material issues; a naming suggestion
was applied. Both controlled captures and their source/study/outbox rows were
removed with cascade verified; existing learner sources are preserved. Review:
[ticket #7](reviews/ticket07.md).
