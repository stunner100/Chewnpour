#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON_BIN="${PYTHON_BIN:-python3.12}"
MIN_FREE_KB=$((15 * 1024 * 1024))

if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  echo "Expected $PYTHON_BIN on PATH." >&2
  exit 1
fi

if ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew is required to install LibreOffice on macOS." >&2
  exit 1
fi

FREE_KB="$(df -Pk "$HOME" | awk 'NR==2 {print $4}')"
if [ -n "$FREE_KB" ] && [ "$FREE_KB" -lt "$MIN_FREE_KB" ]; then
  echo "Warning: less than 15 GB free on the home volume." >&2
  echo "Chandra model downloads need roughly 11 GB in the Hugging Face cache." >&2
  echo "Free space or point HF_HOME to a larger volume before the first live extraction." >&2
fi

brew list --versions poppler >/dev/null 2>&1 || brew install poppler
brew list --cask libreoffice >/dev/null 2>&1 || brew install --cask libreoffice

cd "$ROOT_DIR"

"$PYTHON_BIN" -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
deactivate

"$PYTHON_BIN" -m venv .venv-marker
source .venv-marker/bin/activate
pip install "marker-pdf[full]>=1.10.2"
deactivate

"$PYTHON_BIN" -m venv .venv-chandra
source .venv-chandra/bin/activate
pip install "chandra-ocr[hf]>=0.2.0"
deactivate

cat <<'EOF'

Installed:
- service env: .venv
- marker env: .venv-marker
- chandra env: .venv-chandra

Next:
- export DATALAB_OSS_SHARED_SECRET if you want auth on /extract
- export HF_TOKEN for faster Hugging Face downloads and higher rate limits
- export HF_HOME if you want model weights stored on a larger volume
- run: uvicorn render_api.app:app --reload --port 10000
EOF
