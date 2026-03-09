import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();

const source = await fs.readFile(path.join(root, 'convex/ai.ts'), 'utf8');

const requiredPatterns = [
  'const repairGroundedMcqCandidate = async (',
  'const generateOptionsForQuestion = async (',
  'buildGroundedMcqRepairPrompt(',
  'console.warn("[QuestionBank] grounded_mcq_repair_failed"',
  'return null;',
];

for (const pattern of requiredPatterns) {
  if (!source.includes(pattern)) {
    throw new Error(`Expected convex/ai.ts to include "${pattern}" for timeout resilience.`);
  }
}

const optionRepairSectionStart = source.indexOf('const repairGroundedMcqCandidate = async (');
const optionRepairSectionEnd = source.indexOf('const CONCEPT_TEMPLATE_BLANK_PATTERN =');
const optionRepairSection = source.slice(optionRepairSectionStart, optionRepairSectionEnd);

if (!/try\s*\{[\s\S]*callInception\(/.test(optionRepairSection)) {
  throw new Error('Expected grounded MCQ option repair to wrap callInception in a try block.');
}

if (!/catch\s*\(error\)\s*\{[\s\S]*grounded_mcq_repair_failed[\s\S]*return null;/.test(optionRepairSection)) {
  throw new Error('Expected grounded MCQ option repair to catch callInception errors and return null.');
}

if (!/generateOptionsForQuestion\s*=\s*async\s*\([\s\S]*repairGroundedMcqCandidate\(/.test(optionRepairSection)) {
  throw new Error('Expected generateOptionsForQuestion to delegate to grounded MCQ repair.');
}

console.log('question-bank-option-timeout-resilience-regression.test.mjs passed');
