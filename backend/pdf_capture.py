"""Bounded selectable-text PDF extraction in a disposable subprocess."""

import asyncio
import json
import sys
from urllib.parse import urljoin

import httpx

from backend.source_models import PDFDocument
from backend.source_capture import public_source_address

MAX_PDF_BYTES = 10_000_000
MAX_PDF_PAGES = 100


async def capture_pdf_link(url: str) -> dict:
    try:
        async with (
            asyncio.timeout(60),
            httpx.AsyncClient(
                timeout=httpx.Timeout(25, connect=7),
                follow_redirects=False,
                trust_env=False,
                limits=httpx.Limits(max_keepalive_connections=0),
            ) as client,
        ):
            current = url
            for _ in range(5):
                target = httpx.URL(current)
                address = await public_source_address(target)
                async with client.stream(
                    "GET",
                    target.copy_with(host=address),
                    headers={
                        "Host": target.netloc.decode(),
                        "Accept": "application/pdf",
                    },
                    extensions={"sni_hostname": target.host},
                ) as response:
                    if response.status_code in (301, 302, 303, 307, 308):
                        location = response.headers.get("location")
                        if not location:
                            raise ValueError("The PDF redirect has no destination.")
                        current = urljoin(current, location)
                        continue
                    response.raise_for_status()
                    mime = (
                        response.headers.get("content-type", "")
                        .split(";", 1)[0]
                        .lower()
                        .strip()
                    )
                    if mime not in ("application/pdf", "application/octet-stream"):
                        raise ValueError(
                            "This link does not return a PDF. Use a direct public PDF link or upload the file."
                        )
                    data = bytearray()
                    async for chunk in response.aiter_bytes():
                        if len(data) + len(chunk) > MAX_PDF_BYTES:
                            raise ValueError(
                                "PDFs must be 10 MB or smaller. Export a smaller document."
                            )
                        data.extend(chunk)
                return await capture_pdf(bytes(data))
            raise ValueError(
                "The PDF redirects too many times. Use a direct public PDF link."
            )
    except (httpx.HTTPError, TimeoutError) as exc:
        raise ValueError(
            "The PDF could not be downloaded. Use a direct public PDF link or upload the file."
        ) from exc


async def monitor_memory(process):
    # macOS does not enforce RLIMIT_AS. Observe only this owned parser's RSS.
    while process.returncode is None:
        probe = await asyncio.create_subprocess_exec(
            "ps",
            "-o",
            "rss=",
            "-p",
            str(process.pid),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
        )
        output, _ = await probe.communicate()
        if output.strip() and int(output.strip()) > 512 * 1024:
            if process.returncode is None:
                process.kill()
            return
        await asyncio.sleep(0.25)


async def capture_pdf(data: bytes, filename: str | None = None) -> dict:
    if not data.startswith(b"%PDF-"):
        raise ValueError(
            "This file is not a readable PDF. Upload a selectable-text PDF."
        )
    if len(data) > MAX_PDF_BYTES:
        raise ValueError("PDFs must be 10 MB or smaller. Export a smaller document.")
    process = await asyncio.create_subprocess_exec(
        sys.executable,
        "-m",
        "backend.pdf_extraction",
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL,
    )
    monitor = (
        asyncio.create_task(monitor_memory(process))
        if sys.platform == "darwin"
        else None
    )
    try:
        async with asyncio.timeout(15):
            output, _ = await process.communicate(data)
        if process.returncode != 0:
            raise ValueError(
                "The PDF exceeds extraction limits or is unreadable. Export a simpler selectable-text PDF."
            )
        result = json.loads(output)
        if "error" in result:
            raise ValueError(result["error"])
        result["document"]["filename"] = filename
        result["document"] = PDFDocument.model_validate_json(
            json.dumps(result["document"])
        ).model_dump()
        return result
    except TimeoutError as exc:
        raise ValueError(
            "PDF extraction timed out. Export a smaller or simpler selectable-text PDF."
        ) from exc
    finally:
        if monitor:
            monitor.cancel()
            await asyncio.gather(monitor, return_exceptions=True)
        if process.returncode is None:
            process.kill()
            await process.wait()
