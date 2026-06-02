# Convex SQLite to Postgres Migration Runbook

This is the hard-cutover plan for moving ChewnPour's self-hosted Convex
backend from local SQLite persistence to managed Postgres.

Sources checked on May 29, 2026:

- ChewnPour repo guardrails: [AGENTS.md](../../AGENTS.md) and
  [staging.md](./staging.md)
- Convex self-hosting guide:
  <https://github.com/get-convex/convex-backend/tree/main/self-hosted>
- Convex Postgres configuration:
  <https://github.com/get-convex/convex-backend/blob/main/self-hosted/advanced/postgres_or_mysql.md>
- Convex import/export docs:
  <https://docs.convex.dev/database/import-export/>

## Non-Negotiables

- Production stays on the current SQLite-backed Convex service until a full
  staging rehearsal passes.
- Do not use `*.convex.cloud` for staging or production.
- Do not run `npx convex deploy` against Convex Cloud. Use the self-hosted
  environment variables for the DigitalOcean-hosted Convex runtime.
- The official self-hosted Convex Postgres switch is `POSTGRES_URL`, not
  `DATABASE_URL`. Do not include the database name in `POSTGRES_URL`; the
  backend derives the database from `INSTANCE_NAME`.
- Keep the Convex backend and Postgres in the same region or as close as the
  provider allows.
- Do not manually edit files in `convex/_generated/`.
- No production cutover without a final SQLite backup, a tested rollback path,
  and a written validation log.
- Before every `npx convex deploy`, `npx convex export`, or `npx convex import`,
  run the target preflight in this runbook and verify the self-hosted URL,
  admin key, backend logs, and persistence layer.

## Current Facts to Verify Before Work Starts

Run these read-only checks and save the output in the migration evidence log.
Redact secrets before sharing.

```bash
# Local repo evidence
git rev-parse --show-toplevel
git status --short --branch
git rev-parse HEAD
rg "VITE_CONVEX_URL|CONVEX_URL|POSTGRES_URL|MYSQL_URL|INSTANCE_NAME" -n .

# DigitalOcean account/resource inventory
doctl auth list
doctl compute droplet list
doctl database list

# Vercel project/env inventory
npx vercel whoami
npx vercel project ls
npx vercel env ls
```

On the production Convex host, capture:

```bash
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
docker inspect <convex-backend-container> > convex-backend.inspect.redacted.json
docker logs --tail 200 <convex-backend-container> > convex-backend.tail.log
docker exec <convex-backend-container> sh -lc 'printenv | sort' > convex-env.redacted.txt
docker exec <convex-backend-container> sh -lc 'ls -lah /convex/data || true'
docker exec <convex-backend-container> sh -lc 'sqlite3 /convex/data/db.sqlite3 "PRAGMA integrity_check;"'
```

Confirm and record:

- Convex backend container image digest/tag.
- Dashboard image digest/tag.
- `INSTANCE_NAME`.
- Whether `POSTGRES_URL` and `MYSQL_URL` are unset or empty.
- SQLite file path, size, last modified time, and volume mount.
- Current frontend `VITE_CONVEX_URL` and serverless `CONVEX_URL` targets.
- Existing backup schedule, if any.

## Target Preflight for Convex CLI Commands

Run this before every Convex CLI command that can read or write deployment data.
Never rely on shell history or an existing `.env.local`.

```bash
export CONVEX_SELF_HOSTED_URL="https://<expected-convex-host>"
export CONVEX_SELF_HOSTED_ADMIN_KEY="<expected-admin-key>"

printf 'Target Convex URL: %s\n' "$CONVEX_SELF_HOSTED_URL"
test "$CONVEX_SELF_HOSTED_URL" = "https://<expected-convex-host>"
test -n "$CONVEX_SELF_HOSTED_ADMIN_KEY"

docker logs <expected-convex-backend-container> | rg -i "sqlite|postgres|connected"
```

For imports and staging/prod deploys, the backend logs must show the expected
persistence layer before continuing:

- production export source: SQLite before cutover, Postgres after cutover
- staging import target: Postgres
- production final import target: Postgres

