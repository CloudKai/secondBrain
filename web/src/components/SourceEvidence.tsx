import { ExternalLink } from "lucide-react";
import type { Note } from "../types";
import type { SourceReference } from "../lib/study-note";
import { formatVideoTime, videoMomentUrl } from "../lib/transcript";
import CapturedSourceText from "./CapturedSourceText";
import ReadingText from "./ReadingText";
import PassageLocation from "./PassageLocation";

export default function SourceEvidence({ note, passage, onFullText }: {
  note: Note;
  passage?: SourceReference;
  onFullText: () => void;
}) {
  return <>
    <header className="source-reading-header">
      <span className="eyebrow">{note.demo ? "EXAMPLE EVIDENCE" : passage ? "ORIGINAL SOURCE EXCERPT" : "CAPTURED SOURCE"}</span>
      <h2>{note.title}</h2>
      <p>{note.author} · {note.year}</p>
      {passage ? <PassageLocation passage={passage}/> : <span className="source-location">{note.evidenceLabel}</span>}
    </header>
    {passage ? (
      <ReadingText text={passage.excerpt} source={!note.demo}/>
    ) : (
      <CapturedSourceText note={note} />
    )}
    {passage && (
      <button
        className="text-button"
        onClick={onFullText}
      >
        Show full captured text
      </button>
    )}
    {note.demo && (
      <p className="micro-copy">
        This example note includes paraphrased evidence, not a
        verbatim excerpt or a full-source extraction.
      </p>
    )}
    {note.url ? (
      <a
        className="button secondary full"
        href={
          passage?.page
            ? `${note.url.split("#")[0]}#page=${passage.page}`
            : note.kind === "Video"
              ? videoMomentUrl(note.url, passage?.start_ms)
              : note.url
        }
        target="_blank"
        rel="noreferrer"
      >
        {note.kind === "Video" &&
        passage?.start_ms != null &&
        note.savedSource?.transcript?.provider === "youtube"
          ? `Open video at ${formatVideoTime(Math.floor(passage.start_ms / 1000) * 1000)}`
          : "Open original"}{" "}
        <ExternalLink size={15} />
      </a>
    ) : (
      <p className="micro-copy">
        Uploaded PDF · saved page text. The original file is not
        stored; refer to your local copy for images and layout.
      </p>
    )}
    {note.kind === "Video" && (
      <p className="micro-copy">
        {note.savedSource?.capture_origin === "direct"
          ? note.savedSource.coverage_detail
          : `User-supplied transcript · ${note.savedSource?.transcript?.filename ?? "pasted text"}. No video was fetched or watched.`}
        {passage?.start_ms != null &&
          note.savedSource?.transcript?.provider !==
            "youtube" &&
          " Times are retained from your transcript; this link opens the recording without seeking to a time."}
      </p>
    )}

  </>;
}
