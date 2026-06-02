# Production Maintenance Screen Design

## Objective

Add a controlled maintenance screen for the ChewnPour frontend so users see a
clear service-unavailable message during the production SQLite-to-Postgres
cutover. Pair the screen with self-hosted Convex's built-in deployment pause
endpoint so the maintenance window blocks application writes, queues scheduled
jobs, and skips cron jobs until the deployment is unpaused.

This change prepares the cutover procedure. It must not switch production to
Postgres, pause production, take a paid DigitalOcean snapshot, resize the
Droplet, or deploy a maintenance build by itself.

## Frontend Behavior

Add a Vite build-time variable:

```text
VITE_MAINTENANCE_MODE=false
```

When the trimmed value is exactly `true`, the frontend root renders a static
maintenance screen instead of constructing a Convex client, Better Auth
provider, or application router. The maintenance build therefore avoids normal
application reads and writes while the backend pause is active.

The screen must:

- State that ChewnPour is temporarily unavailable for scheduled maintenance.
- Tell users to try again shortly.
- Avoid interactive application controls.
- Avoid timers, automatic refresh loops, and backend requests.
- Use the existing frontend styling system without adding dependencies.

When the variable is unset or not exactly `true`, the existing application
provider flow remains unchanged.

## Backend Pause Procedure

Use the existing self-hosted Convex platform endpoints:

```text
POST /api/v1/pause_deployment
POST /api/v1/unpause_deployment
```

Authenticate with a transient production admin key generated on the
DigitalOcean-hosted Convex backend. Never print, commit, or persist the key in
repository files.

The official self-hosted Convex backend source states that a paused deployment
rejects new function calls, queues scheduled jobs until resume, and skips cron
jobs. A staging rehearsal on `2026-06-02` verified:

- Public query before pause: passed.
- Pause endpoint: HTTP `200`.
- Public query while paused: blocked.
- Unpause endpoint: HTTP `200`.
- Public query after unpause: passed.

## DigitalOcean Disk Headroom

The production Convex Droplet currently reports an `80 GB` disk while its
existing `s-4vcpu-8gb` plan includes `160 GB`. During the maintenance window,
expand the disk permanently to the already-included `160 GB` capacity:

```bash
doctl compute droplet-action resize 566121482 \
  --size s-4vcpu-8gb \
  --resize-disk \
  --wait
```

DigitalOcean documents that disk resize is permanent and the resize action
powers off the Droplet. Verify the filesystem size, container health, frontend
health, and backend health after the action. This resize must not increase the
Droplet plan above its current `$48/month` size.

## Snapshot Timing

Create the provider-level Droplet snapshot inside the maintenance window after
writes are paused and before the SQLite-backed backend is replaced. Do not take
the final snapshot while the live database is accepting writes. Retain it until
the Postgres-backed deployment has run cleanly for at least seven days.

DigitalOcean prices Droplet snapshots at `$0.06/GB/month`. A retained `80 GB`
snapshot is approximately `$4.80/month`.

## Cutover Sequence

1. Deploy the frontend with `VITE_MAINTENANCE_MODE=true`.
2. Pause the production self-hosted Convex deployment.
3. Prove write quiescence for the required tables.
4. Take the final SQLite backup and provider-level Droplet snapshot.
5. Permanently expand the production Droplet disk from `80 GB` to the
   already-included `160 GB`.
6. Verify the filesystem, containers, and frontend/backend health.
7. Continue the documented SQLite-to-Postgres export, backend restart, deploy,
   import, and smoke-test sequence.
8. Unpause Convex only after the Postgres-backed smoke checks pass.
9. Deploy the frontend with `VITE_MAINTENANCE_MODE=false`.

If any required gate fails, keep the maintenance screen active and execute the
documented SQLite rollback path.

## Implementation Scope

Implement:

- One static maintenance screen component.
- One build-time maintenance flag check before normal application providers are
  constructed.
- One `.env.example` entry.
- One static regression script covering the flag, early render gate, static
  screen, and runbook procedure.
- Runbook and checklist updates.

Do not implement:

- Backward compatibility paths.
- Runtime database flags stored in Convex.
- A new maintenance API.
- Automatic cutover scripts.
- New infrastructure providers.
- Automatic production deployment.

## Verification

Before committing the implementation:

1. Run the new maintenance regression script and the existing migration runbook
   regression script.
2. Run `npm run lint`.
3. Run `npm run build`.
4. Build once with `VITE_MAINTENANCE_MODE=true`.
5. Verify the maintenance build renders the static screen without connecting to
   the normal app flow.
6. Verify the default build still renders the existing application flow.
7. Confirm production frontend/backend health remains HTTP `200` and production
   `POSTGRES_URL` remains empty.
