import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { SourceClient } from "./source-client";
import { QUIZ_COPY, fill } from "./quiz-copy";
import {
  POLL_INTERVAL_MS,
  POLL_MAX,
  QuizApiError,
  attemptsForCurrentQuiz,
  buildSubmitBody,
  feedbackKey,
  feedbackRequests,
  initialQuizState,
  parseProgress,
  progressKey,
  quizReducer,
  quizView,
  serializeProgress,
  shouldPoll,
  toQuizApiError,
} from "./quiz-logic";
import type { QuizAnswers, QuizEvent } from "./quiz-logic";

function browserStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Loads and drives one plan's quiz. `GET` runs first on mount and polls while a
 * generation is running. `POST ""` is never aborted: the server finishes the
 * generation even if this page goes away, and a reload simply finds the result.
 */
export function useQuiz(
  client: SourceClient,
  collectionId: string,
  planId: string,
) {
  const [state, dispatch] = useReducer(quizReducer, initialQuizState);
  const [announcement, setAnnouncement] = useState("");
  const [notice, setNotice] = useState<QuizApiError | null>(null);
  const [feedbackBusy, setFeedbackBusy] = useState<string[]>([]);
  const [feedbackErrors, setFeedbackErrors] = useState<
    Record<string, QuizApiError>
  >({});
  const live = useRef(true);
  const latest = useRef(state);
  const intent = useRef<{ id: string; regenerate: boolean } | null>(null);
  const requested = useRef<Set<string>>(new Set());
  const autoRunning = useRef(false);
  const knownQuiz = useRef<string | null>(null);

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  useEffect(() => {
    latest.current = state;
  });

  const send = useCallback((event: QuizEvent) => {
    if (live.current) dispatch(event);
  }, []);

  const load = useCallback(async () => {
    send({ type: "load_started" });
    try {
      send({
        type: "loaded",
        server: await client.quizState(collectionId, planId),
      });
    } catch (reason) {
      send({ type: "load_failed", error: toQuizApiError(reason) });
    }
  }, [client, collectionId, planId, send]);

  useEffect(() => {
    void load();
  }, [load]);

  // Restore an interrupted attempt, and forget progress for a quiz that was replaced.
  const quizId = state.server?.quiz?.id ?? null;
  const canTake = state.server?.can_take ?? false;
  useEffect(() => {
    const previous = knownQuiz.current;
    if (previous === quizId) return;
    knownQuiz.current = quizId;
    const storage = browserStorage();
    try {
      if (previous) storage?.removeItem(progressKey(previous));
    } catch {
      /* Storage may be blocked; the quiz still works in memory. */
    }
    if (!quizId || !canTake || latest.current.phase !== "idle") return;
    let raw: string | null = null;
    try {
      raw = storage?.getItem(progressKey(quizId)) ?? null;
    } catch {
      raw = null;
    }
    const progress = parseProgress(raw, quizId, Date.now());
    if (progress)
      dispatch({
        type: "progress_restored",
        attemptKey: progress.attemptKey,
        answers: progress.answers,
        step: progress.step,
        firstAttempt: attemptsForCurrentQuiz(latest.current.server) === 0,
      });
  }, [quizId, canTake]);

  // Save the learner's selections (never keys or results), debounced.
  const saving = [
    "taking",
    "reviewing",
    "submit_error",
    "evidence_changed_on_submit",
  ].includes(state.phase);
  useEffect(() => {
    if (!saving || !quizId || !state.attemptKey) return;
    const attemptKey = state.attemptKey;
    const timer = window.setTimeout(() => {
      try {
        browserStorage()?.setItem(
          progressKey(quizId),
          serializeProgress({
            quizId,
            attemptKey,
            answers: state.answers,
            step: state.step,
            savedAt: Date.now(),
          }),
        );
      } catch {
        /* Storage may be blocked or full. */
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [saving, quizId, state.attemptKey, state.answers, state.step]);

  // Poll while a generation runs (initial or regenerating).
  const polling = shouldPoll(state.server);
  useEffect(() => {
    if (!polling) return;
    let stopped = false;
    let count = 0;
    let timer = 0;
    const tick = async () => {
      count += 1;
      try {
        const server = await client.quizState(collectionId, planId);
        if (stopped) return;
        send({ type: "loaded", server });
        if (!shouldPoll(server)) {
          setAnnouncement(QUIZ_COPY.generating.ready);
          return;
        }
      } catch (reason) {
        if (!stopped)
          send({ type: "load_failed", error: toQuizApiError(reason) });
        return;
      }
      if (count >= POLL_MAX) {
        send({
          type: "load_failed",
          error: new QuizApiError({
            status: 409,
            code: "quiz_generation_in_progress",
          }),
        });
        return;
      }
      timer = window.setTimeout(() => void tick(), POLL_INTERVAL_MS);
    };
    timer = window.setTimeout(() => void tick(), POLL_INTERVAL_MS);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [polling, client, collectionId, planId, send]);

  const generate = useCallback(
    async (regenerate: boolean) => {
      if (latest.current.requesting) return;
      if (!intent.current || intent.current.regenerate !== regenerate)
        intent.current = { id: crypto.randomUUID(), regenerate };
      const { id } = intent.current;
      send({ type: "generate_started" });
      try {
        const server = await client.generateQuiz(collectionId, planId, {
          request_id: id,
          regenerate,
        });
        intent.current = null;
        send({ type: "generate_finished", server });
        if (live.current) setAnnouncement(QUIZ_COPY.generating.ready);
      } catch (reason) {
        const error = toQuizApiError(reason);
        if (error.code === "quiz_request_exhausted") intent.current = null;
        send({ type: "generate_failed", error });
        // Another request (this tab earlier, or another tab) is already generating.
        if (error.code === "quiz_generation_in_progress") void load();
      }
    },
    [client, collectionId, planId, send, load],
  );

  const start = useCallback(() => {
    const server = latest.current.server;
    if (!server?.quiz) return;
    send({
      type: "attempt_started",
      attemptKey: crypto.randomUUID(),
      firstAttempt: attemptsForCurrentQuiz(server) === 0,
    });
  }, [send]);

  const submit = useCallback(async () => {
    const current = latest.current;
    const quiz = current.server?.quiz;
    if (!quiz || !current.attemptKey || current.phase === "submitting") return;
    send({ type: "submit_started" });
    try {
      const result = await client.submitQuizAttempt(
        collectionId,
        planId,
        buildSubmitBody(
          current.attemptKey,
          quiz.id,
          quiz.questions,
          current.answers,
        ),
      );
      try {
        browserStorage()?.removeItem(progressKey(quiz.id));
      } catch {
        /* Storage may be blocked. */
      }
      send({ type: "submit_succeeded", result });
      if (live.current)
        setAnnouncement(fill(QUIZ_COPY.results.announce, result.score));
      // The attempts list changes; refresh it quietly.
      client
        .quizState(collectionId, planId)
        .then((server) => send({ type: "loaded", server }))
        .catch(() => undefined);
    } catch (reason) {
      send({ type: "submit_failed", error: toQuizApiError(reason) });
    }
  }, [client, collectionId, planId, send]);

  const requestFeedback = useCallback(
    async (attemptId: string, questionId: string, manual: boolean) => {
      const key = feedbackKey(attemptId, questionId);
      if (!manual && requested.current.has(key)) return;
      requested.current.add(key);
      if (live.current) {
        setFeedbackBusy((ids) => [...ids, questionId]);
        setFeedbackErrors((errors) => {
          const next = { ...errors };
          delete next[questionId];
          return next;
        });
      }
      try {
        send({
          type: "result_updated",
          result: await client.quizShortAnswerFeedback(
            collectionId,
            planId,
            attemptId,
            questionId,
          ),
        });
      } catch (reason) {
        if (live.current)
          setFeedbackErrors((errors) => ({
            ...errors,
            [questionId]: toQuizApiError(reason),
          }));
        // The server records limit and provider outcomes on the answer; show what it stored.
        try {
          send({
            type: "result_updated",
            result: await client.quizAttempt(collectionId, planId, attemptId),
          });
        } catch {
          /* Keep what is on screen. */
        }
      } finally {
        if (live.current)
          setFeedbackBusy((ids) => ids.filter((id) => id !== questionId));
      }
    },
    [client, collectionId, planId, send],
  );

  // Automatic feedback: only the attempt just submitted, one request at a time.
  useEffect(() => {
    if (state.phase !== "results" || !state.result || !state.justSubmitted)
      return;
    if (autoRunning.current) return;
    const attemptId = state.result.attempt_id;
    const ids = feedbackRequests(state.result, true, requested.current);
    if (!ids.length) return;
    autoRunning.current = true;
    void (async () => {
      try {
        for (const id of ids) {
          const current = latest.current;
          if (!live.current || current.result?.attempt_id !== attemptId) break;
          if (
            !feedbackRequests(
              current.result,
              current.justSubmitted,
              requested.current,
            ).includes(id)
          )
            continue;
          await requestFeedback(attemptId, id, false);
        }
        if (live.current) setAnnouncement(QUIZ_COPY.short.ready);
      } finally {
        autoRunning.current = false;
      }
    })();
  }, [state.phase, state.result, state.justSubmitted, requestFeedback]);

  const openAttempt = useCallback(
    async (attemptId: string) => {
      setNotice(null);
      try {
        send({
          type: "result_opened",
          result: await client.quizAttempt(collectionId, planId, attemptId),
        });
      } catch (reason) {
        if (live.current) setNotice(toQuizApiError(reason));
      }
    },
    [client, collectionId, planId, send],
  );

  const close = useCallback(() => {
    setNotice(null);
    send({ type: "closed" });
    void load();
  }, [send, load]);

  return {
    state,
    view: quizView(state),
    announcement,
    notice,
    feedbackBusy,
    feedbackErrors,
    reload: load,
    generate,
    start,
    submit,
    openAttempt,
    close,
    setAnswers: (answers: QuizAnswers) =>
      send({ type: "answers_changed", answers }),
    next: () => send({ type: "step_next" }),
    back: () => send({ type: "step_back" }),
    goTo: (step: number) => send({ type: "step_to", step }),
    dismissError: () => send({ type: "error_dismissed" }),
    getFeedback: (attemptId: string, questionId: string) =>
      void requestFeedback(attemptId, questionId, true),
  };
}

export type QuizController = ReturnType<typeof useQuiz>;
