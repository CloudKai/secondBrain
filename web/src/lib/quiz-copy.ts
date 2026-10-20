import type { QuizErrorCode } from "./quiz.ts";

/**
 * Every learner-visible quiz string (spec section 14). `{x}` marks interpolation;
 * fill() replaces it. Results are evidence of what a learner recalls now, so the
 * words below never claim an outcome: see assertCopyIsCalm().
 */
export const QUIZ_COPY = {
  tab: "Quiz",
  loading: "Loading quiz…",
  endOfPath: {
    title: "You've reached the last lesson in this path.",
    body: "A short quiz can show what you remember right now. It's optional and doesn't affect your progress.",
    action: "Open the quiz",
  },
  entry: {
    title: "Check your understanding",
    body: "A short quiz written from the passages this path cites. You'll see a score, a note on each outcome, and explanations with sources. It's evidence of what you recall now, not proof of mastery.",
    start: "Start the quiz",
  },
  none: {
    title: "Make a quiz for this path",
    body: "We'll write a short quiz from the passages this path cites. This uses one of your {limit} daily quiz generations ({remaining} left today).",
    action: "Generate quiz",
  },
  generating: {
    title: "Preparing your quiz",
    body: "Writing questions from the passages this path cites. This can take up to a minute. Your learning progress is safe.",
    regenerating: "Preparing new questions…",
    ready: "Your quiz is ready.",
  },
  ready: {
    summary: "{count} questions across {outcomes} outcomes",
  },
  attempts: {
    title: "Earlier attempts",
    row: "{date} — {correct} of {total}",
    open: "Open results",
  },
  retake: "Retake",
  retakeNote:
    "Retaking uses the same questions. Generate new questions for a fresh set.",
  generateNew: {
    action: "Generate new questions",
    confirm:
      "Make a new set of questions? This uses 1 of your {limit} daily quiz generations ({remaining} left today). Your current quiz and results stay available.",
    yes: "Use one generation",
    no: "Keep this quiz",
  },
  runner: {
    position: "Question {n} of {m}",
    progress: "Quiz progress",
    single: "Choose one answer.",
    trueFalse: "Choose True or False.",
    multi: "Select all that apply.",
    short: "Write a short answer in your own words.",
    counter: "{count} of {max} characters",
    back: "Back",
    next: "Next",
    review: "Check your answers",
  },
  short: {
    clamped: "Text was shortened to {max} characters",
    label: "Provisional AI feedback",
    caveat:
      "AI feedback can be wrong. Use it as a prompt to check the passage, not as a grade.",
    pending: "Preparing provisional AI feedback…",
    autoNote:
      "Provisional AI feedback uses your daily AI-feedback allowance: {remaining} of {limit} left today",
    ready: "Provisional AI feedback is ready for your short answers.",
    addressed: "Addressed",
    tryAgain: "Worth another look",
    uncertain: "Unclear",
    covers: "What a strong answer covers",
    model: "A strong answer might say",
    retry: "Try again",
    get: "Get provisional AI feedback",
    yourAnswer: "Your answer",
    unavailableProvider:
      "Provisional AI feedback isn't available right now. Your score isn't affected.",
    unavailableLimit:
      "AI feedback is paused until your daily limit resets ({time}). Your score isn't affected.",
    unanswered: "You didn't write an answer for this question.",
  },
  review: {
    title: "Check your answers",
    summary: "You've answered {answered} of {total} questions.",
    unanswered:
      "{count} questions have no answer. You can still submit; they'll be counted as not answered.",
    rowAnswered: "Answered",
    rowUnanswered: "No answer yet",
    go: "Go to question {n}",
    submit: "Submit answers",
    first: {
      title: "Review these first",
      body: "These outcomes are worth another look. This is a suggestion, not a requirement.",
      action: "Review this lesson",
      none: "Every outcome looks solid on this quiz. That's one short check, not proof of mastery.",
    },
  },
  submitting: "Submitting your answers…",
  results: {
    title: "Your results",
    close: "Close results",
    announce:
      "Quiz submitted. You answered {correct} of {total} questions correctly.",
    score: "{correct} of {total}",
    scoreCaption: "questions answered correctly",
    framing:
      "This is evidence from one short quiz, not proof of mastery. Short-answer feedback is shown separately and isn't part of this score.",
  },
  outcome: {
    title: "By outcome",
    looksSolid: "Looks solid",
    worthReviewing: "Worth reviewing",
    counts: "{correct} answered correctly · {toReview} to review",
    shortToReview: "{n} short answer to look at again (provisional)",
    shortBlank: "{n} short answer left blank",
    ai: "Includes provisional AI feedback",
    pending:
      "Short-answer feedback is still loading. It can add a note to review, so this label may change.",
  },
  covers: "This quiz covers lessons {list}.",
  q: {
    title: "Question {n}",
    correct: "Correct",
    partly: "Partly correct",
    incorrect: "Not quite",
    none: "No answer",
    yourAnswer: "Your answer",
    correctAnswer: "Correct answer",
    partlyNote: "You chose only correct options, but missed {k}.",
    why: "Why",
    sources: "Sources",
  },
  back: "Back to the lesson",
  olderVersion: {
    title: "This quiz is for an earlier version of this path.",
    body: "The lessons have since changed. You can still read and retake it.",
    action: "Open the current version",
  },
  noQuizOlder:
    "No quiz was made for this version. Open the current version to make one.",
  evidenceChanged:
    "The supporting material for this path changed, so this quiz is kept for reference only.",
  evidenceChangedMidAttempt:
    "The supporting material for this path changed while you were answering, so these answers can't be scored against the new version. Your answers are still shown here. Open the current version to take its quiz.",
  redacted:
    "The original source was removed. Your scores are kept; the question text was removed.",
  notReadyTitle: "A quiz isn't available yet",
  notReady: {
    plan_not_confirmed:
      "Open this path first. Quizzes are available for paths you've confirmed.",
    evidence_changed:
      "The supporting material for this path changed. Preview a new path version to get a quiz that matches it.",
    not_enough_cited_material:
      "This path doesn't cite enough source material to write a fair quiz yet. Add or confirm a path with more cited lessons, then come back.",
    disabled: "Quizzes are turned off for now.",
  },
  generateBlocked: {
    setup: "Quiz generation isn't set up on this server yet.",
    notActive: "Quizzes can only be made for the current version of a path.",
  },
  limit: {
    generation:
      "You've used all {limit} quiz generations for today. You can generate new questions again after {time}. {retakeNote}",
    retakeNote: "You can still retake this quiz as often as you like.",
    grading:
      "You've used all {limit} AI-feedback requests for today. Feedback is available again after {time}.",
    attempts:
      "This quiz has reached its limit of {n} attempts. Generate new questions to continue.",
    planCap: "This path has reached its limit of {n} saved quizzes.",
    attemptsCapped:
      "Too many quiz attempts didn't finish for this path today. You can try again after {time}.",
    resetsNote: "(resets at midnight UTC)",
  },
  error: {
    generic: "We couldn't do that just now. Try again in a moment.",
    generation:
      "We couldn't create the quiz this time. {chargeNote} Try again in a moment.",
    charged:
      "This attempt used one of today's generations because the request reached the AI service.",
    free: "It didn't use any of today's generations.",
    truncated:
      "The quiz came out longer than we allow, so we didn't save it. This attempt used one of today's generations. Try again later. If it keeps happening, the server's output limit may need to be raised.",
    refused:
      "The AI service declined to write this quiz. This attempt used one of today's generations. Try again later.",
    setup: "Quiz generation isn't set up on this server yet.",
    storage:
      "We couldn't reach your library. Your answers are kept in this tab. Try again.",
    session: "Your library session expired. Reconnect and try again.",
    inProgress:
      "A quiz is already being prepared for this path. We'll show it when it's ready.",
    gradingInProgress:
      "Your answers are still being checked. This will update in a moment.",
    leaseLost: "That request took too long and was released. Try again.",
    conflict: "This quiz changed. Reload and try again.",
    answers:
      "One of your answers couldn't be accepted. Reload the quiz and try again.",
    retry: "Try again",
  },
  ai: {
    note: "Questions are AI-generated from the passages this path cites. Inspect the sources to check them.",
  },
  /** One entry for every code in backend/tests/fixtures/quiz_error_codes.json. */
  errors: {
    quiz_generation_limit_reached:
      "You've used all {limit} quiz generations for today. You can generate new questions again after {time}. {retakeNote}",
    quiz_grading_limit_reached:
      "You've used all {limit} AI-feedback requests for today. Feedback is available again after {time}.",
    quiz_attempt_limit_reached:
      "This quiz has reached its limit of {n} attempts. Generate new questions to continue.",
    quiz_plan_cap_reached:
      "This path has reached its limit of {n} saved quizzes.",
    quiz_generation_attempts_capped:
      "Too many quiz attempts didn't finish for this path today. You can try again after {time}.",
    quiz_grading_exhausted:
      "Provisional AI feedback couldn't be made for this answer after 3 tries. Your score isn't affected.",
    quiz_not_ready: "This path isn't ready for a quiz yet.",
    quiz_request_invalid:
      "That request couldn't be sent. Reload the quiz and try again.",
    quiz_answer_invalid:
      "One of your answers couldn't be accepted. Reload the quiz and try again.",
    quiz_not_found: "This quiz is no longer available. Reload and try again.",
    quiz_plan_not_current:
      "Quizzes can only be made for the current version of a path.",
    quiz_evidence_changed:
      "The supporting material for this path changed, so this quiz is kept for reference only.",
    quiz_generation_in_progress:
      "A quiz is already being prepared for this path. We'll show it when it's ready.",
    quiz_attempt_in_progress:
      "Your answers are still being checked. This will update in a moment.",
    quiz_grading_busy:
      "Your answers are still being checked. This will update in a moment.",
    quiz_lease_lost: "That request took too long and was released. Try again.",
    quiz_request_changed: "This quiz changed. Reload and try again.",
    quiz_request_exhausted:
      "That request was tried too many times. Try again to start a new one.",
    quiz_attempt_conflict: "This quiz changed. Reload and try again.",
    quiz_generation_unavailable:
      "We couldn't create the quiz this time. {chargeNote} Try again in a moment.",
    quiz_disabled: "Quizzes are turned off for now.",
    quiz_storage_unavailable:
      "We couldn't reach your library. Your answers are kept in this tab. Try again.",
    quiz_session_expired:
      "Your library session expired. Reconnect and try again.",
  } satisfies Record<QuizErrorCode, string>,
};

