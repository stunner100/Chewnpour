#!/usr/bin/env python3
"""Replace Material Symbols spans with <AppIcon />."""
from __future__ import annotations

import re
from pathlib import Path

SRC = Path(__file__).resolve().parents[1] / "src"


def import_path_for(file: Path) -> str:
    rel = file.relative_to(SRC)
    depth = len(rel.parts) - 1
    if rel.parts[0] == "components" and depth == 1:
        return "./AppIcon"
    if rel.parts[0] == "components":
        return ("../" * (depth - 1)) + "AppIcon"
    return ("../" * depth) + "components/AppIcon"


def ensure_import(text: str, file: Path) -> str:
    if re.search(r"import\s+AppIcon\s+from\s+['\"]", text):
        return text
    imp = f"import AppIcon from '{import_path_for(file)}';\n"
    lines = text.splitlines(keepends=True)
    last_import = -1
    for i, line in enumerate(lines):
        if line.startswith("import "):
            last_import = i
            # absorb multi-line import
            while last_import + 1 < len(lines) and (
                "from " not in lines[last_import]
                or (
                    not lines[last_import].rstrip().endswith(";")
                    and not lines[last_import].rstrip().endswith("'")
                    and not lines[last_import].rstrip().endswith('"')
                    and "from " not in lines[last_import]
                )
            ):
                # simpler: advance until line contains from '
                if "from '" in lines[last_import] or 'from "' in lines[last_import]:
                    break
                last_import += 1
                if last_import >= len(lines):
                    break
            # find true end
            j = i
            while j < len(lines):
                if "from '" in lines[j] or 'from "' in lines[j]:
                    last_import = j
                    break
                j += 1
    if last_import >= 0:
        lines.insert(last_import + 1, imp)
    else:
        lines.insert(0, imp)
    return "".join(lines)


SPAN_RE = re.compile(
    r"<span(?P<attrs>[^>]*\bmaterial-symbols-outlined\b[^>]*)>(?P<body>.*?)</span>",
    re.DOTALL,
)


def transform_span(match: re.Match[str]) -> str:
    attrs = match.group("attrs")
    body = match.group("body").strip()

    class_match = re.search(r'className=(?P<q>["\'])(?P<cls>.*?)(?P=q)', attrs)
    cls = class_match.group("cls") if class_match else ""
    cls = re.sub(r"\s*material-symbols-outlined\s*", " ", cls).strip()
    cls = re.sub(r"\s+", " ", cls)

    style_attr = ""
    style_match = re.search(r"style=\{(?P<style>.*?)\}", attrs, re.DOTALL)
    if style_match:
        style = style_match.group("style").strip()
        style_clean = re.sub(
            r",?\s*fontVariationSettings:\s*(?:'[^']*'|\"[^\"]*\"|`[^`]*`)",
            "",
            style,
        )
        style_clean = re.sub(
            r"fontVariationSettings:\s*(?:'[^']*'|\"[^\"]*\"|`[^`]*`)\s*,?\s*",
            "",
            style_clean,
        ).strip()
        if style_clean not in ("", "{}", "undefined"):
            style_attr = f" style={{{style_clean}}}"

    aria = ' aria-hidden="true"' if "aria-hidden" in attrs else ""

    if body.startswith("{") and body.endswith("}"):
        name_attr = f" name={body}"
    elif re.fullmatch(r"[a-z0-9_]+", body):
        name_attr = f' name="{body}"'
    else:
        return match.group(0)

    class_attr = f' className="{cls}"' if cls else ""
    return f"<AppIcon{name_attr}{class_attr}{aria}{style_attr} />"


def strip_local_material_icon(text: str) -> str:
    return re.sub(
        r"const MaterialIcon\s*=\s*\([^)]*\)\s*=>\s*\([\s\S]*?\);\n*",
        "",
        text,
    )


def replace_material_icon_usages(text: str) -> str:
    def repl(match: re.Match[str]) -> str:
        attrs = match.group("attrs")
        name = match.group("body").strip()
        class_match = re.search(r"className=(?P<q>['\"])(?P<cls>.*?)(?P=q)", attrs)
        class_attr = f' className="{class_match.group("cls")}"' if class_match else ""
        return f'<AppIcon name="{name}"{class_attr} />'

    return re.sub(
        r"<MaterialIcon(?P<attrs>[^>]*)>(?P<body>\s*[a-z0-9_]+\s*)</MaterialIcon>",
        repl,
        text,
    )


def main() -> None:
    changed: list[str] = []
    for path in list(SRC.rglob("*.jsx")) + list(SRC.rglob("*.js")):
        text = path.read_text(encoding="utf-8")
        if "material-symbols-outlined" not in text and "MaterialIcon" not in text:
            continue
        original = text
        text = SPAN_RE.sub(transform_span, text)
        text = replace_material_icon_usages(text)
        text = strip_local_material_icon(text)
        if text != original:
            if "AppIcon" in text:
                text = ensure_import(text, path)
            path.write_text(text, encoding="utf-8")
            changed.append(str(path.relative_to(SRC.parent)))

    print(f"updated {len(changed)} files")
    remaining = []
    for path in list(SRC.rglob("*.jsx")) + list(SRC.rglob("*.js")):
        content = path.read_text(encoding="utf-8")
        if "material-symbols-outlined" in content:
            remaining.append(str(path.relative_to(SRC.parent)))
    print(f"remaining material-symbols: {len(remaining)}")
    for item in remaining[:40]:
        print(item)


if __name__ == "__main__":
    main()
