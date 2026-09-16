# Codex for Open Source application draft

This is an internal preparation document. It is not a public project description and should be reviewed against current GitHub and product analytics before submission.

## 1. Describe your role

I am Patrick Annor, the primary maintainer of Chewnpour. I own the architecture and maintainer workflow, triage issues, review pull requests, validate QA evidence, coordinate security reports, and prepare releases. I was the sole contributor to the repository in the last 12 months. The repository does not currently document a separate organization or delegated maintainer team.

## 2. Why does this repository qualify?

Draft answer, 500-character limit:

Chewnpour is a public open-source AI study workspace I primarily maintain. It has a React/Vite app, PostgreSQL/Supabase data layer, FastAPI extraction service, Eve study worker, automated QA, regression scripts, package tests, deployment configuration, and an active pull-request workflow. Current figures are 500 monthly active users, 1,000+ monthly uploads, and 12,000+ lessons; I was the sole contributor in the last 12 months.

## 3. How will you use API credits for your project?

Draft answer, 500-character limit:

I will use credits to improve Chewnpour's existing upload-to-study loop: test extraction, course and lesson generation, grounded tutor responses, quizzes, and failure recovery across supported materials. Credits will support reproducible engineering and QA iteration, not manufactured engagement, users, stars, downloads, or other metrics.

## 4. Anything else we should know?

Draft answer, 500-character limit:

I am documenting Chewnpour for transparent outside contribution with current setup, architecture, security, code-of-conduct, release, issue, and PR guidance. Current figures are 500 monthly active users, 1,000+ monthly uploads, 12,000+ lessons, and 99% deployment uptime; I was the sole contributor in the last 12 months. The frontend/API runs on Vercel and PostgreSQL/Storage uses Supabase. I will confirm metric definitions and reporting periods before submitting.

## Evidence checked

The following evidence was verified during this preparation and should be rechecked immediately before submission:

- The repository is public and the default branch is master.
- The reviewed GitHub snapshot had 2 open pull requests, 0 open issues, 0 stars, and 0 forks. These are repository metadata counts, not adoption claims.
- The maintainer provided current operating figures of 500 monthly active users, 1,000+ monthly uploads, 12,000+ lessons, and 99% deployment uptime. Verify the measurement definitions, time window, and source before submitting.
- The maintainer identifies Vercel as the frontend/API deployment and Supabase as the PostgreSQL/Storage backend. Verify the active production configuration before making time-sensitive claims.
- The reviewed checkout contained 418 tracked stitch-app script files matching scripts/*.test.mjs. The runner skips live and provider-dependent tests unless explicitly requested; the count is not a claim that all 418 tests pass.
- Running the full default runner in this checkout produced 152 passed, 62 failed, and 204 skipped tests. This is not a green baseline. Many failures reference retired Convex paths, old source locations, or historical UI contracts, but the failing set still needs maintainer triage before it is presented as evidence of release readiness.
- docling-service includes pytest contract tests for health, extraction, authentication, and upload validation.
- study-agent declares typecheck and build scripts.
- study-agent typecheck passed, and its Eve build passed under Node 24. The default local Node 22 install reports the package engine warning and cannot run the Eve build.
- stitch-app build passed. Its declared lint command reported 162 existing errors, and npm ci is currently blocked by a package-lock mismatch for @types/react; these should be triaged before being presented as a clean readiness signal.
- .github/workflows/qa.yml runs automated pull-request QA, uploads artifacts, and posts a report. The workflow uses repository secrets for configured test accounts and integrations.
- Two open pull requests were visible: #54 for a PWA reload prompt and #37 for an AnyDoc parsing cutover. Their checks and relevance should be rechecked before applying.
- The repository contains Vercel-compatible main-app configuration and Render/DigitalOcean extraction-service manifests. These files do not by themselves prove current production deployment.
- The public production homepage and signup page were inspected and captured for the README. No login, upload, or personal data was used.

## Information still required

- [INSERT SOURCE AND REPORTING WINDOW FOR THE 500 MONTHLY ACTIVE USERS FIGURE]
- [INSERT SOURCE AND DEFINITIONS FOR THE 1,000+ MONTHLY UPLOADS AND 12,000+ LESSONS FIGURES]
- [INSERT SOURCE AND MEASUREMENT WINDOW FOR THE 99% DEPLOYMENT UPTIME FIGURE]

Do not submit placeholders or replace them with estimates. If a metric cannot be verified from an appropriate source, say that it is unavailable.
