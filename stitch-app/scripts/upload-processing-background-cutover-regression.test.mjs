import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const aiPath = path.join(root, 'convex', 'ai.ts');
const aiSource = await fs.readFile(aiPath, 'utf8');

const requiredSnippets = [
  'const resolveUploadProcessingKickoffState = (upload: any) => {',
  'reason: "already_ready"',
  'reason: "already_processing"',
  'console.info("[UploadProcessing] kickoff_skip"',
  'export const generateCourseFromTextInBackground = internalAction({',
  'await ctx.scheduler.runAfter(0, internal.ai.generateCourseFromTextInBackground, {',
  'queued: true',
];

for (const snippet of requiredSnippets) {
  if (!aiSource.includes(snippet)) {
    throw new Error(`ai.ts is missing upload background-cutover snippet: ${snippet}`);
  }
}

if (aiSource.includes('await ctx.runAction(api.ai.generateCourseFromText, {')) {
  throw new Error('processUploadedFile should not await nested generateCourseFromText actions anymore.');
}

if (!/\.\.\.\(extractionCompleted \? \{\} : \{ extractionStatus: "failed" \}\)/.test(aiSource)) {
  throw new Error('processUploadedFile should only stamp extractionStatus=failed when extraction never completed.');
}

console.log('upload-processing-background-cutover-regression.test.mjs passed');
