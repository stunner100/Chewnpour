import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const pipelinePath = resolve(root, 'convex', 'lib', 'documentExtractionPipeline.ts');
const doclingClientPath = resolve(root, 'convex', 'lib', 'doclingClient.ts');
const envPath = resolve(root, '.env.example');
const stagingDocPath = resolve(root, 'docs', 'staging.md');
const readmePath = resolve(root, 'README.md');

const pipelineSource = readFileSync(pipelinePath, 'utf8');
const doclingClientSource = readFileSync(doclingClientPath, 'utf8');
const envSource = readFileSync(envPath, 'utf8');
const stagingDocSource = readFileSync(stagingDocPath, 'utf8');
const readmeSource = readFileSync(readmePath, 'utf8');

assert.ok(
  pipelineSource.includes('const EXTRACTION_DEFAULT_BACKEND = String(process.env.EXTRACTION_DEFAULT_BACKEND || "")')
    && pipelineSource.includes('if (EXTRACTION_DEFAULT_BACKEND === "docling" && isDoclingEnabled()) return "docling";')
    && pipelineSource.includes('if (defaultBackend === "docling") {')
    && pipelineSource.includes('return await runDoclingExtractionCandidate(args);'),
  'Expected the extraction pipeline to allow an env-driven Docling cutover.'
);

assert.ok(
  doclingClientSource.includes('export const isDoclingEnabled = () => Boolean(DOCLING_API_BASE_URL);')
    && doclingClientSource.includes('Authorization = `Bearer ${DOCLING_API_KEY}`')
    && doclingClientSource.includes('to_formats: ["md"]'),
  'Expected the Docling client to support a bearer-protected staging service and request markdown output.'
);

assert.ok(
  envSource.includes('EXTRACTION_DEFAULT_BACKEND=')
    && envSource.includes('DOCLING_API_BASE_URL=')
    && envSource.includes('DOCLING_API_KEY=')
    && envSource.includes('DOCLING_TIMEOUT_MS=180000'),
  'Expected .env.example to document the staging Docling override variables.'
);

assert.ok(
  stagingDocSource.includes('EXTRACTION_DEFAULT_BACKEND=docling')
    && stagingDocSource.includes('DOCLING_API_BASE_URL')
    && stagingDocSource.includes('DOCLING_API_KEY')
    && stagingDocSource.includes('Leave `EXTRACTION_DEFAULT_BACKEND` unset in production'),
  'Expected staging docs to document the Docling-only preview wiring and keep production opt-in.'
);

assert.ok(
  readmeSource.includes('EXTRACTION_DEFAULT_BACKEND=docling')
    && readmeSource.includes('DOCLING_API_BASE_URL'),
  'Expected the README staging section to mention the Docling staging cutover knobs.'
);

console.log('docling-staging-routing-regression.test.mjs passed');
