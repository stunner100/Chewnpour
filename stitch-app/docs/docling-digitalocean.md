# Docling On DigitalOcean

This guide deploys a separate staging Docling service on a DigitalOcean Droplet
and connects `stitch-app` staging to it through `DOCLING_API_BASE_URL`.

## What This Runs

- `docling-serve-cpu` behind Caddy for HTTPS
- A stable hostname such as `docling-staging.chewnpour.com`
- No auth by default; if the service is public, keep the firewall tight or add
  your preferred gateway or auth layer before exposing it broadly

Deployment assets live in [deploy/docling](/Users/patrickannor/Desktop/chewnpour/stitch-app/deploy/docling).

## Recommended Droplet

Start simple:

- Ubuntu 24.04 or the DigitalOcean Docker image
- `2 vCPU / 4 GB RAM` minimum for staging
- `80 GB` disk or larger so the Docling image pull and Docker data do not crowd
  the host

If you expect large PDFs or concurrent conversions, move to `8 GB RAM`.

## DNS

Create an `A` record:

- `docling-staging.chewnpour.com -> <droplet-ip>`

Wait until DNS resolves before requesting certificates.

## Files To Copy

Copy these files to the Droplet, for example into `/opt/docling`:

- [compose.yaml](/Users/patrickannor/Desktop/chewnpour/stitch-app/deploy/docling/compose.yaml)
- [Caddyfile](/Users/patrickannor/Desktop/chewnpour/stitch-app/deploy/docling/Caddyfile)
- [.env.example](/Users/patrickannor/Desktop/chewnpour/stitch-app/deploy/docling/.env.example)

Create a real `.env` beside `compose.yaml`:

```dotenv
DOCLING_HOSTNAME=docling-staging.chewnpour.com
ACME_EMAIL=ops@chewnpour.com
DOCLING_SERVE_ENABLE_UI=0
```

## Bring The Service Up

SSH to the Droplet and run:

```bash
mkdir -p /opt/docling
cd /opt/docling

# Copy compose.yaml, Caddyfile, and .env into this directory first.
docker compose pull
docker compose up -d
docker compose ps
```

Caddy will terminate TLS and proxy traffic to Docling on the internal Docker
network.

## Validate The Service

Once DNS and TLS are ready, test the service:

```bash
cd /Users/patrickannor/Desktop/chewnpour/stitch-app
node scripts/docling-deploy-smoke.mjs \
  --url https://docling-staging.chewnpour.com \
  --file /absolute/path/to/sample.pdf
```

If the smoke test passes, the service is ready for the app.

## Wire Staging To The Service

Set these Vercel Preview env vars for the `staging` branch:

```bash
npx vercel env add EXTRACTION_DEFAULT_BACKEND preview staging --force --value "docling" --yes
npx vercel env add DOCLING_API_BASE_URL preview staging --force --value "https://docling-staging.chewnpour.com" --yes
```

Only set `DOCLING_API_KEY` if you later put a bearer-auth gateway in front of
the service.

## Roll Forward / Roll Back

Upgrade Docling:

1. Edit `deploy/docling/compose.yaml` and bump the image tag.
2. On the Droplet, run `docker compose pull && docker compose up -d`.
3. Re-run the smoke test.

Rollback:

1. Revert the image tag in `compose.yaml`.
2. Re-run `docker compose pull && docker compose up -d`.

To disable Docling in app staging without touching the Droplet, unset
`EXTRACTION_DEFAULT_BACKEND` in Vercel Preview for the `staging` branch.
