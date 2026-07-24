import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { nanoid } from 'nanoid';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(thisDir, '..');

loadEnv({ path: path.join(root, '.env.local') });
loadEnv({ path: path.join(root, '.env') });

const baseUrl = `http://127.0.0.1:${process.env.AUTH_DEV_PORT || 8787}`;
const stamp = Date.now();
const email = `progress-smoke-${stamp}@example.com`;
const password = `SmokePass!${stamp}`;
const name = 'Progress Smoke';

const cookieJar = new Map();

const rememberCookies = (response) => {
  const raw = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [];
  for (const entry of raw) {
    const [pair] = String(entry).split(';');
    const eq = pair.indexOf('=');
    if (eq <= 0) continue;
    cookieJar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
};

const cookieHeader = () =>
  Array.from(cookieJar.entries())
    .map(([key, value]) => `${key}=${value}`)
    .join('; ');

const api = async (pathname, { method = 'GET', body } = {}) => {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      Accept: 'application/json',
      Origin: process.env.BETTER_AUTH_URL || 'http://localhost:5173',
      ...(cookieJar.size ? { Cookie: cookieHeader() } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  rememberCookies(response);
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

console.log(`[progress-smoke] using ${baseUrl}`);

{
  const health = await fetch(baseUrl).catch(() => null);
  assert(health, `Auth server is not reachable at ${baseUrl}. Run: npm run dev:auth`);
}

const signup = await api('/api/auth/sign-up/email', {
  method: 'POST',
  body: { email, password, name },
});
assert(signup.response.ok, `sign-up failed: ${signup.payload?.message || signup.response.status}`);

const session = await api('/api/auth/get-session');
const userId = session.payload?.user?.id;
assert(userId, 'Expected session user id');

const empty = await api('/api/progress');
assert(empty.response.ok, `progress GET failed: ${empty.payload?.error || empty.response.status}`);
assert(empty.payload?.progress?.stats?.topics === 0, 'Expected 0 practiced topics for new user');

const { ensureCourseFromUpload } = await import(
  pathToFileURL(path.join(root, 'server', 'courses.js')).href
);
const { getPool } = await import(pathToFileURL(path.join(root, 'server', 'db.js')).href);

const course = await ensureCourseFromUpload({
  userId,
  uploadId: null,
  fileName: 'progress-smoke.txt',
  extractedText:
    '# Attention\n\nAttention selects what enters working memory.\n\n## Encoding\n\nEncoding moves information into long-term memory with practice.',
});
assert(course?.topics?.length > 0, 'Expected generated topics');
const topic = course.topics[0];

const db = getPool();
await db.query(
  `INSERT INTO quiz_attempts (id, topic_id, course_id, user_id, answers, score, total)
   VALUES ($1,$2,$3,$4,'[]'::jsonb,4,5)`,
  [nanoid(), topic.id, course.id, userId],
);

const after = await api('/api/progress');
assert(after.response.ok, `progress GET after attempt failed: ${after.payload?.error}`);
assert(after.payload.progress.stats.topics === 1, 'Expected 1 practiced topic');
assert(
  after.payload.progress.stats.accuracy === 80,
  `Expected 80% accuracy, got ${after.payload.progress.stats.accuracy}`,
);
assert(
  after.payload.progress.resumeTarget?.topicId === topic.id,
  'Expected resume target to match quiz topic',
);
assert(
  Array.isArray(after.payload.progress.courses) && after.payload.progress.courses.length >= 1,
  'Expected course progress rows',
);

console.log('[progress-smoke] passed', {
  email,
  topics: after.payload.progress.stats.topics,
  accuracy: after.payload.progress.stats.accuracy,
});