## Phase 1: Production SQLite Backup

Take a cold or write-quiesced SQLite backup before any migration rehearsal.
Prefer stopping writes first. If the service cannot pause writes, take both a
live SQLite `.backup` and a full volume snapshot.

```bash
export BACKUP_DIR="/root/chewnpour-convex-backups/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP_DIR"

docker exec <convex-backend-container> sh -lc \
  'sqlite3 /convex/data/db.sqlite3 ".backup /tmp/chewnpour-convex.sqlite3"'

docker cp <convex-backend-container>:/tmp/chewnpour-convex.sqlite3 \
  "$BACKUP_DIR/chewnpour-convex.sqlite3"

sqlite3 "$BACKUP_DIR/chewnpour-convex.sqlite3" "PRAGMA integrity_check;"
sha256sum "$BACKUP_DIR/chewnpour-convex.sqlite3" \
  > "$BACKUP_DIR/chewnpour-convex.sqlite3.sha256"
```

Also create a provider-level snapshot of the volume or droplet before cutover.

Prove the backup before cutover by restoring it into a disposable
SQLite-backed Convex service and booting that service successfully. A backup is
not considered valid until a restore has been rehearsed.

## Phase 2: Provision Managed Postgres

Recommended default: DigitalOcean Managed Postgres in the same region as the
Convex droplet. Neon or Supabase are acceptable only if latency from the Convex
host is measured and acceptable.

Create two separate managed Postgres services or clusters:

- `chewnpour-convex-staging`
- `chewnpour-convex-production`

Enable:

- Automated backups.
- Point-in-time recovery where available.
- Restricted network access to the Convex backend host.
- Monitoring for CPU, memory, storage, connections, slow queries, and restarts.

For the budget-conscious production baseline, start with one
`db-s-1vcpu-1gb` node and resize as measured traffic requires. This initial
plan is intentionally single-node and does not provide a standby. Review a
resize when CPU is sustained above `70%`, memory or connection pressure appears,
storage exceeds `70%`, or the deployed website benchmark regresses. The
`db-s-1vcpu-1gb` size cannot add a standby, so adding high availability first
requires resizing to a plan that supports multiple nodes. Rehearse any resize
or standby change on staging before applying it to production.

Within each service, create the actual Postgres database name expected by the
backend. Convex derives this database name from `INSTANCE_NAME` by replacing
hyphens with underscores. If `INSTANCE_NAME=chewnpour-convex-production`, the
database must be `chewnpour_convex_production`.

```bash
export INSTANCE_NAME='chewnpour-convex-staging'
export CONVEX_DATABASE_NAME="${INSTANCE_NAME//-/_}"
psql "$DATABASE_CONNECTION" -c "CREATE DATABASE $CONVEX_DATABASE_NAME"
```

Set `POSTGRES_URL` to the connection string without the database name and query
params. Keep SSL required in managed environments.

## Phase 3: Build a Postgres-Backed Staging Convex

Create a duplicate DigitalOcean-hosted Convex backend and dashboard. Keep
production untouched.

Required staging env:

```bash
INSTANCE_NAME=<same-shape-staging-instance-name>
POSTGRES_URL=postgresql://<user>:<password>@<host>:<port>
CONVEX_SELF_HOSTED_URL=https://<staging-convex-host>
CONVEX_SELF_HOSTED_ADMIN_KEY=<staging-admin-key>
```

Do not include `convex_self_hosted` in `POSTGRES_URL`.

Verify the backend logs contain a successful Postgres connection message before
importing data.

```bash
docker logs <staging-convex-backend-container> | rg -i "postgres|connected"
```

Push the current Convex functions/schema to this self-hosted staging backend
using the self-hosted CLI env, not Convex Cloud env.

