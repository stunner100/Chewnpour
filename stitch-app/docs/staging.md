# Staging Environment

This project uses:

- Local development: `vite` + a non-production Convex deployment from `.env.local`
- Staging: the Vercel `Preview` deployment for the `staging` Git branch + the staging DigitalOcean-hosted Convex deployment
- Production: Vercel `Production` + the production DigitalOcean-hosted Convex deployment

## Rule

Never point a preview deployment at the production Convex URL.

If a preview frontend talks to production Convex, you are no longer testing in
staging. You are testing against live data and live side effects.

ChewnPour's Convex backend is self-hosted on DigitalOcean. Do not deploy to,
configure, or fall back to `*.convex.cloud` for staging or production unless the
user explicitly requests Convex Cloud for that specific task.

The Vite production build refuses `*.convex.cloud` targets by default. The
`ALLOW_CONVEX_CLOUD_DEPLOY=true` override exists only for a one-off task where
the user explicitly asks to use Convex Cloud.

## Repo Guardrail

[vite.config.js](../vite.config.js)
only allows the checked-in `config/convex.public.json` fallback during local
`vite` serve. Real builds must get `VITE_CONVEX_URL` or `CONVEX_URL` from the
environment.

That means:

- local dev can stay convenient
- preview builds must explicitly target staging
- production builds must explicitly target production

## Vercel Mapping

Configure Vercel environments like this:

- `Production`
  - `VITE_CONVEX_URL` = production DigitalOcean-hosted Convex URL
  - `CONVEX_URL` = production DigitalOcean-hosted Convex URL when serverless functions need it

- `Preview (staging branch)`
  - git branch = `staging`
  - `VITE_CONVEX_URL` = staging DigitalOcean-hosted Convex URL
  - `CONVEX_URL` = staging DigitalOcean-hosted Convex URL for serverless functions
  - `VITE_SENTRY_ENVIRONMENT=staging`

## Convex Mapping

Use a non-production DigitalOcean-hosted Convex deployment for staging.

Recommended:

- local development uses one dev deployment
- staging uses a dedicated dev/preview deployment
- production uses the production deployment

At minimum, staging must not use the production Convex deployment.

## Extraction

Upload finalize extracts PDF/DOCX/PPTX in-process with `@firecrawl/anydoc`
(Markdown). No `DOCLING_*` env vars are required on Vercel. Scanned or
image-only PDFs are deferred (OCR is not enabled in this path). Local
text extraction remains a fallback if anydoc fails to load.

## Current Workflow

1. Push to the `staging` branch.
2. Vercel creates or refreshes the `staging` Preview deployment.
3. That deployment uses the staging Convex URL from the branch-scoped Preview env.
4. Test there.
5. Promote to production by merging the validated changes into the production branch.

## Useful Commands

Pull preview env locally:

```bash
npx vercel env pull .vercel/.env.preview.staging.local --environment=preview --git-branch staging
```

Set the `staging` branch Preview deployment to a staging Convex deployment:

```bash
npx vercel env add VITE_CONVEX_URL preview staging --force --value "https://<staging-digitalocean-convex-host>" --yes
npx vercel env add CONVEX_URL preview staging --force --value "https://<staging-digitalocean-convex-host>" --yes
npx vercel env add VITE_SENTRY_ENVIRONMENT preview staging --force --value "staging" --yes
```

Set Production to the live Convex deployment:

```bash
npx vercel env add VITE_CONVEX_URL production --force --value "https://<production-digitalocean-convex-host>" --yes
npx vercel env add CONVEX_URL production --force --value "https://<production-digitalocean-convex-host>" --yes
```

## Stable Staging URL

If you want auth, callbacks, and QA links to be fully predictable, add a fixed
staging hostname such as `staging.chewnpour.com` and point it at the Vercel
preview deployment you use for QA.

That is better than relying on one-off preview URLs.

## Current Setup

The repo now has a remote `staging` branch and Vercel branch-scoped Preview
environment variables for that branch.
