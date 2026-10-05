import { useState } from "react";
import { ArrowUp, BookOpen, Globe2, Network, Sparkles } from "lucide-react";
import type { Note } from "../types";
interface Message {
  role: "user" | "assistant";
  text: string;
  references: Note[];
  gap?: boolean;
}
export default function Assistant({
  note,
  notes,
  onCitation,
  onDiscover,
}: {
  note: Note;
  notes: Note[];
  onCitation: (id: string) => void;
  onDiscover: () => void;
}) {
  const [topicScope, setTopicScope] = useState(false),
    [libraryScope, setLibraryScope] = useState(false),
    [input, setInput] = useState(""),
    [messages, setMessages] = useState<Message[]>([]);
  function ask(question: string) {
    if (!question.trim()) return;
    const stopWords = new Set([
      "what",
      "how",
      "why",
      "the",
      "this",
      "that",
      "does",
      "can",
      "are",
      "and",
      "for",
      "with",
      "about",
      "explain",
    ]);
    const words = question
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length >= 3 && !stopWords.has(w));
    const topicNotes = notes.filter(
      (n) => n.id !== note.id && n.topics.some((t) => note.topics.includes(t)),
    );
    const libraryNotes = notes.filter(
      (n) =>
        n.id !== note.id &&
        words.some((w) =>
          `${n.title} ${n.overview} ${n.concepts.map((c) => `${c.title} ${c.text}`).join(" ")}`
            .toLowerCase()
            .includes(w),
        ),
    );
    const candidates = [
      note,
      ...(topicScope ? topicNotes : []),
      ...(libraryScope ? libraryNotes : []),
    ].filter((n, i, list) => list.findIndex((m) => m.url === n.url) === i);
    let references: Note[] = [note],
      text = "",
      gap = false;
    if (/summari[sz]e|key ideas|big picture/i.test(question)) {
      text = candidates.map((n) => `${n.title}: ${n.overview}`).join("\n\n");
      references = candidates;
    } else if (/quiz|test me|recall/i.test(question))
      text = `Try this without looking at your notes: ${note.recall[0]?.question || "What is the main idea of this source?"}`;
    else if (/example|analogy/i.test(question) && note.example)
      text = note.example;
    else {
      const matches = candidates.flatMap((n) =>
        n.concepts
          .filter((c) =>
            words.some((w) =>
              `${n.title} ${c.title} ${c.text}`.toLowerCase().includes(w),
            ),
          )
          .map((c) => ({ n, c })),
      );
      if (matches.length) {
        text = matches
          .slice(0, 3)
          .map((m) => `${m.c.title}: ${m.c.text}`)
          .join("\n\n");
        references = [
          ...new Map(matches.slice(0, 3).map((m) => [m.n.id, m.n])).values(),
        ];
      } else {
        text =
          "These saved notes do not provide enough evidence to answer that question. You can inspect the original sources or explore the reading list for more context.";
        references = [];
        gap = true;
      }
    }
    setMessages((m) => [
      ...m,
      { role: "user", text: question, references: [] },
      { role: "assistant", text, references, gap },
    ]);
    setInput("");
  }
  return (
    <section className="assistant" aria-labelledby="assistant-title">
      <div className="assistant-heading">
        <span className="assistant-icon">
          <Sparkles size={19} />
        </span>
        <div>
          <h3 id="assistant-title">A little help connecting the dots</h3>
          <p>Ask about what you’re learning.</p>
        </div>
        <span className="badge">Preview</span>
      </div>
      <p className="preview-explainer">
        Saved-note lookup, using your existing notes. Open-ended AI chat is
        planned.
      </p>
      <div className="conversation" role="log" aria-live="polite">
        {messages.map((m, i) => (
          <div className={`message ${m.role}`} key={i}>
            <small>
              {m.role === "user" ? "YOU" : "SECOND BRAIN · SAVED NOTES"}
            </small>
            <p>{m.text}</p>
            {m.references.map((n, j) => (
              <button
                className="citation-reference"
                key={n.id}
                onClick={() => onCitation(n.id)}
              >
                <BookOpen size={12} /> {j + 1}. {n.title}
              </button>
            ))}
            {m.gap && (
              <button className="text-button" onClick={onDiscover}>
                Explore reliable sources <Globe2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="prompt-chips">
        {[
          "Summarize the key ideas",
          "Give me an analogy",
          "Quiz me on this",
        ].map((p) => (
          <button key={p} onClick={() => ask(p)}>
            {p}
            <span>↗</span>
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="assistant-input"
      >
        <label className="sr-only" htmlFor="assistant-question">
          Ask about this note
        </label>
        <textarea
          id="assistant-question"
          rows={2}
          placeholder="What would you like to understand better?"
          value={input}
          maxLength={2000}
          onChange={(e) => setInput(e.target.value)}
        />
        <div className="assistant-input-footer">
          <div className="scope-buttons">
            <span>
              <BookOpen size={12} /> Current note
            </span>
            <button
              type="button"
              aria-pressed={topicScope}
              className={topicScope ? "selected" : ""}
              onClick={() => setTopicScope(!topicScope)}
            >
              <Network size={12} /> Ask this topic
            </button>
            <button
              type="button"
              aria-pressed={libraryScope}
              className={libraryScope ? "selected" : ""}
              onClick={() => setLibraryScope(!libraryScope)}
            >
              <Globe2 size={12} /> Ask my library
            </button>
          </div>
          <button
            type="submit"
            className="send-button"
            aria-label="Send question"
            disabled={!input.trim()}
          >
            <ArrowUp size={18} />
          </button>
        </div>
      </form>
    </section>
  );
}
