import { useState } from "react";
import { ArrowRight, Check, RotateCcw, Sparkles } from "lucide-react";
import type { Note } from "../types";
import { StudyCitations } from "./StructuredStudy";
export default function RecallCards({
  note,
  mastered,
  onMaster,
  onCitation,
}: {
  note: Note;
  mastered: string[];
  onMaster: (id: string) => void;
  onCitation?: (id: string) => void;
}) {
  const [index, setIndex] = useState(0),
    [revealed, setRevealed] = useState(false);
  const card = note.recall[index];
  if (!card) return null;
  const done = mastered.includes(`${note.id}:${index}`);
  return (
    <div className="recall-card">
      <div className="recall-top">
        <span>
          <Sparkles size={15} /> A moment to recall
        </span>
        <small>
          {index + 1} / {note.recall.length}
        </small>
      </div>
      <h3>{card.question}</h3>
      {revealed && (
        <p className="recall-answer">
          {card.answer}
          {onCitation && note.study?.note && (
            <StudyCitations
              ids={note.study.note.recall[index].citation_ids}
              onCitation={onCitation}
            />
          )}
        </p>
      )}
      <div className="recall-actions">
        {!revealed ? (
          <button
            className="button secondary"
            onClick={() => setRevealed(true)}
          >
            Reveal answer
          </button>
        ) : (
          <button
            className={`button ${done ? "secondary" : "primary"}`}
            onClick={() => onMaster(`${note.id}:${index}`)}
          >
            <Check size={15} />
            {done ? "Marked understood" : "I understand this"}
          </button>
        )}
        <button
          className="text-button"
          onClick={() => {
            setIndex((index + 1) % note.recall.length);
            setRevealed(false);
          }}
        >
          {index === note.recall.length - 1 ? (
            <>
              Start again <RotateCcw size={14} />
            </>
          ) : (
            <>
              Next question <ArrowRight size={14} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
