import { z } from "zod";

const time = z.number().int().min(0).max(604_800_000).nullable();
export const transcriptSchema = z
  .object({
    provider: z.enum(["youtube", "teams", "zoom", "panopto"]),
    format: z.enum(["text", "vtt", "srt"]),
    filename: z
      .string()
      .refine((s) => Array.from(s).length >= 1 && Array.from(s).length <= 200)
      .nullable(),
    segments: z
      .array(
        z
          .object({
            start: z.number().int().min(0).max(30000),
            end: z.number().int().min(1).max(30000),
            start_ms: time,
            end_ms: time,
          })
          .strict(),
      )
      .min(1)
      .max(2000),
  })
  .strict()
  .superRefine((doc, ctx) => {
    let previousEnd = -1,
      previousTime = -1;
    let invalid = doc.format === "text" && doc.segments.length !== 1;
    for (const s of doc.segments) {
      invalid ||= s.start !== previousEnd + 1 || s.end <= s.start;
      invalid ||=
        doc.format === "text"
          ? s.start_ms !== null || s.end_ms !== null
          : s.start_ms === null ||
            s.end_ms === null ||
            s.end_ms <= s.start_ms ||
            s.start_ms < previousTime;
      previousEnd = s.end;
      previousTime = s.start_ms ?? previousTime;
    }
    if (invalid)
      ctx.addIssue({
        code: "custom",
        message: "Invalid transcript locations or supplied times",
      });
  });

export function videoIdentity(value: string): {
  provider: "youtube" | "teams" | "zoom" | "panopto";
  canonicalUrl: string;
} {
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || url.username || url.password || url.port)
    throw new Error(
      "Use an HTTPS YouTube, Teams, Zoom or Panopto recording link without credentials or custom ports.",
    );
  let id: string | null = null;
  if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(host)) {
    id =
      url.pathname === "/watch"
        ? (url.searchParams.get("v") ?? "")
        : /^\/(shorts|live|embed)\/[^/]+$/.test(url.pathname)
          ? (url.pathname.split("/").pop() ?? "")
          : "";
  } else if (host === "youtu.be") id = url.pathname.replace(/^\/|\/$/g, "");
  if (id !== null) {
    if (!/^[A-Za-z0-9_-]{11}$/.test(id))
      throw new Error(
        "Use a link to a specific YouTube video, not a channel or playlist.",
      );
    return {
      provider: "youtube",
      canonicalUrl: `https://www.youtube.com/watch?v=${id}`,
    };
  }
  let provider: "teams" | "zoom" | "panopto";
  if (
    ["teams.microsoft.com", "teams.cloud.microsoft"].includes(host) ||
    host.endsWith(".sharepoint.com")
  )
    provider = "teams";
  else if (host === "zoom.us" || host.endsWith(".zoom.us")) {
    if (!/^\/rec\/(share|play)\/.+/.test(url.pathname))
      throw new Error("Use a Zoom recording link, not a meeting invitation.");
    provider = "zoom";
  } else if (host.endsWith(".panopto.com") || host.endsWith(".panopto.eu")) {
    if (
      !url.pathname.toLowerCase().endsWith("/viewer.aspx") ||
      !url.searchParams.get("id")
    )
      throw new Error("Use a Panopto viewer link with a recording ID.");
    provider = "panopto";
  } else
    throw new Error(
      "Use a YouTube, Teams/SharePoint, Zoom recording or Panopto viewer link.",
    );
  if (url.pathname === "/")
    throw new Error("Use a link to the recording, not the platform home page.");
  url.hash = "";
  return { provider, canonicalUrl: url.href };
}

export function formatVideoTime(ms: number): string {
  const seconds = Math.floor(ms / 1000),
    hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) % 60;
  const fraction = ms % 1000;
  return `${hours ? `${hours}:` : ""}${hours ? String(minutes).padStart(2, "0") : minutes}:${String(seconds % 60).padStart(2, "0")}${fraction ? `.${String(fraction).padStart(3, "0")}` : ""}`;
}

export function videoMomentUrl(
  original: string,
  startMs: number | null | undefined,
): string {
  if (startMs == null) return original;
  const identity = videoIdentity(original);
  if (identity.provider !== "youtube") return original;
  const url = new URL(identity.canonicalUrl);
  url.searchParams.set("t", `${Math.floor(startMs / 1000)}s`);
  return url.href;
}
