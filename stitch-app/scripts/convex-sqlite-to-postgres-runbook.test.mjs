import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(thisDir, '..');
const runbookPath = path.join(appRoot, 'docs', 'convex-sqlite-to-postgres-migration.md');
const schemaPath = path.join(appRoot, 'convex', 'schema.ts');
const source = fs.readFileSync(runbookPath, 'utf8');
const schemaSource = fs.readFileSync(schemaPath, 'utf8');

const requiredPatterns = [
  {
    label: 'DigitalOcean self-hosted constraint',
    pattern: /DigitalOcean-hosted Convex|DigitalOcean Convex/i,
  },
  {
    label: 'Convex Cloud prohibition',
    pattern: /Do not use `\*\.convex\.cloud`|Do not deploy to.*Convex Cloud/is,
  },
  {
    label: 'Postgres env var is POSTGRES_URL',
    pattern: /official[\s\S]+POSTGRES_URL[\s\S]+not[\s\S]+DATABASE_URL/is,
  },
  {
    label: 'SQLite backup integrity gate',
    pattern: /PRAGMA integrity_check/,
  },
  {
    label: 'Provider snapshot before cutover',
    pattern: /provider-level snapshot|volume snapshot|droplet/i,
  },
  {
    label: 'Staging rehearsal before production',
    pattern: /staging rehearsal|Build a Postgres-Backed Staging Convex|Production Dry Run/is,
  },
  {
    label: 'Convex export/import path',
    pattern: /npx convex export[\s\S]+npx convex import/,
  },
  {
    label: 'Convex CLI target preflight',
    pattern: /Target Preflight for Convex CLI Commands[\s\S]+npx convex deploy[\s\S]+npx convex export[\s\S]+npx convex import/,
  },
  {
    label: 'Postgres import target before production import',
    pattern: /Stop the SQLite-backed production Convex backend[\s\S]+connected to Postgres[\s\S]+production import target is the[\s\S]+Postgres-backed service[\s\S]+Import the final production export/is,
  },
  {
    label: 'Vite build URL passed during deploy',
    pattern: /--cmd-url-env-var-name VITE_CONVEX_URL/,
  },
  {
    label: 'File storage migration coverage',
    pattern: /--include-file-storage|file storage/i,
  },
  {
    label: 'write quiescence proof',
    pattern: /Write-quiescence proof[\s\S]+maintenance start[\s\S]+_creationTime/is,
  },
  {
    label: 'Better Auth component validation',
    pattern: /Better Auth|component\/auth|auth\/component/i,
  },
  {
    label: 'Rollback steps',
    pattern: /## Rollback[\s\S]+POSTGRES_URL[\s\S]+SQLite-backed Convex/is,
  },
  {
    label: 'backup restore rehearsal',
    pattern: /restoring it into a disposable[\s\S]+SQLite-backed Convex service/i,
  },
  {
    label: 'Adversarial review gate',
    pattern: /adversarial review/i,
  },
];

const missing = requiredPatterns
  .filter(({ pattern }) => !pattern.test(source))
  .map(({ label }) => label);

if (missing.length > 0) {
  throw new Error(
    `Migration runbook is missing required guardrails: ${missing.join(', ')}`
  );
}

const schemaTables = Array.from(
  schemaSource.matchAll(/^\s+([A-Za-z0-9_]+): defineTable/gm),
  (match) => match[1]
).sort();
const missingTables = schemaTables.filter(
  (tableName) => !new RegExp(`^- ${tableName}$`, 'm').test(source)
);

if (missingTables.length > 0) {
  throw new Error(
    `Migration runbook table checklist is missing schema tables: ${missingTables.join(', ')}`
  );
}

console.log('Convex SQLite to Postgres migration runbook guardrails verified.');
