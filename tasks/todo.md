# Staging Banner

- [completed] Audit the existing app shell and choose one top-level insertion point for a staging-only banner.
- [completed] Add a visible staging banner that appears on the staging hostname(s) but never on production.
- [completed] Verify the build, then commit and push only the staging-banner changes.

## Review

- Added a fixed staging-only banner for `staging.chewnpour.com` and Vercel `git-staging` preview hosts.
- Added a runtime hostname detector in `src/lib/runtimeEnvironment.js` so production stays untouched.
- Offset the app shell when the banner is active so the dashboard layout still fits the viewport.
- Verified `npm run build`.
- Verified focused lint on `src/App.jsx`, `src/components/StagingBanner.jsx`, and `src/lib/runtimeEnvironment.js`.
