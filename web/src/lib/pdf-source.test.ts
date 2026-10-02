import test from "node:test";
import assert from "node:assert/strict";
import { sourceSchema } from "./source-client";
import { noteFromSavedSource } from "./api";
import { studySchema } from "./study-note";
import { createLibrary, updateLibrary } from "./library";

const first = "Algebra describes variables and relationships. ".repeat(4);
const third = "Calculus describes rates of change. ".repeat(4);
const source = {
  id: "33333333-3333-4333-8333-333333333333",
  source_kind: "pdf",
  original_url: null,
  canonical_url: `urn:pdf:sha256:${"a".repeat(64)}`,
  title: "Learning",
  captured_text: first + "\n\n" + third,
  captured_at: "2026-10-03T00:00:00Z",
  capture_origin: "upload",
  coverage: "partial",
  coverage_detail: "Page 2 has no selectable text.",
  study_status: "pending",
  document: {
    filename: "learning.pdf",
    page_count: 3,
    pages: [
      { page: 1, start: 0, end: first.length },
      { page: 2, start: first.length + 1, end: first.length + 1 },
      {
        page: 3,
        start: first.length + 2,
        end: first.length + 2 + third.length,
      },
    ],
  },
};

test("an uploaded PDF reopens as a PDF with page evidence and no invented original URL", () => {
  const note = noteFromSavedSource(sourceSchema.parse(source));
  assert.equal(note.kind, "PDF");
  assert.equal(note.author, "learning.pdf");
  assert.equal(note.url, "");
  assert.equal(note.savedSource?.document?.pages[2].page, 3);
  const second = noteFromSavedSource(
    sourceSchema.parse({
      ...source,
      id: "44444444-4444-4444-8444-444444444444",
      canonical_url: `urn:pdf:sha256:${"b".repeat(64)}`,
    }),
  );
  const library = updateLibrary(createLibrary([], {}), {
    type: "add-sources",
    notes: [note, second],
  });
  assert.equal(library.notes.length, 2);
  assert.equal(
    updateLibrary(library, { type: "add-sources", notes: [note] }).notes.length,
    2,
  );
});

test("PDF references validate page numbers against the immutable capture", () => {
  const claim = { text: "Calculus describes change.", citation_ids: ["p0002"] };
  const raw = {
    source_id: source.id,
    status: "succeeded",
    attempts: 1,
    max_attempts: 3,
    next_attempt_at: "2026-10-03T00:00:00Z",
    updated_at: "2026-10-03T00:00:00Z",
    error_code: null,
    note: {
      overview: claim,
      concepts: [{ ...claim, title: "Change" }],
      examples: [],
      equations: [],
      recall: [
        {
          question: "What changes?",
          answer: "Quantities.",
          citation_ids: ["p0002"],
        },
      ],
      references: [
        {
          id: "p0002",
          start: first.length + 2,
          end: first.length + 2 + third.length,
          excerpt: third,
          page: 3,
        },
      ],
    },
  };
  const parsedSource = sourceSchema.parse(source);
  assert.equal(
    noteFromSavedSource(parsedSource, studySchema.parse(raw)).study?.note
      ?.references[0].page,
    3,
  );
  assert.throws(() =>
    noteFromSavedSource(
      parsedSource,
      studySchema.parse({
        ...raw,
        note: {
          ...raw.note,
          references: [{ ...raw.note.references[0], page: 2 }],
        },
      }),
    ),
  );
  assert.throws(() =>
    sourceSchema.parse({
      ...source,
      document: {
        ...source.document,
        pages: [{ page: 4, start: 0, end: 100 }],
      },
    }),
  );
});

test("PDF client sends raw file bytes and authenticated PDF URLs with actionable errors", async () => {
  const { createSourceClient } = await import("./source-client");
  const token = `${Buffer.from('{"alg":"HS256"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub: "11111111-1111-4111-8111-111111111111", exp: 2000000000 })).toString("base64url")}.fixture`;
  let fileSent = false,
    linkSent = false;
  const values = new Map<string, string>();
  const file = new File(["%PDF-fixture"], "learning.pdf", {
    type: "application/pdf",
  });
  const client = createSourceClient(
    { url: "https://pdf-fixture.supabase.co", publicKey: "public-test" },
    {
      storage: {
        getItem: (k) => values.get(k) ?? null,
        setItem: (k, v) => {
          values.set(k, v);
        },
        removeItem: (k) => {
          values.delete(k);
        },
      },
      fetch: async (input, init) => {
        const url = String(input);
        if (url.includes("/auth/v1/signup"))
          return Response.json({
            access_token: token,
            refresh_token: "fixture",
            token_type: "bearer",
            expires_in: 3600,
            user: {
              id: "11111111-1111-4111-8111-111111111111",
              is_anonymous: true,
              app_metadata: {},
              user_metadata: {},
            },
          });
        assert.equal(
          new Headers(init?.headers).get("Authorization"),
          `Bearer ${token}`,
        );
        if (url.includes("/sources/pdf?")) {
          assert.equal(
            new Headers(init?.headers).get("Content-Type"),
            "application/pdf",
          );
          assert.equal(init?.body, file);
          fileSent = true;
          return Response.json(source, { status: 201 });
        }
        const body = JSON.parse(String(init?.body));
        assert.equal(body.url, "https://example.com/paper.pdf");
        linkSent = true;
        return Response.json(
          {
            detail:
              "No substantial selectable text was found. Apply OCR first.",
          },
          { status: 422 },
        );
      },
    },
  );
  assert.equal(
    (await client.savePDF({ file, title: "Learning" })).document?.page_count,
    3,
  );
  await assert.rejects(
    client.savePDF({ url: "https://example.com/paper.pdf", title: "" }),
    /Apply OCR first/,
  );
  assert.ok(fileSent && linkSent);
});
