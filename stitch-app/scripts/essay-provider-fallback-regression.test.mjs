import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const aiPath = path.resolve('convex/ai.ts');
const source = fs.readFileSync(aiPath, 'utf8');

assert.match(
  source,
  /const featurePrefersInceptionTextFallback = \(feature: string\) =>\s*String\(feature \|\| ""\)\.trim\(\) === "essay_generation";/s,
  'Essay generation should explicitly prefer Inception as the first fallback provider.'
);

assert.match(
  source,
  /if \(openAiFallbackPrefersInception && args\.allowInceptionFallback && shouldFallbackToInceptionText\(\{ errorMessage, inceptionApiKey \}\)\) \{\s*console\.warn\("\[LLM\] primary_provider_failed_using_fallback"/s,
  'OpenAI essay failures should attempt Inception fallback before Bedrock.'
);

assert.match(
  source,
  /if \(openAiFallbackPrefersInception && args\.allowInceptionFallback && inceptionApiKey\) \{\s*console\.warn\("\[LLM\] primary_provider_unavailable_using_fallback"/s,
  'OpenAI essay unavailability should attempt Inception fallback before Bedrock.'
);

console.log('essay-provider-fallback-regression.test.mjs passed');
