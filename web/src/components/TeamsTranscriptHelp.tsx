import { ExternalLink } from "lucide-react";

export default function TeamsTranscriptHelp({ url }: { url: string }) {
  return (
    <section
      className="transcript-access"
      aria-labelledby="teams-transcript-heading"
    >
      <h3 id="teams-transcript-heading">Teams transcript access</h3>
      <p>
        Upload a VTT export or paste the transcript. This app has no Teams
        authorization to fetch it. Being able to watch a recording doesn’t always
        give you permission to download its transcript.
      </p>
      <details>
        <summary>How to get your transcript</summary>
        <ol>
          <li>In Teams, open the past meeting chat → Recap → Transcript.</li>
          <li>
            If Download is available, choose .vtt and upload it here to retain
            speaker labels and cue times.
          </li>
          <li>
            If you only have a DOCX export, copy its readable text and paste it
            here. DOCX files aren’t supported; plain text cites excerpts without
            precise times.
          </li>
        </ol>
        <p>
          If you can’t view or download the transcript, ask the organizer for an
          export you’re allowed to use. The link alone can’t tell this app whether
          a transcript is missing, still processing, deleted or restricted.
        </p>
        <a
          href="https://support.microsoft.com/en-us/teams/meetings/start-stop-and-download-live-transcripts-in-microsoft-teams-meetings"
          target="_blank"
          rel="noreferrer"
        >
          Microsoft’s transcript guide <ExternalLink size={13} />
        </a>
      </details>
      <a href={url} target="_blank" rel="noreferrer">
        Open original recording or recap <ExternalLink size={13} />
      </a>
    </section>
  );
}
