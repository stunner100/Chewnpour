# Convex SQLite and Postgres Website Benchmark Design

## Objective

Measure the user-visible performance of ChewnPour's deployed SQLite-backed
production Convex service and Postgres-backed staging Convex service through the
real website flows. The benchmark must use disposable accounts, keep production
writes scoped to those accounts, and remove generated application records after
the run.

This is a deployed-environment comparison, not an isolated database-engine
benchmark. The report must state that production and staging have different
frontend assets and different host sizing.

## Targets

| Label | Frontend | Convex persistence |
| --- | --- | --- |
| SQLite production | `https://www.chewnpour.com` | SQLite |
| Postgres staging | `https://staging.chewnpour.com` | DigitalOcean Managed Postgres |

The production Convex backend is the existing DigitalOcean-hosted service.
The staging Convex backend is the existing DigitalOcean-hosted Postgres-backed
service. Do not deploy Convex functions or change environment variables during
the benchmark.

## Safety Boundary

The user explicitly authorized disposable production writes for this benchmark.

- Create exactly one fresh `gate_*@example.com` account per target.
- Use the same small fixture file on both targets:
  `Channel Ideas Without Remotion.pdf`.
- Do not use an existing user account.
- Do not modify production configuration, production infrastructure, or
  existing user records.
- Avoid high-volume load generation. Use a focused single-user journey followed
  by low-concurrency steady-state browser reads.
- Invoke `admin.cleanupDisposableE2EAccounts` for each disposable account after
  the run.
- Run cleanup with `dryRun: true` first, then with `dryRun: false`, then verify
  with another `dryRun: true`.
- Cleanup is allowed only through the existing guarded mutation. It rejects any
  email outside the `gate_*@example.com` pattern.

The cleanup mutation removes application records but intentionally does not
delete Better Auth records. Report this limitation.

## Website Workload

Run the same browser journey against both targets:

1. Open signup and choose email signup.
2. Create a fresh disposable account and complete onboarding.
3. Wait for the authenticated dashboard to render.
4. Open the upload screen and upload the same 53 KB PDF fixture.
5. Wait for processing to begin and for generated study content to become
   available.
6. Open the dashboard, library, lessons, first available topic, progress, and
   settings routes.
7. Change the tutor persona once.
8. Send one tutor message when a ready topic is available.
9. Start one multiple-choice quiz and submit it when the rendered UI allows it.
10. Repeat steady-state authenticated route loads at low concurrency.

If a flow is unavailable because generated study content is not ready, record
the blocked step and continue with the remaining safe checks. Do not generate
extra accounts or repeat expensive external-provider work automatically.

## Measurement

Capture:

- Navigation duration for each route.
- Time from signup submission to authenticated dashboard.
- Time from upload selection to processing route.
- Time from upload selection to first ready topic.
- Time to render topic content.
- Time to change tutor persona.
- Time to send a tutor message and receive a rendered assistant response.
- Time to reach an interactive quiz.
- Time to submit the quiz and reach results.
- Browser console errors, page errors, and failed requests.
- Cleanup dry-run, deletion, and post-cleanup verification results.

Classify timings:

- **Database-heavy route timings:** dashboard, library, lessons, topic,
  progress, settings, and low-concurrency steady-state route loads.
- **External-provider timings:** document processing, tutor answer generation,
  and quiz generation. Report these separately because they include third-party
  service latency and cost.

## Interpretation Limits

The report must not claim intrinsic database-engine superiority.

- SQLite production runs on a larger Convex host than Postgres staging.
- The deployed frontend asset hashes differ between production and staging.
- External AI providers can dominate upload, tutor, and quiz timings.
- Production receives real user traffic during the run.
- The Postgres staging snapshot can lag production outside the new disposable
  benchmark account.

The result answers: "What experience does a disposable user observe on each
currently deployed stack?"

## Artifacts

Write temporary harnesses and measurement artifacts outside committed source
files. Store browser artifacts under `stitch-app/output/playwright/`, which is
gitignored. Do not commit passwords, admin keys, account tokens, screenshots, or
raw reports containing credentials.

## Verification

Before reporting completion:

1. Confirm both website targets were reached.
2. Confirm each created account matches `gate_*@example.com`.
3. Confirm every successful flow has timestamped measurements.
4. Confirm console and request errors are included in the report.
5. Confirm cleanup ran for both disposable accounts.
6. Confirm post-cleanup dry-runs report no remaining application records for
   the disposable users.

