import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const aiPath = path.resolve('convex/ai.ts');
const envPath = path.resolve('.env.example');
const fallbackLibPath = path.resolve('convex/lib/llmProviderFallback.js');

const aiSource = fs.readFileSync(aiPath, 'utf8');
const envSource = fs.readFileSync(envPath, 'utf8');
const fallbackSource = fs.readFileSync(fallbackLibPath, 'utf8');

assert.match(envSource, /^MINIMAX_API_KEY=/m, '.env.example should declare MINIMAX_API_KEY');
assert.match(envSource, /^MINIMAX_BASE_URL=https:\/\/api\.minimax\.io\/v1\/$/m, '.env.example should declare the global MiniMax base URL');
assert.match(envSource, /^MINIMAX_MODEL=MiniMax-M2\.7$/m, '.env.example should declare the MiniMax model');
assert.match(envSource, /^MINIMAX_EXPERIMENTAL_FALLBACK_FEATURES=/m, '.env.example should declare feature-gated MiniMax fallback');

assert.match(aiSource, /const MINIMAX_BASE_URL = \(\(\) => \{/s, 'ai.ts should define a MiniMax base URL');
assert.match(aiSource, /const MINIMAX_MODEL = String\(process\.env\.MINIMAX_MODEL \|\| "MiniMax-M2\.7"\)/, 'ai.ts should define a MiniMax model');
assert.match(aiSource, /const MINIMAX_EXPERIMENTAL_FALLBACK_FEATURES = new Set\(/, 'ai.ts should parse feature-gated MiniMax fallbacks');
assert.match(aiSource, /const featureAllowsMiniMaxExperimentalFallback = \(feature: string\) =>/, 'ai.ts should gate MiniMax fallback by feature');
assert.match(aiSource, /const callMiniMaxText = async \(\) => \{/s, 'ai.ts should implement MiniMax text calls');
assert.match(aiSource, /fallbackProvider: "minimax"/, 'ai.ts should log MiniMax fallback routing');
assert.match(aiSource, /callMiniMaxWithOptionalInceptionFallback/, 'ai.ts should allow MiniMax fallback to cascade into Inception when needed');
assert.match(aiSource, /provider: "minimax"/, 'MiniMax should be included in provider telemetry');

assert.match(fallbackSource, /export const shouldFallbackToMiniMaxText = \(\{ errorMessage, minimaxApiKey \}\) => \{/, 'Fallback library should expose MiniMax fallback detection');
assert.match(fallbackSource, /isMiniMaxProviderFailure/, 'Fallback library should classify MiniMax provider failures');

console.log('minimax-experimental-fallback-regression.test.mjs passed');
