from __future__ import annotations

import os
import re
import shutil
import subprocess
import tempfile
import json
from pathlib import Path
from typing import Literal, TypedDict, cast

FileKind = Literal["pdf", "image", "office", "html", "epub"]
Profile = Literal["marker", "marker_ocr", "chandra"]

PAGINATED_MARKDOWN_PAGE_PATTERN = re.compile(r"^\{(\d+)\}-{20,}\s*$", re.MULTILINE)
SUPPORTED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".bmp", ".gif", ".tif", ".tiff", ".webp"}
SUPPORTED_OFFICE_EXTENSIONS = {".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx"}
SUPPORTED_HTML_EXTENSIONS = {".html", ".htm"}
SUPPORTED_EPUB_EXTENSIONS = {".epub"}

SERVICE_ROOT = Path(__file__).resolve().parents[1]


def resolve_cli(default_name: str, env_var: str, relative_candidates: list[str]) -> str:
    explicit = str(os.getenv(env_var, "")).strip()
    if explicit:
        return explicit
    for relative_candidate in relative_candidates:
        candidate = SERVICE_ROOT / relative_candidate
        if candidate.exists():
            return str(candidate)
    return default_name


MARKER_CLI = resolve_cli(
    "marker_single",
    "MARKER_CLI",
    [
        ".venv-marker/bin/marker_single",
        ".venv-marker/bin/marker",
    ],
)
MARKER_OUTPUT_FORMAT = str(os.getenv("MARKER_OUTPUT_FORMAT", "markdown")).strip() or "markdown"
MARKER_USE_LLM = str(os.getenv("MARKER_USE_LLM", "")).strip().lower() in {"1", "true", "yes", "on"}
CHANDRA_CLI = resolve_cli(
    "chandra",
    "CHANDRA_CLI",
    [
        ".venv-chandra/bin/chandra",
    ],
)
CHANDRA_METHOD = str(os.getenv("CHANDRA_METHOD", "hf")).strip() or "hf"
EXTRACTION_TIMEOUT_MS = max(15000, int(os.getenv("DATALAB_OSS_TIMEOUT_MS", "240000")))


class CandidateMetrics(TypedDict, total=False):
    tableCount: int
    formulaCount: int
    chartCount: int


class CandidatePage(TypedDict, total=False):
    index: int
    text: str
    chars: int
    tableCount: int
    formulaCount: int
    source: str


class ExtractionCandidate(TypedDict):
    backend: Literal["datalab_oss"]
    kind: FileKind
    parser: Profile
    text: str
    charCount: int
    pageCount: int
    pages: list[CandidatePage]
    warnings: list[str]
    metrics: CandidateMetrics


def detect_file_kind(file_name: str, content_type: str | None) -> FileKind:
    normalized_content_type = str(content_type or "").split(";")[0].strip().lower()
    suffix = Path(file_name or "").suffix.lower()

    if normalized_content_type.startswith("image/") or suffix in SUPPORTED_IMAGE_EXTENSIONS:
        return "image"
    if normalized_content_type == "application/pdf" or suffix == ".pdf":
        return "pdf"
    if suffix in SUPPORTED_OFFICE_EXTENSIONS:
        return "office"
    if suffix in SUPPORTED_HTML_EXTENSIONS:
        return "html"
    if suffix in SUPPORTED_EPUB_EXTENSIONS:
        return "epub"

    raise ValueError("Unsupported file type. Upload PDF, Office, EPUB, HTML, or image files.")


def default_profile_for_kind(kind: FileKind) -> Profile:
    return "marker"


def normalize_requested_profile(kind: FileKind, profile: str | None) -> Profile:
    requested = str(profile or "").strip().lower() or default_profile_for_kind(kind)
    normalized = cast(Profile, requested)

    allowed_profiles = {
        "pdf": {"marker", "marker_ocr", "chandra"},
        "image": {"marker", "marker_ocr", "chandra"},
        "office": {"marker"},
        "html": {"marker"},
        "epub": {"marker"},
    }
    if normalized not in allowed_profiles[kind]:
        raise ValueError(f"Unsupported extraction profile '{requested}' for {kind}.")
    return normalized


