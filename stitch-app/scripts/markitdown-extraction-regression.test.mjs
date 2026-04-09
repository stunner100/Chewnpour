import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const pipelinePath = resolve(root, 'convex', 'lib', 'documentExtractionPipeline.ts');
const extractionPath = resolve(root, 'convex', 'extraction.ts');
const clientPath = resolve(root, 'convex', 'lib', 'markitdownClient.ts');
const scriptPath = resolve(root, 'scripts', 'markitdown_convert.py');
const envPath = resolve(root, '.env.example');

const pipelineSource = readFileSync(pipelinePath, 'utf8');
const extractionSource = readFileSync(extractionPath, 'utf8');
const clientSource = readFileSync(clientPath, 'utf8');
const scriptSource = readFileSync(scriptPath, 'utf8');
const envSource = readFileSync(envPath, 'utf8');

assert.ok(
  pipelineSource.includes('export type ExtractionBackendId = "markitdown" | "datalab" | "azure" | "llamaparse"'),
  'Expected MarkItDown to be a first-class extraction backend.'
);
assert.ok(
  pipelineSource.includes('parser: "markitdown_markdown"')
    && pipelineSource.includes('pass: "markitdown_markdown"'),
  'Expected MarkItDown extraction to persist a dedicated parser and provider pass label.'
);
assert.ok(
  pipelineSource.includes('console.warn("[Extraction] markitdown_primary_failed"')
    && pipelineSource.includes('message: error instanceof Error ? error.message : String(error)'),
  'Expected the MarkItDown-first office route to log converter failures before falling back.'
);
assert.ok(
  pipelineSource.includes('const parseMarkItDownPages')
    && pipelineSource.includes('source: "markitdown"')
    && pipelineSource.includes('countMarkdownTables'),
  'Expected MarkItDown extraction to synthesize structured pages from markdown sections.'
);
assert.ok(
  extractionSource.includes('v.literal("markitdown")')
    && extractionSource.includes('return "markitdown";'),
  'Expected extraction actions to accept the MarkItDown backend and treat it as primary for PPTX/DOCX.'
);
assert.ok(
  clientSource.includes('spawn(MARKITDOWN_PYTHON_BIN')
    && clientSource.includes('markitdown_convert.py'),
  'Expected the MarkItDown bridge to shell out through the configured Python interpreter.'
);
assert.ok(
  scriptSource.includes('MarkItDown(enable_plugins=False)')
    && scriptSource.includes('result = converter.convert'),
  'Expected the Python bridge script to call the official MarkItDown API.'
);
assert.ok(
  envSource.includes('MARKITDOWN_PYTHON_BIN=python3')
    && envSource.includes('MARKITDOWN_TIMEOUT_MS=120000'),
  'Expected .env.example to document the MarkItDown bridge runtime.'
);

console.log('markitdown-extraction-regression tests passed');
