import { ListChecks } from "lucide-react";
import { Button, Callout, Card } from "../ui";
import { QUIZ_COPY, fill } from "../../lib/quiz-copy";
import {
  formatLimitMessage,
  generateBlockedText,
  generationUsage,
  quizErrorText,
} from "../../lib/quiz-logic";
import type { QuizApiError } from "../../lib/quiz-logic";
import type { QuizState } from "../../lib/quiz";
import { QuizSkeleton } from "./QuizSkeleton";

export function QuizNotReady({
  reason,
}: {
  reason: NonNullable<QuizState["not_ready_reason"]>;
}) {
  return (
    <div className="ui-empty quiz-empty">
      <span className="ui-empty__icon" aria-hidden="true">
        <ListChecks size={22} />
      </span>
      <h5 className="ui-empty__title">{QUIZ_COPY.notReadyTitle}</h5>
      <div className="ui-empty__description">
        <p role="status">{QUIZ_COPY.notReady[reason]}</p>
      </div>
    </div>
  );
}

/** No quiz yet: the usage line and a plain Generate button. Never a focus callout. */
export function QuizNone({
  server,
  requesting,
  onGenerate,
  onOpenCurrentVersion,
}: {
  server: QuizState;
  requesting: boolean;
  onGenerate: () => void;
  onOpenCurrentVersion?: () => void;
}) {
  const blocked = generateBlockedText(server, { now: new Date() });
  return (
    <Card tone="quiet" padding="lg" className="quiz-card">
      <h5 className="quiz-card__title">{QUIZ_COPY.none.title}</h5>
      {server.can_generate ? (
        <>
          <p>{fill(QUIZ_COPY.none.body, generationUsage(server))}</p>
          <div className="quiz-actions">
            <Button
              variant="secondary"
              loading={requesting}
              onClick={onGenerate}
            >
              {QUIZ_COPY.none.action}
            </Button>
          </div>
        </>
      ) : blocked ? (
        <p role="status" className="quiz-note">
          {blocked}
        </p>
      ) : null}
      {server.generate_blocked === "not_active" && onOpenCurrentVersion ? (
        <div className="quiz-actions">
          <Button variant="secondary" onClick={onOpenCurrentVersion}>
            {QUIZ_COPY.olderVersion.action}
          </Button>
        </div>
      ) : null}
      <p className="quiz-micro">{QUIZ_COPY.ai.note}</p>
    </Card>
  );
}

export function QuizGenerating() {
  return (
    <div className="quiz-generating">
      <h5 className="quiz-card__title">{QUIZ_COPY.generating.title}</h5>
      <p>{QUIZ_COPY.generating.body}</p>
      <QuizSkeleton label={QUIZ_COPY.generating.title} />
    </div>
  );
}

/** A regeneration is running; the current quiz stays usable. */
export function QuizRegenerating() {
  return (
    <p role="status" className="quiz-note">
      {QUIZ_COPY.generating.regenerating}
    </p>
  );
}

export function QuizLimitReached({
  server,
  error,
}: {
  server: QuizState;
  error: QuizApiError | null;
}) {
  const context = { now: new Date(), hasQuiz: !!server.quiz };
  const text =
    error && error.code !== "quiz_unknown"
      ? formatLimitMessage(error, context)
      : generateBlockedText(server, context);
  return (
    <Callout variant="info" role="status" className="quiz-notice">
      <p>{text}</p>
    </Callout>
  );
}

/** A calm, assertive message with an optional retry. Never shows server text. */
export function QuizErrorNotice({
  error,
  hasQuiz = false,
  onRetry,
}: {
  error: QuizApiError;
  hasQuiz?: boolean;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="quiz-alert">
      <p>{quizErrorText(error, { now: new Date(), hasQuiz })}</p>
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {QUIZ_COPY.error.retry}
        </Button>
      ) : null}
    </div>
  );
}

export function QuizOlderVersion({ onOpen }: { onOpen?: () => void }) {
  return (
    <Callout
      variant="caution"
      className="quiz-notice"
      title={QUIZ_COPY.olderVersion.title}
    >
      <p>{QUIZ_COPY.olderVersion.body}</p>
      {onOpen ? (
        <Button variant="secondary" size="sm" onClick={onOpen}>
          {QUIZ_COPY.olderVersion.action}
        </Button>
      ) : null}
    </Callout>
  );
}

export function QuizEvidenceChanged() {
  return (
    <Callout variant="caution" role="status" className="quiz-notice">
      <p>{QUIZ_COPY.evidenceChanged}</p>
    </Callout>
  );
}

export function QuizRedacted() {
  return (
    <Callout variant="info" role="status" className="quiz-notice">
      <p>{QUIZ_COPY.redacted}</p>
    </Callout>
  );
}

/** The material changed while answering: no reload advice, only the way forward. */
export function QuizEvidenceChangedOnSubmit({
  onOpen,
}: {
  onOpen?: () => void;
}) {
  return (
    <div role="alert" className="quiz-alert">
      <p>{QUIZ_COPY.evidenceChangedMidAttempt}</p>
      {onOpen ? (
        <Button variant="primary" size="sm" onClick={onOpen}>
          {QUIZ_COPY.olderVersion.action}
        </Button>
      ) : null}
    </div>
  );
}
