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


def _is_heading_line(line: str) -> bool:
    return bool(re.match(r"^#{1,6}\s+\S", line.strip()))


def _is_table_separator(line: str) -> bool:
    return bool(re.match(r"^\s*\|?[\s:-]+(?:\|[\s:-]+)+\|?\s*$", line))


def _is_table_start(lines: list[dict[str, Any]], index: int) -> bool:
    if index + 1 >= len(lines):
        return False
    return "|" in lines[index]["text"] and _is_table_separator(lines[index + 1]["text"])


def _is_list_line(line: str) -> bool:
    return bool(re.match(r"^\s*(?:[-*+]\s+|\d+[.)]\s+)", line))


def _block_type_for_text(text: str) -> str:
    stripped = text.strip()
    if _is_heading_line(stripped):
        return "heading"
    if _count_tables(stripped) > 0:
        return "table"
    if stripped.startswith("```"):
        return "code"
    if _count_formulas(stripped) > 0:
        return "formula"
    lines = [line for line in stripped.splitlines() if line.strip()]
    if lines and all(_is_list_line(line) for line in lines):
        return "list"
    return "paragraph"


def _flags_for_block(block_type: str, text: str) -> list[str]:
    flags: list[str] = [block_type]
    if block_type == "table" or _count_tables(text) > 0:
        flags.append("table")
    if block_type == "formula" or _count_formulas(text) > 0:
        flags.append("formula")
    if block_type == "code" or "```" in text:
        flags.append("code")
    return list(dict.fromkeys(flags))


def _resolve_page_for_offset(start: int, text_length: int, page_count: int) -> int:
    if page_count <= 1 or text_length <= 0:
        return 0
    ratio = max(0.0, min(0.999999, start / text_length))
    return min(page_count - 1, int(ratio * page_count))


def _extract_markdown_blocks(markdown: str, page_count: int) -> list[dict[str, Any]]:
    normalized = _sanitize_text(markdown)
    if not normalized:
        return []

    lines: list[dict[str, Any]] = []
    offset = 0
    for raw_line in normalized.splitlines(keepends=True):
        line_text = raw_line.rstrip("\n")
        line_start = offset
        offset += len(raw_line)
        lines.append({"text": line_text, "start": line_start, "end": line_start + len(line_text)})

    blocks: list[dict[str, Any]] = []
    heading_stack: list[tuple[int, str]] = []
    paragraph_lines: list[dict[str, Any]] = []

    def current_heading_path() -> list[str]:
        return [entry[1] for entry in heading_stack]

    def add_block(raw_text: str, start: int, end: int, block_type: str | None = None) -> None:
        text = _sanitize_text(raw_text)
        if not text:
            return
        resolved_type = block_type or _block_type_for_text(text)
        page = _resolve_page_for_offset(start, len(normalized), max(1, int(page_count or 1)))
        heading_path = current_heading_path()
        section_hint = " > ".join(heading_path) or text.splitlines()[0][:120].strip()
        block_index = len(blocks)
        blocks.append(
            {
                "id": f"docling-p{page + 1}-{block_index}",
                "page": page,
                "blockType": resolved_type,
                "sectionHint": section_hint[:160],
                "headingPath": heading_path,
                "text": text,
                "startChar": max(0, start),
                "endChar": max(max(0, start), end),
                "flags": _flags_for_block(resolved_type, text),
                "source": "docling",
            }
        )

    def flush_paragraph() -> None:
        nonlocal paragraph_lines
        if not paragraph_lines:
            return
        start = paragraph_lines[0]["start"]
        end = paragraph_lines[-1]["end"]
        text = "\n".join(line["text"] for line in paragraph_lines)
        add_block(text, start, end)
        paragraph_lines = []

    index = 0
    in_code = False
    code_lines: list[dict[str, Any]] = []
    while index < len(lines):
        line = lines[index]
        text = line["text"]
        stripped = text.strip()

        if stripped.startswith("```"):
            if not in_code:
                flush_paragraph()
                in_code = True
                code_lines = [line]
            else:
                code_lines.append(line)
                add_block(
                    "\n".join(entry["text"] for entry in code_lines),
                    code_lines[0]["start"],
                    code_lines[-1]["end"],
                    "code",
                )
                in_code = False
                code_lines = []
            index += 1
            continue

        if in_code:
            code_lines.append(line)
            index += 1
            continue

        if not stripped:
            flush_paragraph()
            index += 1
            continue

        heading_match = re.match(r"^(#{1,6})\s+(.+?)\s*$", stripped)
        if heading_match:
            flush_paragraph()
            level = len(heading_match.group(1))
            title = heading_match.group(2).strip()
            heading_stack = [entry for entry in heading_stack if entry[0] < level]
            heading_stack.append((level, title))
            add_block(stripped, line["start"], line["end"], "heading")
            index += 1
            continue

        if _is_table_start(lines, index):
            flush_paragraph()
            table_lines = [line, lines[index + 1]]
            index += 2
            while index < len(lines) and "|" in lines[index]["text"] and lines[index]["text"].strip():
                table_lines.append(lines[index])
                index += 1
            add_block(
                "\n".join(entry["text"] for entry in table_lines),
                table_lines[0]["start"],
                table_lines[-1]["end"],
                "table",
            )
            continue

        paragraph_lines.append(line)
        index += 1

    if in_code and code_lines:
        add_block(
            "\n".join(entry["text"] for entry in code_lines),
            code_lines[0]["start"],
            code_lines[-1]["end"],
            "code",
        )
    flush_paragraph()
    return blocks


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
    blocks = _extract_markdown_blocks(text, page_count)
    table_count = sum(1 for block in blocks if "table" in block.get("flags", []))
    formula_count = sum(1 for block in blocks if "formula" in block.get("flags", []))

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
        "blocks": blocks,
        "warnings": warnings,
        "metrics": {
            "tableCount": table_count,
            "formulaCount": formula_count,
            "chartCount": 0,
        },
    }
