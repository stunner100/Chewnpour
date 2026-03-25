# Staging Setup

- [completed] Audit the current Vercel + Convex environment split and identify any prod fallbacks.
- [completed] Remove build-time fallback behavior that can point preview deployments at production Convex.
- [completed] Add repo documentation/templates for local, preview/staging, and production environment wiring.
- [completed] Update the linked Vercel Preview environment to use the non-production Convex deployment for the `staging` branch.
- [completed] Verify the build and environment state, then commit and push the staging setup changes.

## Review

- `vite.config.js` now allows `config/convex.public.json` fallback only during local `vite` serve.
- Added `stitch-app/docs/staging.md` and updated `README.md` / `.env.example` to document the staging model.
- Created branch-scoped Vercel Preview env vars for `staging`: `VITE_CONVEX_URL`, `CONVEX_URL`, and `VITE_SENTRY_ENVIRONMENT`.
- Verified the `staging` Preview env resolves to the same non-production Convex URL as local dev.
- Verified `node scripts/convex-url-cutover-regression.test.mjs`.
- Verified `npm run build`.
