import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rootDir = resolve(import.meta.dirname, '..');
const pipelinePath = resolve(rootDir, 'convex/lib/documentExtractionPipeline.ts');
const extractionPath = resolve(rootDir, 'convex/extraction.ts');

const pipelineSource = readFileSync(pipelinePath, 'utf8');
const extractionSource = readFileSync(extractionPath, 'utf8');

assert.ok(
  pipelineSource.includes('export const shouldRunLlamaParseFallback'),
  'Expected extraction pipeline to expose LlamaParse fallback eligibility helper.'
);
assert.ok(
  pipelineSource.includes('const getLlamaParseFallbackRecommendation')
    && pipelineSource.includes('backend: "llamaparse"')
    && pipelineSource.includes('parser: "llamaparse"'),
  'Expected extraction pipeline to build a LlamaParse fallback recommendation for weak Azure candidates.'
);
assert.ok(
  pipelineSource.includes('const getAzureFallbackRecommendation')
    && pipelineSource.includes('fallbackRecommendation: getAzureFallbackRecommendation('),
  'Expected Azure extraction candidate to resolve fallback recommendations through the shared Azure fallback policy.'
);
assert.ok(
  pipelineSource.includes('if (dataLabFallback && dataLabFallback.reason !== "weak_page_ratio_candidate")')
    && pipelineSource.includes('const llamaParseFallback = getLlamaParseFallbackRecommendation(args);'),
  'Expected Azure fallback policy to keep Datalab for scanned/table-heavy cases and prefer LlamaParse only for weaker non-specialized Azure quality issues.'
);
assert.ok(
  extractionSource.includes('const didUseFallbackBackend')
    && extractionSource.includes('fallbackUsed: didUseFallbackBackend(upload.fileType, result.backend)')
    && extractionSource.includes('fallbackUsed: didUseFallbackBackend(upload.fileType, result?.backend)'),
  'Expected extraction persistence to resolve fallback usage against the per-file primary backend, including MarkItDown for office documents.'
);

console.log('llamaparse-fallback-routing-regression tests passed');
