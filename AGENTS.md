# Agent Instructions

## Repo Layout
- This repository contains two active projects:
- `stitch-app/`: React + Vite frontend with Convex functions.
- `docling-service/`: Python package plus FastAPI Docling extraction service (`render_api`).

## Global Rules
- Bugs: add a regression test when it fits.
- Keep changes scoped to the target project; avoid cross-project edits unless required.
- Do not commit secrets; use environment variables from `stitch-app/.env.example`.
- Do not manually edit generated Convex files in `stitch-app/convex/_generated/`.
- Use a hard cutover approach and never implement backward compatibility.
- Do not assume hosting, deployment targets, or runtime infrastructure from partial config or prior context. If the target is unclear, verify it from the repo, provider dashboards/CLIs, or the user before deploying or describing production state.
- Any time you make a change, create a git commit for that work and push it to GitHub unless the user explicitly says not to.

## stitch-app Workflow
- Setup: `cd stitch-app && npm install`.
- Local dev: `npm run dev`.
- Lint before handoff: `npm run lint`.
- Regression checks live in `stitch-app/scripts/*.test.mjs`; run targeted checks with `node scripts/<name>.test.mjs`.
- If you change processing navigation, topic outline/chunking, OCR extraction, or readability logic, add/update the matching regression script in `stitch-app/scripts/`.

## Convex Notes
- ChewnPour's authoritative Convex backend is self-hosted on DigitalOcean, not Convex Cloud. Always deploy and configure staging/production against the DigitalOcean-hosted Convex runtime unless the user explicitly says otherwise for that specific task.
- Do not deploy to, configure, or fall back to `*.convex.cloud` for staging or production. Before any Convex-related deploy or env change, verify `VITE_CONVEX_URL` and `CONVEX_URL` point at the DigitalOcean/self-hosted Convex URL.
- Do not run Convex Cloud deployment workflows such as `npx convex deploy` for staging/production unless the user explicitly requests Convex Cloud. If codegen is needed, use the configured self-hosted/local workflow and verify the target first.
- Convex schema/functions live in `stitch-app/convex/*.ts`.
- If schema or API signatures change, regenerate Convex outputs through the configured self-hosted/local workflow instead of hand-editing `_generated`.

## docling-service Workflow
- Setup: `cd docling-service && python -m venv .venv && source .venv/bin/activate && pip install -e ".[dev]"`.
- Test: `pytest` (or targeted `pytest tests/test_render_api_utils.py`).
- Run API locally: `uvicorn render_api.app:app --reload --port 10000`.
- System dependencies for full PDF extraction: Poppler and Tesseract (`poppler-utils`, `tesseract-ocr`).
- Prefer deterministic unit tests; mock external OCR/VLM/network dependencies where possible.
- Keep Python style compatible with Black/isort defaults (88-char line length).
