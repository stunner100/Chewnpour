# Agent Instructions

## Repo Layout
- This repository contains two active projects:
- `stitch-app/`: React + Vite frontend with Convex functions.
- `datalab-oss-service/`: Self-hosted FastAPI extraction service built on Marker + Chandra (`render_api`).

## Global Rules
- Bugs: add a regression test when it fits.
- Keep changes scoped to the target project; avoid cross-project edits unless required.
- Do not commit secrets; use environment variables from `stitch-app/.env.example`.
- Do not manually edit generated Convex files in `stitch-app/convex/_generated/`.
- Use a hard cutover approach and never implement backward compatibility.
- Any time you make a change, create a git commit for that work and push it to GitHub unless the user explicitly says not to.

## stitch-app Workflow
- Setup: `cd stitch-app && npm install`.
- Local dev: `npm run dev`.
- Lint before handoff: `npm run lint`.
- Regression checks live in `stitch-app/scripts/*.test.mjs`; run targeted checks with `node scripts/<name>.test.mjs`.
- If you change processing navigation, topic outline/chunking, OCR extraction, or readability logic, add/update the matching regression script in `stitch-app/scripts/`.

## Convex Notes
- Convex schema/functions live in `stitch-app/convex/*.ts`.
- If schema or API signatures change, regenerate Convex outputs through the CLI (for example `npx convex dev`) instead of hand-editing `_generated`.

## datalab-oss-service Workflow
- Setup: `cd datalab-oss-service && python -m venv .venv && source .venv/bin/activate && pip install -e ".[dev]"`.
- Test: `pytest` (or targeted `pytest tests/test_extract_api_contract.py`).
- Run API locally: `uvicorn render_api.app:app --reload --port 10000`.
- System dependencies for best extraction quality may include GPU-enabled PyTorch, plus any native dependencies required by Marker/Chandra.
- Prefer deterministic unit tests; mock external CLI/model dependencies where possible.
- Keep Python style compatible with Black/isort defaults (88-char line length).
