import { Check, Info, Minus, RotateCcw, TriangleAlert, X } from "lucide-react";
import type { ReactNode } from "react";
import { Badge, Button } from "../ui";
import { StudyCitations } from "../StructuredStudy";
import { QUIZ_COPY, fill } from "../../lib/quiz-copy";
import {
  formatResetTime,
  partlyCorrectNote,
  questionResultText,
  quizErrorText,
} from "../../lib/quiz-logic";
import type { QuizApiError } from "../../lib/quiz-logic";
import type { GradedQuestion } from "../../lib/quiz";

type Choice = Extract<
  GradedQuestion,
  { kind: "single_choice" | "true_false" | "multi_select" }
>;
type Short = Extract<GradedQuestion, { kind: "short_answer" }>;

const RESULT_BADGE = {
  correct: { tone: "success", icon: <Check size={14} /> },
  partly_correct: { tone: "warning", icon: <TriangleAlert size={14} /> },
  incorrect: { tone: "warning", icon: <X size={14} /> },
  unanswered: { tone: "neutral", icon: <Minus size={14} /> },
} as const;

const ASSESSMENT = {
  addressed: {
    text: QUIZ_COPY.short.addressed,
    tone: "success",
    icon: <Check size={14} />,
  },
  try_again: {
    text: QUIZ_COPY.short.tryAgain,
    tone: "warning",
    icon: <RotateCcw size={14} />,
  },
  uncertain: {
    text: QUIZ_COPY.short.uncertain,
    tone: "info",
    icon: <Info size={14} />,
  },
} as const;

interface References {
  references?: { id: string }[];
  onCitation: (id: string) => void;
}

function Why({
  explanation,
  citationIds,
  references,
  onCitation,
}: References & { explanation: string; citationIds: string[] }) {
  return (
    <div className="quiz-why">
      <h6 className="quiz-subtitle">{QUIZ_COPY.q.why}</h6>
      <p>{explanation}</p>
      {citationIds.length ? (
        <p className="quiz-citations">
          <span className="quiz-citations__label">{QUIZ_COPY.q.sources}</span>
          <StudyCitations
            ids={citationIds}
            references={references}
            onCitation={onCitation}
          />
        </p>
      ) : null}
    </div>
  );
}

