import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const aiPath = path.join(root, 'convex', 'ai.ts');
const aiSource = await fs.readFile(aiPath, 'utf8');

if (!/const buildFallbackAssessmentBlueprint = \(\) => \{/.test(aiSource)) {
  throw new Error('Expected ai.ts to define a fallback assessment blueprint for fresh exam generation.');
}

if (!/\[fresh-exam\] assessment blueprint generation failed; using fallback blueprint/.test(aiSource)) {
  throw new Error('Expected fresh exam generation to log when blueprint generation falls back.');
}

if (!/if \(!blueprint\) \{\s*blueprint = buildFallbackAssessmentBlueprint\(\);\s*\}/s.test(aiSource)) {
  throw new Error('Expected fresh exam generation to fall back when no assessment blueprint can be parsed.');
}

if (!/objective: `Explain the core idea of \$\{topicTitle\}\.`/.test(aiSource)) {
  throw new Error('Expected the fallback blueprint to seed a core-understanding outcome.');
}

console.log('fresh-exam-blueprint-fallback-regression.test.mjs passed');
