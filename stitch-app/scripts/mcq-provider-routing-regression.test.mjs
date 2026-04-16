import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const aiPath = path.resolve('convex/ai.ts');
const source = fs.readFileSync(aiPath, 'utf8');

assert.match(source, /const BEDROCK_PRIMARY_FEATURES = new Set\(\[\s*"mcq_generation"/s, 'MCQ generation should prefer Bedrock first');
assert.doesNotMatch(source, /const HARD_CUTOVER_OPENAI_FEATURES = new Set\(\[\s*"course_generation",\s*"mcq_generation"/s, 'MCQ generation should not be hard-cutover to the slow OpenAI route');
assert.match(source, /if \(BEDROCK_PRIMARY_FEATURES\.has\(feature\)\) \{\s*return "bedrock";/s, 'Provider resolver should route MCQ generation to Bedrock');
assert.match(source, /if \(preferredProvider === "bedrock"\) \{\s*return callBedrockWithFallbackText\(\{ allowInceptionFallback: true \}\);\s*\}/s, 'Bedrock-primary path should exist');

console.log('mcq-provider-routing-regression.test.mjs passed');
