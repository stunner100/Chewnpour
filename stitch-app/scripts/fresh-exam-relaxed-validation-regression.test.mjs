import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const aiPath = path.join(root, 'convex', 'ai.ts');
const aiSource = await fs.readFile(aiPath, 'utf8');

if (!/warnings\.push\(`Objective question is missing citations:/.test(aiSource)) {
  throw new Error('Expected fresh objective validation to downgrade missing citations to warnings.');
}

if (!/warnings\.push\(`Objective question failed grounding:/.test(aiSource)) {
  throw new Error('Expected fresh objective validation to downgrade individual grounding failures to warnings.');
}

if (!/const minimumGroundedCount = Math\.max\(1, Math\.floor\(args\.requestedCount \/ 3\)\);/.test(aiSource)) {
  throw new Error('Expected fresh objective validation to enforce a softer grounded-count floor.');
}

if (!/warnings\.push\(`Essay prompt is missing citations:/.test(aiSource)) {
  throw new Error('Expected fresh essay validation to downgrade missing citations to warnings.');
}

if (!/warnings\.push\(`Essay prompt failed grounding:/.test(aiSource)) {
  throw new Error('Expected fresh essay validation to downgrade individual grounding failures to warnings.');
}

if (!/const minimumGroundedCount = Math\.max\(1, Math\.floor\(args\.requestedCount \/ 2\)\);/.test(aiSource)) {
  throw new Error('Expected fresh essay validation to enforce a softer grounded-count floor.');
}

console.log('fresh-exam-relaxed-validation-regression.test.mjs passed');
