/** Static placeholder blocks (no shimmer, so reduced motion needs no special case). */
export function QuizSkeleton({ label }: { label: string }) {
  return (
    <div className="quiz-skeleton-wrap" aria-busy="true">
      <div className="quiz-skeleton quiz-skeleton--title" aria-hidden="true" />
      <div className="quiz-skeleton" aria-hidden="true" />
      <div className="quiz-skeleton quiz-skeleton--short" aria-hidden="true" />
      <p role="status" className="quiz-note">
        {label}
      </p>
    </div>
  );
}
