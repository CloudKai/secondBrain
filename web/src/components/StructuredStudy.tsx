import type { StudyNote } from "../lib/study-note";

export function StudyCitations({
  ids,
  onCitation,
}: {
  ids: string[];
  onCitation: (id: string) => void;
}) {
  return (
    <span className="study-citations">
      {ids.map((id) => (
        <button
          key={id}
          className="citation"
          aria-label={`Inspect source passage ${id}`}
          onClick={() => onCitation(id)}
        >
          {Number(id.slice(1)) || id}
        </button>
      ))}
    </span>
  );
}

export default function StructuredStudy({
  note,
  onCitation,
}: {
  note: StudyNote;
  onCitation: (id: string) => void;
}) {
  return (
    <>
      <section className="overview-block">
        <div>
          <h2>The big picture</h2>
          <p>
            {note.overview.text}{" "}
            <StudyCitations
              ids={note.overview.citation_ids}
              onCitation={onCitation}
            />
          </p>
        </div>
      </section>
      <section className="concept-section">
        <span className="eyebrow">LET’S BREAK IT DOWN</span>
        <h2>The ideas to take with you</h2>
        {note.concepts.map((concept, i) => (
          <div className="concept" key={i}>
            <span className="concept-number">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <h3>{concept.title}</h3>
              <p>
                {concept.text}{" "}
                <StudyCitations
                  ids={concept.citation_ids}
                  onCitation={onCitation}
                />
              </p>
            </div>
          </div>
        ))}
      </section>
      {note.examples.length > 0 && (
        <section className="example-block">
          <h2>Make it concrete</h2>
          {note.examples.map((example, i) => (
            <div key={i}>
              <h3>{example.title}</h3>
              <p>
                {example.text}{" "}
                <StudyCitations
                  ids={example.citation_ids}
                  onCitation={onCitation}
                />
              </p>
            </div>
          ))}
        </section>
      )}
      {note.equations.length > 0 && (
        <section className="study-equations">
          <h2>Equations from the source</h2>
          {note.equations.map((equation, i) => (
            <div className="equation" key={i}>
              <code>{equation.expression}</code>
              <p>
                {equation.text}{" "}
                <StudyCitations
                  ids={equation.citation_ids}
                  onCitation={onCitation}
                />
              </p>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
