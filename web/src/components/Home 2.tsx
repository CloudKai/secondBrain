import { Plus } from "lucide-react";
import type { ReactNode } from "react";
import LearningHistory from "./LearningHistory";
import { ContinueLearning } from "./home/ContinueLearning";
import { SourceLibrary } from "./home/SourceLibrary";
import { Button, ButtonLink, Card } from "./ui";
import { librarySummary } from "../lib/home";
import type { SourceClient } from "../lib/source-client";
import type { Note, Topic } from "../types";

export interface HomeProps {
  client: SourceClient | null;
  storageReady: boolean;
  notes: Note[];
  filtered: Note[];
  topics: Topic[];
  names: Record<string, string>;
  demo: boolean;
  query: string;
  filter: string;
  sort: string;
  setQuery: (value: string) => void;
  setFilter: (value: string) => void;
  setSort: (value: string) => void;
  onOpenNote: (note: Note) => void;
  onOpenLearning: (sourceId: string) => void;
  onAddSource: () => void;
  onLoadExamples: () => void;
  /** The compact topic map, built by App so saved/example topic logic stays there. */
  topicMap?: ReactNode;
}

export default function Home({
  client,
  storageReady,
  notes,
  filtered,
  topics,
  names,
  demo,
  query,
  filter,
  sort,
  setQuery,
  setFilter,
  setSort,
  onOpenNote,
  onOpenLearning,
  onAddSource,
  onLoadExamples,
  topicMap,
}: HomeProps) {
  const summary = librarySummary(notes, topics.length);
  return (
    <div className="home">
      <header className="home-header">
        <div>
          <h1>Home</h1>
          <p className="home-header__lead">
            A calm place for what you save and what you learn from it.
          </p>
        </div>
        <Button
          variant="primary"
          leadingIcon={<Plus size={16} />}
          onClick={onAddSource}
        >
          Add source
        </Button>
      </header>
      <ContinueLearning
        client={client}
        storageReady={storageReady}
        notes={notes}
        demo={demo}
        onOpenLearning={onOpenLearning}
        onOpenNote={onOpenNote}
        onAddSource={onAddSource}
        onLoadExamples={onLoadExamples}
      />
      {notes.length > 0 && <p className="home-summary">{summary.text}</p>}
      {notes.length > 0 && (
        <section className="home-section" aria-label="Your sources">
          <SourceLibrary
            filtered={filtered}
            notes={notes}
            names={names}
            demo={demo}
            query={query}
            filter={filter}
            sort={sort}
            setQuery={setQuery}
            setFilter={setFilter}
            setSort={setSort}
            onOpenNote={onOpenNote}
          />
        </section>
      )}
      {notes.length > 0 && (
        <Card as="section" aria-labelledby="home-topics-title" padding="lg">
          <h2 id="home-topics-title" className="home-section__title">
            Topics
          </h2>
          {topicMap}
          <div className="home-card-actions">
            <ButtonLink href="#topics" variant="ghost">
              Explore topic graph
            </ButtonLink>
          </div>
        </Card>
      )}
      {client && storageReady && (
        <div className="home-links">
          <ButtonLink href="#collection" variant="ghost" size="sm">
            All learning collections
          </ButtonLink>
          <LearningHistory
            client={client}
            onOpen={(sourceId) => onOpenLearning(sourceId)}
          />
        </div>
      )}
    </div>
  );
}
