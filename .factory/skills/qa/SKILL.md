---
name: qa
description: >
  Run QA tests for ChewnPour. Analyzes git diff to determine affected areas,
  runs configured browser and API flows with the right personas, and generates
  concise evidence-backed QA reports for PRs and smoke tests.
---

# QA Orchestrator

**SCOPE: This skill performs manual/functional QA only -- verifying that the application actually works by interacting with it as a real user would (browser or API). Do NOT run or report on CI checks, linting, ESLint, typecheck, unit tests, or static analysis.**

## Step 1: Load Configuration

Read `.factory/skills/qa/config.yaml` for environments, personas, credentials, cleanup rules, and app path mappings.

## Step 2: Determine Target Environment

Use `default_target` unless the user explicitly requests another environment.

- `production` is the default smoke target for this repo.
- Operator policy for this setup allows QA writes in production, but only when the chosen flow truly needs them.
- Paystack coverage must stay in sandbox/test mode.
- Cleanup must happen through the admin panel after any write-heavy run.

## Step 3: Analyze Git Diff

Run `git diff` and map changed files to apps using `config.yaml`.

- Load `.factory/skills/qa-stitch-app/SKILL.md` only if a changed file matches the `stitch-app` path patterns.
- Load `.factory/skills/qa-docling-service/SKILL.md` only if a changed file matches the `docling-service` path patterns.
- Files under `.factory/skills/**`, `.github/**`, docs, and other non-app paths do not count as app changes.
- If no app code changed, report `:grey_question: INCONCLUSIVE` with: `No app code changed -- QA not applicable for this diff.`

## Step 4: Pre-flight Checks (app-specific only)

Run pre-flight checks only for affected apps.

### Detected web strategy for this repo

Use **local dev server** for PR/diff validation.

Why:

- The repo documents Vercel preview behavior for the `staging` branch.
- No in-repo PR preview workflow or PR-comment preview discovery flow was detected.
- Therefore branch-code validation must use the checked-out branch locally.

If the task is a user-requested smoke test against a named environment instead of PR validation, the web sub-skill may use the configured remote environment URL.

## Step 5: Execute Diff-Relevant Flows Only

For each affected app:

1. Read the matching sub-skill.
2. Pick only the flows that directly verify the changed behavior plus nearby integration points.
3. Add ad-hoc tests when no menu flow covers the change.
4. Do not run unrelated flows.
5. Never silently skip a flow. If a flow cannot complete, report it as BLOCKED with what was tried and how the user can fix it.

## Step 6: Evidence Capture

Use text evidence first.

- For web app runs, use `agent-browser snapshot` accessibility trees after meaningful state changes.
- For API runs, capture the exact `curl` request summary and the relevant response body fields.
- Save screenshots and GIFs under `qa-results/$RUN_ID/` when visual evidence helps.
- Do not embed broken image links in the report.

## Step 7: Test Quality Gate

1. At least half of executed tests must directly validate the behavior changed by the diff.
2. Integration checks are valid when they prove the changed code still connects to adjacent systems.
3. Do not run unrelated features.
4. Do not run automated test suites from this skill.
5. Include at least one negative or boundary-condition check related to the diff when possible.
6. Mark the run `INCONCLUSIVE` if the diff intent cannot be explained clearly.

## Step 8: Handle Failures

- Continue to the next relevant flow even after a failure.
- Report setup blockers separately from product failures.
- If auth, secrets, local startup, or third-party prerequisites are missing, use `:no_entry: BLOCKED`.

## Step 9: Generate Report

Write `qa-results/report.md` using `.factory/skills/qa/REPORT-TEMPLATE.md`.

Rules:

- Start with `## QA Report`
- Use result emojis exactly:
  - `:white_check_mark: PASS`
  - `:x: FAIL`
  - `:no_entry: BLOCKED`
  - `:warning: FLAKY`
  - `:grey_question: INCONCLUSIVE`
- Keep the report concise.
- Do not report setup-only steps as test rows.
- Put all evidence inside a single collapsed `<details>` block.

## Step 10: Suggest Skill Updates

If a BLOCKED or FAIL result reveals a new environment-specific lesson not already covered in a sub-skill's `Known Failure Modes`:

1. Add a `## Suggested Skill Updates (N issues found)` section to the report.
2. Include a table with severity, target file, issue, and a copy-ready fix prompt.
3. Because `failure_learning` is set to `open_pr`, also write `qa-results/skill-updates.json`.

Use this JSON format:

```json
[
  {
    "file": ".factory/skills/qa-stitch-app/SKILL.md",
    "section": "Known Failure Modes",
    "action": "append",
    "content": "6. **Example issue.** Example fix guidance."
  }
]
```

Do not emit skill updates for selector bugs, expected PR changes, or issues already documented.
