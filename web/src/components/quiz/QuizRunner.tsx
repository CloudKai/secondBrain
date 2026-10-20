import { useEffect, useRef, useState } from "react";
import { Button, ProgressBar } from "../ui";
import { QUIZ_COPY, fill } from "../../lib/quiz-copy";
import {
  isReviewStep,
  selectSingle,
  setText,
  toggleMulti,
} from "../../lib/quiz-logic";
import type { QuizAnswers, QuizApiError, QuizStep } from "../../lib/quiz-logic";
import { QuizQuestion } from "./QuizQuestion";
import { QuizReviewStep } from "./QuizReviewStep";

/**
 * One question at a time with Back and Next, then a "Check your answers" step.
 * Focus moves to the new step's heading after every navigation.
 */
export function QuizRunner({
  steps,
  answers,
  step,
  submitting,
  error,
  onAnswers,
  onNext,
  onBack,
  onGo,
  onSubmit,
}: {
  steps: QuizStep[];
  answers: QuizAnswers;
  step: number;
  submitting: boolean;
  error: QuizApiError | null;
  onAnswers: (answers: QuizAnswers) => void;
  onNext: () => void;
  onBack: () => void;
  onGo: (index: number) => void;
  onSubmit: () => void;
}) {
  const total = steps.length;
  const reviewing = isReviewStep(step, total);
  const heading = useRef<HTMLHeadingElement>(null);
  const [clampedId, setClampedId] = useState<string | null>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [step]);
  const current = reviewing ? null : steps[step];
  return (
    <div className="quiz-runner" aria-busy={submitting}>
      <ProgressBar
        label={QUIZ_COPY.runner.progress}
        value={reviewing ? total : step + 1}
        max={total}
        valueText={
          reviewing
            ? QUIZ_COPY.runner.review
            : fill(QUIZ_COPY.runner.position, { n: step + 1, m: total })
        }
        size="sm"
      />
      {current ? (
        <QuizQuestion
          key={current.question.id}
          step={current}
          number={step + 1}
          total={total}
          answer={answers[current.question.id]}
          disabled={submitting}
          clamped={clampedId === current.question.id}
          headingRef={heading}
          onSelectSingle={(optionId) =>
            onAnswers(selectSingle(answers, current.question.id, optionId))
          }
          onToggle={(optionId) =>
            onAnswers(toggleMulti(answers, current.question.id, optionId))
          }
          onText={(text) => {
            if (current.question.kind !== "short_answer") return;
            const next = setText(
              answers,
              current.question.id,
              text,
              current.question.max_chars,
            );
            setClampedId(next.clamped ? current.question.id : null);
            onAnswers(next.answers);
          }}
        />
      ) : (
        <QuizReviewStep
          steps={steps}
          answers={answers}
          submitting={submitting}
          error={error}
          headingRef={heading}
          onGo={onGo}
          onSubmit={onSubmit}
        />
      )}
      <div className="quiz-nav">
        <Button
          variant="ghost"
          disabled={step === 0 || submitting}
          onClick={onBack}
        >
          {QUIZ_COPY.runner.back}
        </Button>
        {reviewing ? null : (
          <Button variant="primary" disabled={submitting} onClick={onNext}>
            {step === total - 1
              ? QUIZ_COPY.runner.review
              : QUIZ_COPY.runner.next}
          </Button>
        )}
      </div>
    </div>
  );
}
