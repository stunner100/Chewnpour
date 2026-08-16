import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const progress = await fs.readFile(path.join(root, 'server', 'progress.js'), 'utf8');
if (!/export const getProgressSnapshotForUser/.test(progress)) {
  throw new Error('Expected server/progress.js to export getProgressSnapshotForUser.');
}
if (!/buildResumeTarget/.test(progress) || !/last_activity_kind/.test(progress)) {
  throw new Error('Expected progress snapshot to resume the current lesson, quiz, podcast, or exam.');
}

const progressHttp = await fs.readFile(path.join(root, 'server', 'progressHttp.js'), 'utf8');
if (!/handleProgressRequest/.test(progressHttp)) {
  throw new Error('Expected progress HTTP handler.');
}

const apiRoute = await fs.readFile(path.join(root, 'api', 'progress.js'), 'utf8');
if (!/handleProgressRequest/.test(apiRoute)) {
  throw new Error('Expected api/progress.js to export the progress handler.');
}

const page = await fs.readFile(path.join(root, 'src', 'pages', 'StudyProgressMastery.jsx'), 'utf8');
if (/from ['"]convex\/react['"]/.test(page)) {
  throw new Error('Expected StudyProgressMastery to stop depending on Convex.');
}
if (!/\/api\/progress/.test(page)) {
  throw new Error('Expected StudyProgressMastery to fetch /api/progress.');
}

const viteConfig = await fs.readFile(path.join(root, 'vite.config.js'), 'utf8');
if (!/['"]\/api\/progress['"]/.test(viteConfig)) {
  throw new Error('Expected Vite to proxy /api/progress.');
}

const devAuth = await fs.readFile(path.join(root, 'scripts', 'dev-auth-server.mjs'), 'utf8');
if (!/\/api\/progress/.test(devAuth)) {
  throw new Error('Expected dev-auth server to route /api/progress.');
}

console.log('supabase-progress-milestone-regression.test.mjs passed');
