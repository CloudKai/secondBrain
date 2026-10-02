import type { Note } from "../types";

export default function CapturedSourceText({ note }: { note: Note }) {
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
