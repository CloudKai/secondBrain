export type ThemePreference = "system" | "light" | "dark";

// The inline script in index.html reads this key before first paint; keep them in sync.
export const THEME_STORAGE_KEY = "secondbrain.theme";

export const THEME_OPTIONS: ReadonlyArray<{
  value: ThemePreference;
  label: string;
}> = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export function parseThemePreference(value: unknown): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}

export function readThemePreference(
  storage: Pick<Storage, "getItem"> | null,
): ThemePreference {
  if (!storage) return "system";
  try {
    return parseThemePreference(storage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

export function writeThemePreference(
  storage: Pick<Storage, "setItem" | "removeItem"> | null,
  preference: ThemePreference,
): void {
  if (!storage) return;
  try {
    if (preference === "system") storage.removeItem(THEME_STORAGE_KEY);
    else storage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Storage can be blocked or full; the choice then applies to this visit only.
  }
}

export function applyThemePreference(
  root: { dataset: DOMStringMap },
  preference: ThemePreference,
): void {
  if (preference === "system") delete root.dataset.theme;
  else root.dataset.theme = preference;
}

export function nextThemePreference(
  preference: ThemePreference,
): ThemePreference {
  if (preference === "system") return "light";
  if (preference === "light") return "dark";
  return "system";
}
