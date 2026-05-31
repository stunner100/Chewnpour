# Convex SQLite and Postgres Website Benchmark

## Plan

- [x] Inspect deployed frontend targets, backend persistence, guarded cleanup,
  and existing authenticated E2E patterns.
- [x] Agree on the production-write safety boundary and benchmark design.
- [x] Review the committed design checkpoint with the user.
- [x] Write the execution plan for the approved deployed website benchmark.
- [x] Create a temporary Playwright benchmark harness outside committed source.
- [x] Run the approved disposable-account website journey against SQLite
  production.
- [x] Attempt the approved disposable-account website journey against Postgres
  staging. The deployed auth endpoint rejected the staging frontend origin at
  CORS preflight before authenticated workload timing could begin.
- [x] Run guarded cleanup dry-run, deletion, and post-cleanup verification for
  both accounts.
- [x] Summarize database-heavy route timings, provider timings, errors, cleanup
  evidence, and interpretation limits.

## Review

The website-real comparison cannot rank SQLite against Postgres yet. The
Postgres staging frontend at `https://staging.chewnpour.com` is blocked before
signup because `https://staging-site.164-92-178-122.sslip.io` does not return an
`Access-Control-Allow-Origin` header for the staging frontend origin.

SQLite production results from `https://www.chewnpour.com`:

- Fresh signup and onboarding: `13.5s`.
- Retained disposable-account login settle: `42.0s` in the final pass.
- Initial protected routes: dashboard `657ms`, library `1.28s`, lessons
  `2.60s`, progress `1.14s`, settings `1.42s`.
- Settings write: `3.77s`.
- Upload kickoff and library redirect for the `53,660` byte PDF fixture:
  `10.41s`.
- Two concurrent route-read workers completed the standard route sweep in
  `8.90s` wall time. Mean per-route timings were dashboard `3.18s`, library
  `774ms`, lessons `1.08s`, progress `2.07s`, and settings `1.38s`.

The extraction/provider phase did not expose a lesson link within the
eight-minute guard (`487.57s`). Cleanup evidence confirmed that the upload still
created `1` upload, `1` course, `7` topics, and `44` evidence passages. Tutor and
quiz timing could not run because the website did not expose a generated lesson
link.

All guarded cleanup post-checks passed with zero residual app-data counts.
Production intentionally retains the Better Auth disposable account row because
the cleanup mutation removes app records only. Raw reports and temporary
harnesses remain gitignored under
`output/playwright/convex-db-website-benchmark/`.

## Postgres Staging Auth Repair

### Plan

- [x] Reproduce the staging auth failure with an HTTP preflight request.
- [x] Compare checked-in CORS origins, staging container env, staging Convex
  deployment env, and the working production deployment env.
- [x] Propagate the staging application values from `/opt/convex/.env` into the
  self-hosted staging Convex deployment env.
- [x] Verify staging auth preflight returns CORS `204` for
  `https://staging.chewnpour.com`.
- [x] Verify a disposable staging signup can reach the authenticated dashboard.
- [x] Rerun the Postgres staging website benchmark and guarded cleanup.
- [x] Record the repaired Postgres measurements and comparison limits.

### Diagnosis

The checked-in Better Auth CORS route already allows
`https://staging.chewnpour.com`. The staging container also has its persisted
application values in `/opt/convex/.env`, including `BETTER_AUTH_SECRET`.
However, `npx convex env list` against the self-hosted staging deployment
reported `No environment variables set.` HTTP functions read the Convex
deployment env, so staging Better Auth initialized with its default secret and
returned HTTP `500` before CORS headers could be emitted.

### Review

Propagated the `56` production-derived application variable names from the
staging host into the self-hosted staging Convex deployment env using the
staging values. Container-only infrastructure variables such as `POSTGRES_URL`,
`CONVEX_*`, and `INSTANCE_NAME` were not copied into function env. Both
`/api/auth/get-session` and `/api/auth/sign-up/email` preflights now return CORS
`204` with `Access-Control-Allow-Origin: https://staging.chewnpour.com`.

The fresh Postgres staging website journey completed its authenticated workload:

- Fresh signup and onboarding: `13.18s`.
- Initial protected routes: dashboard `794ms`, library `810ms`, lessons
  `879ms`, progress `883ms`, settings `900ms`.
- Settings write: `3.66s`.
- Upload kickoff and library redirect for the same `53,660` byte PDF fixture:
  `12.65s`.
- Two concurrent route-read workers completed the standard route sweep in
  `8.75s` wall time.

Against the SQLite production measurements, Postgres staging was `2.35%` faster
for fresh signup, `2.93%` faster for the settings write, and `1.78%` faster for
the concurrent route sweep wall time. The initial protected-route results were
mixed: dashboard was `20.81%` slower, while library, lessons, progress, and
settings were `22.48%` to `66.16%` faster. Upload kickoff was `21.45%` slower.

These are deployed website measurements from one run per workload, not isolated
database engine measurements. The targets still differ in frontend builds and
hardware. Both environments also failed to expose a generated lesson link
inside the eight-minute provider guard: SQLite production waited `487.57s` and
Postgres staging waited `482.65s`. Tutor and quiz timing therefore remain
unavailable.

The guarded Postgres cleanup post-check passed with zero residual app-data
counts. The Better Auth disposable account row remains intentionally because the
cleanup mutation removes app records only.
