import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  COPY_PLACEHOLDERS,
  QUIZ_COPY,
  assertCopyIsCalm,
  fill,
} from "./quiz-copy.ts";
import { generationErrorText, scoreText } from "./quiz-logic.ts";
import { QuizApiError } from "./quiz-logic.ts";

const fixture: { code: string }[] = JSON.parse(
  readFileSync(
    new URL(
      "../../../backend/tests/fixtures/quiz_error_codes.json",
      import.meta.url,
    ),
    "utf8",
  ),
);

function strings(value: unknown, into: string[] = []): string[] {
  if (typeof value === "string") into.push(value);
  else if (value && typeof value === "object")
    for (const item of Object.values(value)) strings(item, into);
  return into;
}

test("QUIZ_COPY.errors has exactly one entry for every shared error code", () => {
  const codes = fixture.map((row) => row.code).sort();
  assert.equal(codes.length, 23);
  assert.deepEqual(Object.keys(QUIZ_COPY.errors).sort(), codes);
  for (const code of codes)
    assert.ok(
      QUIZ_COPY.errors[code as keyof typeof QUIZ_COPY.errors].length > 10,
    );
});

test("the copy is calm: no outcome or game vocabulary, no stray placeholders", () => {
  assertCopyIsCalm();
  assertCopyIsCalm(QUIZ_COPY.errors);
});

test("assertCopyIsCalm rejects outcome words, game words and typos", () => {
  for (const bad of [
    "You passed",
    "You mastered it",
    "This failed",
    "Show mastery",
    "Keep your streak",
    "Earn 10 points",
    "A perfect score",
    "Congratulations",
    "Level up",
    "Hello {nmae}",
  ])
    assert.throws(() => assertCopyIsCalm({ bad }), bad);
});

test("the exact phrase 'not proof of mastery' is the only allowed use of the word", () => {
  assertCopyIsCalm({ ok: "This is not proof of mastery." });
  assert.throws(() => assertCopyIsCalm({ bad: "Proof of mastery" }));
  const withMastery = strings(QUIZ_COPY).filter((text) =>
    /mastery/i.test(text),
  );
  assert.ok(withMastery.length >= 2);
  for (const text of withMastery) assert.match(text, /not proof of mastery/);
});

test("required strings exist verbatim", () => {
  const all = strings(QUIZ_COPY);
  for (const required of [
    "Start the quiz",
    "Review these first",
    "Retake",
    "Generate new questions",
    "Looks solid",
    "Worth reviewing",
    "Provisional AI feedback",
    "{n} short answer left blank",
    "Text was shortened to {max} characters",
  ])
    assert.ok(all.includes(required), required);
  assert.match(
    QUIZ_COPY.short.autoNote,
    /Provisional AI feedback uses your daily AI-feedback allowance: \{remaining\} of \{limit\} left today/,
  );
});

test("every placeholder used is documented", () => {
  for (const text of strings(QUIZ_COPY))
    for (const match of text.matchAll(/\{(\w+)\}/g))
      assert.ok(COPY_PLACEHOLDERS.includes(match[1]), `${match[1]} in ${text}`);
});

test("scores read 'X of Y'", () => {
  assert.equal(QUIZ_COPY.results.score, "{correct} of {total}");
  assert.equal(scoreText({ correct: 4, total: 6 }), "4 of 6");
  assert.equal(
    fill(QUIZ_COPY.results.announce, { correct: 4, total: 5 }),
    "Quiz submitted. You answered 4 of 5 questions correctly.",
  );
});

test("fill replaces known keys, keeps unknown ones and tidies spacing", () => {
  assert.equal(fill("{a} and {b}", { a: 1 }), "1 and {b}");
  assert.equal(fill("one {x} two", { x: "" }), "one two");
});

test("'it didn't use a generation' is never shown for a charged failure", () => {
  const make = (charged: boolean | null) =>
    new QuizApiError({
      status: 503,
      code: "quiz_generation_unavailable",
      reason: "provider_unavailable",
      charged,
    });
  assert.ok(generationErrorText(make(true)).includes(QUIZ_COPY.error.charged));
  assert.ok(!generationErrorText(make(true)).includes(QUIZ_COPY.error.free));
  assert.ok(!generationErrorText(make(null)).includes(QUIZ_COPY.error.free));
  assert.ok(generationErrorText(make(false)).includes(QUIZ_COPY.error.free));
  assert.ok(
    generationErrorText(
      new QuizApiError({
        status: 503,
        code: "quiz_generation_unavailable",
        reason: "truncated",
        charged: true,
      }),
    ).includes("longer than we allow"),
  );
});
