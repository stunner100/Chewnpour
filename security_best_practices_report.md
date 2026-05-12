# Security Best Practices Report

Date: 2026-05-11

## Executive Summary

I scanned the active projects in this repository: `stitch-app` (React/Vite plus Convex functions), `docling-service` (FastAPI), and `chewnpour-product-video` (HyperFrames package). The highest-priority issues are:

- A public Convex development mutation can delete users when the production guard is misconfigured.
- `stitch-app` has production dependency advisories, including a critical `protobufjs` advisory in the production dependency graph.
- Ignored local environment files contain live-looking secrets. Values are intentionally not copied into this report.
- `docling-service` permits unauthenticated extraction when `DOCLING_SHARED_SECRET` is unset and reads entire uploads into memory without an app-side size limit.

Dependency scan results:

- `stitch-app`: `npm audit --omit=dev` found 4 production advisories: 1 critical, 2 high, 1 moderate.
- `stitch-app`: full `npm audit` found 19 total advisories including dev tooling.
- `docling-service`: `uvx pip-audit --format json .` found no known Python package vulnerabilities.
- `chewnpour-product-video`: `npm audit --json` found no vulnerabilities.

Source scan notes:

- No `dangerouslySetInnerHTML`, `innerHTML`, `document.write`, `eval`, `new Function`, string `setTimeout`, or string `setInterval` sinks were found in app source during the grep-based scan.
- Security headers may be set by hosting or Cloudflare, but they are not visible in the checked-in app config reviewed here.

## Critical Findings

### SEC-001: Public destructive dev mutation is guarded only by `NODE_ENV`

Severity: Critical

Location: `stitch-app/convex/devAuth.ts:5`, `stitch-app/convex/devAuth.ts:7`

Evidence:

```ts
const isProd = process.env.NODE_ENV === "production";

export const devDeleteUserByEmail = mutation({
```

The mutation deletes Better Auth account/session/user records and the matching profile after only this environment check.

Impact:

If a deployed Convex environment does not set `NODE_ENV=production`, any caller who can invoke public Convex mutations can delete an account by email. Even if production currently sets the flag, the function is exported as a public mutation and the destructive control depends on one environment variable.

Fix:

Remove this public mutation from deployable Convex code, or convert it to an `internalMutation` that is only called by trusted test/admin tooling. If it must remain callable, require explicit admin authorization plus a separate test-only environment flag.

Mitigation:

Verify production Convex environment variables immediately and search deployment logs for calls to `devDeleteUserByEmail`.

False positive notes:

If Convex guarantees `NODE_ENV=production` in every production deployment, the immediate exposure is lower. The exported unauthenticated destructive mutation remains unsafe-by-default.

### SEC-002: Production dependency advisories in `stitch-app`

Severity: Critical

Location: `stitch-app/package.json:13`, `stitch-app/package.json:17`, `stitch-app/package.json:27`; `stitch-app/package-lock.json:5473`, `stitch-app/package-lock.json:5493`, `stitch-app/package-lock.json:7287`, `stitch-app/package-lock.json:8189`

Evidence:

`npm audit --omit=dev --json` reports:

- `protobufjs@7.5.4`: critical arbitrary code execution advisory, brought in by `posthog-js`.
- `kysely@0.28.10`: high SQL injection advisories, brought in by `better-auth`.
- `defu@6.1.4`: high prototype pollution advisory, brought in by `better-auth`.
- `dompurify@3.3.1`: moderate XSS-related advisories, brought in by `posthog-js`.

Impact:

These packages are in the production dependency graph. Exploitability depends on whether the vulnerable APIs are reachable with attacker-controlled input, but the `protobufjs` advisory is critical and should be patched promptly.

Fix:

Upgrade the direct packages that own these transitive dependencies, primarily `posthog-js`, `@posthog/react`, `better-auth`, and `@convex-dev/better-auth`. Re-run `npm audit --omit=dev` after upgrades and run the normal app verification suite.

Mitigation:

If upgrades are blocked, use npm `overrides` only after validating compatibility with PostHog and Better Auth. Avoid accepting untrusted protobuf schemas, untrusted SQL path fragments, or untrusted DOMPurify policy options.

False positive notes:

Audit findings are dependency advisories, not confirmed exploit paths in this app. They are still production graph risk.

## High Findings

### SEC-003: Live-looking secrets exist in ignored local env files

Severity: High

Location: `stitch-app/.env.local:6`, `stitch-app/.env.local:9`, `stitch-app/.env.local:18`, `stitch-app/.env.local:20`, `stitch-app/.env.local:23`, `stitch-app/.env.local:24`, `stitch-app/.env.local:25`, `stitch-app/.env.local:26`, `stitch-app/.env.local:27`, `stitch-app/.env.local:28`, `stitch-app/.env.local:29`, `stitch-app/.env.local:30`, `stitch-app/.env.local:33`, `stitch-app/.env.local:40`, `stitch-app/.env.production.local:4`, `stitch-app/.env.production.local:5`, `stitch-app/.env.production.local:23`

Evidence:

The local files are ignored by `stitch-app/.gitignore:27` and `stitch-app/.gitignore:28`, but they contain live-looking provider/API credentials and a Vercel OIDC token. Secret values are intentionally redacted from this report.

Impact:

Even ignored files are exposed to local malware, backups, terminal scrollback, accidental screenshots, file sharing, and tool output. Several detected values appear to be production/live credentials.

Fix:

Rotate all live-looking secrets present in those local files. Keep only placeholders in repo templates and store active values in the provider/hosting secret manager. Remove obsolete duplicate keys after rotation.

Mitigation:

