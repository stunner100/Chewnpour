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

## Production SQLite to Postgres Rehearsal

### Plan

- [x] Verify the live production source is still SQLite-backed and the staging
  target is Postgres-backed.
- [x] Verify the supported self-hosted Convex export/import CLI options and
  review the prior SQLite restore proof.
- [x] Create a fresh live production SQLite backup, run integrity checks, and
  record its SHA-256 and duration.
- [x] Create and time a fresh production Convex export with file storage.
- [x] Preserve a reversible staging checkpoint before replacing staging data.
- [x] Import the fresh production snapshot into staging Postgres.
- [x] Validate application table counts, component auth records, file storage,
  existing account login, session restore, and at least one new Postgres write.
- [x] Record measured export/import duration, rollback evidence, remaining
  blockers, and the final production maintenance-window estimate.

### Initial Evidence

Verified on June 2, 2026:

- Production `https://api.chewnpour.com` is still SQLite-backed:
  `POSTGRES_URL` and `MYSQL_URL` are empty.
- Production SQLite file size is approximately `1.3G`.
- Production Convex data footprint is approximately `22G`, including `13G` of
  stored files and `5.9G` of prior export artifacts.
- Staging `https://staging-api.164-92-178-122.sslip.io` is Postgres-backed.
- DigitalOcean currently has one managed Postgres cluster:
  `chewnpour-convex-pg-staging`. A production cluster has not been provisioned.
- The May 29 SQLite backup restore proof passed integrity checks and booted a
  disposable restore container successfully in approximately `83s`.

### Fresh Backup Evidence

Created `/root/chewnpour-convex-backups/20260602T172545Z` on the production host.

- Live source integrity: `ok`.
- Backup integrity: `ok`.
- Backup size: `1,300,066,304` bytes.
- SHA-256:
  `248f7bfc9935324ee6ced72eeab156c52cdb3f6fd3aac5b49bed6b5246d4eb5b`.
- Online backup duration: `12.45s`.
- Restore proof: an isolated backend container with networking disabled booted
  successfully from the backup and logged a SQLite connection. The temporary
  restore data copy was removed afterward.

### Fresh Export Evidence

Created a production Convex ZIP export with file storage and transferred it
directly to
`/root/chewnpour-postgres-rehearsal/20260602T174144Z/prod-convex-export.zip` on
the staging host.

- Server export requested at: `2026-06-02T17:34:01.210Z`.
- Server export completed at: `2026-06-02T17:41:44.662Z`.
- Server export duration: `463.45s`.
- Export size: `6,194,402,313` bytes.
- Staging-side SHA-256:
  `57e41a6ec96a4028d933761eb438e93479d20cc1d399772094e31d61dcce6ecf`.
- Staging-side checksum duration: `31s`.
- Staging free disk after transfer: `12,487,872,512` bytes.
- The direct-transfer wrapper completed the download but failed while
  formatting its first checksum line, so the exact transfer duration was not
  retained. The staged file size matches the server-reported export size.

### Staging Checkpoint Evidence

Created a staging Convex ZIP rollback export with file storage at
`/var/lib/docker/volumes/convex_convex_data/_data/storage/exports/95c108ca-4221-4ac4-b834-dad4b636f807.blob`
before starting the replacement import.

- Server export requested at: `2026-06-02T17:48:19.368Z`.
- Server export completed at: `2026-06-02T17:55:37.590Z`.
- Server export duration: `438.22s`.
- Checkpoint size: `6,194,398,787` bytes.
- SHA-256:
  `4a2a070b2ab52ac8524ff3453bf127a68fed8af407a8dca37e4c04a997d3298b`.
- Staging contained two prior `6,194,398,503` byte snapshot-import blobs. The
  failed May 29 upload was removed before checkpointing. The completed May 30
  upload was retained until the fresh checkpoint passed its checksum, then
  removed.
- Staging free disk after the checkpoint cleanup: `18,682,085,376` bytes.

### Staging Import Evidence

Imported the fresh production snapshot into staging Postgres with Convex
`replaceAll`.

- Multipart upload duration: `73.05s` for `1,182` parts and
  `6,194,402,313` bytes.
- Import id: `km2ehb23yj9mcs3q9j4rbg8cy987w1rk`.
- Replacement import requested at: `2026-06-02T18:01:45.268Z`.
- Replacement import completed at: `2026-06-02T18:13:40.136Z`.
- Replacement import duration: `714.87s`.
- Total rows written: `140,333`.
- Imported storage records: `4,361`.
- Selected imported application counts: profiles `542`, uploads `1,332`,
  courses `1,338`, and questions `74,586`.