def sanitize_text(value: str) -> str:
    text = str(value or "")
    text = text.replace("\u0000", "")
    text = text.replace("\r\n", "\n")
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def normalize_extracted_text(value: str) -> str:
    text = sanitize_text(value)
    text = re.sub(r"!\[[^\]]*\]\(([^)]+)\)", " ", text)
    text = re.sub(r"^#{1,6}\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\s*[-*+]\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\s*>\s?", "", text, flags=re.MULTILINE)
    text = re.sub(r"`([^`]+)`", r"\1", text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
    text = re.sub(r"__([^_]+)__", r"\1", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    return text.strip()


def lexical_ratio(value: str) -> float:
    text = str(value or "")
    if not text:
        return 0.0
    letter_like = len(re.findall(r"[A-Za-z0-9]", text))
    return letter_like / max(len(text), 1)


def count_markdown_tables(value: str) -> int:
    return len(re.findall(r"^\|.+\|$", str(value or ""), flags=re.MULTILINE))


def count_formula_markers(value: str) -> int:
    return len(re.findall(r"\$[^$\n]+\$", str(value or "")))


def parse_paginated_markdown(markdown: str) -> list[CandidatePage]:
    source = sanitize_text(markdown)
    matches = list(PAGINATED_MARKDOWN_PAGE_PATTERN.finditer(source))
    if not matches:
        return []

    pages: list[CandidatePage] = []
    for idx, match in enumerate(matches):
        page_index = max(0, int(match.group(1) or idx))
        start = match.end()
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(source)
        page_markdown = normalize_extracted_text(source[start:end])
        if not page_markdown:
            continue
        pages.append({
            "index": page_index,
            "text": page_markdown,
            "chars": len(page_markdown),
            "tableCount": count_markdown_tables(page_markdown),
            "formulaCount": count_formula_markers(page_markdown),
            "source": "datalab_oss",
        })
    return pages


def build_candidate_pages(value: str, *, target_chars_per_page: int = 2600) -> list[CandidatePage]:
    paginated = parse_paginated_markdown(value)
    if paginated:
        return paginated

    text = normalize_extracted_text(value)
    if not text:
        return []

    paragraphs = [chunk.strip() for chunk in re.split(r"\n{2,}", text) if chunk.strip()]
    if not paragraphs:
        return [{
            "index": 0,
            "text": text,
            "chars": len(text),
            "tableCount": count_markdown_tables(text),
            "formulaCount": count_formula_markers(text),
            "source": "datalab_oss",
        }]

    pages: list[CandidatePage] = []
    current = ""
    for paragraph in paragraphs:
        candidate = paragraph if not current else f"{current}\n\n{paragraph}"
        if current and len(candidate) > target_chars_per_page:
            pages.append({
                "index": len(pages),
                "text": current,
                "chars": len(current),
                "tableCount": count_markdown_tables(current),
                "formulaCount": count_formula_markers(current),
                "source": "datalab_oss",
            })
            current = paragraph
            continue
        current = candidate

    if current:
        pages.append({
            "index": len(pages),
            "text": current,
            "chars": len(current),
            "tableCount": count_markdown_tables(current),
            "formulaCount": count_formula_markers(current),
            "source": "datalab_oss",
        })

    return pages


def build_candidate(
    *,
    kind: FileKind,
    parser: Profile,
    text: str,
    warnings: list[str] | None = None,
) -> ExtractionCandidate:
    normalized_text = normalize_extracted_text(text)
    pages = build_candidate_pages(text)
    if not pages and normalized_text:
        pages = [{
            "index": 0,
            "text": normalized_text,
            "chars": len(normalized_text),
            "tableCount": count_markdown_tables(normalized_text),
            "formulaCount": count_formula_markers(normalized_text),
            "source": "datalab_oss",
        }]

    return {
        "backend": "datalab_oss",
        "kind": kind,
        "parser": parser,
        "text": normalized_text,
        "charCount": len(normalized_text),
        "pageCount": max(len(pages), 1 if normalized_text else 0),
        "pages": pages,
        "warnings": list(warnings or []),
        "metrics": {
            "tableCount": sum(int(page.get("tableCount", 0)) for page in pages),
            "formulaCount": sum(int(page.get("formulaCount", 0)) for page in pages),
            "chartCount": 0,
        },
    }


def read_first_output(root_dir: Path) -> str:
    markdown_files = sorted(root_dir.rglob("*.md"))
    for markdown_path in markdown_files:
        raw = markdown_path.read_text(encoding="utf-8", errors="ignore")
        cleaned = sanitize_text(raw)
        if cleaned:
            return cleaned
    html_files = sorted(root_dir.rglob("*.html"))
    for html_path in html_files:
        raw = html_path.read_text(encoding="utf-8", errors="ignore")
        cleaned = sanitize_text(raw)
        if cleaned:
            return cleaned
    return ""


def run_cli(command: list[str], *, timeout_ms: int = EXTRACTION_TIMEOUT_MS) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        check=False,
        capture_output=True,
        text=True,
        timeout=max(15, timeout_ms / 1000),
    )


def run_marker_extract(file_path: Path, *, force_ocr: bool, max_pages: int | None) -> tuple[str, list[str]]:
    warnings: list[str] = []
    with tempfile.TemporaryDirectory(prefix="marker_extract_") as output_dir:
        config_path = Path(output_dir) / "marker_config.json"
        config_path.write_text(
            json.dumps({
                "paginate_output": True,
            }),
            encoding="utf-8",
        )
        command = [
            MARKER_CLI,
            str(file_path),
            "--output_dir",
            output_dir,
            "--output_format",
            MARKER_OUTPUT_FORMAT,
            "--config_json",
            str(config_path),
        ]
        if force_ocr:
            command.append("--force_ocr")
        if MARKER_USE_LLM:
            command.append("--use_llm")
        if max_pages is not None and max_pages > 0:
            command.extend(["--page_range", f"0-{max_pages - 1}"])

        result = run_cli(command)
        if result.returncode != 0:
            stderr = sanitize_text(result.stderr)
            raise RuntimeError(stderr or "marker extraction failed")

        text = read_first_output(Path(output_dir))
        if not text:
            warnings.append("marker_empty_output")
        return text, warnings


def run_chandra_extract(file_path: Path, *, max_pages: int | None) -> tuple[str, list[str]]:
    warnings: list[str] = []
    with tempfile.TemporaryDirectory(prefix="chandra_extract_") as output_dir:
        command = [CHANDRA_CLI, str(file_path), output_dir]
        if CHANDRA_METHOD:
            command.extend(["--method", CHANDRA_METHOD])
        if max_pages is not None and max_pages > 0:
            command.extend(["--page-range", f"1-{max_pages}"])

        result = run_cli(command)
        if result.returncode != 0:
            stderr = sanitize_text(result.stderr)
            raise RuntimeError(stderr or "chandra extraction failed")

        text = read_first_output(Path(output_dir))
        if not text:
            warnings.append("chandra_empty_output")
        return text, warnings


def should_escalate_to_chandra(kind: FileKind, text: str) -> bool:
    normalized = normalize_extracted_text(text)
    if kind not in {"pdf", "image"}:
        return False
    if len(normalized) < 180:
        return True
    if lexical_ratio(normalized) < 0.45:
        return True
    return False


def extract_candidate(
    file_path: Path,
    file_name: str,
    content_type: str | None,
    profile: str | None = None,
    max_pages: int | None = None,
) -> ExtractionCandidate:
    kind = detect_file_kind(file_name=file_name, content_type=content_type)
    normalized_profile = normalize_requested_profile(kind, profile)

    warnings: list[str] = []
    if normalized_profile == "chandra":
        text, chandra_warnings = run_chandra_extract(file_path, max_pages=max_pages)
        return build_candidate(kind=kind, parser="chandra", text=text, warnings=chandra_warnings)

    force_ocr = normalized_profile == "marker_ocr"
    marker_text = ""
    try:
        marker_text, marker_warnings = run_marker_extract(
            file_path,
            force_ocr=force_ocr,
            max_pages=max_pages,
        )
        warnings.extend(marker_warnings)
    except Exception as error:
        warnings.append("marker_failed")
        if kind not in {"pdf", "image"}:
            raise
        warnings.append(f"marker_error:{sanitize_text(str(error))}")

    if kind in {"pdf", "image"} and (not marker_text or should_escalate_to_chandra(kind, marker_text)):
        if marker_text:
            warnings.append("marker_weak_output")
        try:
            chandra_text, chandra_warnings = run_chandra_extract(file_path, max_pages=max_pages)
            warnings.extend(chandra_warnings)
            if len(normalize_extracted_text(chandra_text)) >= len(normalize_extracted_text(marker_text)):
                return build_candidate(kind=kind, parser="chandra", text=chandra_text, warnings=warnings)
        except Exception as error:
            warnings.append("chandra_failed")
            warnings.append(f"chandra_error:{sanitize_text(str(error))}")

    return build_candidate(kind=kind, parser=normalized_profile, text=marker_text, warnings=warnings)
