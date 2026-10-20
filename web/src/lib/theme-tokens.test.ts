import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

/**
 * The dark palette is declared twice in tokens.css: once for the system
 * preference (no explicit choice) and once for an explicit data-theme="dark".
 * This test fails if the two copies drift apart.
 */

function declarationsAfter(css: string, marker: string): string[] {
  const start = css.indexOf(marker);
  assert.ok(start >= 0, `missing block: ${marker}`);
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  assert.ok(open >= 0 && close > open, `unterminated block: ${marker}`);
  return css
    .slice(open + 1, close)
    .split(";")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

test("system-dark and explicit-dark palettes declare the same values", async () => {
  const css = await readFile(
    new URL("../styles/tokens.css", import.meta.url),
    "utf8",
  );
  const system = declarationsAfter(css, ":root:not([data-theme])");
  const explicit = declarationsAfter(css, ':root[data-theme="dark"]');
  assert.ok(system.length > 20, "system dark block looks too small");
  assert.deepEqual(system, explicit);
});
