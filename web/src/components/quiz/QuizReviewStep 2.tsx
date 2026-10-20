import type { Ref } from "react";
import { Button } from "../ui";
import { QUIZ_COPY, fill } from "../../lib/quiz-copy";
import { answerStatus, answeredCount } from "../../lib/quiz-logic";
import type { QuizAnswers, QuizStep } from "../../lib/quiz-logic";
import type { QuizApiError } from "../../lib/quiz-logic";
import { QuizErrorNotice } from "./QuizNotices";

function chosenText(step: QuizStep, answers: QuizAnswers): string {
  const entry = answers[step.question.id];
  if (!entry) return "";
  if (step.question.kind === "short_answer") return entry.text;
  return step.options
    .filter((option) => entry.optionIds.includes(option.id))
    .map((option) => option.text)
    .join("; ");
}

/**
 * The last step. Submitting is never blocked by unanswered questions. When the
 * material changed mid-attempt (`readOnly`) it is only a record of what was chosen.
 */
export function QuizReviewStep({
  steps,
  answers,
  submitting,
  error,
  readOnly = false,
  headingRef,
  onGo,
  onSubmit,
}: {
  steps: QuizStep[];
  answers: QuizAnswers;
  submitting: boolean;
  error: QuizApiError | null;
  readOnly?: boolean;
  headingRef: Ref<HTMLHeadingElement>;
  onGo: (index: number) => void;
  onSubmit: () => void;
}) {
  const questions = steps.map((step) => step.question);
  const answered = answeredCount(questions, answers);
  const missing = steps.length - answered;
  return (
    <div className="quiz-review">
      <h5 className="quiz-question__position" tabIndex={-1} ref={headingRef}>
        {QUIZ_COPY.review.title}
      </h5>
      <p>
        {fill(QUIZ_COPY.review.summary, {
          answered,
          total: steps.length,
        })}
      </p>
      {missing > 0 && !readOnly ? (
        <p className="quiz-note">
          {fill(QUIZ_COPY.review.unanswered, { count: missing })}
        </p>
      ) : null}
      <ol className="quiz-review__list">
        {steps.map((step, index) => {
          const status = answerStatus(step.question, answers[step.question.id]);
          const shown = readOnly ? chosenText(step, answers) : "";
          return (
            <li className="quiz-review__row" key={step.question.id}>
              <div className="quiz-review__text">
                <span className="quiz-review__prompt">
                  {step.question.prompt}
                </span>
                <span className="quiz-review__status">
                  {status === "answered"
                    ? QUIZ_COPY.review.rowAnswered
                    : QUIZ_COPY.review.rowUnanswered}
                </span>
                {shown ? (
                  <span className="quiz-review__chosen">{shown}</span>
                ) : null}
              </div>
              {readOnly ? null : (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={submitting}
                  onClick={() => onGo(index)}
                >
                  {fill(QUIZ_COPY.review.go, { n: index + 1 })}
                </Button>
              )}
            </li>
          );
        })}
      </ol>
      {error && !readOnly ? <QuizErrorNotice error={error} /> : null}
      {readOnly ? null : (
        <div className="quiz-actions">
          <Button variant="primary" loading={submitting} onClick={onSubmit}>
            {error ? QUIZ_COPY.error.retry : QUIZ_COPY.review.submit}
          </Button>
        </div>
      )}
      {submitting ? (
        <p role="status" className="quiz-note">
          {QUIZ_COPY.submitting}
        </p>
      ) : null}
    </div>
  );
}
