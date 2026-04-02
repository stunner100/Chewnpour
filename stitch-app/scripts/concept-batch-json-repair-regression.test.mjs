import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const repoRoot = '/private/tmp/stitch-concept-phase2/stitch-app';
const aiPath = path.join(repoRoot, 'convex/ai.ts');
const source = await fs.readFile(aiPath, 'utf8');

assert.match(
  source,
  /const parseConceptExerciseBatchWithRepair = async \(/,
  'Concept batch repair helper should exist.'
);

assert.match(
  source,
  /const buildConceptExerciseBatchRepairSchema = \(\) => `\{/,
  'Concept batch repair schema should be defined.'
);

assert.match(
  source,
  /const parsed = await parseConceptExerciseBatchWithRepair\(response, \{/,
  'Concept batch generation should use the repair-aware parser.'
);

assert.doesNotMatch(
  source,
  /const parsed = parseJsonFromResponse\(response, "concept exercise batch"\);/,
  'Concept batch generation should not parse raw LLM output without repair.'
);

console.log('concept-batch-json-repair-regression: ok');
