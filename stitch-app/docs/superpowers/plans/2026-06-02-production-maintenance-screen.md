# Production Maintenance Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a build-time frontend maintenance screen and update the migration runbook so ChewnPour can show a static maintenance page while self-hosted Convex is paused during the production SQLite-to-Postgres cutover.

**Architecture:** Introduce a small `maintenance-mode` config helper, a static `MaintenanceScreen` component, and an early gate in `AppProviders` before the Convex client and normal app providers are constructed. Keep all cutover actions manual and documented; this implementation does not deploy, pause production, snapshot, resize, or migrate production.

**Tech Stack:** React, Vite `import.meta.env`, Tailwind utility classes, Node-based static regression scripts, existing ChewnPour migration runbook.

---

## File Structure

- Create `stitch-app/scripts/production-maintenance-mode-regression.test.mjs` to statically verify the maintenance flag, early render gate, static screen constraints, environment example, and runbook procedure.
- Create `stitch-app/src/lib/maintenance-mode.js` to centralize the strict `VITE_MAINTENANCE_MODE === "true"` check.
- Create `stitch-app/src/components/MaintenanceScreen.jsx` as a dependency-free static React screen.
- Modify `stitch-app/src/bootstrap/AppProviders.jsx` to return the maintenance screen before constructing the Convex client or rendering Better Auth/App providers.
- Modify `stitch-app/vite.config.js` to explicitly define `import.meta.env.VITE_MAINTENANCE_MODE` at build time.
- Modify `stitch-app/.env.example` to document the maintenance flag.
- Modify `stitch-app/docs/convex-sqlite-to-postgres-migration.md` to include the maintenance build, Convex pause, snapshot, disk resize, and unpause sequence.
- Modify `stitch-app/tasks/todo.md` to record staging pause evidence and the remaining manual production gates.

## Task 1: Regression Test

**Files:**
- Create: `stitch-app/scripts/production-maintenance-mode-regression.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const read = async (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

const maintenanceModeSource = await read('src/lib/maintenance-mode.js');
const appProvidersSource = await read('src/bootstrap/AppProviders.jsx');
const maintenanceScreenSource = await read('src/components/MaintenanceScreen.jsx');
const envExampleSource = await read('.env.example');
const viteConfigSource = await read('vite.config.js');
const runbookSource = await read('docs/convex-sqlite-to-postgres-migration.md');
const todoSource = await read('tasks/todo.md');

if (!maintenanceModeSource.includes("String(import.meta.env.VITE_MAINTENANCE_MODE || '').trim() === 'true'")) {
  throw new Error('Expected maintenance-mode.js to require an exact build-time true flag.');
}

for (const snippet of [
  "import MaintenanceScreen from '../components/MaintenanceScreen.jsx';",
  "import { maintenanceModeEnabled } from '../lib/maintenance-mode.js';",
  'const convex = !maintenanceModeEnabled && hasConvexUrl ? new ConvexReactClient(convexUrl) : null;',
  'if (maintenanceModeEnabled) {',
  '<MaintenanceScreen />',
]) {
  if (!appProvidersSource.includes(snippet)) {
    throw new Error(`Expected AppProviders to gate normal app startup with maintenance mode: ${snippet}`);
  }
}

const maintenanceBranchIndex = appProvidersSource.indexOf('if (maintenanceModeEnabled) {');
const normalProviderIndex = appProvidersSource.indexOf('if (hasConvexUrl && convex) {');
if (maintenanceBranchIndex === -1 || normalProviderIndex === -1 || maintenanceBranchIndex > normalProviderIndex) {
  throw new Error('Expected AppProviders to render the maintenance screen before normal providers.');
}

for (const snippet of [
  'ChewnPour is under scheduled maintenance',
  'Please try again shortly',
  'We are moving the database to a more scalable setup',
]) {
  if (!maintenanceScreenSource.includes(snippet)) {
    throw new Error(`Expected maintenance screen copy: ${snippet}`);
  }
}

for (const forbidden of ['useEffect', 'setTimeout', 'setInterval', 'window.location', 'useQuery', 'useMutation', 'ConvexReactClient']) {
  if (maintenanceScreenSource.includes(forbidden)) {
    throw new Error(`Maintenance screen must stay static and avoid backend/app behavior: ${forbidden}`);
  }
}

if (!/^VITE_MAINTENANCE_MODE=false$/m.test(envExampleSource)) {
  throw new Error('Expected .env.example to document VITE_MAINTENANCE_MODE=false.');
}

for (const snippet of [
  "const resolvedMaintenanceMode = String(env.VITE_MAINTENANCE_MODE || '').trim()",
  "'import.meta.env.VITE_MAINTENANCE_MODE': JSON.stringify(resolvedMaintenanceMode)",
]) {
  if (!viteConfigSource.includes(snippet)) {
    throw new Error(`Expected vite config to inject maintenance mode at build time: ${snippet}`);
  }
}

for (const snippet of [
  'VITE_MAINTENANCE_MODE=true',
  '/api/v1/pause_deployment',
  '/api/v1/unpause_deployment',
  'doctl compute droplet-action resize 566121482',
  '--resize-disk',
  'already-included `160 GB`',
  'VITE_MAINTENANCE_MODE=false',
]) {
  if (!runbookSource.includes(snippet)) {
    throw new Error(`Expected runbook to document the maintenance cutover step: ${snippet}`);
  }
}

for (const snippet of [
  'Production Maintenance Screen And Pause Readiness',
  'staging pause rehearsal',
  'Production remains SQLite-backed',
]) {
  if (!todoSource.includes(snippet)) {
    throw new Error(`Expected todo evidence for maintenance readiness: ${snippet}`);
  }
}

console.log('production-maintenance-mode-regression.test.mjs passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd stitch-app
node scripts/production-maintenance-mode-regression.test.mjs
```

