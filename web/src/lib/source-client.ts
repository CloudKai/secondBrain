import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { studyPageSchema, studySchema, type StudyRecord } from "./study-note";

const httpUrl = z
  .string()
  .url()
  .refine((url) => /^https?:\/\//.test(url));
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
    original_url: httpUrl,
    canonical_url: httpUrl,
    title: boundedText(1, 200),
    captured_text: boundedText(120, 30_000),
    captured_at: z.string().datetime({ offset: true }),
    capture_origin: z.enum(["direct", "reader", "pasted"]),
    coverage: z.enum(["complete", "partial", "unknown"]),
    coverage_detail: boundedText(1, 500),
    study_status: z.literal("pending"),
  })
  .strict();
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
          "Content-Type": "application/json",
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
