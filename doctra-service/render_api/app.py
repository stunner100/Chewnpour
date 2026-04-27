from __future__ import annotations

import math
import os
import re
import tempfile
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile

app = FastAPI(title="Docling Extract Service")

DOCLING_SHARED_SECRET = os.getenv("DOCLING_SHARED_SECRET", "").strip()


def _normalize_parser(profile: str, content_type: str, file_name: str) -> str:
    requested = str(profile or "").strip().lower()
    if requested in {"enhanced_pdf", "paddleocr_vl", "docx_structured", "image_ocr"}:
        return requested

    suffix = Path(file_name or "").suffix.lower()
    lower_content_type = str(content_type or "").lower()
    if suffix == ".pdf" or "pdf" in lower_content_type:
        return "enhanced_pdf"
    if suffix == ".docx" or "wordprocessingml.document" in lower_content_type:
        return "docx_structured"
    if suffix in {".png", ".jpg", ".jpeg", ".webp"} or lower_content_type.startswith("image/"):
        return "image_ocr"
    return "enhanced_pdf"


def _infer_kind(file_name: str, content_type: str) -> str:
    suffix = Path(file_name or "").suffix.lower()
    if suffix == ".pdf" or "pdf" in str(content_type or "").lower():
        return "pdf"
    if suffix == ".docx":
        return "docx"
    if suffix == ".pptx":
        return "pptx"
    if suffix in {".png", ".jpg", ".jpeg", ".webp"}:
        return "image"
    if suffix in {".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac"}:
        return "audio"
    return suffix.lstrip(".") or "document"


def _sanitize_text(value: str) -> str:
    return (
        str(value or "")
        .replace("\u0000", "")
        .replace("\r\n", "\n")
        .replace("\r", "\n")
        .replace("\n\n\n", "\n\n")
        .strip()
    )


def _count_tables(markdown: str) -> int:
    lines = markdown.splitlines()
    count = 0
    index = 0
    while index + 1 < len(lines):
        if "|" in lines[index] and re.match(r"^\s*\|?[\s:-]+(?:\|[\s:-]+)+\|?\s*$", lines[index + 1]):
            count += 1
            index += 2
            continue
        index += 1
    return count


def _count_formulas(markdown: str) -> int:
    inline = re.findall(r"\$[^$\n]+\$", markdown)
    block = re.findall(r"\\\[[\s\S]+?\\\]", markdown)
    return len(inline) + len(block)


def _extract_page_count(conversion_result: Any) -> int:
    pages = getattr(conversion_result, "pages", None)
    if isinstance(pages, list) and pages:
        return len(pages)

    input_doc = getattr(conversion_result, "input", None)
    page_count = getattr(input_doc, "page_count", None)
    if isinstance(page_count, int) and page_count > 0:
        return page_count

    document = getattr(conversion_result, "document", None)
    for attr_name in ("pages", "page_items"):
        candidate = getattr(document, attr_name, None) if document is not None else None
        if isinstance(candidate, list) and candidate:
            return len(candidate)
    return 1


def _split_into_pages(text: str, page_count: int) -> list[dict[str, Any]]:
    normalized = _sanitize_text(text)
    if not normalized:
        return []

    paragraphs = [chunk.strip() for chunk in re.split(r"\n{2,}", normalized) if chunk.strip()]
    if not paragraphs:
        paragraphs = [normalized]

    target_pages = max(1, int(page_count or 1))
    target_chars = max(1200, math.ceil(len(normalized) / target_pages))
    pages: list[dict[str, Any]] = []
    current = ""

    for paragraph in paragraphs:
        candidate = paragraph if not current else f"{current}\n\n{paragraph}"
        if current and len(candidate) > target_chars and len(pages) + 1 < target_pages:
            page_text = _sanitize_text(current)
            pages.append(
                {
                    "index": len(pages),
                    "text": page_text,
                    "chars": len(page_text),
                    "tableCount": _count_tables(page_text),
                    "formulaCount": _count_formulas(page_text),
                    "source": "docling",
                }
            )
            current = paragraph
        else:
            current = candidate

    if current:
        page_text = _sanitize_text(current)
        pages.append(
            {
                "index": len(pages),
                "text": page_text,
                "chars": len(page_text),
                "tableCount": _count_tables(page_text),
                "formulaCount": _count_formulas(page_text),
                "source": "docling",
            }
        )

    while len(pages) < target_pages and pages:
        pages.append(
            {
                "index": len(pages),
                "text": "",
                "chars": 0,
                "tableCount": 0,
                "formulaCount": 0,
                "source": "docling",
            }
        )

    return pages


def _convert_with_docling(file_path: Path, max_pages: int | None) -> dict[str, Any]:
    from docling.document_converter import DocumentConverter

    converter = DocumentConverter()
    if max_pages and max_pages > 0:
        result = converter.convert(file_path, max_num_pages=max_pages, raises_on_error=False)
    else:
        result = converter.convert(file_path, raises_on_error=False)

    document = getattr(result, "document", None)
    if document is None:
        errors = getattr(result, "errors", None)
        raise RuntimeError(f"Docling conversion returned no document: {errors}")

    markdown = _sanitize_text(document.export_to_markdown())
    if not markdown:
        raise RuntimeError("Docling conversion returned empty markdown.")

    return {
        "markdown": markdown,
        "pageCount": _extract_page_count(result),
        "warnings": [str(item) for item in (getattr(result, "errors", None) or []) if str(item).strip()],
    }


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/extract")
async def extract_document(
    file: UploadFile = File(...),
    contentType: str = Form(...),
    profile: str = Form(...),
    maxPages: str | None = Form(default=None),
    x_docling_shared_secret: str | None = Header(default=None),
) -> dict[str, Any]:
    if DOCLING_SHARED_SECRET and x_docling_shared_secret != DOCLING_SHARED_SECRET:
        raise HTTPException(status_code=401, detail="Invalid shared secret.")

    parser = _normalize_parser(profile, contentType, file.filename or "")
    kind = _infer_kind(file.filename or "", contentType)

    max_pages: int | None = None
    if maxPages is not None and str(maxPages).strip():
        try:
            max_pages = max(1, int(maxPages))
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="maxPages must be an integer.") from exc

    suffix = Path(file.filename or "upload").suffix or ".bin"
    payload = await file.read()
    if not payload:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
        temp_file.write(payload)
        temp_path = Path(temp_file.name)

    try:
        conversion = _convert_with_docling(temp_path, max_pages)
    except Exception as exc:  # pragma: no cover - surfaced in response and tests via monkeypatch
        raise HTTPException(status_code=500, detail=f"Docling extract error: {exc}") from exc
    finally:
        try:
            temp_path.unlink(missing_ok=True)
        except OSError:
            pass

    text = conversion["markdown"]
    page_count = max(1, int(conversion["pageCount"] or 1))
    pages = _split_into_pages(text, page_count)
    table_count = sum(int(page.get("tableCount") or 0) for page in pages)
    formula_count = sum(int(page.get("formulaCount") or 0) for page in pages)

    warnings = list(dict.fromkeys([*conversion.get("warnings", [])]))
    if parser == "paddleocr_vl":
        warnings.append("profile_mapped_to_docling_default")

    return {
        "backend": "docling",
        "kind": kind,
        "parser": parser,
        "text": text,
        "charCount": len(text),
        "pageCount": max(page_count, len(pages)),
        "pages": pages,
        "warnings": warnings,
        "metrics": {
            "tableCount": table_count,
            "formulaCount": formula_count,
            "chartCount": 0,
        },
    }
