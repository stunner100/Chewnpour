import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const aiPath = path.join(root, 'convex', 'ai.ts');
const source = await fs.readFile(aiPath, 'utf8');

if (!/const\s+TEACH_TWELVE_STYLE_PATTERN\s*=/.test(source)) {
  throw new Error('Expected ai.ts to define TEACH_TWELVE_STYLE_PATTERN.');
}

if (!/const\s+evaluateTeachTwelveConsistency\s*=\s*\(content:\s*string\)\s*=>/.test(source)) {
  throw new Error('Expected ai.ts to define a teach-12 consistency evaluator.');
}

if (!/const\s+generateTeachTwelveRewrite\s*=\s*async\s*\(args:\s*\{[\s\S]*?\}\)\s*=>/.test(source)) {
  throw new Error('Expected ai.ts to define generateTeachTwelveRewrite.');
}

if (!/responseFormat:\s*"json_object"/.test(source)) {
  throw new Error('Expected teach-12 rewrite flow to request strict JSON output.');
}

if (!/if\s*\(TEACH_TWELVE_STYLE_PATTERN\.test\(normalizedStyle\)\)\s*\{[\s\S]*generateTeachTwelveRewrite/s.test(source)) {
  throw new Error('Expected reExplainTopic to route teach-12 style through the consistency rewrite path.');
}

if (!/Word Bank must include at least 6 entries\./.test(source)) {
  throw new Error('Expected teach-12 consistency gate to enforce minimum Word Bank entries.');
}

if (!/Quick Check must include at least 3 question\/answer pairs\./.test(source)) {
  throw new Error('Expected teach-12 consistency gate to enforce Quick Check coverage.');
}

console.log('reexplain-teach12-consistency-regression.test.mjs passed');
