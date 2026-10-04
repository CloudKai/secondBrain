"""Bounded public article capture. No model call or library ownership here."""

import asyncio
import ipaddress
import socket
from urllib.parse import urljoin, urlsplit, urlunsplit

import httpx
from bs4 import BeautifulSoup

MAX_DOWNLOAD_BYTES = 2_000_000
MAX_CAPTURE_CHARS = 30_000
MIN_TEXT_CHARS = 120


class UnsupportedSource(ValueError):
    """Sources that must not be delegated to a reader or paste fallback."""


def canonical_source_url(url: str) -> str:
    parts = urlsplit(url)
    return urlunsplit(parts._replace(fragment=""))


async def public_source_address(url: httpx.URL) -> str:
    port = url.port or (443 if url.scheme == "https" else 80)
    if (
        url.scheme not in ("http", "https")
        or not url.host
        or url.username
        or url.password
        or port not in (80, 443)
    ):
        raise UnsupportedSource("Use a public HTTP(S) source URL without credentials.")
    try:
        results = await asyncio.wait_for(
            asyncio.to_thread(
                socket.getaddrinfo, url.host, port, type=socket.SOCK_STREAM
            ),
            timeout=5,
        )
    except (OSError, TimeoutError) as exc:
        raise UnsupportedSource("The source host could not be resolved.") from exc
    addresses = [ipaddress.ip_address(result[4][0]) for result in results]
    if not addresses or any(not address.is_global for address in addresses):
        raise UnsupportedSource("Only public internet source URLs are supported.")
    return str(addresses[0])


async def download_public_document(
    client: httpx.AsyncClient,
    source_url: str,
    *,
    media_types: frozenset[str],
    max_bytes: int,
) -> tuple[bytes, str, str]:
    current = source_url
    for _ in range(5):
        url = httpx.URL(current)
        address = await public_source_address(url)
        # Pin the validated address and retain TLS identity on every redirect.
        async with client.stream(
            "GET",
            url.copy_with(host=address),
            headers={
                "Host": url.netloc.decode(),
                "Accept": ",".join(sorted(media_types)),
                "Accept-Encoding": "identity",
            },
            extensions={"sni_hostname": url.host},
        ) as response:
            if response.status_code in (301, 302, 303, 307, 308):
                location = response.headers.get("location")
                if not location:
                    raise ValueError("The source redirect has no destination.")
                current = urljoin(current, location)
                continue
            response.raise_for_status()
            mime = (
                response.headers.get("content-type", "")
                .split(";", 1)[0]
                .strip()
                .lower()
            )
            if mime not in media_types:
                raise UnsupportedSource(
                    "This link does not return a supported source type. Use a direct public link."
                )
            if (
                response.headers.get("content-encoding", "identity").strip().lower()
                != "identity"
            ):
                raise ValueError(
                    "This server returned an encoded download. Download the original PDF and upload it, or use another public link."
                )
            body = bytearray()
            # Reject encoding before reading raw transport bytes: HTTPX decoding
            # must not allocate an unbounded expanded response in the API process.
            async for chunk in response.aiter_raw():
                if len(body) + len(chunk) > max_bytes:
                    raise ValueError(
                        f"The source exceeds the {max_bytes // 1_000_000} MB download limit."
                    )
                body.extend(chunk)
            return bytes(body), mime, response.encoding or "utf-8"
    raise ValueError("The source redirects too many times. Use a direct public link.")


async def _download_article(client: httpx.AsyncClient, source_url: str) -> str:
    body, mime, encoding = await download_public_document(
        client,
        source_url,
        media_types=frozenset({"text/html", "application/xhtml+xml", "text/plain"}),
        max_bytes=MAX_DOWNLOAD_BYTES,
    )
    try:
        document = body.decode(encoding, errors="replace")
    except LookupError:
        document = body.decode("utf-8", errors="replace")
    if mime != "text/plain":
        soup = BeautifulSoup(document, "html.parser")
        for element in soup(
            ["script", "style", "noscript", "svg", "nav", "footer", "header"]
        ):
            element.decompose()
        return "\n".join(soup.stripped_strings)
    return document.strip()


def _captured_text(text: str, origin: str) -> dict[str, str]:
    if len(text) < MIN_TEXT_CHARS:
        raise ValueError("No substantial article text was found. Try pasting its text.")
    partial = len(text) > MAX_CAPTURE_CHARS
    return {
        "captured_text": text[:MAX_CAPTURE_CHARS],
        "capture_origin": origin,
        "coverage": "partial"
        if partial
        else "complete"
        if origin == "direct"
        else "unknown",
        "coverage_detail": (
            "Captured the first 30,000 characters; additional text was omitted."
            if partial
            else "Captured the readable text returned by this page."
            if origin == "direct"
            else "Captured reader output; full original-page coverage is not confirmed."
            if origin == "reader"
            else "User-supplied article text; full original-page coverage is not confirmed."
        ),
    }


async def capture_article(url: str, pasted_text: str | None = None, *, prefer_pasted: bool = False) -> dict[str, str]:
    original = canonical_source_url(url)
    if urlsplit(original).path.lower().endswith(".pdf"):
        raise UnsupportedSource(
            "Use the PDF form for a public PDF link or selectable-text upload."
        )
    if prefer_pasted and pasted_text is not None:
        await public_source_address(httpx.URL(original))
        return _captured_text(pasted_text.strip(), "pasted")
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
            try:
                return _captured_text(
                    await _download_article(client, original), "direct"
                )
            except UnsupportedSource:
                raise
            except (httpx.HTTPError, ValueError):
                try:
                    return _captured_text(
                        await _download_article(
                            client, f"https://r.jina.ai/{original}"
                        ),
                        "reader",
                    )
                except UnsupportedSource as exc:
                    # Original URL passed the public-article check. Reader failure
                    # can use pasted text without weakening that original check.
                    raise ValueError(
                        "The page reader could not return article text."
                    ) from exc
    except UnsupportedSource:
        raise
    except (httpx.HTTPError, ValueError, TimeoutError) as exc:
        text = (pasted_text or "").strip()
        if len(text.replace(url, "").strip()) >= MIN_TEXT_CHARS:
            return _captured_text(text, "pasted")
        raise ValueError(
            "The article could not be captured. Use a public URL or paste substantial article text."
        ) from exc