```bash
cd stitch-app
export CONVEX_SELF_HOSTED_URL="https://<staging-convex-host>"
export CONVEX_SELF_HOSTED_ADMIN_KEY="<staging-admin-key>"

test "$CONVEX_SELF_HOSTED_URL" = "https://<staging-convex-host>"
docker logs <staging-convex-backend-container> | rg -i "connected to postgres|postgres"

CONVEX_SELF_HOSTED_URL="https://<staging-convex-host>" \
CONVEX_SELF_HOSTED_ADMIN_KEY="<staging-admin-key>" \
npx convex deploy --cmd 'npm run build' --cmd-url-env-var-name VITE_CONVEX_URL
```

Before running this command, confirm the target URL is the staging
DigitalOcean-hosted Convex URL.

## Phase 4: Export and Import Rehearsal

Use Convex's supported provider migration path:

```bash
cd stitch-app

CONVEX_SELF_HOSTED_URL="https://<production-convex-host>" \
CONVEX_SELF_HOSTED_ADMIN_KEY="<production-admin-key>" \
npx convex export --include-file-storage --path ./tmp/prod-convex-export.zip

CONVEX_SELF_HOSTED_URL="https://<staging-convex-host>" \
CONVEX_SELF_HOSTED_ADMIN_KEY="<staging-admin-key>" \
npx convex import --replace ./tmp/prod-convex-export.zip
```

If export/import fails for this self-hosted version, stop and investigate with
the Convex self-hosted docs or support channel. Do not fall back to ad hoc SQL
conversion unless we have a table-by-table compatibility proof and a rollback
review.

## Phase 5: Data Validation

Validate record counts for every application table in
[schema.ts](../convex/schema.ts), plus Convex system storage and Convex
component/auth data if file storage or Better Auth is in use.

Generate the table checklist from the schema instead of maintaining it by hand:

```bash
rg '^[[:space:]]+[a-zA-Z0-9_]+: defineTable' convex/schema.ts \
  | sed -E 's/^[[:space:]]+([a-zA-Z0-9_]+):.*/\1/' \
  | sort
```

Minimum application table checklist:

- adminAccess
- aiMessageUsage
- appSettings
- assignmentMessages
- assignmentThreads
- campaignCreditGrants
- campaignLandingEvents
- communityChannels
- communityFlags
- communityMembers
- communityPosts
- conceptAttempts
- conceptExercises
- conceptMastery
- courseFolders
- courseUploads
- courses
- distractorBank
- documentExtractions
- emailLog
- evidencePassages
- examAttempts
- examPreparations
- feedback
- humanizerUsage
- lessons
- libraryMaterials
- llmUsageDaily
- paymentTransactions
- profiles
- productResearchResponses
- questionTargetAuditRuns
- questions
- searchDocuments
- subscriptions
- topicChatMessages
- topicNotes
- topicPodcasts
- topicSubClaims
- topics
- uploadEvidenceIndexes
- uploads
- userTutorProfiles
- userTutorMemory
- userPresence
- userTopicProgress

For each table, record:

- Production SQLite-backed count before export.
- Staging Postgres-backed count after import.
- Spot-check IDs and `_creationTime` for linked records.
- Spot-check file storage references for uploaded material.
- Validate Better Auth/component records required for existing account login,
  session restore, account linkage, and subscription-gated access.

## Phase 6: App Validation Against Staging

Point a temporary frontend environment at the staging Convex URL.

```bash
cd stitch-app
VITE_CONVEX_URL="https://<staging-convex-host>" \
CONVEX_URL="https://<staging-convex-host>" \
npm run build

VITE_CONVEX_URL="https://<staging-convex-host>" \
CONVEX_URL="https://<staging-convex-host>" \
node scripts/deploy-convex-host-smoke.test.mjs
```

Manual browser checks:

- Login/session restore.
- Dashboard load and dark mode persistence.
- Upload metadata and existing material display.
- Lesson detail page.
- Study assistant message send, reply, no duplicate user message.
- Quiz start, answer, and result page.
- Progress page.
- Settings page.
- Payment/subscription display.

Pass condition: all workflows load existing migrated data and at least one new
write lands in Postgres.

## Phase 7: Production Dry Run

Repeat phases 1, 4, 5, and 6 with a fresh SQLite backup and a fresh staging
Postgres database.

Record:

