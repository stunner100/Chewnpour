import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rootDir = resolve(import.meta.dirname, '..');
const pipelinePath = resolve(rootDir, 'convex/lib/documentExtractionPipeline.ts');
const source = readFileSync(pipelinePath, 'utf8');

assert.ok(
  source.includes('export const shouldRunDoclingFallback')
    && source.includes('export const selectDoclingParser'),
  'Expected the pipeline to expose explicit Docling fallback routing helpers.'
);
assert.ok(
  source.includes('args.metrics.scannedLikely')
    && source.includes('args.metrics.tableRecoveryRatio < STRICT_TABLE_RECOVERY_THRESHOLD')
    && source.includes('args.metrics.weakPageRatio > args.metrics.weakPageThreshold'),
  'Expected fallback routing to consider scanned documents, weak page ratios, and weak table recovery.'
);
assert.ok(
  source.includes('return "enhanced_pdf"')
    && source.includes('return "paddleocr_vl"')
    && source.includes('return "docx_structured"'),
  'Expected Docling parser routing to cover scanned PDFs, table-heavy PDFs, and DOCX fallback.'
);
assert.ok(
  source.includes('if (!isDoclingEnabled())')
    && source.includes('backend: "docling"'),
  'Expected Docling recommendations to stay gated behind runtime configuration.'
);

console.log('extraction-docling-fallback-regression tests passed');
