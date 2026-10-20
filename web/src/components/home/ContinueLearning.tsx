import { ArrowRight, BookOpen, Plus } from "lucide-react";
import { useLearningSummary } from "../../lib/use-learning-summary";
import { pickStartHere, plural } from "../../lib/home";
import type { SourceClient } from "../../lib/source-client";
import type { Note } from "../../types";
import { Badge, Button, Callout, EmptyState } from "../ui";

export interface ContinueLearningProps {
  client: SourceClient | null;
  storageReady: boolean;
  notes: Note[];
  demo: boolean;
  onOpenLearning: (sourceId: string) => void;
  onOpenNote: (note: Note) => void;
  onAddSource: () => void;
  onLoadExamples: () => void;
}

/**
 * The one emphasised block on Home. It resumes the saved learning place when
 * one exists and otherwise points at a source to start from. It shows counts
 * of saved activity only: no percentages, totals or next-step claims.
 */
export function ContinueLearning({
  client,
  storageReady,
  notes,
  demo,
  onOpenLearning,
  onOpenNote,
  onAddSource,
  onLoadExamples,
}: ContinueLearningProps) {
  const summaryClient = storageReady && !demo ? client : null;
  const { data, error, retry } = useLearningSummary(summaryClient);

  if (notes.length === 0) {
    return (
      <EmptyState
        icon={<BookOpen size={28} />}
        title="Give your curiosity a home."
        description="Add an article, selectable-text PDF or video transcript to create a note and discover its topics."
        actions={
          <>
            <Button
              id="home-add-source"
              variant="primary"
              trailingIcon={<Plus size={16} />}
              onClick={onAddSource}
            >
              Add your first source
            </Button>
            {!demo && (
              <Button variant="secondary" onClick={onLoadExamples}>
                Explore with example material
              </Button>
            )}
          </>
        }
      />
    );
  }

  if (summaryClient && !error && !data) {
    return <p role="status">Restoring your learning place…</p>;
  }

  const place = summaryClient && !error && data ? data.resume : null;
  if (data && place) {
    return (
      <Callout
        as="section"
        variant="focus"
        title="Continue learning"
        aria-label="Continue learning"
        className="home-focus"
      >
        <h2 className="home-focus__title">{place.plan_title}</h2>
        <p>{place.goal}</p>
        <p className="home-focus__lesson">
          Lesson {place.lesson_index + 1}: {place.lesson_title}
        </p>
        <p className="micro-copy">Started from {place.source_title}</p>
        {place.needs_review && (
          <p role="note">
            Supporting evidence needs review. Your learning history stays saved.
          </p>
        )}
        {!place.source_available && (
          <p>
            The original source was removed; your collection history stays
            accessible.
          </p>
        )}
        <div className="home-focus__actions">
          <Button
            variant="primary"
            trailingIcon={<ArrowRight size={16} />}
            onClick={() => onOpenLearning(place.source_id)}
          >
            Continue this lesson
          </Button>
        </div>
        <p className="micro-copy">
          {plural(data.studied_lessons, "lesson")} marked studied ·{" "}
          {plural(data.practice_attempts, "practice attempt")}. Studying and
          provisional feedback do not establish mastery.
        </p>
      </Callout>
    );
  }

  const start = pickStartHere(notes);
  return (
    <>
      {error && (
        <div role="alert" className="home-notice">
          <p>Saved learning activity is unavailable. {error}</p>
          <button className="text-button" onClick={retry}>
            Retry learning activity
          </button>
        </div>
      )}
      {start && (
        <Callout
          as="section"
          variant="focus"
          title="Start here"
          aria-label="Start here"
          className="home-focus"
        >
          {start.demo && <Badge tone="info">Example material</Badge>}
          <h2 className="home-focus__title">{start.title}</h2>
          <p>{start.subtitle}</p>
          <p className="micro-copy">
            {plural(start.concepts.length, "key concept")} ·{" "}
            {start.demo ? "Example study note" : `${start.kind} study note`}
          </p>
          {start.demo && (
            <p className="micro-copy">
              Curated example note. Evidence is paraphrased; examples are
              illustrative and are not saved to your private library.
            </p>
          )}
          <div className="home-focus__actions">
            <Button
              variant="primary"
              trailingIcon={<ArrowRight size={16} />}
              onClick={() => onOpenNote(start)}
            >
              Open source note
            </Button>
          </div>
        </Callout>
      )}
    </>
  );
}
