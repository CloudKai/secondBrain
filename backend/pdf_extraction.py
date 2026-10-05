"""Disposable PDF parser process; no network, files, OCR or model calls."""

from io import BytesIO
import json
import resource
import sys
from backend.capture_limits import MAX_CAPTURE_CHARS


def extract(data: bytes, page_start: int | None = None, page_end: int | None = None) -> dict:
    from pypdf import PdfReader, overwrite_configuration

    overwrite_configuration(
        maximum_declared_stream_length=10_000_000,
        array_based_stream_maximum_output_length=2_000_000,
        zlib_maximum_output_length=2_000_000,
        lzw_maximum_output_length=2_000_000,
        run_length_maximum_output_length=2_000_000,
        image_maximum_buffer_size=2_000_000,
    )

    reader = PdfReader(BytesIO(data), strict=True)
    if reader.is_encrypted:
        return {
            "error": "Password-protected PDFs are unsupported. Export an unencrypted selectable-text copy."
        }
    count = len(reader.pages)
    if not 1 <= count <= 100:
        return {"error": "PDFs must contain 1–100 pages. Export a smaller document."}
    if page_start is not None and not (page_end is not None and 1 <= page_start <= page_end <= count):
        return {"error": f"Choose an existing page range within this {count}-page PDF."}
    first, last = (page_start or 1), (page_end or count)
    text = ""
    pages = []
    partial = False
    for index in range(first - 1, last):
        page = reader.pages[index]
        content = page.get_contents()
        if content and len(content.get_data()) > 2_000_000:
            return {
                "error": "A PDF page exceeds extraction limits. Export a simpler selectable-text PDF."
            }
        extracted = (page.extract_text() or "").replace("\x00", "\ufffd").strip()
        if not extracted:
            partial = True
        if pages:
            if len(text) == MAX_CAPTURE_CHARS:
                partial = True
                break
            text += "\n"
        start = len(text)
        remaining = MAX_CAPTURE_CHARS - start
        text += extracted[:remaining]
        pages.append({"page": index + 1, "start": start, "end": len(text)})
        if len(extracted) > remaining:
            partial = True
            break
    if len(text.strip()) < 120:
        return {
            "error": "No substantial selectable text was found. Scanned-only PDFs need OCR first; upload a text-based copy."
        }
    partial = partial or len(pages) < last - first + 1 or first != 1 or last != count
    return {
        "captured_text": text,
        "coverage": "partial" if partial else "complete",
        "coverage_detail": (
            (f"Selected pages {first}–{last} of {count}. " if page_start is not None else "")
            + f"Captured selectable text from {len(pages)} of {count} PDF pages (up to 120,000 characters). "
            + ("Some page text is missing or omitted. " if partial else "")
            + "Images, diagrams and layout are not extracted; check the original for context."
        ),
        "document": {"filename": None, "page_count": count, "pages": pages,
                     "selected_pages": {"start": first, "end": last} if page_start is not None else None},
    }


def main():
    # CPU and heap limits isolate decompression/parsing from the API process.
    resource.setrlimit(resource.RLIMIT_CPU, (10, 10))
    if sys.platform != "darwin":
        resource.setrlimit(resource.RLIMIT_AS, (768 * 1024 * 1024, 768 * 1024 * 1024))
    try:
        print(json.dumps(extract(sys.stdin.buffer.read(10_000_001), *[int(x) for x in sys.argv[1:]])))
    except Exception as exc:
        print(
            json.dumps(
                {
                    "error": "This PDF is damaged or unreadable. Export a selectable-text copy and try again.",
                    "diagnostic": type(exc).__name__,
                }
            )
        )


if __name__ == "__main__":
    main()
