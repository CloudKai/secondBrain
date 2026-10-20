import assert from "node:assert/strict";
import test from "node:test";
import {
  THEME_OPTIONS,
  THEME_STORAGE_KEY,
  applyThemePreference,
  nextThemePreference,
  parseThemePreference,
  readThemePreference,
  writeThemePreference,
} from "./theme.ts";
import type { ThemePreference } from "./theme.ts";

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map<string, string>(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
}

const throwingStorage = {
  getItem: (): string | null => {
    throw new Error("blocked");
  },
  setItem: (): void => {
    throw new Error("blocked");
  },
  removeItem: (): void => {
    throw new Error("blocked");
  },
};

test("parseThemePreference accepts light and dark and falls back to system", () => {
  assert.equal(parseThemePreference("light"), "light");
  assert.equal(parseThemePreference("dark"), "dark");
  assert.equal(parseThemePreference("system"), "system");
  assert.equal(parseThemePreference("sepia"), "system");
  assert.equal(parseThemePreference(null), "system");
  assert.equal(parseThemePreference(undefined), "system");
  assert.equal(parseThemePreference(1), "system");
});

test("readThemePreference reads the stored value and survives blocked storage", () => {
  assert.equal(readThemePreference(null), "system");
  assert.equal(readThemePreference(fakeStorage()), "system");
  assert.equal(
    readThemePreference(fakeStorage({ [THEME_STORAGE_KEY]: "dark" })),
    "dark",
  );
  assert.equal(
    readThemePreference(fakeStorage({ [THEME_STORAGE_KEY]: "nonsense" })),
    "system",
  );
  assert.equal(readThemePreference(throwingStorage), "system");
});

test("writeThemePreference stores light and dark and removes the key for system", () => {
  const storage = fakeStorage();
  writeThemePreference(storage, "dark");
  assert.equal(storage.data.get(THEME_STORAGE_KEY), "dark");
  writeThemePreference(storage, "light");
  assert.equal(storage.data.get(THEME_STORAGE_KEY), "light");
  writeThemePreference(storage, "system");
  assert.equal(storage.data.has(THEME_STORAGE_KEY), false);
  assert.doesNotThrow(() => writeThemePreference(throwingStorage, "dark"));
  assert.doesNotThrow(() => writeThemePreference(null, "dark"));
});

test("applyThemePreference sets data-theme and removes it for system", () => {
  const root: { dataset: DOMStringMap } = { dataset: {} };
  applyThemePreference(root, "dark");
  assert.equal(root.dataset.theme, "dark");
  applyThemePreference(root, "light");
  assert.equal(root.dataset.theme, "light");
  applyThemePreference(root, "system");
  assert.equal("theme" in root.dataset, false);
});

test("nextThemePreference cycles system, light, dark, system", () => {
  const order: ThemePreference[] = [];
  let current: ThemePreference = "system";
  for (let step = 0; step < 4; step += 1) {
    current = nextThemePreference(current);
    order.push(current);
  }
  assert.deepEqual(order, ["light", "dark", "system", "light"]);
});

test("THEME_OPTIONS lists every preference with a label", () => {
  assert.deepEqual(
    THEME_OPTIONS.map((option) => option.value),
    ["system", "light", "dark"],
  );
  assert.ok(THEME_OPTIONS.every((option) => option.label.length > 0));
});
