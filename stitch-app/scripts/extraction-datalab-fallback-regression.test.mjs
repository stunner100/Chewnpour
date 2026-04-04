import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rootDir = resolve(import.meta.dirname, '..');
const pipelinePath = resolve(rootDir, 'convex/lib/documentExtractionPipeline.ts');
const source = readFileSync(pipelinePath, 'utf8');

assert.ok(
  source.includes('export const shouldRunDataLabFallback')
    && source.includes('const getDataLabFallbackRecommendation'),
  'Expected the pipeline to expose explicit Datalab fallback routing helpers.'
);
assert.ok(
  source.includes('args.metrics.scannedLikely')
    && source.includes('args.metrics.tableRecoveryRatio < STRICT_TABLE_RECOVERY_THRESHOLD')
    && source.includes('args.metrics.weakPageRatio > args.metrics.weakPageThreshold'),
  'Expected fallback routing to consider scanned documents, weak page ratios, and weak table recovery.'
);
assert.ok(
  source.includes('backend: "datalab"')
    && source.includes('parser: "datalab"')
    && source.includes('structured_docx_candidate'),
  'Expected Datalab fallback recommendations to target the hosted Datalab backend for scanned, weak, and structured document cases.'
);
assert.ok(
  source.includes('if (!isDataLabEnabled())')
    && source.includes('backend: "datalab"'),
  'Expected hosted Datalab recommendations to stay gated behind runtime configuration.'
);

console.log('extraction-datalab-fallback-regression tests passed');
