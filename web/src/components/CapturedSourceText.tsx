import type { Note } from "../types";
import { formatVideoTime } from "../lib/transcript";

export default function CapturedSourceText({ note }: { note: Note }) {
  const transcript = note.savedSource?.transcript;
  if (transcript && transcript.format !== "text") {
    const characters = Array.from(note.evidence);
    return (
      <div className="transcript-cues">
        {transcript.segments.map((segment) => (
          <section key={segment.start}>
            <h3>
              {segment.start_ms != null && segment.end_ms != null
                ? `${formatVideoTime(segment.start_ms)}–${formatVideoTime(segment.end_ms)}`
                : "Untimed transcript excerpt"}
            </h3>
            <p className="evidence-text">
              {characters.slice(segment.start, segment.end).join("")}
            </p>
          </section>
        ))}
      </div>
    );
  }
  const pages = note.savedSource?.document?.pages;
  if (!pages)
    return (
      <p className="evidence-text">
        {note.evidence || "No captured source text is available."}
      </p>
    );
  const characters = Array.from(note.evidence);
  return (
    <div className="pdf-pages">
      {pages.map((page) => (
        <section key={page.page}>
          <h3>PDF page {page.page}</h3>
          <p className="evidence-text">
            {characters.slice(page.start, page.end).join("") ||
              "No selectable text was captured on this page."}
          </p>
        </section>
      ))}
    </div>
  );
}
