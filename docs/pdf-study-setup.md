# PDF study notes — ticket #3

## Implementation and acceptance

Selectable-text PDF uploads and public links use the existing owned source,
structured study, outbox and ARQ workflow. Local acceptance and hosted
Supabase acceptance passed on 2026-10-03 after the reviewed migration was applied
and the worker restarted. This document records verified browser behavior;
video ingestion and topic generation remain later tickets.

Final checks: 71 backend tests, 24 web tests, web build/typecheck and lint passed.
Backend checks used `uv run --project backend --extra dev python -m pytest
backend/tests -q --tb=short`: the copied pytest executable has a stale shebang,
so the module command ensures the project interpreter is used. The build retains
a nonfatal 552 KB bundle warning; two backend dependency deprecation warnings
remain.

Live acceptance covered a three-page upload with a blank middle page, exact
physical-page citations after reload, owner-scoped digest reuse and second-learner
API/RLS denial. A public 15-page arXiv PDF captured 30,000 characters with partial
coverage and generated a note whose references all match saved page spans.
Deterministic checks cover unsupported/encrypted/scanned/oversized files, unsafe
redirects and encoded HTTP responses. Disposable acceptance sources and their
study/outbox records were removed. Independent review: `docs/reviews/ticket03.md`.

## Supported inputs and limits

- Upload a PDF or submit a direct public HTTP(S) PDF URL in **Add source → PDF**.
- Maximum 10 MB (10,000,000 bytes), 100 physical PDF pages, and 30,000 captured
  Unicode characters. Captures beyond the text limit are labelled partial.
- Upload streaming has a 30s deadline; public downloads have a 60s deadline,
  bounded redirects and pinned validated public addresses. No authenticated
  remote downloads or reader fallback is attempted for PDFs.
- Extraction runs in a disposable subprocess with a 15s deadline, a 10s CPU
  limit, limited decompression (2 MB per content stream/page), and memory controls
  (Linux address-space ceiling; macOS RSS watchdog). Unreadable or overly complex
  PDFs receive an actionable error instead of a saved source or fabricated note.
- Password-protected and scanned-only PDFs are unsupported. Use an unencrypted
  selectable-text copy or apply OCR externally. The app does not perform OCR.
- Only selectable text is captured. Images, diagrams, tables and visual reading
  order are not guaranteed. Blank/image-only pages make coverage partial; blank
  pages retain their physical numbers. “Complete” means the readable text from
  all supported pages was captured, not that visual content was understood.
- Uploads retain filename, a content digest, captured page text and page locations.
  The original binary is not stored. Public PDF links retain their original URL;
  **Open original** targets the cited physical page where the PDF viewer supports
  `#page=`. Uploaded sources show their saved page excerpt and local-file notice.

## Schema and worker rollout

Apply `supabase/migrations/202610030003_pdf_sources.sql` after the two existing
browser migrations. It extends `sources` with `source_kind` and strict page
metadata, permits a null original URL only for uploaded PDFs with a digest,
and includes page metadata in the service-only worker claim. Existing ownership,
RLS, atomic note acceptance, bounded retries and fencing remain in effect.

Restart the study worker with the current code before applying the migration;
older worker DTOs reject the added claim field. The current DTO accepts claims
both before and after migration. Keep Redis, FastAPI, Vite and the worker running
as described in `study-note-setup.md`. No new credential is needed.

Rollback `supabase/rollbacks/202610030003_pdf_sources.sql` refuses to run while
PDF captures exist, preserving learner records. Retain the schema, or explicitly
export/remove PDF sources before intentionally rolling it back. Articles survive.

## Contracts

- `POST /api/v2/sources/pdf?filename=...&title=...`: authenticated raw PDF bytes;
  public response is the strict captured-source DTO, with `original_url: null`.
- `POST /api/v2/sources/pdf-link`: authenticated JSON `{url, title}`.
- Page metadata uses physical page numbers and captured-text character offsets.
  Worker passages never cross a page; the model supplies only passage IDs, and
  the server attaches exact excerpts and page numbers. Browser validation checks
  both text and page bounds before rendering. Reload restores the same metadata.
- Upload content digests and URL identities are scoped to the authenticated owner.
  Repeated uploads reuse one source. Changed-source refresh and selected page
  ranges remain later tickets, as do video transcripts and topic graphs.

Parser guidance: [pypdf text extraction](https://pypdf.readthedocs.io/en/stable/user/extract-text.html).
