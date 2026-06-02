# Convex SQLite and Postgres Website Benchmark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run the approved disposable-account website benchmark against the deployed SQLite production stack and Postgres staging stack, then remove the generated application records.

**Architecture:** Use one temporary Playwright harness under the gitignored `output/playwright/` directory. The harness drives each deployed website through the same guarded signup, onboarding, upload, route-load, settings, tutor, quiz, and low-concurrency read workflow. A shell cleanup helper obtains each self-hosted admin key from its backend container, invokes the existing restricted cleanup mutation with an explicit bootstrap-admin identity, and records dry-run, deletion, and post-cleanup verification results without persisting secrets.

**Tech Stack:** Node.js, Playwright, Convex self-hosted CLI, Bash, DigitalOcean-hosted Convex backends.

---

### Task 1: Create Temporary Browser Harness

**Files:**
- Create: `output/playwright/convex-db-website-benchmark/run-benchmark.mjs`

- [ ] **Step 1: Create the temporary Playwright harness**

Implement one sequential account journey per target:

```js
const targets = [
  { label: 'sqlite-production', baseUrl: 'https://www.chewnpour.com' },
  { label: 'postgres-staging', baseUrl: 'https://staging.chewnpour.com' },
];
```

For each target:

1. Create one `gate_dbbench_*@example.com` account.
2. Complete onboarding.
3. Measure authenticated page loads for `/dashboard`, `/dashboard/library`,
   `/dashboard/lessons`, `/dashboard/progress`, and `/dashboard/settings`.
4. Upload `Channel Ideas Without Remotion.pdf` once.
5. Poll `/dashboard/lessons` until the first `/dashboard/topic/:topicId` link
   appears or the bounded timeout expires.
6. When a topic appears, measure topic rendering, save settings after changing
   tutor style, ask one tutor question, start one topic quiz, and submit it when
   the rendered UI allows submission.
7. Use the authenticated storage state to run low-concurrency route loads with
   two browser contexts.
8. Write a redacted JSON report under
   `output/playwright/convex-db-website-benchmark/$RUN_ID/`.

- [ ] **Step 2: Check the temporary harness parses**

Run:

```bash
node --check output/playwright/convex-db-website-benchmark/run-benchmark.mjs
```

Expected: exit `0`.

### Task 2: Run Website Journeys

**Files:**
- Read: `output/playwright/convex-db-website-benchmark/run-benchmark.mjs`
- Write: `output/playwright/convex-db-website-benchmark/$RUN_ID/benchmark-report.json`

- [ ] **Step 1: Execute the website benchmark**

Run:

```bash
node output/playwright/convex-db-website-benchmark/run-benchmark.mjs
```

Expected: one JSON report containing one disposable email and timestamped step
results for each target. External-provider failures are recorded as blocked
steps and do not create replacement accounts.

- [ ] **Step 2: Inspect the report**

Run:

```bash
RUN_ID="$(find output/playwright/convex-db-website-benchmark -mindepth 1 -maxdepth 1 -type d -exec basename {} \\; | sort | tail -n 1)"
jq '{runId, targets: [.targets[] | {label, email, status, steps, errors}]}' \
  "output/playwright/convex-db-website-benchmark/$RUN_ID/benchmark-report.json"
```

Expected: both target labels appear, both emails begin with `gate_`, and each
successful step has an elapsed duration.

### Task 3: Clean Disposable Application Records

**Files:**
- Create: `output/playwright/convex-db-website-benchmark/cleanup-account.sh`
- Write: `output/playwright/convex-db-website-benchmark/$RUN_ID/cleanup-*.json`

- [ ] **Step 1: Create the temporary cleanup helper**

The helper must:

1. Accept target label, SSH host, Convex URL, and disposable email.
2. Reject emails outside `gate_*@example.com`.
3. Read the admin key transiently by running `/convex/generate_admin_key.sh`
   inside the target backend container.
4. Invoke:

```bash
npx convex run admin:cleanupDisposableE2EAccounts \
  "{\"email\":\"$EMAIL\",\"dryRun\":true,\"maxUsers\":1}" \
  --identity '{"subject":"benchmark-cleanup-admin","email":"patrickannor35@gmail.com"}' \
  --env-file "$TMP_ENV"
```

5. Repeat with `dryRun: false`.
6. Repeat with `dryRun: true` for post-cleanup verification.
7. Delete the temporary env file on exit.

- [ ] **Step 2: Check the cleanup helper syntax**

Run:

```bash
bash -n output/playwright/convex-db-website-benchmark/cleanup-account.sh
```

Expected: exit `0`.

- [ ] **Step 3: Run cleanup for SQLite production and Postgres staging**

Run the helper once for each disposable email from the browser report.

Expected: each pre-delete dry-run can report generated application records;
each deletion reports `dryRun: false`; each post-delete dry-run reports empty
application-record totals. Better Auth account rows remain by backend design.

### Task 4: Verify and Report

**Files:**
- Read: `output/playwright/convex-db-website-benchmark/$RUN_ID/benchmark-report.json`
- Read: `output/playwright/convex-db-website-benchmark/$RUN_ID/cleanup-*.json`
- Modify: `tasks/todo.md`

- [ ] **Step 1: Verify report safety and completeness**

Run:

```bash
RUN_ID="$(find output/playwright/convex-db-website-benchmark -mindepth 1 -maxdepth 1 -type d -exec basename {} \\; | sort | tail -n 1)"
jq -e '
  (.targets | length == 2)
  and ([.targets[].email | startswith("gate_") and endswith("@example.com")] | all)
' "output/playwright/convex-db-website-benchmark/$RUN_ID/benchmark-report.json"
```

Expected: `true`.

- [ ] **Step 2: Verify post-cleanup dry-runs**

Inspect each cleanup report and confirm the final dry-run has no generated
application-record totals for the disposable identity.

- [ ] **Step 3: Update the execution checklist**

Mark completed benchmark tasks in `tasks/todo.md` and add a concise review
summary. Keep raw emails, passwords, admin keys, and artifact paths out of the
committed review.

- [ ] **Step 4: Run repository diff checks**

Run:

```bash
git diff --check
git status --short --branch
```

Expected: no whitespace errors; only intentional documentation changes plus
the user's pre-existing workspace changes.

- [ ] **Step 5: Commit and push the checklist update**

Run:

```bash
git add stitch-app/tasks/todo.md
git commit -m "Record deployed database website benchmark"
git push origin codex/dashboard-dark-mode-toggle
```

Expected: commit and push succeed.
