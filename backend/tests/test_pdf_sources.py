"""PDF capture and page evidence through the owned-source HTTP interface."""

from io import BytesIO

from pypdf import PdfWriter
from pypdf.generic import DictionaryObject, NameObject, DecodedStreamObject

from backend.tests.test_sources import browser_client  # noqa: F401
import pytest


FIRST_PAGE = (
    "Algebra studies symbols and rules for combining them. Variables represent unknown quantities. "
    * 3
)
THIRD_PAGE = (
    "Calculus studies change. A derivative measures instantaneous rate of change. Integrals accumulate quantities. "
    * 3
)


def pdf_bytes(texts=(FIRST_PAGE, "", THIRD_PAGE), *, encrypted=False):
    writer = PdfWriter()
    for text in texts:
        page = writer.add_blank_page(width=612, height=792)
        font = DictionaryObject(
            {
                NameObject("/Type"): NameObject("/Font"),
                NameObject("/Subtype"): NameObject("/Type1"),
                NameObject("/BaseFont"): NameObject("/Helvetica"),
            }
        )
        page[NameObject("/Resources")] = DictionaryObject(
            {
                NameObject("/Font"): DictionaryObject(
                    {NameObject("/F1"): writer._add_object(font)}
                )
            }
        )
        stream = DecodedStreamObject()
        stream.set_data(
            (
                "BT /F1 12 Tf 36 740 Td ("
                + text.replace("(", "\\(").replace(")", "\\)")
                + ") Tj ET"
            ).encode()
        )
        page[NameObject("/Contents")] = writer._add_object(stream)
    if encrypted:
        writer.encrypt("password")
    output = BytesIO()
    writer.write(output)
    return output.getvalue()


def test_uploaded_pdf_reopens_with_original_page_identity_and_is_owned(browser_client):
    headers = {"Authorization": "Bearer alice", "Content-Type": "application/pdf"}
    response = browser_client.post(
        "/api/v2/sources/pdf?filename=learning.pdf",
        headers=headers,
        content=pdf_bytes(),
    )
    assert response.status_code == 201, response.text
    source = response.json()
    assert source["source_kind"] == "pdf"
    assert source["original_url"] is None
    assert source["document"]["filename"] == "learning.pdf"
    assert source["document"]["page_count"] == 3
    assert [p["page"] for p in source["document"]["pages"]] == [1, 2, 3]
    page_three = source["document"]["pages"][2]
    assert (
        source["captured_text"][page_three["start"] : page_three["end"]]
        == THIRD_PAGE.strip()
    )
    assert (
        source["coverage"] == "partial"
    )  # Blank/image pages are not assumed understood.
    assert (
        browser_client.get(f"/api/v2/sources/{source['id']}", headers=headers).json()
        == source
    )
    assert (
        browser_client.get(
            f"/api/v2/sources/{source['id']}", headers={"Authorization": "Bearer bob"}
        ).status_code
        == 404
    )
    duplicate = browser_client.post(
        "/api/v2/sources/pdf?filename=renamed.pdf", headers=headers, content=pdf_bytes()
    ).json()
    assert duplicate["id"] == source["id"]


@pytest.mark.parametrize(
    "data,message",
    [
        (b"not a PDF", "readable PDF"),
        (b"%PDF-1.7 damaged", "damaged or unreadable"),
        (pdf_bytes(("",)), "selectable text"),
        (pdf_bytes(encrypted=True), "Password-protected"),
        (pdf_bytes((FIRST_PAGE,) * 101), "1–100 pages"),
        (b"%PDF-" + b"x" * 10_000_000, "10 MB"),
    ],
    ids=["not-pdf", "damaged", "scanned", "encrypted", "too-many-pages", "too-large"],
)
def test_unsupported_pdfs_never_create_sources(browser_client, data, message):
    response = browser_client.post(
        "/api/v2/sources/pdf?filename=bad.pdf",
        headers={"Authorization": "Bearer alice"},
        content=data,
    )
    assert response.status_code in (413, 422)
    assert message in response.json()["detail"]
    assert (
        browser_client.get(
            "/api/v2/sources", headers={"Authorization": "Bearer alice"}
        ).json()["sources"]
        == []
    )


