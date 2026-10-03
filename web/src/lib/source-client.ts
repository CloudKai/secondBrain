import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { studyPageSchema, studySchema, type StudyRecord } from "./study-note";
import { transcriptSchema, videoIdentity } from "./transcript";

const httpUrl = z
  .string()
  .url()
  .refine((url) => /^https?:\/\//.test(url));
const documentSchema = z
  .object({
    filename: boundedText(1, 200).nullable(),
    page_count: z.number().int().min(1).max(100),
    pages: z
      .array(
        z
          .object({
            page: z.number().int().min(1).max(100),
            start: z.number().int().min(0).max(30000),
            end: z.number().int().min(0).max(30000),
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict();
// Python and Postgres constrain Unicode code points, rather than UTF-16 units.
function boundedText(min: number, max: number) {
  return z.string().refine((value) => {
    const length = Array.from(value).length;
    return length >= min && length <= max;
  }, `Expected ${min}–${max} characters.`);
}
export const sourceSchema = z
  .object({
    id: z.string().uuid(),
    original_url: httpUrl.nullable(),
    canonical_url: z.union([
      httpUrl,
      z.string().regex(/^urn:pdf:sha256:[a-f0-9]{64}$/),
    ]),
    source_kind: z.enum(["article", "pdf", "video"]).optional(),
    document: documentSchema.nullish(),
    transcript: transcriptSchema.nullish(),
    title: boundedText(1, 200),
    captured_text: boundedText(120, 30_000),
    captured_at: z.string().datetime({ offset: true }),
    capture_origin: z.enum(["direct", "reader", "pasted", "upload"]),
    coverage: z.enum(["complete", "partial", "unknown"]),
    coverage_detail: boundedText(1, 500),
    study_status: z.literal("pending"),
  })
  .strict()
  .superRefine((source, ctx) => {
    const pdf = source.source_kind === "pdf";
    const video = source.source_kind === "video";
    let invalid =
      !pdf &&
      !video &&
      (source.original_url === null ||
        !!source.document ||
        source.capture_origin === "upload");
    invalid ||= !video && !!source.transcript;
    if (video) {
      const transcript = source.transcript;
      invalid ||=
        !source.original_url ||
        !!source.document ||
        !transcript ||
        !["pasted", "upload"].includes(source.capture_origin);
      if (transcript) {
        invalid ||=
          (source.capture_origin === "upload") !==
            (transcript.filename !== null) ||
          transcript.segments[transcript.segments.length - 1].end !==
            Array.from(source.captured_text).length;
        try {
          const identity = videoIdentity(source.original_url ?? "");
          invalid ||=
            identity.provider !== transcript.provider ||
            identity.canonicalUrl !== source.canonical_url;
        } catch {
          invalid = true;
        }
      }
    }
    if (pdf) {
      const doc = source.document;
      invalid ||=
        !doc ||
        !["direct", "upload"].includes(source.capture_origin) ||
        (source.capture_origin === "upload") !== (source.original_url === null);
      invalid ||= source.capture_origin === "upload" && !doc?.filename;
      if (doc) {
        invalid ||=
          doc.pages.length > doc.page_count ||
          doc.pages[0].start !== 0 ||
          doc.pages[doc.pages.length - 1].end !==
            Array.from(source.captured_text).length;
        doc.pages.forEach((p, i) => {
          invalid ||=
            p.page !== i + 1 ||
            p.end < p.start ||
            (i > 0 && p.start !== doc.pages[i - 1].end + 1);
        });
      }
    }
    invalid ||=
      source.original_url === null
        ? !source.canonical_url.startsWith("urn:pdf:sha256:")
        : !/^https?:/.test(source.canonical_url);
    if (invalid)
      ctx.addIssue({
        code: "custom",
        message: "Invalid source identity or page locations",
      });
  });
export type SavedSource = z.infer<typeof sourceSchema>;
const pageSchema = z
  .object({
    sources: z.array(sourceSchema),
    next_offset: z.number().int().nonnegative().nullable(),
  })
  .strict();

interface Storage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function createSourceClient(
  settings: { url: string; publicKey: string },
  dependencies: { fetch?: typeof fetch; storage?: Storage } = {},
) {
  if (
    !settings.url ||
    !settings.publicKey ||
    settings.publicKey.startsWith("sb_secret_")
  )
    throw new Error(
      "Configure the Supabase project URL and public publishable key.",
    );
  const fetcher = dependencies.fetch ?? fetch;
  const supabase = createClient(settings.url, settings.publicKey, {
    global: { fetch: fetcher },
    auth: {
      persistSession: true,
      autoRefreshToken: typeof window !== "undefined",
      detectSessionInUrl: false,
      storage: dependencies.storage,
    },
  });
  let connecting: Promise<void> | null = null;

  async function ready(): Promise<void> {
    const { data, error } = await supabase.auth.getSession();
    if (error)
      throw new Error(
        "Your library session could not be restored. Retry connecting.",
      );
    if (data.session) return;
    if (!connecting) {
      connecting = (async () => {
        const result = await supabase.auth.signInAnonymously();
        if (result.error || !result.data.session)
          throw new Error(
            "Could not connect your library. Check that anonymous sign-ins are enabled and retry.",
          );
      })().finally(() => {
        connecting = null;
      });
    }
    await connecting;
  }

  async function request(path: string, init?: RequestInit): Promise<Response> {
    await ready();
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session)
      throw new Error("Your library session is unavailable. Retry connecting.");
    let response: Response;
    try {
      response = await fetcher(`/api/v2${path}`, {
        ...init,
        headers: {
          ...Object.fromEntries(new Headers(init?.headers).entries()),
          "Content-Type":
            init?.body instanceof Blob
              ? init.body.type || "application/octet-stream"
              : "application/json",
          Authorization: `Bearer ${data.session.access_token}`,
        },
        signal: AbortSignal.timeout(120_000),
      });
    } catch {
      throw new Error(
        "Could not reach the library service. Check the connection and retry.",
      );
    }
    if (!response.ok) {
      if (
        (path.startsWith("/sources/pdf") ||
          path.startsWith("/sources/video")) &&
        [408, 413, 422].includes(response.status)
      ) {
        const body: unknown = await response.json().catch(() => null);
        const error = z
          .object({ detail: z.string().min(1).max(500) })
          .safeParse(body);
        throw new Error(
          error.success
            ? error.data.detail
            : path.startsWith("/sources/video")
              ? "Use a readable UTF-8 TXT, VTT or SRT transcript up to 1 MB, or paste its text."
              : "This PDF is unsupported. Use an unencrypted selectable-text PDF up to 10 MB and 100 pages.",
        );
      }
      throw new Error(
        path.includes("stud") &&
          response.status !== 401 &&
          response.status !== 404
          ? "Study notes are unavailable. Check the study migration and worker setup, then retry."
          : response.status === 422
            ? "This article could not be captured. Use a public article URL or paste its text."
            : response.status === 401
              ? "Your library session could not be verified. Retry connecting."
              : response.status === 404
                ? "This source is no longer in your library."
                : "Library storage is unavailable. Check the configuration and retry.",
      );
    }
    return response;
  }

  async function parse<T>(
    response: Response,
    schema: z.ZodType<T>,
  ): Promise<T> {
    try {
      return schema.parse(await response.json());
    } catch {
      throw new Error(
        "The library returned incomplete material. Retry loading it.",
      );
    }
  }

  return {
    ready,
    async list(): Promise<SavedSource[]> {
      const sources: SavedSource[] = [];
      let offset = 0;
      for (;;) {
        const page = await parse(
          await request(`/sources?offset=${offset}`),
          pageSchema,
        );
        sources.push(...page.sources);
        if (page.next_offset === null) return sources;
        if (page.next_offset <= offset)
          throw new Error(
            "The library returned invalid pagination. Retry loading.",
          );
        offset = page.next_offset;
      }
    },
    async save(input: {
      url: string;
      title: string;
      raw_text: string | null;
    }): Promise<SavedSource> {
      return parse(
        await request("/sources", {
          method: "POST",
          body: JSON.stringify(input),
        }),
        sourceSchema,
      );
    },
    async remove(id: string): Promise<void> {
      await request(`/sources/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
    async savePDF(input: {
      file?: File;
      url?: string;
      title: string;
    }): Promise<SavedSource> {
      if (input.file) {
        if (input.file.size > 10_000_000)
          throw new Error(
            "PDFs must be 10 MB or smaller. Export a smaller document.",
          );
        if (Array.from(input.file.name).length > 200)
          throw new Error("Use a PDF filename with 200 characters or fewer.");
        return parse(
          await request(
            `/sources/pdf?${new URLSearchParams({ filename: input.file.name, title: input.title })}`,
            { method: "POST", body: input.file },
          ),
          sourceSchema,
        );
      }
      return parse(
        await request("/sources/pdf-link", {
          method: "POST",
          body: JSON.stringify({ url: input.url, title: input.title }),
        }),
        sourceSchema,
      );
    },
    async saveVideo(input: {
      url: string;
      title: string;
      file?: File;
      text?: string;
    }): Promise<SavedSource> {
      videoIdentity(input.url);
      if (input.file && input.text !== undefined)
        throw new Error("Choose a transcript file or paste text, not both.");
      const params = new URLSearchParams({ title: input.title });
      let body: Blob;
      if (input.file) {
        if (input.file.size > 1_000_000)
          throw new Error(
            "Transcripts must be 1 MB or smaller. Export a shorter transcript or paste its text.",
          );
        if (Array.from(input.file.name).length > 200)
          throw new Error(
            "Use a transcript filename with 200 characters or fewer.",
          );
        if (!/\.(txt|vtt|srt)$/i.test(input.file.name))
          throw new Error(
            "Upload UTF-8 TXT, VTT or SRT. Copy and paste transcript text from other formats.",
          );
        params.set("filename", input.file.name);
        body = input.file;
      } else {
        const text = input.text?.trim() ?? "";
        if (Array.from(text).length < 120 || Array.from(text).length > 100_000)
          throw new Error(
            "Paste 120–100,000 transcript characters, or upload a UTF-8 TXT, VTT or SRT file.",
          );
        body = new Blob([text], { type: "text/plain;charset=utf-8" });
      }
      return parse(
        await request(`/sources/video?${params}`, {
          method: "POST",
          body,
          headers: { "X-Video-URL": input.url },
        }),
        sourceSchema,
      );
    },
    async generate(id: string, retry = false): Promise<StudyRecord> {
      return parse(
        await request(`/sources/${encodeURIComponent(id)}/study`, {
          method: "POST",
          body: JSON.stringify({ retry }),
        }),
        studySchema,
      );
    },
    async studies(): Promise<StudyRecord[]> {
      const records: StudyRecord[] = [];
      let offset = 0;
      for (;;) {
        const page = await parse(
          await request(`/studies?offset=${offset}`),
          studyPageSchema,
        );
        records.push(...page.studies);
        if (page.next_offset === null) return records;
        if (page.next_offset <= offset)
          throw new Error(
            "The library returned invalid pagination. Retry loading.",
          );
        offset = page.next_offset;
      }
    },
  };
}

export type SourceClient = ReturnType<typeof createSourceClient>;
