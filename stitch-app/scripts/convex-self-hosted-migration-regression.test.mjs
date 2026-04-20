import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const envPath = resolve(root, '.env.example');
const readmePath = resolve(root, 'README.md');
const migrationDocPath = resolve(root, 'docs', 'convex-self-hosted-migration.md');
const composePath = resolve(root, 'deploy', 'convex-self-hosted', 'compose.yaml');
const caddyPath = resolve(root, 'deploy', 'convex-self-hosted', 'Caddyfile');
const deployEnvPath = resolve(root, 'deploy', 'convex-self-hosted', '.env.example');
const smokePath = resolve(root, 'scripts', 'convex-self-hosted-smoke.mjs');

const envSource = readFileSync(envPath, 'utf8');
const readmeSource = readFileSync(readmePath, 'utf8');
const migrationDocSource = readFileSync(migrationDocPath, 'utf8');
const composeSource = readFileSync(composePath, 'utf8');
const caddySource = readFileSync(caddyPath, 'utf8');
const deployEnvSource = readFileSync(deployEnvPath, 'utf8');
const smokeSource = readFileSync(smokePath, 'utf8');

assert.ok(
  envSource.includes('CONVEX_SELF_HOSTED_URL=') &&
    envSource.includes('CONVEX_SELF_HOSTED_ADMIN_KEY='),
  'Expected .env.example to document self-hosted Convex deploy variables.'
);

assert.ok(
  composeSource.includes('ghcr.io/get-convex/convex-backend') &&
    composeSource.includes('CONVEX_CLOUD_ORIGIN: ${CONVEX_CLOUD_ORIGIN}') &&
    composeSource.includes('CONVEX_SITE_ORIGIN: ${CONVEX_SITE_ORIGIN}') &&
    composeSource.includes('POSTGRES_URL: ${POSTGRES_URL:-}'),
  'Expected the self-hosted Convex compose file to use the official backend image and configurable origins.'
);

assert.ok(
  caddySource.includes('{$CONVEX_API_HOSTNAME}') &&
    caddySource.includes('reverse_proxy backend:3210') &&
    caddySource.includes('{$CONVEX_SITE_HOSTNAME}') &&
    caddySource.includes('reverse_proxy backend:3211'),
  'Expected the Convex reverse-proxy config to expose both API and site origins.'
);

assert.ok(
  deployEnvSource.includes('CONVEX_API_HOSTNAME=') &&
    deployEnvSource.includes('CONVEX_SITE_HOSTNAME=') &&
    deployEnvSource.includes('CONVEX_CLOUD_ORIGIN=') &&
    deployEnvSource.includes('CONVEX_SITE_ORIGIN='),
  'Expected the self-hosted Convex env example to declare hostname and origin values.'
);

assert.ok(
  migrationDocSource.includes('npx convex export --path ./backups') &&
    migrationDocSource.includes('npx convex import --replace ./backups/<backup>.zip') &&
    migrationDocSource.includes('VITE_CONVEX_URL=https://api.chewnpour.com') &&
    migrationDocSource.includes('CONVEX_URL=https://api.chewnpour.com'),
  'Expected the migration doc to describe export/import and frontend cutover.'
);

assert.ok(
  migrationDocSource.includes('2 vCPU / 4 GB RAM / 80 GB SSD') &&
    migrationDocSource.includes('SQLite first') &&
    migrationDocSource.includes('dashboard locally'),
  'Expected the migration doc to recommend the cheap starting resource profile.'
);

assert.ok(
  smokeSource.includes("fetch(`${baseUrl}/version`)") &&
    smokeSource.includes('CONVEX_SELF_HOSTED_URL'),
  'Expected the self-hosted Convex smoke script to verify the version endpoint.'
);

assert.ok(
  readmeSource.includes('convex-self-hosted-migration'),
  'Expected the README to link to the self-hosted Convex migration guide.'
);

console.log('convex-self-hosted-migration-regression.test.mjs passed');
