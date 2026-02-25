import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const examsSource = await fs.readFile(path.join(root, 'convex', 'exams.ts'), 'utf8');

if (!/export const getUserPerformanceInsights = query\(\{/.test(examsSource)) {
  throw new Error('Expected getUserPerformanceInsights query to exist in convex/exams.ts.');
}

if (!/args:\s*\{\s*userId:\s*v\.optional\(v\.string\(\)\)\s*\}/.test(examsSource)) {
  throw new Error('Expected getUserPerformanceInsights args.userId to be optional.');
}

if (!/if\s*\(!authUserId\)\s*return null;/.test(examsSource)) {
  throw new Error('Expected getUserPerformanceInsights to gracefully return null when auth is unavailable.');
}

if (!/const\s+effectiveUserId\s*=\s*requestedUserId\s*&&\s*requestedUserId\s*===\s*authUserId[\s\S]*:\s*authUserId;/.test(examsSource)) {
  throw new Error('Expected getUserPerformanceInsights to use authenticated identity as fallback source of truth.');
}

if (!/withIndex\("by_userId",\s*\(q\)\s*=>\s*q\.eq\("userId",\s*effectiveUserId\)\)/.test(examsSource)) {
  throw new Error('Expected getUserPerformanceInsights query to fetch attempts using effectiveUserId.');
}

console.log('performance-insights-server-resilience-regression.test.mjs passed');
