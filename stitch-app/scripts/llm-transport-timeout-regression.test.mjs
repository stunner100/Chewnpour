import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const aiPath = path.resolve('convex/ai.ts');
const source = fs.readFileSync(aiPath, 'utf8');

const expectSection = (startMarker, endMarker) => {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `Missing section start: ${startMarker}`);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(end, -1, `Missing section end after: ${startMarker}`);
  return source.slice(start, end);
};

const openAiSection = expectSection('const callOpenAiText = async () => {', 'const callBedrockText = async () => {');
assert.match(openAiSection, /timeoutId = setTimeout\(\(\) => \{\s*controller\.abort\(\);/s, 'OpenAI timeout should abort the controller directly');
assert.match(openAiSection, /const response = await fetch\(/, 'OpenAI call should await fetch directly');
assert.match(openAiSection, /const responseBody = await response\.text\(\);/, 'OpenAI timeout must cover response body read');
assert.doesNotMatch(openAiSection, /Promise\.race\(/, 'OpenAI transport should not stop timing out after headers');

const bedrockSection = expectSection('const callBedrockText = async () => {', 'const callInceptionText = async () => {');
assert.match(bedrockSection, /timeoutId = setTimeout\(\(\) => \{\s*controller\.abort\(\);/s, 'Bedrock timeout should abort the controller directly');
assert.match(bedrockSection, /const response = await fetch\(/, 'Bedrock call should await fetch directly');
assert.match(bedrockSection, /const responseBody = await response\.text\(\);/, 'Bedrock timeout must cover response body read');
assert.doesNotMatch(bedrockSection, /Promise\.race\(/, 'Bedrock transport should not stop timing out after headers');

const inceptionSection = expectSection('const callInceptionText = async () => {', 'const callBedrockWithOptionalInceptionFallback = async');
assert.match(inceptionSection, /timeoutId = setTimeout\(\(\) => \{\s*controller\.abort\(\);/s, 'Inception timeout should abort the controller directly');
assert.match(inceptionSection, /const response = await fetch\(/, 'Inception call should await fetch directly');
assert.match(inceptionSection, /const responseBody = await response\.text\(\);/, 'Inception timeout must cover response body read');
assert.doesNotMatch(inceptionSection, /Promise\.race\(/, 'Inception transport should not stop timing out after headers');

console.log('llm-transport-timeout-regression.test.mjs passed');
