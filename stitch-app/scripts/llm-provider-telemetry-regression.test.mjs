import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const aiPath = path.resolve('convex/ai.ts');
const llmUsagePath = path.resolve('convex/llmUsage.ts');
const schemaPath = path.resolve('convex/schema.ts');

const aiSource = fs.readFileSync(aiPath, 'utf8');
const llmUsageSource = fs.readFileSync(llmUsagePath, 'utf8');
const schemaSource = fs.readFileSync(schemaPath, 'utf8');

assert.match(schemaSource, /llmProviderPerformanceDaily: defineTable\(/, 'Schema should define daily provider telemetry storage');
assert.match(llmUsageSource, /export const recordProviderAttemptInternal = internalMutation\(/, 'LLM usage module should expose provider attempt recorder');
assert.match(llmUsageSource, /query\("llmProviderPerformanceDaily"\)/, 'Provider attempt recorder should aggregate into llmProviderPerformanceDaily');
assert.match(aiSource, /const recordLlmProviderAttempt = async \(args:/, 'AI pipeline should define provider attempt recorder helper');
assert.match(aiSource, /recordProviderAttemptInternal/, 'AI pipeline should write provider attempt telemetry through llmUsage');
assert.match(aiSource, /timeoutCount: args.timeout \? 1 : 0/, 'Provider attempt telemetry should separate timeout failures');
assert.match(aiSource, /provider: "openai"/, 'OpenAI attempts should be instrumented');
assert.match(aiSource, /provider: "bedrock"/, 'Bedrock attempts should be instrumented');
assert.match(aiSource, /provider: "minimax"/, 'MiniMax attempts should be instrumented');
assert.match(aiSource, /provider: "inception"/, 'Inception attempts should be instrumented');

console.log('llm-provider-telemetry-regression.test.mjs passed');
