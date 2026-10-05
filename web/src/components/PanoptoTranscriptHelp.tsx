import { ExternalLink } from "lucide-react";

export default function PanoptoTranscriptHelp({ url }: { url: string }) {
  const site = new URL(url).hostname;
  return (
    <section
      className="transcript-access"
      aria-labelledby="panopto-transcript-heading"
    >
      <h3 id="panopto-transcript-heading">Panopto transcript access</h3>
      <p><strong>Panopto site:</strong> {site}</p>
      <p>
        Upload a caption export or paste the transcript. This app doesn’t sign
        into your Panopto site, and automatic caption access hasn’t been
        validated. Being able to watch a lecture doesn’t establish permission
        for this app to download its captions.
      </p>
      <details>
        <summary>Get captions or resolve access</summary>
        <ol>
          <li>
            Open the original lecture in your usual browser. If your site offers
            a caption export, upload its SRT or VTT file to retain the supplied
            cue times and speaker labels.
          </li>
          <li>
            If captions or export access aren’t available, ask the lecturer or
            site administrator for a transcript you’re allowed to use. Access
            can depend on the site and your permissions.
          </li>
          <li>
            If an export is unreadable or uses another format, obtain a UTF-8
            TXT, SRT or VTT export, or paste its readable transcript text.
            Plain text cites excerpts without precise times.
          </li>
        </ol>
        <p>
          The site address identifies the lecture’s context. This app hasn’t
          checked the site’s policy, your access, whether the lecture exists or
          whether it has captions. A video file or link alone can’t generate a
          note through this transcript form.
        </p>
      </details>
      <a href={url} target="_blank" rel="noreferrer">
        Open original lecture <ExternalLink size={13} />
      </a>
    </section>
  );
}
