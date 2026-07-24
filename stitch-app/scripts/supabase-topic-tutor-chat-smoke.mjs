import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { config as loadEnv } from 'dotenv';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(thisDir, '..');

loadEnv({ path: path.join(root, '.env.local') });
loadEnv({ path: path.join(root, '.env') });

const baseUrl = `http://127.0.0.1:${process.env.AUTH_DEV_PORT || 8787}`;
const stamp = Date.now();
const email = `tutor-smoke-${stamp}@example.com`;
const password = `SmokePass!${stamp}`;
const name = 'Tutor Smoke';

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

console.log(`[tutor-smoke] using ${baseUrl}`);

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
const userId = session.payload?.user?.id || session.payload?.session?.userId;
assert(userId, 'Expected session user id after signup');

const { ensureCourseFromUpload } = await import(
  pathToFileURL(path.join(root, 'server', 'courses.js')).href
);

const course = await ensureCourseFromUpload({
  userId,
  uploadId: null,
  fileName: 'tutor-smoke-notes.txt',
  extractedText:
    '# Working memory\n\nWorking memory holds information briefly for reasoning.\n\n## Long-term memory\n\nLong-term memory stores durable knowledge for later retrieval during exams.',
});
assert(course?.id, 'Expected a generated course');
assert(Array.isArray(course.topics) && course.topics.length > 0, 'Expected generated topics');
const topicId = course.topics[0].id;

const ask = await api(`/api/topics/${encodeURIComponent(topicId)}/chat`, {
  method: 'POST',
  body: { question: 'Explain working memory simply.' },
});
assert(ask.response.ok, `ask failed: ${ask.payload?.error || ask.response.status}`);
assert(ask.payload?.success === true, 'Expected ask success');
assert(
  Array.isArray(ask.payload?.messages) && ask.payload.messages.length >= 2,
  `Expected at least user+assistant messages, got ${ask.payload?.messages?.length}`,
);

const listed = await api(`/api/topics/${encodeURIComponent(topicId)}/chat`);
assert(listed.response.ok, `list failed: ${listed.payload?.error || listed.response.status}`);
assert(
  listed.payload.messages.length >= 2,
  `Expected persisted messages, got ${listed.payload.messages.length}`,
);

const cleared = await api(`/api/topics/${encodeURIComponent(topicId)}/chat`, {
  method: 'DELETE',
});
assert(cleared.response.ok, `clear failed: ${cleared.payload?.error || cleared.response.status}`);

const afterClear = await api(`/api/topics/${encodeURIComponent(topicId)}/chat`);
assert(
  Array.isArray(afterClear.payload.messages) && afterClear.payload.messages.length === 0,
  'Expected chat to be empty after clear',
);

console.log('[tutor-smoke] passed', {
  email,
  topicId,
  backend: ask.payload?.backend,
  messageCountBeforeClear: listed.payload.messages.length,
});
