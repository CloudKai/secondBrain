"""Disposable PDF parser process; no network, files, OCR or model calls."""

from io import BytesIO
import json
import resource
import sys


def extract(data: bytes) -> dict:
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
    text = ""
    pages = []
    partial = False
    for index, page in enumerate(reader.pages):
        content = page.get_contents()
        if content and len(content.get_data()) > 2_000_000:
            return {
                "error": "A PDF page exceeds extraction limits. Export a simpler selectable-text PDF."
            }
        extracted = (page.extract_text() or "").replace("\x00", "\ufffd").strip()
        if not extracted:
            partial = True
        if index:
            if len(text) == 30_000:
                partial = True
                break
            text += "\n"
        start = len(text)
        remaining = 30_000 - start
        text += extracted[:remaining]
        pages.append({"page": index + 1, "start": start, "end": len(text)})
        if len(extracted) > remaining:
            partial = True
            break
    if len(text.strip()) < 120:
        return {
            "error": "No substantial selectable text was found. Scanned-only PDFs need OCR first; upload a text-based copy."
        }
    partial = partial or len(pages) < count
    return {
        "captured_text": text,
        "coverage": "partial" if partial else "complete",
        "coverage_detail": (
            f"Captured selectable text from {len(pages)} of {count} PDF pages (up to 30,000 characters). "
            + ("Some page text is missing or omitted. " if partial else "")
            + "Images, diagrams and layout are not extracted; check the original for context."
        ),
        "document": {"filename": None, "page_count": count, "pages": pages},
    }


def main():
    # CPU and heap limits isolate decompression/parsing from the API process.
    resource.setrlimit(resource.RLIMIT_CPU, (10, 10))
    if sys.platform != "darwin":
        resource.setrlimit(resource.RLIMIT_AS, (768 * 1024 * 1024, 768 * 1024 * 1024))
    try:
        print(json.dumps(extract(sys.stdin.buffer.read(10_000_001))))
    except Exception:
        print(
            json.dumps(
                {
                    "error": "This PDF is damaged or unreadable. Export a selectable-text copy and try again."
                }
            )
        )


if __name__ == "__main__":
    main()
