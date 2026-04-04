import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rootDir = resolve(import.meta.dirname, '..');
const pipelinePath = resolve(rootDir, 'convex/lib/documentExtractionPipeline.ts');
const source = readFileSync(pipelinePath, 'utf8');

assert.ok(
  source.includes('export const shouldRunDataLabOssFallback')
    && source.includes('export const selectDataLabOssParser'),
  'Expected the pipeline to expose explicit Datalab OSS fallback routing helpers.'
);
assert.ok(
  source.includes('args.metrics.scannedLikely')
    && source.includes('args.metrics.tableRecoveryRatio < STRICT_TABLE_RECOVERY_THRESHOLD')
    && source.includes('args.metrics.weakPageRatio > args.metrics.weakPageThreshold'),
  'Expected fallback routing to consider scanned documents, weak page ratios, and weak table recovery.'
);
assert.ok(
  source.includes('return "chandra"')
    && source.includes('return "marker_ocr"')
    && source.includes('return "marker"'),
  'Expected Datalab OSS parser routing to cover OCR-heavy scans, forced OCR PDFs, and standard office documents.'
);
assert.ok(
  source.includes('if (!isDataLabOssEnabled())')
    && source.includes('backend: "datalab_oss"'),
  'Expected Datalab OSS recommendations to stay gated behind runtime configuration.'
);

console.log('extraction-datalab-oss-fallback-regression tests passed');
