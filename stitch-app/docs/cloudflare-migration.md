# Cloudflare migration

Status: discovery complete on 2026-10-14; target scope awaiting user selection.
Implementation branch: `codex/cloudflare-migration`.

## Verified baseline

The active application is React/Vite, Better Auth, Node HTTP handlers, PostgreSQL,
and Supabase Storage. Production at `https://www.chewnpour.com` is currently
served by Vercel project `stitch-app` (`prj_KsXFSONtxj30YHakjmtv1Xykn12R`).
The Google OAuth endpoint regression check passed after the Supabase project was
resumed. Do not use the older Convex benchmark notes as the current architecture.
There are no active Convex functions in this checkout, and extraction uses
`@firecrawl/anydoc`, not the historical Docling service.

Wrangler 4.151.0 could not authenticate: its local OAuth token has expired.
The user must complete `npx wrangler login`, then the account must be verified
with `npx wrangler whoami` before resources are created. The connected Supabase
account also lacks access to production project `bpfmueufwjwgkwjmxflk`.
Database/storage export access must be established before a data cutover.

## Proposed full Cloudflare target

| Responsibility | Destination | Required change |
| --- | --- | --- |
| React frontend | Workers Static Assets | SPA routing, security/cache headers, PWA behavior |
| API and Better Auth | Workers | Fetch handlers, binding-based dependencies, auth adapter |
| Relational data | D1 | Explicit SQLite schema and query conversion |
| Uploads and generated audio | R2 | Private object operations, upload URLs, object copy |
| Passage embeddings | Vectorize | Cosine search with user/topic isolation |
| Long processing jobs | Queues and/or Workflows | Durable status, retries, idempotency |
| Native extraction | Cloudflare Container | Linux NAPI dependencies, authenticated internal interface |

Keep React. An Astro rewrite is outside this migration. Google OAuth, Paystack,
Resend, and the configured AI/voice providers remain external integrations.
If the user chooses hosting only, keep PostgreSQL through Hyperdrive and
Supabase Storage; that is a different scope and does not remove Supabase.

## Implementation sequence

1. Confirm scope and Cloudflare account. Inventory live database size, table row
   counts, object count/bytes, and vector count/dimensions using read-only access.
   Check current product limits against measured data before selecting resources.
2. Establish an isolated Cloudflare preview and runtime smoke test. Port all
   active API routes, including Google start/callback, payment webhook, streaming
   tutor/voice, podcast generation, and analytics/Sentry proxy routes. API misses
   must return API errors rather than the SPA shell.
3. For the full migration, convert the 17 PostgreSQL migrations and queries
   explicitly. Replace `pg`, casts, `jsonb`, `ANY(text[])`, JSON aggregation,
   `NOW()`/`INTERVAL`, and vector operators. Define and test timestamp, boolean,
   JSON and null representations. Do not introduce a SQL string rewriting shim
   or runtime dual database compatibility.
4. Port Better Auth with its existing snake_case field mappings. Preserve user
   IDs, account IDs, credential hashes, provider links, and the auth secret.
   Verify session-cookie behavior instead of assuming existing sessions survive.
   Keep production OAuth on the canonical origin; use a separately allowed
   callback URI for preview. Preserve profile and billing signup hooks.
5. Replace Supabase Storage with R2 and native extraction with the Container.
   Move long jobs to durable execution with observable progress and bounded
   retries. Ensure payment grants and job retries cannot apply twice.
6. Move passage metadata to D1 and embeddings to Vectorize. Preserve the
   1536-dimensional embedding model unless a separately tested reindex is needed.
   Enforce user and topic filters for retrieval and deletion.
7. Rehearse complete export/import into the isolated target. Preserve IDs,
   foreign keys, hashes, object paths and ownership. Export artifacts contain
   private data and secrets: store them outside Git and restrict access.
8. Run the acceptance checks below. Produce a cutover report with measured
   migration duration, checksums/counts, known session effects and rollback steps.
9. Cut over once: pause production writes, drain jobs/webhooks appropriately,
   take final exports, import and reconcile, deploy the tested build, switch
   routing, smoke test, then resume writes. Do not run two writable backends.
   Retain the frozen source and backups until reconciliation is complete.

## Acceptance checks

- Existing email login, Google login/signup, session refresh, logout and password
  reset work; account IDs and ownership remain intact.
- Users can onboard, upload representative PDF/DOCX/PPTX inputs, finish course
  processing, study lessons, answer quizzes/exams, save notes and resume progress.
- Tutor streaming, grounded retrieval, voice and podcast generation work with
  the configured external providers; cancellation and retries terminate cleanly.
- Private files and vectors cannot be read or deleted by another user.
- Paystack webhook signatures are checked against the raw body; duplicate
  deliveries cannot duplicate purchases or credit grants.
- Table counts and foreign-key checks match the export; object inventories and
  sampled content checksums match; vector ownership/counts reconcile.
- Direct navigation, PWA updates, API errors, CSP, cache rules, analytics and
  Sentry behavior match the intended production behavior.
- Lint, targeted regression scripts, build and real Cloudflare runtime checks
  pass. Source changes are committed and pushed without local private artifacts.

## References

- https://developers.cloudflare.com/workers/static-assets/
- https://developers.cloudflare.com/d1/platform/limits/
- https://developers.cloudflare.com/r2/
- https://developers.cloudflare.com/vectorize/
- https://developers.cloudflare.com/containers/
- https://developers.cloudflare.com/hyperdrive/