- Selected imported Better Auth component counts: users `1,722`, accounts
  `1,727`, and sessions `2,280`.
- Removed the completed staging upload blob after the successful import while
  retaining the checksummed rollback checkpoint and the fresh production ZIP.
  Staging free disk after cleanup: `11,620,524,032` bytes.

### Staging Validation Evidence

Ran the deployed website harness against `https://staging.chewnpour.com` with a
retained production-derived disposable account and provider work disabled.

- Existing migrated account login: passed.
- Protected dashboard, library, lessons, progress, and settings routes: passed.
- New Postgres settings write: passed.
- Session restore through two concurrent authenticated browser contexts:
  passed.
- Browser console errors, page errors, and HTTP response errors: none.
- Browser report:
  `output/playwright/convex-db-website-benchmark/db-website-benchmark-2026-06-02T18-15-50-923Z/benchmark-report.json`.
- Direct migrated storage sample:
  `GET https://staging-api.164-92-178-122.sslip.io/api/storage/870129ba-f9fe-4f55-85ad-5f68750ad7de`
  returned HTTP `200`, `118,072` bytes, and the expected SHA-256 digest.
- Production frontend/backend and staging frontend/backend health checks
  returned HTTP `200`. Staging Better Auth CORS preflight returned HTTP `204`.
- Production remained SQLite-backed throughout the rehearsal. Staging remained
  Postgres-backed.

### Production Cutover Estimate And Remaining Gates

The measured final-path work is approximately `25m` before production-specific
backend restart, function deployment, preflights, smoke checks, and operational
buffer:

- Final live SQLite backup: approximately `13s`.
- Production export with file storage: approximately `8m`.
- Direct host-to-host transfer: budget `2m`. The rehearsal transfer completed,
  but its wrapper did not retain the exact duration.
- Postgres multipart upload and parse: approximately `2m`.
- Postgres replacement import: approximately `12m`.
- Deployed website smoke path: approximately `1m`.

Reserve a `45m` to `60m` production maintenance window. Keep writes disabled
until the Postgres backend, import, preflights, and browser smoke checks pass.

Remaining production gates:

- Keep the provisioned production Postgres cluster disconnected from the live
  Convex backend until the final maintenance-window cutover.
- DigitalOcean has no provider-level droplet snapshot yet. Create one as part of
  the final cutover backup gate.
- Production currently has approximately `9.85G` free while
  `/convex/data/storage/exports` occupies approximately `12G`. Reclaim expired
  export artifacts through a safe provider-supported path or expand disk before
  producing the final cutover export.
- Execute maintenance/read-only mode and prove write quiescence before the final
  export.
- The provider-dependent upload-to-generated-lesson flow still did not expose a
  lesson link inside the prior eight-minute guards on either SQLite production
  or Postgres staging. Diagnose or explicitly accept that residual provider
  risk before cutover.
- Run the final adversarial cutover review after the production cluster,
  snapshot, disk-headroom, and write-quiescence procedures are ready.

### Approved Low-Cost Production Postgres Baseline

Provisioned the approved budget baseline on `2026-06-02`:

- DigitalOcean managed Postgres cluster:
  `chewnpour-convex-pg-production`
  (`d13334c9-4090-4fd8-9a98-5f5557ce1f4e`).
- Region: `fra1`.
- Version: Postgres `16`, matching the rehearsed staging cluster.
- Initial size: one `db-s-1vcpu-1gb` node with `10,240 MiB` storage. The
  DigitalOcean price at provisioning time was `$15.15/month`.
- Database created for the production Convex instance:
  `chewnpour_convex_production`.
- Trusted source restricted to the production Convex Droplet
  `convex-selfhosted` (`566121482`).
- Production Droplet Postgres SSL handshake: passed.
- Untrusted workstation Postgres SSL handshake: timed out as expected.
- Live production frontend/backend health checks: HTTP `200`.
- Live production Convex `POSTGRES_URL` and `MYSQL_URL`: still empty. Production
  remains SQLite-backed until the approved maintenance-window cutover.

The initial plan intentionally accepts single-node recovery risk to minimize
cost. Review a resize when CPU remains above `70%`, memory or connection
pressure appears, storage exceeds `70%`, or the deployed website benchmark
regresses. This size cannot add a standby; adding high availability first
requires resizing to a multi-node-capable plan and rehearsing the change on
staging.