- Export duration.
- Import duration.
- Total downtime needed for the final cutover.
- Largest tables by row count.
- Any failed tables or file storage mismatches.
- Exact rollback command sequence.

Do not schedule production cutover until the dry run passes without manual data
repair.

## Phase 8: Production Cutover

Schedule a short maintenance window.

1. Announce maintenance.
2. Enable maintenance/read-only mode at the frontend and edge layer.
3. Block or pause all write entry points: Convex mutations/actions, uploads,
   AI tutor writes, quiz submissions, payment webhooks, scheduled jobs, and
   background extraction work.
4. Record the maintenance start timestamp and prove no new writes occur after
   that timestamp by checking the latest `_creationTime` in core write tables.
5. Take final SQLite backup and provider snapshot.
6. Export production Convex data with file storage from the SQLite-backed
   service.
7. Stop the SQLite-backed production Convex backend.
8. Start the production Convex backend with `POSTGRES_URL` and the confirmed
   `INSTANCE_NAME`.
9. Confirm logs show the production backend is connected to Postgres.
10. Redeploy functions/schema to the Postgres-backed production Convex target
    with `--cmd-url-env-var-name VITE_CONVEX_URL`.
11. Run target preflight again and confirm the production import target is the
    Postgres-backed service.
12. Import the final production export into that running Postgres-backed Convex
    service.
13. Confirm Vercel production `VITE_CONVEX_URL` and `CONVEX_URL` still point to
    the same production DigitalOcean Convex host.
14. Run smoke tests and manual checks.
15. Re-enable writes.

Write-quiescence proof: record the maintenance start timestamp, then prove no
new `_creationTime` values exist after maintenance start before the final
export. Cover at least:

- profiles
- uploads
- courses
- topics
- lessons
- questions
- examAttempts
- conceptAttempts
- userTopicProgress
- userTutorMemory
- topicChatMessages
- paymentTransactions
- subscriptions

The frontend URL should not need to change if the public production Convex host
stays the same and only the backend persistence changes.

## Phase 9: Post-Cutover Monitoring

For the first 24 hours, watch:

- Convex backend logs.
- Postgres CPU, memory, connections, storage, and restarts.
- Vercel errors.
- Sentry errors.
- AI tutor/chat writes.
- Quiz submissions.
- Uploads and file storage reads.
- Payment webhook mutations.

Keep the final SQLite backup and pre-cutover container config untouched until
the Postgres deployment has run cleanly for at least 7 days.

## Rollback

Rollback is allowed only before irreversible cleanup.

1. Put the site back into maintenance.
2. Stop the Postgres-backed Convex backend.
3. Restore the pre-cutover container env with `POSTGRES_URL` unset.
4. Restore the final SQLite backup to `/convex/data/db.sqlite3`.
5. Start the SQLite-backed Convex backend.
6. Confirm frontend `VITE_CONVEX_URL` and `CONVEX_URL` point to the restored
   DigitalOcean Convex host.
7. Run the smoke and manual checks.
8. Re-enable writes.

Any writes accepted by the Postgres-backed service after cutover and before
rollback must be treated as at risk unless manually reconciled.

## Evidence Log Template

```text
Migration date:
Operator:
Repo commit:
Convex image:
Dashboard image:
Production Convex host:
Staging Convex host:
INSTANCE_NAME:
SQLite backup path:
SQLite backup sha256:
Postgres provider:
Postgres region:
Export started:
Export finished:
Import started:
Import finished:
Record count comparison:
File storage validation:
Smoke test output:
Manual browser checks:
Cutover decision:
Rollback decision:
Adversarial review:
```

## Cutover Gate

Do not cut over unless all are true:

- Production SQLite backup exists and passes `PRAGMA integrity_check`.
- Provider-level snapshot exists.
- Staging import from a fresh production export passes.
- Record counts match for all required tables.
- File storage references are valid.
- Existing migrated account login and session restore pass.
- Write-quiescence proof shows no writes after maintenance start before export.
- App validation against staging passes.
- Rollback sequence has been rehearsed.
- An adversarial review has signed off on the plan and evidence.
