---
name: qa-docling-service
description: >
  QA tests for the docling-service FastAPI extraction API, covering health,
  extraction contract behavior, auth, and validation failures.
---

# QA for docling-service

## Testing Target

### PR / diff validation

Use the checked-out branch code locally.

1. Create a venv: `python3 -m venv docling-service/.venv`
2. Install deps: `docling-service/.venv/bin/python -m pip install -e "./docling-service[dev]"`
3. Start the API: `docling-service/.venv/bin/python -m uvicorn render_api.app:app --app-dir docling-service --host 127.0.0.1 --port 10000`
4. Poll `http://127.0.0.1:10000/health`
5. Run API QA against the local service

### Manual smoke against a configured environment

If the user explicitly requests remote smoke coverage, use `QA_DOCLING_EXTRACT_URL` and `DOCLING_SHARED_SECRET` from the environment.

## Authentication in CI

Expected env vars:

- `QA_DOCLING_EXTRACT_URL`
- `DOCLING_SHARED_SECRET`

If `DOCLING_SHARED_SECRET` is set for the target environment, send it as `x-docling-shared-secret`.

## App-Specific Notes

- The service is a FastAPI adapter around Docling with `GET /health` and `POST /extract`.
- `/extract` expects multipart data with `file`, `contentType`, `profile`, and optional `maxPages`.
- Output should include `backend`, `kind`, `parser`, `text`, `charCount`, `pageCount`, `pages`, `blocks`, `warnings`, and `metrics`.

## Flow Menu

### HEALTH_SMOKE

Verify:

- `GET /health` returns `200`
- payload includes `{"status":"ok"}`

### EXTRACT_CONTRACT

Verify:

- a valid sample upload returns `200`
- `backend` is `docling`
- parser/kind fields are sensible for the sample
- `pages`, `blocks`, and `metrics` are populated

### SECRET_AUTH

Verify:

- when `DOCLING_SHARED_SECRET` is configured, a request without it fails with `401`
- a request with the correct header succeeds

### VALIDATION_ERRORS

Verify:

- invalid `maxPages` returns `400`
- empty upload returns `400`

### PARSER_KIND_INFERENCE

Verify:

- parser selection behaves correctly for representative pdf/docx/image samples
- `paddleocr_vl` mappings expose the expected warning when applicable

## Error Handling

- If the local server never reaches `/health`, report BLOCKED with the failing startup command.
- If sample extraction is too heavy for the environment, use the smallest representative fixture and document the limitation.
- If the remote environment URL is missing, report remote API coverage BLOCKED and continue with any local checks that are still relevant.

## Known Failure Modes

1. **Missing shared secret.** Remote `/extract` calls will return `401` when the environment expects `x-docling-shared-secret`.
2. **Heavy first-time dependency install.** Local Docling setup can be slow because the package and OCR-related system dependencies are large.
3. **System OCR helpers matter.** Some extraction paths rely on Poppler/Tesseract availability in the runtime environment.
4. **Empty uploads fail fast.** A blank file should return `400`; do not treat that as flaky behavior.