function ChoiceReview({
  question,
  number,
  ...rest
}: References & { question: Choice; number: number }) {
  const badge = RESULT_BADGE[question.result];
  const textOf = (ids: string[]) =>
    question.options
      .filter((option) => ids.includes(option.id))
      .map((option) => option.text);
  const selected = textOf(question.selected_option_ids);
  const note =
    question.kind === "multi_select" && question.result === "partly_correct"
      ? partlyCorrectNote(
          question.selected_option_ids,
          question.correct_option_ids,
        )
      : null;
  return (
    <>
      <div className="quiz-review-q__head">
        <h6 className="quiz-subtitle">
          {fill(QUIZ_COPY.q.title, { n: number })}
        </h6>
        <Badge tone={badge.tone} icon={badge.icon}>
          {questionResultText(question.result)}
        </Badge>
      </div>
      <p className="quiz-review-q__prompt">{question.prompt}</p>
      <dl className="quiz-answers">
        <dt>{QUIZ_COPY.q.yourAnswer}</dt>
        <dd>
          {selected.length ? (
            <ul>
              {selected.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
          ) : (
            QUIZ_COPY.q.none
          )}
        </dd>
        <dt>{QUIZ_COPY.q.correctAnswer}</dt>
        <dd>
          <ul>
            {textOf(question.correct_option_ids).map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        </dd>
      </dl>
      {note ? <p className="quiz-note">{note}</p> : null}
      <Why
        explanation={question.explanation}
        citationIds={question.citation_ids}
        {...rest}
      />
    </>
  );
}

function ShortReview({
  question,
  number,
  busy,
  error,
  note,
  resetsAt,
  onGetFeedback,
  ...rest
}: References & {
  question: Short;
  number: number;
  busy: boolean;
  error: QuizApiError | null;
  note: string | null;
  resetsAt: string | null;
  onGetFeedback: () => void;
}) {
  const blank = question.grading_state === "not_applicable";
  const hasFeedback = question.grading_state === "graded";
  let feedback: ReactNode = null;
  if (blank) {
    feedback = <p className="quiz-note">{QUIZ_COPY.short.unanswered}</p>;
  } else if (busy) {
    feedback = (
      <div className="quiz-feedback">
        {note ? <p className="quiz-micro">{note}</p> : null}
        <p role="status" className="quiz-note">
          {QUIZ_COPY.short.pending}
        </p>
      </div>
    );
  } else if (hasFeedback) {
    feedback = (
      <div className="quiz-feedback">
        <p className="quiz-feedback__label">
          <Badge tone="info" icon={<Info size={14} />}>
            {QUIZ_COPY.short.label}
          </Badge>
        </p>
        {question.feedback_summary ? <p>{question.feedback_summary}</p> : null}
        {question.next_hint ? (
          <p className="quiz-note">{question.next_hint}</p>
        ) : null}
        <p className="quiz-micro">{QUIZ_COPY.short.caveat}</p>
      </div>
    );
  } else if (question.grading_state === "unavailable") {
    const limited = question.unavailable_reason === "limit";
    feedback = (
      <div className="quiz-feedback">
        <p role="status" className="quiz-note">
          {limited
            ? fill(QUIZ_COPY.short.unavailableLimit, {
                time: formatResetTime(resetsAt, new Date()),
              })
            : QUIZ_COPY.short.unavailableProvider}
        </p>
        <Button variant="secondary" size="sm" onClick={onGetFeedback}>
          {QUIZ_COPY.short.retry}
        </Button>
      </div>
    );
  } else {
    feedback = (
      <div className="quiz-feedback">
        {note ? <p className="quiz-micro">{note}</p> : null}
        <Button variant="secondary" size="sm" onClick={onGetFeedback}>
          {QUIZ_COPY.short.get}
        </Button>
      </div>
    );
  }
  return (
    <>
      <div className="quiz-review-q__head">
        <h6 className="quiz-subtitle">
          {fill(QUIZ_COPY.q.title, { n: number })}
        </h6>
      </div>
      <p className="quiz-review-q__prompt">{question.prompt}</p>
      <dl className="quiz-answers">
        <dt>{QUIZ_COPY.short.yourAnswer}</dt>
        <dd className="quiz-answers__text">
          {blank ? QUIZ_COPY.q.none : question.answer_text}
        </dd>
      </dl>
      {feedback}
      {error ? (
        <p role="alert" className="quiz-note">
          {quizErrorText(error, { now: new Date(), hasQuiz: true })}
        </p>
      ) : null}
      <h6 className="quiz-subtitle">{QUIZ_COPY.short.covers}</h6>
      <ul className="quiz-criteria">
        {question.criteria.map((criterion) => {
          const assessment = criterion.assessment
            ? ASSESSMENT[criterion.assessment]
            : null;
          return (
            <li key={criterion.index}>
              <span>{criterion.text}</span>
              {assessment ? (
                <Badge tone={assessment.tone} icon={assessment.icon}>
                  {assessment.text}
                </Badge>
              ) : null}
              {criterion.observation ? (
                <span className="quiz-note">
                  {criterion.observation}
                  {criterion.citation_ids.length ? (
                    <StudyCitations
                      ids={criterion.citation_ids}
                      references={rest.references}
                      onCitation={rest.onCitation}
                    />
                  ) : null}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
      <h6 className="quiz-subtitle">{QUIZ_COPY.short.model}</h6>
      <p>{question.model_answer}</p>
      <Why
        explanation={question.explanation}
        citationIds={question.citation_ids}
        {...rest}
      />
    </>
  );
}

/** A redacted question has no text by type: only its place is shown. */
function RedactedReview({ number }: { number: number }) {
  return (
    <>
      <h6 className="quiz-subtitle">
        {fill(QUIZ_COPY.q.title, { n: number })}
      </h6>
      <p className="quiz-note">{QUIZ_COPY.redacted}</p>
    </>
  );
}

export function QuizQuestionReview({
  question,
  number,
  busy,
  error,
  note,
  resetsAt,
  references,
  onCitation,
  onGetFeedback,
}: References & {
  question: GradedQuestion;
  number: number;
  busy: boolean;
  error: QuizApiError | null;
  note: string | null;
  resetsAt: string | null;
  onGetFeedback: () => void;
}) {
  return (
    <li className="quiz-review-q">
      {question.kind === "redacted" ? (
        <RedactedReview number={number} />
      ) : question.kind === "short_answer" ? (
        <ShortReview
          question={question}
          number={number}
          busy={busy}
          error={error}
          note={note}
          resetsAt={resetsAt}
          references={references}
          onCitation={onCitation}
          onGetFeedback={onGetFeedback}
        />
      ) : (
        <ChoiceReview
          question={question}
          number={number}
          references={references}
          onCitation={onCitation}
        />
      )}
    </li>
  );
}
