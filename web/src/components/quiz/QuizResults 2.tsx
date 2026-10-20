import { useEffect, useRef } from "react";
import { Check, RotateCcw } from "lucide-react";
import { Badge, Button, Callout } from "../ui";
import { QUIZ_COPY, fill } from "../../lib/quiz-copy";
import {
  feedbackAllowance,
  formatLimitMessage,
  inPositionOrder,
  outcomeCountsText,
  outcomeLabelText,
  pendingShortAnswers,
  scoreText,
} from "../../lib/quiz-logic";
import { QuizApiError } from "../../lib/quiz-logic";
import type { QuizAttemptResult, QuizState } from "../../lib/quiz";
import { GenerateNew } from "./QuizEntry";
import { QuizQuestionReview } from "./QuizQuestionReview";

/**
 * Results: "X of Y", a label per outcome (text plus icon), and at most one focus
 * callout, "Review these first". Questions are always in stored position order.
 */
export function QuizResults({
  result,
  server,
  justSubmitted,
  feedbackBusy,
  feedbackErrors,
  requesting,
  references,
  onCitation,
  onReviewLesson,
  onGetFeedback,
  onRetake,
  onGenerate,
  onClose,
  onBackToLesson,
}: {
  result: QuizAttemptResult;
  server: QuizState | null;
  justSubmitted: boolean;
  feedbackBusy: string[];
  feedbackErrors: Record<string, QuizApiError>;
  requesting: boolean;
  references?: { id: string }[];
  onCitation: (id: string) => void;
  onReviewLesson: (lessonIndex: number) => void;
  onGetFeedback: (questionId: string) => void;
  onRetake: () => void;
  onGenerate: () => void;
  onClose: () => void;
  onBackToLesson?: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [result.attempt_id]);

  const now = new Date();
  const allowance = feedbackAllowance(result);
  const spent = !!allowance && allowance.remaining <= 0;
  const pending = pendingShortAnswers(result);
  const firstPending = pending[0];
  const grading = result.grading_usage;
  const limitNote = grading
    ? formatLimitMessage(
        new QuizApiError({
          status: 429,
          code: "quiz_grading_limit_reached",
          limit: grading.limit,
          resetsAt: grading.resets_at,
        }),
        { now },
      )
    : null;
  const canRetake = !!server?.can_take && result.quiz_is_current;
  const canGenerate = !!server?.can_generate && server.quiz !== null;
  const stillLoading = result.short_answers.pending > 0;
  const reviewFirst = result.review_first.flatMap((index) =>
    result.outcomes.filter((outcome) => outcome.index === index),
  );

  return (
    <div className="quiz-results">
      <h5 className="quiz-results__title" tabIndex={-1} ref={heading}>
        {QUIZ_COPY.results.title}
      </h5>
      <p className="quiz-score">
        <span className="quiz-score__value">{scoreText(result.score)}</span>{" "}
        <span className="quiz-score__caption">
          {QUIZ_COPY.results.scoreCaption}
        </span>
      </p>
      <p className="quiz-micro">{QUIZ_COPY.results.framing}</p>

      {result.outcomes.length ? (
        <section aria-label={QUIZ_COPY.outcome.title}>
          <h6 className="quiz-subtitle">{QUIZ_COPY.outcome.title}</h6>
          <ul className="quiz-outcomes">
            {result.outcomes.map((outcome) => (
              <li className="quiz-outcome" key={outcome.index}>
                <div className="quiz-outcome__head">
                  <span className="quiz-outcome__title">{outcome.title}</span>
                  <Badge
                    tone={
                      outcome.label === "looks_solid" ? "success" : "warning"
                    }
                    icon={
                      outcome.label === "looks_solid" ? (
                        <Check size={14} />
                      ) : (
                        <RotateCcw size={14} />
                      )
                    }
                  >
                    {outcomeLabelText(outcome.label)}
                  </Badge>
                </div>
                {outcomeCountsText(outcome).map((line) => (
                  <p className="quiz-outcome__line" key={line}>
                    {line}
                  </p>
                ))}
              </li>
            ))}
          </ul>
          {stillLoading ? (
            <p role="status" className="quiz-note">
              {QUIZ_COPY.outcome.pending}
            </p>
          ) : null}
        </section>
      ) : null}

      {reviewFirst.length ? (
        <Callout variant="focus" title={QUIZ_COPY.review.first.title}>
          <p>{QUIZ_COPY.review.first.body}</p>
          <ul className="quiz-review-first">
            {reviewFirst.map((outcome) => (
              <li key={outcome.index}>
                <span>{outcome.title}</span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onReviewLesson(outcome.index)}
                >
                  {QUIZ_COPY.review.first.action}
                </Button>
              </li>
            ))}
          </ul>
        </Callout>
      ) : result.outcomes.length &&
        result.outcomes.every((outcome) => outcome.label === "looks_solid") ? (
        <p className="quiz-note">{QUIZ_COPY.review.first.none}</p>
      ) : null}

      <ol className="quiz-review-questions">
        {inPositionOrder(result.questions).map((question, index) => {
          const id = question.question_id;
          const waiting =
            question.kind === "short_answer" &&
            question.grading_state === "pending";
          // Right after submitting, the automatic request is about to start.
          const busy =
            feedbackBusy.includes(id) ||
            (waiting && justSubmitted && !spent && !feedbackErrors[id]);
          let note: string | null = null;
          if (waiting) {
            if (spent) note = limitNote;
            else if (id === firstPending && allowance)
              note = fill(QUIZ_COPY.short.autoNote, allowance);
          }
          return (
            <QuizQuestionReview
              key={id}
              question={question}
              number={index + 1}
              busy={busy}
              error={feedbackErrors[id] ?? null}
              note={note}
              resetsAt={grading?.resets_at ?? null}
              references={references}
              onCitation={onCitation}
              onGetFeedback={() => onGetFeedback(id)}
            />
          );
        })}
      </ol>

      <div className="quiz-actions">
        {canRetake ? (
          <Button variant="primary" onClick={onRetake}>
            {QUIZ_COPY.retake}
          </Button>
        ) : null}
        {canGenerate && server ? (
          <GenerateNew
            server={server}
            requesting={requesting}
            onConfirm={onGenerate}
          />
        ) : null}
        <Button variant="ghost" onClick={onClose}>
          {QUIZ_COPY.results.close}
        </Button>
        {onBackToLesson ? (
          <Button variant="ghost" onClick={onBackToLesson}>
            {QUIZ_COPY.back}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
