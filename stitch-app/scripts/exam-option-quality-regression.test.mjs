import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const aiPath = path.join(root, 'convex', 'ai.ts');
const aiSource = await fs.readFile(aiPath, 'utf8');

if (!/DISALLOWED_EXAM_OPTION_PATTERNS/.test(aiSource)) {
  throw new Error('Expected ai.ts to define disallowed exam option patterns.');
}

for (const disallowed of [
  'none of the above',
  'all of the above',
  'cannot be determined from the question',
  'not enough information',
]) {
  if (!new RegExp(disallowed, 'i').test(aiSource)) {
    throw new Error(`Expected ai.ts to explicitly disallow "${disallowed}" options.`);
  }
}

if (!/if\s*\(!hasUsableQuestionOptions\(options\)\)\s*\{\s*continue;\s*\}/s.test(aiSource)) {
  throw new Error('Expected question generation to skip questions with unusable options.');
}

if (/fillMissingOptions\s*\(/.test(aiSource)) {
  throw new Error('Expected fallback filler options to be removed from exam generation.');
}

if (!/Do not use "All of the above", "None of the above"/.test(aiSource)) {
  throw new Error('Expected generation prompts to block generic placeholder options.');
}

console.log('exam-option-quality-regression.test.mjs passed');
