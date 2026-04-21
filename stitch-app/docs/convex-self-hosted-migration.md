# Convex Self-Hosted Migration

This is the cheapest sane migration path for the current app while traffic is
still low.

## Recommended Starting Shape

- `1` DigitalOcean Droplet for Convex only
- `2 vCPU / 4 GB RAM / 80 GB SSD`
- SQLite first, stored on a persistent Docker volume
- Keep the frontend on Vercel
- Keep Docling separate for now

Why this shape:

- Convex self-hosted is single-node by default.
- The official Convex self-hosted README recommends starting with SQLite, then
  moving to a separate SQL database if needed.
- Keeping Convex isolated from Docling avoids parser spikes hurting realtime
  app latency.

Official references:

- [Convex self-hosting docs](https://docs.convex.dev/self-hosting)
- [Convex self-hosted guide](https://stack.convex.dev/self-hosted-develop-and-deploy)
- [Convex self-hosted README](https://github.com/get-convex/convex-backend/blob/main/self-hosted/README.md)

## Hostnames

Convex self-hosted needs two public origins:

- API origin for the Convex client and CLI
- Site origin for HTTP actions

Recommended:

- `api.chewnpour.com` -> Convex API on port `3210`
- `site.chewnpour.com` -> Convex HTTP actions on port `3211`

This app uses HTTP actions for:

- Better Auth routes in [http.ts](/Users/patrickannor/Desktop/chewnpour/stitch-app/convex/http.ts)
- voice streaming in [voiceHttp.ts](/Users/patrickannor/Desktop/chewnpour/stitch-app/convex/voiceHttp.ts)

## Deployment Bundle

Deployment files live in
[deploy/convex-self-hosted](/Users/patrickannor/Desktop/chewnpour/stitch-app/deploy/convex-self-hosted):

- [compose.yaml](/Users/patrickannor/Desktop/chewnpour/stitch-app/deploy/convex-self-hosted/compose.yaml)
- [Caddyfile](/Users/patrickannor/Desktop/chewnpour/stitch-app/deploy/convex-self-hosted/Caddyfile)
- [.env.example](/Users/patrickannor/Desktop/chewnpour/stitch-app/deploy/convex-self-hosted/.env.example)

This bundle:

- runs the official Convex backend container
- terminates TLS with Caddy
- keeps the dashboard off the Droplet by default to save RAM

For remote self-hosted setups, Convex’s guide explicitly suggests running the
dashboard locally when needed.

## Droplet Setup

Copy the deployment bundle to the Droplet, for example under `/opt/convex`.

Create a real `.env` beside `compose.yaml`:

```dotenv
ACME_EMAIL=ops@chewnpour.com
CONVEX_API_HOSTNAME=api.chewnpour.com
CONVEX_SITE_HOSTNAME=site.chewnpour.com
CONVEX_CLOUD_ORIGIN=https://api.chewnpour.com
CONVEX_SITE_ORIGIN=https://site.chewnpour.com
CONVEX_IMAGE_TAG=latest
INSTANCE_NAME=convex-self-hosted
DISABLE_BEACON=true
DISABLE_METRICS_ENDPOINT=true
RUST_LOG=info
POSTGRES_URL=
MYSQL_URL=
DO_NOT_REQUIRE_SSL=
```

Bring the backend up:

```bash
mkdir -p /opt/convex
cd /opt/convex

# Copy compose.yaml, Caddyfile, and .env here first.
docker compose pull
docker compose up -d
docker compose ps
```

Generate an admin key:

```bash
docker compose exec backend ./generate_admin_key.sh
```

Smoke-check the API:

```bash
cd /Users/patrickannor/Desktop/chewnpour/stitch-app
node scripts/convex-self-hosted-smoke.mjs --url https://api.chewnpour.com
```

## Local CLI Wiring

In local `.env.local` for the repo:

```dotenv
CONVEX_SELF_HOSTED_URL=https://api.chewnpour.com
CONVEX_SELF_HOSTED_ADMIN_KEY=<generated-admin-key>
```

That lets you use the normal CLI commands against the self-hosted backend:

```bash
npx convex deploy
npx convex export --path ./backups
npx convex import ./backups/<backup>.zip
```

## Data Migration

Convex’s official migration path is export/import.

### 1. Export from current Convex

Make sure the export includes file storage. This app relies heavily on Convex
storage for uploads, extraction artifacts, evidence indexes, and illustrations.

```bash
npx convex export --path ./backups
```

Official docs:

- [Data export](https://docs.convex.dev/database/import-export/export)
- [Backup & restore](https://docs.convex.dev/database/backup-restore)

### 2. Deploy the self-hosted backend code

With `CONVEX_SELF_HOSTED_URL` and `CONVEX_SELF_HOSTED_ADMIN_KEY` set:

```bash
npx convex deploy
```

### 3. Import the backup into self-hosted Convex

```bash
npx convex import --replace ./backups/<backup>.zip
```

Convex’s import docs note that ZIP imports preserve `_id`,
`_creationTime`, and `_storage` documents when file storage is included.

Official docs:

- [Data import](https://docs.convex.dev/database/import-export/import)

## Environment Migration

Backups do not include env vars or pending scheduled functions, so recreate env
config on the self-hosted backend manually.

At minimum, migrate:

- `BETTER_AUTH_SECRET`
- `APP_BASE_URL`
- `FRONTEND_URL`
- `FRONTEND_URLS`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `OPENAI_*`
- `BEDROCK_*`
- `MINIMAX_*`
- `INCEPTION_*`
- `VOYAGE_*`
- `DEEPGRAM_*`
- `RESEND_API_KEY`
- `PAYSTACK_*`
- `SENTRY_*`
- `OPENROUTER_*`
- `DOCLING_*` if you later connect staging or production Docling

This repo’s auth config trusts origins from `APP_BASE_URL`, `FRONTEND_URL`, and
`FRONTEND_URLS`, so those must match the real frontend domains after cutover.

Relevant files:

- [authConfig.ts](/Users/patrickannor/Desktop/chewnpour/stitch-app/convex/authConfig.ts)
- [paystack-webhook.js](/Users/patrickannor/Desktop/chewnpour/stitch-app/api/paystack-webhook.js)

## Frontend Cutover

Once the self-hosted backend is running and imported:

- set `VITE_CONVEX_URL=https://api.chewnpour.com`
- set `VITE_CONVEX_SITE_URL=https://site.chewnpour.com`
- set `CONVEX_URL=https://api.chewnpour.com`

The frontend supports arbitrary Convex deployment URLs through
`VITE_CONVEX_URL` and `CONVEX_URL`. For self-hosted Convex, set
`VITE_CONVEX_SITE_URL` as well so Better Auth targets the self-hosted site
origin instead of the `.convex.cloud -> .convex.site` cloud hostname rewrite.

Relevant files:

- [vite.config.js](/Users/patrickannor/Desktop/chewnpour/stitch-app/vite.config.js)
- [convex-config.js](/Users/patrickannor/Desktop/chewnpour/stitch-app/src/lib/convex-config.js)

## Google OAuth Redirect URI

When Better Auth runs on the self-hosted site origin, Google OAuth callbacks also
move to that origin. After cutover, update the Google OAuth client referenced by
`GOOGLE_CLIENT_ID` so its authorized redirect URIs include:

- `https://site.chewnpour.com/api/auth/callback/google`

If production still uses a different Convex site origin, keep that older redirect
URI alongside the new one until production is cut over too.

You can validate the redirect after updating Google with:

```bash
node scripts/google-oauth-redirect-smoke.test.mjs \
  --site-url https://site.chewnpour.com \
  --callback-url https://staging.chewnpour.com/dashboard
```

## Dashboard

Do not keep the dashboard running on the Droplet by default. Run it locally
when needed:

```bash
docker run \
  -e NEXT_PUBLIC_DEPLOYMENT_URL=https://api.chewnpour.com \
  -p 6791:6791 \
  ghcr.io/get-convex/convex-dashboard:latest
```

Then open `http://localhost:6791` and authenticate with the admin key.

## When To Move Off SQLite

SQLite is acceptable for the initial low-traffic move. Move to managed Postgres
when one of these becomes true:

- you need stronger recovery guarantees
- write volume grows materially
- the backend box becomes storage-sensitive
- you want cleaner backups and database operations

Convex officially supports Postgres for self-hosting via `POSTGRES_URL`, but it
should be in the same region as the backend.