def test_pdf_link_preserves_page_identity_and_rejects_private_redirect(browser_client):
    response = browser_client.post(
        "/api/v2/sources/pdf-link",
        headers={"Authorization": "Bearer alice"},
        json={"url": "https://article.test/pdf-file#page=3"},
    )
    assert response.status_code == 201, response.text
    source = response.json()
    assert source["original_url"] == "https://article.test/pdf-file#page=3"
    assert source["document"]["pages"][2]["page"] == 3
    assert source["capture_origin"] == "direct"
    assert (
        browser_client.post(
            "/api/v2/sources/pdf-link",
            headers={"Authorization": "Bearer alice"},
            json={"url": "https://article.test/redirect-private"},
        ).status_code
        == 422
    )


def test_long_pdf_reports_partial_capture_without_renumbering_pages(browser_client):
    response = browser_client.post(
        "/api/v2/sources/pdf?filename=long.pdf",
        headers={"Authorization": "Bearer alice"},
        content=pdf_bytes((FIRST_PAGE, THIRD_PAGE * 200)),
    )
    assert response.status_code == 201
    source = response.json()
    assert len(source["captured_text"]) == 30_000
    assert source["coverage"] == "partial"
    assert source["document"]["pages"][-1]["page"] == 2
    assert source["document"]["pages"][-1]["end"] == 30_000


def test_pdf_generation_references_never_cross_or_invent_page_boundaries(
    browser_client,
):
    from backend.source_models import PDFDocument
    from backend.study_generation import captured_passages

    source = browser_client.post(
        "/api/v2/sources/pdf?filename=learning.pdf",
        headers={"Authorization": "Bearer alice"},
        content=pdf_bytes(),
    ).json()
    passages = captured_passages(
        source["captured_text"], PDFDocument.model_validate(source["document"])
    )
    assert [p.page for p in passages] == [1, 3]
    assert passages[1].excerpt == THIRD_PAGE.strip()
    assert passages[1].start == len(FIRST_PAGE.strip()) + 2


def test_pdf_model_output_receives_server_derived_page_references():
    import asyncio
    import copy
    import httpx
    from backend.source_models import PDFDocument
    from backend.study_generation import StudyGenerator
    from backend.tests.test_study_generation import DRAFT, completion

    text = FIRST_PAGE.strip() + "\n\n" + THIRD_PAGE.strip()
    end = len(FIRST_PAGE.strip())
    document = PDFDocument(
        filename="learning.pdf",
        page_count=3,
        pages=[
            {"page": 1, "start": 0, "end": end},
            {"page": 2, "start": end + 1, "end": end + 1},
            {"page": 3, "start": end + 2, "end": len(text)},
        ],
    )
    draft = copy.deepcopy(DRAFT)
    for claim in [
        draft["overview"],
        *draft["concepts"],
        *draft["examples"],
        *draft["equations"],
        *draft["recall"],
    ]:
        claim["citation_ids"] = ["p0002"]

    async def run():
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(lambda request: completion(request, draft))
        ) as client:
            note = await StudyGenerator(client, api_key="test-key").generate(
                text, document=document
            )
        assert note.references[0].page == 3
        assert note.references[0].excerpt == THIRD_PAGE.strip()

    asyncio.run(run())


@pytest.mark.parametrize(
    "url",
    [
        "http://127.0.0.1/file.pdf",
        "https://user:pass@article.test/file.pdf",
        "https://article.test:8443/file.pdf",
        "https://article.test/learning",
    ],
    ids=["private", "credentials", "port", "not-pdf"],
)
def test_pdf_links_require_public_pdf_content(browser_client, url):
    response = browser_client.post(
        "/api/v2/sources/pdf-link",
        headers={"Authorization": "Bearer alice"},
        json={"url": url},
    )
    assert response.status_code == 422
    assert (
        browser_client.get(
            "/api/v2/sources", headers={"Authorization": "Bearer alice"}
        ).json()["sources"]
        == []
    )


def test_pdf_upload_requires_a_learner_session(browser_client):
    assert (
        browser_client.post(
            "/api/v2/sources/pdf?filename=learning.pdf", content=pdf_bytes()
        ).status_code
        == 401
    )
