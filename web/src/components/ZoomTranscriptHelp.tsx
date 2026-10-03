import { ExternalLink } from "lucide-react";

export default function ZoomTranscriptHelp({ url }: { url: string }) {
  return (
    <section
      className="transcript-access"
      aria-labelledby="zoom-transcript-heading"
    >
      <h3 id="zoom-transcript-heading">Zoom transcript access</h3>
      <p>
        Upload a VTT export or paste the transcript. This app has no Zoom
        authorization to download it. A share/playback link or recording passcode
        alone doesn’t establish transcript download permission.
      </p>
      <details>
        <summary>Get a transcript or resolve access</summary>
        <ol>
          <li>
            If you own the cloud recording, open Zoom’s web portal → Recordings
            &amp; Transcripts → Cloud recordings → the recorded meeting.
          </li>
          <li>
            If an Audio transcript file is available to download, save its .vtt
            file and upload it here. Supplied speaker labels and cue times are
            retained. Otherwise, ask the host for an export you’re allowed to use.
          </li>
        </ol>
        <ul>
          <li>
            If the transcript is still processing, it can finish after the
            recording. Wait for the host to confirm it is ready.
          </li>
          <li>
            If there is no transcript, ask the host whether audio transcription
            was enabled and a transcript was generated.
          </li>
          <li>
            If access is restricted, being able to watch doesn’t guarantee
            export access. Ask the host for a permitted transcript export.
          </li>
          <li>
            If the link expired or the recording was deleted, ask the host for a
            current link or a transcript export they still have permission to share.
          </li>
        </ul>
        <p>
          This app can’t determine those states from your link. You can paste
          readable transcript text instead; plain text cites excerpts without
          precise times. A video file or link alone can’t generate a note here.
        </p>
        <a
          href="https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0064927"
          target="_blank"
          rel="noreferrer"
        >
          Zoom’s transcript guide <ExternalLink size={13} />
        </a>
      </details>
      <a href={url} target="_blank" rel="noreferrer">
        Open original recording <ExternalLink size={13} />
      </a>
    </section>
  );
}
