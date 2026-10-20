import { useEffect, useState } from "react";
import type { LearningSummary } from "./learning";
import type { SourceClient } from "./source-client";

export interface LearningSummaryState {
  data: LearningSummary | null;
  error: string;
  retry: () => void;
}

/**
 * Loads the saved learning summary and refreshes it when learning activity is
 * saved elsewhere. With no client (no private library) it does nothing.
 */
export function useLearningSummary(
  client: SourceClient | null,
): LearningSummaryState {
  const [data, setData] = useState<LearningSummary | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const refresh = () => setAttempt((value) => value + 1);
    window.addEventListener("learning-updated", refresh);
    return () => window.removeEventListener("learning-updated", refresh);
  }, []);
  useEffect(() => {
    if (!client) return;
    let current = true;
    client
      .learningSummary()
      .then((value) => {
        if (current) {
          setData(value);
          setError("");
        }
      })
      .catch((reason: unknown) => {
        if (current)
          setError(
            reason instanceof Error
              ? reason.message
              : "Learning activity could not be loaded.",
          );
      });
    return () => {
      current = false;
    };
  }, [client, attempt]);
  const retry = () => {
    setError("");
    setAttempt((value) => value + 1);
  };
  return { data, error, retry };
}
