# Datalab OSS Service

Self-hosted FastAPI extraction service for `stitch-app`.

It uses:

- `marker` as the primary extractor for PDF, Office, HTML, EPUB, and images
- `chandra` as the OCR-heavy fallback for weak PDF/image extraction

## Setup

Use Python `3.11` or `3.12`. The model stack is not guaranteed on `3.14`.

On macOS, the fastest path is:

```bash
cd datalab-oss-service
chmod +x scripts/install_full_stack.sh
./scripts/install_full_stack.sh
```

That installs:

- `poppler`
- `LibreOffice`
- `.venv` for the FastAPI service and tests
- `.venv-marker` for `marker-pdf`
- `.venv-chandra` for `chandra-ocr`

```bash
cd datalab-oss-service
python3.12 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"

python3.12 -m venv .venv-marker
source .venv-marker/bin/activate
pip install "marker-pdf[full]>=1.10.2"
deactivate

python3.12 -m venv .venv-chandra
source .venv-chandra/bin/activate
pip install "chandra-ocr[hf]>=0.2.0"
deactivate
```

## Run

```bash
uvicorn render_api.app:app --reload --port 10000
```

## Environment

- `DATALAB_OSS_SHARED_SECRET`: optional shared secret for the `/extract` endpoint
- `DATALAB_OSS_MAX_FILE_SIZE_BYTES`: upload cap, defaults to `50MB`
- `MARKER_CLI`: marker executable, defaults to `marker_single`
- `MARKER_OUTPUT_FORMAT`: defaults to `markdown`
- `MARKER_USE_LLM`: optional, defaults to `false`
- `CHANDRA_CLI`: chandra executable, defaults to `chandra`
- `CHANDRA_METHOD`: `vllm` or `hf`, defaults to `hf`
- `HF_TOKEN`: optional, improves Hugging Face download rate limits
- `HF_HOME`: optional, moves the model cache to a larger disk location

## Notes

- The service auto-detects `./.venv-marker/bin/marker_single` and `./.venv-chandra/bin/chandra`.
- `marker-pdf[full]` is required for Office and EPUB support.
- Install LibreOffice locally if you want the best Office-format coverage.
- `poppler` is required for the PDF path.
- `chandra` is used only as a fallback for OCR-heavy PDFs/images.
- The first live extraction will download large local model weights for Marker and Chandra. Expect the first run to take materially longer than steady-state requests.
- In this workspace, Chandra reported it needs about `10.6 GB` of free space in the Hugging Face cache for its first model download. Plan disk capacity before enabling the fallback in production.