Use a secret scanner in pre-commit/CI and avoid running broad grep commands that print secret values.

False positive notes:

Some values may be public publishable keys such as PostHog or Sentry DSNs. Payment, AI provider, signing, and webhook credentials should be treated as private unless the provider explicitly documents them as public.

### SEC-004: Docling extraction can be unauthenticated and lacks upload size limits

Severity: High

Location: `docling-service/render_api/app.py:12`, `docling-service/render_api/app.py:14`, `docling-service/render_api/app.py:406`, `docling-service/render_api/app.py:414`, `docling-service/render_api/app.py:427`, `docling-service/render_api/app.py:428`

Evidence:

```py
DOCLING_SHARED_SECRET = os.getenv("DOCLING_SHARED_SECRET", "").strip()
...
if DOCLING_SHARED_SECRET and x_docling_shared_secret != DOCLING_SHARED_SECRET:
    raise HTTPException(status_code=401, detail="Invalid shared secret.")
...
payload = await file.read()
```

If `DOCLING_SHARED_SECRET` is empty, `/extract` is open. The handler then reads the entire uploaded file into memory before writing it to a temp file.

Impact:

A public deployment with a missing shared secret can be abused for unauthenticated document parsing, CPU/GPU/IO consumption, and memory exhaustion through large uploads.

Fix:

Fail closed when `DOCLING_SHARED_SECRET` is missing outside explicit local development. Add an app-side max upload size before reading the whole payload, and stream to disk in bounded chunks.

Mitigation:

Enforce request size and auth at the edge as well, but do not rely only on edge controls.

False positive notes:

If this service is never internet-reachable and the edge always requires auth plus size limits, exposure is lower. Those controls are not visible in this repo.

## Medium Findings

### SEC-005: Public Docling smoke action can consume extraction resources

Severity: Medium

Location: `stitch-app/convex/extraction.ts:734`, `stitch-app/convex/extraction.ts:767`

Evidence:

```ts
export const smokeDoclingExtraction = action({
    args: {},
    handler: async () => {
```

The action constructs a DOCX payload and calls the extraction pipeline with the Docling backend.

Impact:

If deployed with Docling enabled, any caller can invoke this public action repeatedly to consume Convex action runtime and Docling service resources.

Fix:

Convert this to an `internalAction`, remove it from production code, or require admin authorization.

Mitigation:

Add rate limiting and monitor Docling request volume.

False positive notes:

The payload is fixed and does not create SSRF. The risk is resource consumption and exposing operational smoke-test functionality publicly.

### SEC-006: Browser security headers are not visible in app config

Severity: Medium

Location: `stitch-app/vercel.json:2`, `stitch-app/vercel.json:31`, `stitch-app/index.html:24`

Evidence:

`vercel.json` only defines cache headers and rewrites. The HTML includes an inline script for theme bootstrapping, but no repository-visible CSP or other security headers were found.

Impact:

Without a CSP, `frame-ancestors`/clickjacking protection, `X-Content-Type-Options`, and a referrer policy, a future XSS or embedding issue has a larger blast radius.

Fix:

Add production response headers in hosting/edge config. At minimum, define a CSP that accounts for Vite assets, the inline theme bootstrap, Google Fonts, Convex, PostHog, Sentry, and payment redirects; add `frame-ancestors 'none'` unless embedding is required, `X-Content-Type-Options: nosniff`, and a strict referrer policy.

Mitigation:

If Cloudflare already sets these headers, document and verify them with runtime header checks.

False positive notes:

Headers may be set outside the repo by Cloudflare/Vercel dashboard settings. That was not visible in source.

### SEC-007: Convex browser JWT is read from localStorage

Severity: Medium

Location: `stitch-app/src/pages/ExamMode.jsx:451`, `stitch-app/src/pages/ExamMode.jsx:454`, `stitch-app/src/pages/ExamMode.jsx:483`, `stitch-app/src/pages/ExamMode.jsx:598`, `stitch-app/src/pages/ExamMode.jsx:600`

Evidence:

```jsx
const raw = window.localStorage.getItem('better-auth_cookie');
...
const response = await fetch(`${authBaseUrl}/api/auth/convex/token`, {
    credentials: 'include',
});
...
client.setAuth(token);
```

Impact:

Any XSS in the app or malicious browser extension can read localStorage and steal the cached Convex JWT. The source scan did not find obvious XSS sinks, but token storage in localStorage increases impact if one appears later.

Fix:

Prefer obtaining short-lived Convex auth through an httpOnly cookie-backed flow or a narrowly scoped server endpoint that does not expose long-lived tokens to localStorage. If client-side tokens are unavoidable, keep TTLs short and do not manually read storage unless the auth library requires it.

Mitigation:

Deploy CSP/Trusted Types hardening and monitor token refresh failures/anomalies.

False positive notes:

This may mirror Better Auth's storage design. The risk is not a proven current XSS; it is credential exposure impact if browser-side script execution is compromised.

## Low / Informational

### SEC-008: Full npm audit includes dev-tool advisories

Severity: Low

Location: `stitch-app/package.json:34`, `stitch-app/package-lock.json`

Evidence:

Full `npm audit --json` found 19 advisories total. After omitting dev dependencies, 4 remain in the production graph.

Impact:

Dev-server and build-tool advisories can matter for developer machines and CI, especially Vite/Rollup file-read/write issues, but they are less urgent than production graph advisories.

Fix:

After production dependency upgrades, update dev tooling and rerun full `npm audit`.

Mitigation:

Do not expose local dev servers to untrusted networks.

False positive notes:

Some dev advisories are not exploitable in production bundles.
