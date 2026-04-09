#!/usr/bin/env python3

import json
import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) != 2:
        print(json.dumps({"error": "expected a single input path"}), file=sys.stderr)
        return 2

    input_path = Path(sys.argv[1]).expanduser().resolve()
    if not input_path.exists():
        print(json.dumps({"error": f"input file not found: {input_path}"}), file=sys.stderr)
        return 2

    try:
        from markitdown import MarkItDown
    except Exception as error:  # pragma: no cover - runtime dependency path
        print(
            json.dumps(
                {
                    "error": (
                        "markitdown is not installed. "
                        "Install it with: pip install 'markitdown[pdf,docx,pptx]'"
                    ),
                    "details": str(error),
                }
            ),
            file=sys.stderr,
        )
        return 3

    try:
        converter = MarkItDown(enable_plugins=False)
        result = converter.convert(str(input_path))
        markdown = getattr(result, "text_content", "") or ""
    except Exception as error:
        print(json.dumps({"error": "markitdown conversion failed", "details": str(error)}), file=sys.stderr)
        return 4

    sys.stdout.write(
        json.dumps(
            {
                "markdown": markdown,
                "warnings": [],
            }
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
