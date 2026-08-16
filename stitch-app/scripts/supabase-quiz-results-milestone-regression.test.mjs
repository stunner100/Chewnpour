import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const read = async (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

const courses = await read('server/courses.js');
if (!courses.includes('export const getQuizAttemptForUser')) {
  throw new Error('Expected courses.js to export getQuizAttemptForUser.');
}
if (!courses.includes('questionText: question.prompt')) {
  throw new Error('Expected submitQuizAttempt to persist reviewable answer payloads.');
}

const courseHttp = await read('server/courseHttp.js');
if (!courseHttp.includes('export const handleQuizAttemptsRequest')) {
  throw new Error('Expected courseHttp to export handleQuizAttemptsRequest.');
}

const results = await read('src/pages/DashboardResults.jsx');
if (/from ['"]convex\/react['"]|api\.exams|api\.subscriptions|api\.profiles|api\.ai/.test(results)) {
  throw new Error('Expected DashboardResults to stop depending on Convex.');
}
if (!results.includes('/api/quiz-attempts/')) {
  throw new Error('Expected DashboardResults to load attempts from Supabase APIs.');
}

const quizPlayer = await read('src/pages/TopicQuizPlayer.jsx');
if (!quizPlayer.includes('/dashboard/quiz/results/')) {
  throw new Error('Expected TopicQuizPlayer to navigate to the results route after submit.');
}

const viteConfig = await read('vite.config.js');
if (!viteConfig.includes("'/api/quiz-attempts'")) {
  throw new Error('Expected Vite to proxy /api/quiz-attempts.');
}

const devAuth = await read('scripts/dev-auth-server.mjs');
if (!devAuth.includes('handleQuizAttemptsRequest') || !devAuth.includes('/api/quiz-attempts')) {
  throw new Error('Expected dev-auth-server to serve /api/quiz-attempts.');
}

console.log('supabase-quiz-results-milestone-regression.test.mjs passed');
