import { useId, useMemo } from "react";
import { QUIZ_COPY } from "../../lib/quiz-copy";
import { orderForAttempt } from "../../lib/quiz-logic";
import { useQuiz } from "../../lib/use-quiz";
import type { SourceClient } from "../../lib/source-client";
import type { LearningPlan } from "../../lib/learning";
import { QuizAttemptsList, QuizEntry, QuizSummaryCard } from "./QuizEntry";
import {
  QuizErrorNotice,
  QuizEvidenceChanged,
  QuizEvidenceChangedOnSubmit,
  QuizGenerating,
  QuizLimitReached,
  QuizNone,
  QuizNotReady,
  QuizOlderVersion,
  QuizRedacted,
  QuizRegenerating,
} from "./QuizNotices";
import { QuizResults } from "./QuizResults";
import { QuizReviewStep } from "./QuizReviewStep";
import { QuizRunner } from "./QuizRunner";
import { QuizSkeleton } from "./QuizSkeleton";

interface Props {
  client: SourceClient;
  collectionId: string;
  plan: LearningPlan;
  /** The active version of this path, when the selected plan is an earlier one. */
  currentPlan: LearningPlan | null;
  onCitation: (id: string) => void;
  onReviewLesson: (lessonIndex: number) => void;
  onOpenCurrentVersion: () => void;
  onBackToLesson: () => void;
}

/**
 * The Quiz tab. Mount it only while the tab is open and the library is connected;
 * it renders nothing it cannot back with server data.
 */
export function QuizPanel({
  client,
  collectionId,
  plan,
  currentPlan,
  onCitation,
  onReviewLesson,
  onOpenCurrentVersion,
  onBackToLesson,
}: Props) {
  const quiz = useQuiz(client, collectionId, plan.id);
  const headingId = useId();
  const { state, view } = quiz;
  const server = state.server;
  const published = server?.quiz ?? null;
  const steps = useMemo(
    () =>
      published && state.attemptKey
        ? orderForAttempt(published, state.attemptKey, state.firstAttempt)
        : [],
    [published, state.attemptKey, state.firstAttempt],
  );
  const references = plan.teaching ? plan.references : undefined;
  const openCurrent = currentPlan ? onOpenCurrentVersion : undefined;
  const generate = (regenerate: boolean) => () =>
    void quiz.generate(regenerate);
  const generationError =
    state.error && ["none", "ready_first", "ready_again"].includes(view)
      ? state.error
      : null;

  function body() {
    if (!server)
      return view === "load_error" && state.error ? (
        <QuizErrorNotice
          error={state.error}
          onRetry={() => void quiz.reload()}
        />
      ) : (
        <QuizSkeleton label={QUIZ_COPY.loading} />
      );
    switch (view) {
      case "loading":
        return <QuizSkeleton label={QUIZ_COPY.loading} />;
      case "load_error":
        return state.error ? (
          <QuizErrorNotice
            error={state.error}
            hasQuiz={!!published}
            onRetry={() => void quiz.reload()}
          />
        ) : null;
      case "not_ready":
        return server.not_ready_reason ? (
          <QuizNotReady reason={server.not_ready_reason} />
        ) : null;
      case "generating":
        return <QuizGenerating />;
      case "limit_reached":
        return <QuizLimitReached server={server} error={state.error} />;
      case "none":
        return (
          <QuizNone
            server={server}
            requesting={state.requesting}
            onGenerate={generate(false)}
            onOpenCurrentVersion={openCurrent}
          />
        );
      case "ready_first":
        return published ? (
          <>
            <QuizEntry quiz={published} onStart={quiz.start} />
            <QuizAttemptsList
              attempts={server.attempts}
              onOpen={(id) => void quiz.openAttempt(id)}
            />
          </>
        ) : null;
      case "ready_again":
      case "older_version":
      case "evidence_changed":
      case "redacted":
        return published ? (
          <>
            {view === "older_version" ? (
              <QuizOlderVersion onOpen={openCurrent} />
            ) : null}
            {view === "evidence_changed" ? <QuizEvidenceChanged /> : null}
            {view === "redacted" ? <QuizRedacted /> : null}
            <QuizSummaryCard
              server={server}
              quiz={published}
              requesting={state.requesting}
              regenerating={server.regenerating}
              onStart={quiz.start}
              onGenerate={generate(true)}
              onOpenAttempt={(id) => void quiz.openAttempt(id)}
            />
          </>
        ) : null;
      case "in_progress":
      case "review_answers":
      case "submitting":
      case "submit_error":
        return (
          <QuizRunner
            steps={steps}
            answers={state.answers}
            step={state.step}
            submitting={view === "submitting"}
            error={view === "submit_error" ? state.error : null}
            onAnswers={quiz.setAnswers}
            onNext={quiz.next}
            onBack={quiz.back}
            onGo={quiz.goTo}
            onSubmit={() => void quiz.submit()}
          />
        );
      case "evidence_changed_on_submit":
        return (
          <>
            <QuizEvidenceChangedOnSubmit onOpen={openCurrent} />
            <QuizReviewStep
              steps={steps}
              answers={state.answers}
              submitting={false}
              error={null}
              readOnly
              headingRef={null}
              onGo={quiz.goTo}
              onSubmit={() => undefined}
            />
          </>
        );
      case "results":
        return state.result ? (
          <QuizResults
            result={state.result}
            server={server}
            justSubmitted={state.justSubmitted}
            feedbackBusy={quiz.feedbackBusy}
            feedbackErrors={quiz.feedbackErrors}
            requesting={state.requesting}
            references={references}
            onCitation={onCitation}
            onReviewLesson={onReviewLesson}
            onGetFeedback={(questionId) =>
              state.result &&
              quiz.getFeedback(state.result.attempt_id, questionId)
            }
            onRetake={quiz.start}
            onGenerate={generate(true)}
            onClose={quiz.close}
            onBackToLesson={onBackToLesson}
          />
        ) : null;
    }
  }

  return (
    <section
      className="quiz-panel"
      aria-labelledby={headingId}
      aria-busy={["loading", "generating", "submitting"].includes(view)}
    >
      <h4 id={headingId} className="quiz-panel__title">
        {QUIZ_COPY.tab}
      </h4>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {quiz.announcement}
      </div>
      {view !== "results" &&
      (server?.regenerating || (state.requesting && published)) ? (
        <QuizRegenerating />
      ) : null}
      {quiz.notice ? <QuizErrorNotice error={quiz.notice} hasQuiz /> : null}
      {generationError ? (
        <QuizErrorNotice
          error={generationError}
          hasQuiz={!!published}
          onRetry={
            generationError.code === "quiz_generation_unavailable" ||
            generationError.code === "quiz_lease_lost"
              ? () => void quiz.generate(!!published)
              : undefined
          }
        />
      ) : null}
      {body()}
    </section>
  );
}
