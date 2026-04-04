# Datalab OSS Service

Self-hosted FastAPI extraction service for `stitch-app`.

It uses:

- `marker` as the primary extractor for PDF, Office, HTML, EPUB, and images
- `chandra` as the OCR-heavy fallback for weak PDF/image extraction

## Setup

```bash
cd datalab-oss-service
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
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
- `CHANDRA_METHOD`: `vllm` or `hf`, defaults to `vllm`

## Notes

- `marker-pdf[full]` is required for Office and EPUB support.
- `chandra` is used only as a fallback for OCR-heavy PDFs/images.