Expected: FAIL because `src/lib/maintenance-mode.js` and `src/components/MaintenanceScreen.jsx` do not exist yet.

## Task 2: Maintenance Gate And Screen

**Files:**
- Create: `stitch-app/src/lib/maintenance-mode.js`
- Create: `stitch-app/src/components/MaintenanceScreen.jsx`
- Modify: `stitch-app/src/bootstrap/AppProviders.jsx`
- Modify: `stitch-app/vite.config.js`
- Modify: `stitch-app/.env.example`
- Test: `stitch-app/scripts/production-maintenance-mode-regression.test.mjs`

- [ ] **Step 1: Add the maintenance-mode helper**

```js
export const maintenanceModeEnabled =
    String(import.meta.env.VITE_MAINTENANCE_MODE || '').trim() === 'true';
```

- [ ] **Step 2: Add the static maintenance screen**

```jsx
import React from 'react';

const MaintenanceScreen = () => (
    <main className="min-h-screen bg-background-light dark:bg-background-dark text-text-main-light dark:text-text-main-dark flex items-center justify-center px-6 py-12">
        <section className="w-full max-w-xl rounded-[2rem] border border-border-light dark:border-border-dark bg-white/90 dark:bg-card-dark/90 shadow-xl p-8 sm:p-10 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-primary mb-4">
                Scheduled maintenance
            </p>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">
                ChewnPour is under scheduled maintenance
            </h1>
            <p className="text-base sm:text-lg text-text-muted-light dark:text-text-muted-dark leading-7 mb-6">
                We are moving the database to a more scalable setup so the app
                can stay fast as traffic grows.
            </p>
            <p className="text-sm font-semibold text-text-faint-light dark:text-text-faint-dark">
                Please try again shortly.
            </p>
        </section>
    </main>
);

export default MaintenanceScreen;
```

- [ ] **Step 3: Gate AppProviders before normal app startup**

