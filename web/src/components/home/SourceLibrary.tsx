import {
  ArrowDownWideNarrow,
  ArrowUpRight,
  BookOpen,
  BrainCircuit,
  FileText,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { AttentionArt } from "../Graph";
import { studyLabel } from "../../lib/study-note";
import type { Note } from "../../types";

export interface SourceLibraryProps {
  filtered: Note[];
  notes: Note[];
  names: Record<string, string>;
  demo: boolean;
  query: string;
  filter: string;
  sort: string;
  setQuery: (value: string) => void;
  setFilter: (value: string) => void;
  setSort: (value: string) => void;
  onOpenNote: (note: Note) => void;
}

export function SourceLibrary({
  filtered,
  notes,
  names,
  demo,
  query,
  filter,
  sort,
  setQuery,
  setFilter,
  setSort,
  onOpenNote,
}: SourceLibraryProps) {
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>
            {demo ? "Sources and examples" : "Your sources"}{" "}
            <span>{notes.length}</span>
          </h2>
          <p>Good ideas, ready to become understanding.</p>
        </div>
        <label className="sort-control">
          <ArrowDownWideNarrow size={15} />
          <span className="sr-only">Sort sources</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="recent">Recently added</option>
            <option value="title">Title A–Z</option>
          </select>
        </label>
      </div>
      <div className="library-toolbar">
        <div className="filter-tabs" aria-label="Source filters">
          {["All sources", "Article", "PDF", "Video", "Paper"].map((f) => (
            <button
              key={f}
              aria-pressed={filter === f}
              className={filter === f ? "active" : ""}
              onClick={() => setFilter(f)}
            >
              {f === "Article" ? "Articles" : f === "Paper" ? "Papers" : f}
            </button>
          ))}
        </div>
        <label className="search-field">
          <Search size={15} />
          <span className="sr-only">Search sources</span>
          <input
            id="library-search"
            placeholder="Search sources…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              className="icon-button"
              aria-label="Clear search"
              onClick={() => setQuery("")}
            >
              <X size={13} />
            </button>
          )}
        </label>
      </div>
      <div className="source-grid">
        {filtered.map((n) => (
          <button
            className={`source-card tone-${n.color}`}
            key={n.id}
            onClick={() => onOpenNote(n)}
          >
            <div className="source-card-art">
              {n.id === "attention" ? (
                <AttentionArt small />
              ) : n.id === "annotated" ? (
                <div className="code-art">
                  <span>class Transformer:</span>
                  <span>
                    {" "}
                    attention = <b>all_you_need</b>
                  </span>
                  <span> context = learn(tokens)</span>
                  <i>01 &nbsp; 02 &nbsp; 03 &nbsp; 04</i>
                </div>
              ) : (
                <div className="retrieval-art">
                  <span>
                    <FileText size={20} />
                  </span>
                  <i />
                  <span>
                    <BrainCircuit size={26} />
                  </span>
                  <i />
                  <span>
                    <Sparkles size={20} />
                  </span>
                </div>
              )}
              <span className="source-type">
                <FileText size={11} />
                {n.kind}
              </span>
            </div>
            <div className="source-card-content">
              <small>
                {n.author} · {n.year}
              </small>
              <h3>
                {n.title}
                <ArrowUpRight size={16} />
              </h3>
              <p>{n.subtitle}</p>
              <div className="topic-chips">
                {n.topics.slice(0, 2).map((t) => (
                  <span key={t}>{names[t] || t}</span>
                ))}
              </div>
              <div className="source-card-footer">
                <span>
                  {n.demo
                    ? "Example note"
                    : n.savedSource
                      ? "Saved privately"
                      : "This session"}
                </span>
                <span>
                  <BookOpen size={12} />
                  {n.savedSource
                    ? studyLabel(n.study)
                    : `${n.concepts.length} concepts`}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
      {!filtered.length && notes.length > 0 && (
        <div className="empty-results">
          <Search size={28} />
          <h3>No matching sources</h3>
          <p>Try another title, author, or topic.</p>
          <button
            className="text-button"
            onClick={() => {
              setQuery("");
              setFilter("All sources");
            }}
          >
            Clear filters
          </button>
        </div>
      )}
    </>
  );
}
