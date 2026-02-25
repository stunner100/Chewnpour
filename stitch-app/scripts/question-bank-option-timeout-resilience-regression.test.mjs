import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();

const source = await fs.readFile(path.join(root, 'convex/ai.ts'), 'utf8');

const requiredPatterns = [
  'const generateOptionsForQuestion = async (',
  'let response = ""',
  'console.warn("[QuestionBank] option_generation_failed"',
  'return null;',
];

for (const pattern of requiredPatterns) {
  if (!source.includes(pattern)) {
    throw new Error(`Expected convex/ai.ts to include "${pattern}" for timeout resilience.`);
  }
}

const optionGeneratorSectionStart = source.indexOf('const generateOptionsForQuestion = async (');
const optionGeneratorSectionEnd = source.indexOf('export const generateConceptExerciseForTopic = action({');
const optionGeneratorSection = source.slice(optionGeneratorSectionStart, optionGeneratorSectionEnd);

if (!/try\s*\{[\s\S]*callQwen\(/.test(optionGeneratorSection)) {
  throw new Error('Expected generateOptionsForQuestion to wrap callQwen in a try block.');
}

if (!/catch\s*\(error\)\s*\{[\s\S]*option_generation_failed[\s\S]*return null;/.test(optionGeneratorSection)) {
  throw new Error('Expected generateOptionsForQuestion to catch callQwen errors and return null.');
}

console.log('question-bank-option-timeout-resilience-regression.test.mjs passed');

