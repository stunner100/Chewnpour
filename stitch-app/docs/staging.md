# Staging Environment

This project uses:

- Local development: `vite` + a non-production Convex deployment from `.env.local`
- Staging: the Vercel `Preview` deployment for the `staging` Git branch + a non-production Convex deployment
- Production: Vercel `Production` + the production Convex deployment

## Rule

Never point a preview deployment at the production Convex URL.

If a preview frontend talks to production Convex, you are no longer testing in
staging. You are testing against live data and live side effects.

## Repo Guardrail

[vite.config.js](/Users/patrickannor/Desktop/stitch_onboarding_name/stitch-app/vite.config.js)
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
  - `VITE_CONVEX_URL` = production Convex deployment URL
  - `CONVEX_URL` = production Convex deployment URL when serverless functions need it

- `Preview (staging branch)`
  - git branch = `staging`
  - `VITE_CONVEX_URL` = staging Convex deployment URL
  - `CONVEX_URL` = staging Convex deployment URL for serverless functions
  - `VITE_SENTRY_ENVIRONMENT=staging`

## Convex Mapping

Use a non-production Convex deployment for staging.

Recommended:

- local development uses one dev deployment
- staging uses a dedicated dev/preview deployment
- production uses the production deployment

At minimum, staging must not use the production Convex deployment.

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
npx vercel env add VITE_CONVEX_URL preview staging --force --value "https://<staging-deployment>.convex.cloud" --yes
npx vercel env add CONVEX_URL preview staging --force --value "https://<staging-deployment>.convex.cloud" --yes
npx vercel env add VITE_SENTRY_ENVIRONMENT preview staging --force --value "staging" --yes
```

Set Production to the live Convex deployment:

```bash
npx vercel env add VITE_CONVEX_URL production --force --value "https://<prod-deployment>.convex.cloud" --yes
```

## Stable Staging URL

If you want auth, callbacks, and QA links to be fully predictable, add a fixed
staging hostname such as `staging.chewnpour.com` and point it at the Vercel
preview deployment you use for QA.

That is better than relying on one-off preview URLs.

## Current Setup

The repo now has a remote `staging` branch and Vercel branch-scoped Preview
environment variables for that branch.
