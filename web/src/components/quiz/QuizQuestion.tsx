import { useId } from "react";
import type { Ref } from "react";
import { QUIZ_COPY, fill } from "../../lib/quiz-copy";
import type { AnswerEntry, QuizStep } from "../../lib/quiz-logic";

const HINTS = {
  single_choice: QUIZ_COPY.runner.single,
  true_false: QUIZ_COPY.runner.trueFalse,
  multi_select: QUIZ_COPY.runner.multi,
  short_answer: QUIZ_COPY.runner.short,
};

/**
 * One question. Choice questions are a fieldset with a legend (native radios or
 * checkboxes, so arrow keys and Space just work); a short answer is a labelled
 * textarea with no maxlength, because the cap counts code points, not UTF-16 units.
 */
export function QuizQuestion({
  step,
  number,
  total,
  answer,
  disabled,
  clamped,
  headingRef,
  onSelectSingle,
  onToggle,
  onText,
}: {
  step: QuizStep;
  number: number;
  total: number;
  answer: AnswerEntry | undefined;
  disabled: boolean;
  clamped: boolean;
  headingRef: Ref<HTMLHeadingElement>;
  onSelectSingle: (optionId: string) => void;
  onToggle: (optionId: string) => void;
  onText: (text: string) => void;
}) {
  const { question, options } = step;
  const base = useId();
  const hintId = `${base}-hint`;
  const counterId = `${base}-counter`;
  const heading = (
    <h5 className="quiz-question__position" tabIndex={-1} ref={headingRef}>
      {fill(QUIZ_COPY.runner.position, { n: number, m: total })}
    </h5>
  );
  if (question.kind === "short_answer") {
    const text = answer?.text ?? "";
    return (
      <div className="quiz-question">
        {heading}
        <label htmlFor={`${base}-text`} className="quiz-question__prompt">
          {question.prompt}
        </label>
        <p id={hintId} className="quiz-hint">
          {HINTS.short_answer}
        </p>
        <textarea
          id={`${base}-text`}
          className="quiz-textarea"
          rows={6}
          value={text}
          disabled={disabled}
          aria-describedby={`${hintId} ${counterId}`}
          onChange={(event) => onText(event.target.value)}
        />
        <p id={counterId} className="quiz-counter">
          {fill(QUIZ_COPY.runner.counter, {
            count: Array.from(text).length,
            max: question.max_chars,
          })}
        </p>
        {clamped ? (
          <p role="status" className="quiz-counter">
            {fill(QUIZ_COPY.short.clamped, { max: question.max_chars })}
          </p>
        ) : null}
      </div>
    );
  }
  const multiple = question.kind === "multi_select";
  const chosen = answer?.optionIds ?? [];
  return (
    <div className="quiz-question">
      {heading}
      <fieldset
        className="quiz-fieldset"
        disabled={disabled}
        aria-describedby={hintId}
      >
        <legend className="quiz-question__prompt">{question.prompt}</legend>
        <p id={hintId} className="quiz-hint">
          {HINTS[question.kind]}
        </p>
        {options.map((option) => (
          <label className="quiz-option" key={option.id}>
            <input
              type={multiple ? "checkbox" : "radio"}
              name={question.id}
              value={option.id}
              checked={chosen.includes(option.id)}
              onChange={() =>
                multiple ? onToggle(option.id) : onSelectSingle(option.id)
              }
            />
            <span>{option.text}</span>
          </label>
        ))}
      </fieldset>
    </div>
  );
}
