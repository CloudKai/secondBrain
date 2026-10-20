import { useEffect, useRef, useState } from "react";
import { ListChecks } from "lucide-react";
import { Badge, Button, Callout, Card } from "../ui";
import { QUIZ_COPY, fill } from "../../lib/quiz-copy";
import { attemptRowText, generationUsage } from "../../lib/quiz-logic";
import type { PublicQuiz, QuizState } from "../../lib/quiz";

const summaryText = (quiz: PublicQuiz) =>
  fill(QUIZ_COPY.ready.summary, {
    count: quiz.question_count,
    outcomes: quiz.outcomes.length,
  });

/** The one focus callout before an attempt: "Start the quiz". */
export function QuizEntry({
  quiz,
  onStart,
}: {
  quiz: PublicQuiz;
  onStart: () => void;
}) {
  return (
    <div className="quiz-entry">
      <Callout
        variant="focus"
        icon={<ListChecks size={18} />}
        title={QUIZ_COPY.entry.title}
      >
        <p>{QUIZ_COPY.entry.body}</p>
        <p className="quiz-meta">{summaryText(quiz)}</p>
        <div className="quiz-actions">
          <Button variant="primary" onClick={onStart}>
            {QUIZ_COPY.entry.start}
          </Button>
        </div>
      </Callout>
      <p className="quiz-micro">{QUIZ_COPY.ai.note}</p>
    </div>
  );
}

/** Asks first, because a new set uses one of the day's generations. */
export function GenerateNew({
  server,
  requesting,
  onConfirm,
}: {
  server: QuizState;
  requesting: boolean;
  onConfirm: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const group = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (confirming) group.current?.focus();
  }, [confirming]);
  if (!confirming)
    return (
      <Button variant="secondary" onClick={() => setConfirming(true)}>
        {QUIZ_COPY.generateNew.action}
      </Button>
    );
  return (
    <div
      ref={group}
      tabIndex={-1}
      role="group"
      aria-label={QUIZ_COPY.generateNew.action}
      className="quiz-confirm"
    >
      <p>{fill(QUIZ_COPY.generateNew.confirm, generationUsage(server))}</p>
      <div className="quiz-actions">
        <Button
          variant="primary"
          loading={requesting}
          onClick={() => {
            setConfirming(false);
            onConfirm();
          }}
        >
          {QUIZ_COPY.generateNew.yes}
        </Button>
        <Button variant="ghost" onClick={() => setConfirming(false)}>
          {QUIZ_COPY.generateNew.no}
        </Button>
      </div>
    </div>
  );
}

/** Earlier attempts: a date and "X of Y", never a trend or a comparison. */
export function QuizAttemptsList({
  attempts,
  onOpen,
}: {
  attempts: QuizState["attempts"];
  onOpen: (attemptId: string) => void;
}) {
  if (!attempts.length) return null;
  return (
    <section className="quiz-attempts" aria-label={QUIZ_COPY.attempts.title}>
      <h6 className="quiz-subtitle">{QUIZ_COPY.attempts.title}</h6>
      <ul className="quiz-attempts__list">
        {attempts.map((attempt) => (
          <li key={attempt.attempt_id} className="quiz-attempts__row">
            <span className="quiz-attempts__text">
              {attemptRowText(attempt)}
              {attempt.quiz_is_current ? null : (
                <Badge className="quiz-attempts__badge">
                  {QUIZ_COPY.attempts.earlier}
                </Badge>
              )}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpen(attempt.attempt_id)}
            >
              {QUIZ_COPY.attempts.open}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A quiz that exists, once it has been attempted or can't be started freshly. */
export function QuizSummaryCard({
  server,
  quiz,
  requesting,
  regenerating,
  onStart,
  onGenerate,
  onOpenAttempt,
}: {
  server: QuizState;
  quiz: PublicQuiz;
  requesting: boolean;
  regenerating: boolean;
  onStart: () => void;
  onGenerate: () => void;
  onOpenAttempt: (attemptId: string) => void;
}) {
  const attempted = server.attempts.some((a) => a.quiz_id === quiz.id);
  return (
    <Card tone="quiet" padding="lg" className="quiz-card">
      <h5 className="quiz-card__title">{QUIZ_COPY.entry.title}</h5>
      <p className="quiz-meta">{summaryText(quiz)}</p>
      {server.can_take ? (
        <>
          <div className="quiz-actions">
            <Button variant="primary" onClick={onStart}>
              {attempted ? QUIZ_COPY.retake : QUIZ_COPY.entry.start}
            </Button>
          </div>
          {attempted ? (
            <p className="quiz-micro">{QUIZ_COPY.retakeNote}</p>
          ) : null}
        </>
      ) : null}
      {server.can_generate && !regenerating ? (
        <div className="quiz-actions">
          <GenerateNew
            server={server}
            requesting={requesting}
            onConfirm={onGenerate}
          />
        </div>
      ) : null}
      <QuizAttemptsList attempts={server.attempts} onOpen={onOpenAttempt} />
      <p className="quiz-micro">{QUIZ_COPY.ai.note}</p>
    </Card>
  );
}