Replace the top-level imports and Convex client setup in `AppProviders.jsx` with:

```jsx
import React from 'react';
import { ConvexReactClient } from 'convex/react';
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react';
import MaintenanceScreen from '../components/MaintenanceScreen.jsx';
import App from '../App.jsx';
import { AuthProvider } from '../contexts/AuthContext.jsx';
import { authClient } from '../lib/auth-client.js';
import { convexUrl, hasConvexUrl } from '../lib/convex-config.js';
import { maintenanceModeEnabled } from '../lib/maintenance-mode.js';

const convex = !maintenanceModeEnabled && hasConvexUrl ? new ConvexReactClient(convexUrl) : null;
```

Then make `AppProviders` return the maintenance screen first:

```jsx
const AppProviders = () => {
    if (maintenanceModeEnabled) {
        return <MaintenanceScreen />;
    }

    if (hasConvexUrl && convex) {
        return (
            <ConvexBetterAuthProvider client={convex} authClient={authClient}>
                <AuthProvider>
                    <App />
                </AuthProvider>
            </ConvexBetterAuthProvider>
        );
    }

    return (
        <AuthProvider>
            <App />
        </AuthProvider>
    );
};
```

- [ ] **Step 4: Define the maintenance flag in Vite config**

Add this after `resolvedConvexSiteUrl`:

```js
const resolvedMaintenanceMode = String(env.VITE_MAINTENANCE_MODE || '').trim()
```

Add this to the `define` block:

```js
'import.meta.env.VITE_MAINTENANCE_MODE': JSON.stringify(resolvedMaintenanceMode),
```

- [ ] **Step 5: Document the env flag**

Add to `.env.example` near the Convex frontend variables:

```text
# Build-time maintenance page gate for scheduled downtime only.
VITE_MAINTENANCE_MODE=false
```

- [ ] **Step 6: Run test to verify it passes**

Run:

```bash
cd stitch-app
node scripts/production-maintenance-mode-regression.test.mjs
```

Expected: PASS and prints `production-maintenance-mode-regression.test.mjs passed`.

## Task 3: Runbook And Checklist Updates

**Files:**
- Modify: `stitch-app/docs/convex-sqlite-to-postgres-migration.md`
- Modify: `stitch-app/tasks/todo.md`
- Test: `stitch-app/scripts/production-maintenance-mode-regression.test.mjs`
- Test: `stitch-app/scripts/convex-sqlite-to-postgres-runbook.test.mjs`

- [ ] **Step 1: Add maintenance and disk-headroom procedure to the runbook**

Add a section before Phase 8 documenting:

```markdown
## Phase 7.5: Maintenance Build, Convex Pause, And Disk Headroom

Deploy a frontend build with `VITE_MAINTENANCE_MODE=true` before pausing
production writes. Then pause the self-hosted Convex deployment:

```bash
curl -X POST \
  -H "Authorization: Convex <admin-key>" \
  https://api.chewnpour.com/api/v1/pause_deployment
```

The staging pause rehearsal on `2026-06-02` verified that public queries work
before pause, fail while paused, and work again after unpause.

After write quiescence is proven, create the provider-level Droplet snapshot
and permanently expand the production Droplet to the already-included `160 GB`
disk:

```bash
doctl compute droplet-action resize 566121482 \
  --size s-4vcpu-8gb \
  --resize-disk \
  --wait
```

DigitalOcean documents that disk resize is permanent and the action powers off
the Droplet. Verify filesystem size, Docker containers, production frontend
HTTP `200`, and production backend HTTP `200` before continuing.

After Postgres-backed smoke checks pass, unpause Convex and deploy the frontend
with `VITE_MAINTENANCE_MODE=false`:

```bash
curl -X POST \
  -H "Authorization: Convex <admin-key>" \
  https://api.chewnpour.com/api/v1/unpause_deployment
```
```

- [ ] **Step 2: Update Phase 8 sequence**