/** The interpolation keys any string may use. Anything else is a typo. */
export const COPY_PLACEHOLDERS: readonly string[] = [
  "n",
  "m",
  "k",
  "limit",
  "remaining",
  "time",
  "date",
  "correct",
  "total",
  "count",
  "outcomes",
  "list",
  "max",
  "answered",
  "toReview",
  "retakeNote",
  "chargeNote",
];

export function fill(
  template: string,
  values: Record<string, string | number> = {},
): string {
  return template
    .replace(/\{(\w+)\}/g, (match, key: string) =>
      Object.prototype.hasOwnProperty.call(values, key)
        ? String(values[key])
        : match,
    )
    .replace(/\s{2,}/g, " ")
    .trim();
}

const BANNED_OUTCOME_WORDS =
  /\b(mastered|mastery|passed|failed|fail|fails|failure)\b/i;
const BANNED_GAME_WORDS =
  /\b(streaks?|xp|points?|perfect|congratulations|level[- ]up|badge unlocked)\b/i;
const FRAMING_PHRASE = /not proof of mastery/gi;

function collectStrings(value: unknown, into: string[] = []): string[] {
  if (typeof value === "string") into.push(value);
  else if (value && typeof value === "object")
    for (const item of Object.values(value)) collectStrings(item, into);
  return into;
}

/**
 * Throws if any string uses outcome or game vocabulary, or an undocumented
 * placeholder. The exact phrase "not proof of mastery" is allowed.
 */
export function assertCopyIsCalm(copy: unknown = QUIZ_COPY): void {
  const problems: string[] = [];
  for (const text of collectStrings(copy)) {
    const stripped = text.replace(FRAMING_PHRASE, "");
    if (BANNED_OUTCOME_WORDS.test(stripped))
      problems.push(`outcome vocabulary: ${text}`);
    if (BANNED_GAME_WORDS.test(stripped))
      problems.push(`game vocabulary: ${text}`);
    for (const match of text.matchAll(/\{(\w+)\}/g))
      if (!COPY_PLACEHOLDERS.includes(match[1]))
        problems.push(`undocumented placeholder {${match[1]}}: ${text}`);
  }
  if (problems.length) throw new Error(problems.join("\n"));
}
