# Chewnpour architecture

This document describes the current master checkout reviewed on 2026-09-16. It is intentionally separated from older migration notes so contributors can distinguish live code boundaries from historical deployment experiments.

## System overview

~~~mermaid
flowchart LR
    browser[Browser]
    frontend[React and Vite frontend]
    api[Vercel-compatible API router]
    auth[Better Auth]
    db[(PostgreSQL)]
    storage[(Private Supabase Storage)]
    ai[LLM providers]
    vectors[Optional Voyage embeddings and pgvector]
    media[Deepgram speech services]
    extract[Document extraction and OCR]
    docling[Standalone FastAPI Docling service]
    worker[Eve study-agent]
    browser --> frontend
    frontend --> api
    api --> auth
    auth --> db
    api --> db
    api --> storage
    api --> ai
    api --> vectors
    api --> media
    api --> extract
    qa[GitHub Actions QA]
    qa -. optional extraction-service checks .-> docling
    worker --> db
    worker --> ai
    browser -. authenticated worker session .-> worker
~~~

## Current scope and legacy drift

The main application currently routes requests through stitch-app/api/router.js and server modules under stitch-app/server. The current checkout has no tracked stitch-app/convex directory. Current persistence is PostgreSQL and Supabase Storage, with migrations under stitch-app/supabase/migrations.

Several pre-existing files still describe Convex, SQLite, or older staging arrangements. These include parts of AGENTS.md, stitch-app/tasks/todo.md, historical migration notes, the dated security report, and QA skill configuration. They are retained as historical project material; they should not be read as proof of the current production architecture without re-verification.

## Frontend

The frontend is a React 19 single-page application built with Vite. The route table is in stitch-app/src/App.jsx. It includes public marketing, authentication, onboarding, lesson sharing, and protected study routes for the dashboard, uploads, lessons, quizzes, exams, AI tutor, progress, settings, and podcasts.

Some route entries intentionally render a paused-feature view or redirect. The architecture and README describe only the active study loop and identify paused surfaces where relevant.

Vite configures same-origin development proxies for the local API/auth server. The PWA plugin produces an installable app shell and limits navigation fallback to the public home route.

## API and server modules

The main server entrypoint is stitch-app/api/router.js. It dispatches requests for auth, profiles, uploads, courses, sharing, exams, podcasts, topics, quiz attempts, billing, progress, and admin operations. Dedicated handlers also exist for topic voice, podcast generation, Paystack webhooks, and the Sentry tunnel.

The deployment configuration in stitch-app/vercel.json rewrites API paths to the router and provides serverless duration and request configuration. The local development auth process is stitch-app/scripts/dev-auth-server.mjs and listens on port 8787 by default.

## Database and storage

stitch-app/server/db.js uses pg.Pool and DATABASE_URL to connect to PostgreSQL. The SQL migrations under stitch-app/supabase/migrations define Better Auth tables, profiles, uploads, courses, topics, questions, attempts, billing, payments, notes, progress, sharing, podcasts, exams, lesson checks, and study-worker sessions.

stitch-app/server/supabase.js uses Supabase service-role access for private object storage. The default bucket name in the environment template is study-uploads. Server-only service-role credentials must never be exposed to the browser.

The migrations include pgvector-backed topic passages and an HNSW index. Grounded vector retrieval is feature-flagged and disabled by default unless the required provider configuration is present.

## Authentication and authorization

Better Auth provides same-origin email/password authentication and can use Google OAuth when the relevant client variables are configured. Password-reset email delivery is optional and uses Resend when configured. Protected API handlers resolve the authenticated user before accessing user-owned data.

The study-agent has a separate worker-session path. It uses a signed HS256 worker token with an issuer and audience, checks session ownership in PostgreSQL, and applies lesson-scoped attributes. The worker instructions require responses to stay within uploaded or generated lesson context and not reveal other students' data or secrets.

## AI, tutoring, and media

Course generation uses an OpenAI-compatible HTTP client with provider selection and fallback logic for the configured Grid, DeepSeek, Bedrock-compatible, and Inception endpoints. The server normalizes generated topics and quiz content and includes source-boundary and prompt-injection defenses.

Tutor and topic-explanation flows use lesson context and can stream responses. Optional grounded retrieval uses Voyage embeddings stored in pgvector. The current default flag does not enable that retrieval path.

Deepgram handles configured speech-to-text and text-to-speech flows. Podcast generation creates a topic script, synthesizes host and guest audio, and records pending, running, failed, and ready states. The code includes stale-job handling and serverless duration guards; it does not contain a separate queue service or scheduler manifest.

Document handling supports PDF, DOCX, PPTX, and the configured audio formats in stitch-app/server/uploads.js. The current upload path uses in-process AnyDoc for supported documents, local extraction fallbacks, OCR.space for scanned PDFs when configured, and Deepgram for audio transcription.

## Standalone extraction service

docling-service is an independent Python package. render_api/app.py exposes GET /health and an authenticated multipart POST /extract endpoint. The service uses Docling, enforces configured upload limits, and fails closed for extraction requests when DOCLING_SHARED_SECRET is not configured unless explicit local-insecure behavior is enabled.

The service has a Dockerfile and a Render definition in render.yaml. The QA configuration also knows how to target an extraction-service URL for integration checks. The current main-app environment template says that no DOCLING variables are required for its in-process AnyDoc upload path. DigitalOcean App Platform manifests under .do/ also exist, but they point at a feature branch and must be verified before use. The repository files alone do not establish which service is currently serving production traffic.

## External services

Depending on configuration, the application integrates with:

- LLM endpoints configured through Grid, DeepSeek, Bedrock-compatible, or Inception variables.
- Deepgram for speech.
- Voyage for embeddings.
- OCR.space and document extraction libraries for scanned or structured documents.
- Google for optional OAuth.
- Resend and Cloudflare email variables for email delivery paths.
- Paystack for upload-credit billing and webhook handling.
- PostHog and Sentry for product analytics and error telemetry.

Provider keys, database URLs, signing secrets, and service-role credentials are server-side configuration. They are represented only by variable names in the checked-in examples.

## Background work and state

The application records state for uploads, courses, podcasts, attempts, progress, and worker sessions in PostgreSQL. Podcast generation and related provider calls may run through serverless handlers with explicit timeout and stale-state handling. No dedicated task queue is declared in the current repository.

## Deployment

The checked-in deployment targets are:

- stitch-app/vercel.json for the main Vercel-compatible web/API deployment.
- render.yaml and docling-service/Dockerfile for a containerized extraction service.
- .do/app.yaml and .do/app.scale-to-zero.yaml for DigitalOcean App Platform variants of the extraction service; both require current-branch and environment verification.

Treat these as deployment configuration, not as an authoritative inventory of live production. Verify the active frontend, API, database, storage, domains, secrets, and health checks in the hosting dashboards before changing infrastructure.

## Testing and QA flow

stitch-app has ESLint, Vite build, and a Node-based regression runner at stitch-app/scripts/run-all-tests.mjs. The runner discovers checked-in scripts/*.test.mjs files and skips live or provider-dependent tests by default.

docling-service uses pytest tests under docling-service/tests. study-agent declares typecheck and build scripts. The product-video package has its own Hyperframe lint and render tooling.

The GitHub Actions QA workflow at .github/workflows/qa.yml runs on pull requests and manual dispatch. It runs the PR-size gate, provisions Node 22 and Python 3.13, installs ImageMagick and Factory droid, runs the repository QA skill, uploads qa-results artifacts, and posts a pull-request report. The workflow's QA step is functional/manual QA; it does not replace package lint, typecheck, unit, or build checks.