Ensure Phase 8 includes the frontend maintenance build first, `POST /api/v1/pause_deployment`, snapshot, disk resize, Postgres cutover, `POST /api/v1/unpause_deployment`, and `VITE_MAINTENANCE_MODE=false` deploy.

- [ ] **Step 3: Add checklist evidence**

Add a todo section titled `Production Maintenance Screen And Pause Readiness` with:

```markdown
### Production Maintenance Screen And Pause Readiness

- Implemented a build-time `VITE_MAINTENANCE_MODE=true` frontend gate that
  renders a static maintenance screen before the Convex client and normal app
  providers are constructed.
- Staging pause rehearsal on `2026-06-02`: public query before pause passed,
  `POST /api/v1/pause_deployment` returned HTTP `200`, public query while
  paused was blocked, `POST /api/v1/unpause_deployment` returned HTTP `200`,
  and public query after unpause passed.
- Production and staging both expose `/api/v1/pause_deployment` and
  `/api/v1/unpause_deployment` in their self-hosted Convex OpenAPI output.
- Production Droplet `convex-selfhosted` currently has an `80 GB` disk while
  its existing `s-4vcpu-8gb` plan includes `160 GB`; expand to the
  already-included size inside the maintenance window before the final export.
- Production remains SQLite-backed. Do not set `POSTGRES_URL` or unpause writes
  until the final Postgres-backed import and smoke checks pass.
```

- [ ] **Step 4: Run runbook tests**

Run:

```bash
cd stitch-app
node scripts/production-maintenance-mode-regression.test.mjs
node scripts/convex-sqlite-to-postgres-runbook.test.mjs
```

Expected: both scripts pass.

## Task 4: Build, Render Verification, And Commit

**Files:**
- Verify all files changed in Tasks 1-3.

- [ ] **Step 1: Run lint**

```bash
cd stitch-app
npm run lint
```

Expected: exit `0`.

- [ ] **Step 2: Run default build**

```bash
cd stitch-app
npm run build
```

Expected: exit `0`.

- [ ] **Step 3: Run maintenance build**

```bash
cd stitch-app
VITE_MAINTENANCE_MODE=true npm run build
```

Expected: exit `0`.

- [ ] **Step 4: Verify rendered maintenance build**

Run:

```bash
cd stitch-app
npx vite preview --host 127.0.0.1 --port 4177
```

Then check the page with Playwright or curl-backed HTML inspection. Expected:
the browser-rendered page contains `ChewnPour is under scheduled maintenance`
and `Please try again shortly`.

- [ ] **Step 5: Verify production remained untouched**

Run:

```bash
curl -sS -o /dev/null -w 'production_frontend=%{http_code}\n' https://www.chewnpour.com
curl -sS -o /dev/null -w 'production_backend=%{http_code}\n' https://api.chewnpour.com
ssh root@164.90.190.254 'python3 - <<'"'"'PY'"'"'
from pathlib import Path
values = {}
for line in Path("/opt/convex/.env").read_text().splitlines():
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        key, value = line.split("=", 1)
        values[key] = value
print("production_postgres_url=" + ("set" if values.get("POSTGRES_URL") else "empty"))
PY'
```

Expected: frontend/backend HTTP `200`, `production_postgres_url=empty`.

- [ ] **Step 6: Commit and push implementation**

```bash
git add \
  stitch-app/scripts/production-maintenance-mode-regression.test.mjs \
  stitch-app/src/lib/maintenance-mode.js \
  stitch-app/src/components/MaintenanceScreen.jsx \
  stitch-app/src/bootstrap/AppProviders.jsx \
  stitch-app/vite.config.js \
  stitch-app/.env.example \
  stitch-app/docs/convex-sqlite-to-postgres-migration.md \
  stitch-app/tasks/todo.md
git commit -m "Add production maintenance mode"
git push origin codex/dashboard-dark-mode-toggle
```
