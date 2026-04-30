from fastapi.testclient import TestClient

from render_api.app import app
import render_api.app as app_module


client = TestClient(app)


def test_extract_document_returns_docling_contract(monkeypatch):
    def fake_convert(file_path, max_pages):
        assert file_path.exists()
        assert max_pages == 3
        return {
            "markdown": "# Title\n\nFirst paragraph.\n\n| A | B |\n| --- | --- |\n| 1 | 2 |",
            "pageCount": 2,
            "warnings": [],
        }

    monkeypatch.setattr(app_module, "_convert_with_docling", fake_convert)
    monkeypatch.setattr(app_module, "DOCLING_SHARED_SECRET", "")

    response = client.post(
        "/extract",
        data={
            "contentType": "application/pdf",
            "profile": "enhanced_pdf",
            "maxPages": "3",
        },
        files={"file": ("sample.pdf", b"%PDF-1.4 sample", "application/pdf")},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["backend"] == "docling"
    assert payload["parser"] == "enhanced_pdf"
    assert payload["kind"] == "pdf"
    assert payload["pageCount"] == 2
    assert payload["charCount"] > 0
    assert len(payload["pages"]) == 2
    assert payload["blocks"]
    assert payload["blocks"][0]["blockType"] == "heading"
    assert any(block["blockType"] == "table" for block in payload["blocks"])
    assert any(block["headingPath"] == ["Title"] for block in payload["blocks"])
    assert payload["metrics"]["tableCount"] >= 1


def test_markdown_blocks_keep_title_context_for_inferred_headings():
    blocks = app_module._extract_markdown_blocks(
        "\n\n".join(
            [
                "## Active Reading Study Guide",
                "## Overview",
                "Active reading starts with a clear purpose.",
                "Key Strategies",
                "Survey the source before reading in detail.",
            ]
        ),
        1,
    )

    assert [block["blockType"] for block in blocks[:4]] == [
        "heading",
        "heading",
        "paragraph",
        "heading",
    ]
    assert blocks[2]["headingPath"] == ["Active Reading Study Guide", "Overview"]
    assert blocks[4]["headingPath"] == ["Active Reading Study Guide", "Key Strategies"]


def test_extract_document_enforces_shared_secret(monkeypatch):
    monkeypatch.setattr(app_module, "DOCLING_SHARED_SECRET", "secret")

    response = client.post(
        "/extract",
        data={
            "contentType": "application/pdf",
            "profile": "enhanced_pdf",
        },
        files={"file": ("sample.pdf", b"%PDF-1.4 sample", "application/pdf")},
    )

    assert response.status_code == 401
