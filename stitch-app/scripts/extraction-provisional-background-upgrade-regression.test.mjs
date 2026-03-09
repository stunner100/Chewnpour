import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const aiPath = resolve(root, 'convex', 'ai.ts');
const extractionPath = resolve(root, 'convex', 'extraction.ts');
const extractionStatePath = resolve(root, 'convex', 'extractionState.ts');

const aiSource = readFileSync(aiPath, 'utf8');
const extractionSource = readFileSync(extractionPath, 'utf8');
const extractionStateSource = readFileSync(extractionStatePath, 'utf8');

assert.ok(
  extractionSource.includes('export const runBackgroundReprocess = internalAction'),
  'Expected extraction module to define runBackgroundReprocess internal action.'
);
assert.ok(
  extractionSource.includes('export const applyExtractionUpgrade = internalAction'),
  'Expected extraction module to define applyExtractionUpgrade internal action.'
);
assert.ok(
  extractionSource.includes('ctx.runAction(internal.extraction.applyExtractionUpgrade'),
  'Expected background reprocess path to call applyExtractionUpgrade on strict pass.'
);
assert.ok(
  extractionSource.includes('status: "failed"'),
  'Expected extraction module to mark failed extraction states explicitly.'
);
assert.ok(
  extractionSource.includes('content_loss_suspected'),
  'Expected extraction module to emit content_loss_suspected telemetry for weak coverage.'
);
assert.ok(
  extractionSource.includes('upload.status === "ready" ? "ready" : "processing"'),
  'Expected background extraction updates to preserve ready upload status.'
);
assert.equal(
  extractionSource.includes('ctx.db'),
  false,
  'Node extraction action must not access ctx.db directly; use query/mutation helpers.'
);
assert.ok(
  extractionStateSource.includes('export const insertDocumentExtraction = internalMutation'),
  'Expected extractionState internal mutation for document extraction persistence.'
);
assert.ok(
  aiSource.includes('ctx.scheduler.runAfter(0, internal.extraction.runBackgroundReprocess'),
  'Expected provisional foreground extraction to schedule background reprocess.'
);

console.log('extraction-provisional-background-upgrade-regression tests passed');
