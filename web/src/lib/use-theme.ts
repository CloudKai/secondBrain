import { useCallback, useEffect, useState } from "react";
import {
  THEME_STORAGE_KEY,
  applyThemePreference,
  readThemePreference,
  writeThemePreference,
} from "./theme";
import type { ThemePreference } from "./theme";

function safeLocalStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function useThemePreference(): [
  ThemePreference,
  (preference: ThemePreference) => void,
] {
  const [preference, setPreference] = useState<ThemePreference>(() =>
    readThemePreference(safeLocalStorage()),
  );

  useEffect(() => {
    applyThemePreference(document.documentElement, preference);
  }, [preference]);

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key === null || event.key === THEME_STORAGE_KEY) {
        setPreference(readThemePreference(safeLocalStorage()));
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const update = useCallback((next: ThemePreference) => {
    writeThemePreference(safeLocalStorage(), next);
    setPreference(next);
  }, []);

  return [preference, update];
}
