import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(thisDir, '..');

loadEnv({ path: path.join(root, '.env.local') });
loadEnv({ path: path.join(root, '.env') });

const baseUrl = String(
  process.env.SMOKE_BASE_URL ||
    `http://127.0.0.1:${process.env.AUTH_DEV_PORT || 8787}`,
).replace(/\/$/, '');
const origin = String(
  process.env.SMOKE_ORIGIN ||
    process.env.BETTER_AUTH_URL ||
    (baseUrl.includes('chewnpour.com')
      ? 'https://www.chewnpour.com'
      : 'http://localhost:5173'),
).replace(/\/$/, '');
const stamp = Date.now();
const email = `study-loop-smoke-${stamp}@example.com`;
const password = `SmokePass!${stamp}`;
const name = 'Study Loop Smoke';

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

const api = async (pathname, { method = 'GET', body, headers = {} } = {}) => {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      Accept: 'application/json',
      Origin: origin,
      ...(cookieJar.size ? { Cookie: cookieHeader() } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
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

// Minimal PDF bytes — storage bucket allows application/pdf (not text/plain).
const fileBytes = Buffer.from(
  '%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n',
  'utf8',
);

console.log(`[study-loop-smoke] using ${baseUrl} (origin ${origin})`);

{
  const health = await fetch(`${baseUrl}/api/auth/get-session`).catch(() => null);
  assert(
    health,
    baseUrl.includes('127.0.0.1')
      ? `Auth server is not reachable at ${baseUrl}. Run: npm run dev:auth`
      : `Production API is not reachable at ${baseUrl}`,
  );
}

// 1) Login / signup
const signup = await api('/api/auth/sign-up/email', {
  method: 'POST',
  body: { email, password, name },
});
assert(signup.response.ok, `sign-up failed: ${signup.payload?.message || signup.response.status}`);

const session = await api('/api/auth/get-session');
const userId = session.payload?.user?.id;
assert(userId, 'Expected session user id after signup');

// 2) Billing starter credits
const billingBefore = await api('/api/billing');
assert(billingBefore.response.ok, `billing GET failed: ${billingBefore.payload?.error || billingBefore.response.status}`);
assert(
  billingBefore.payload?.billing?.remainingUploadCredits === 3,
  `Expected 3 starter credits, got ${billingBefore.payload?.billing?.remainingUploadCredits}`,
);

// 3) Upload init → signed PUT → finalize
const init = await api('/api/uploads/init', {
  method: 'POST',
  body: {
    fileName: 'study-loop-smoke.pdf',
    fileType: 'pdf',
    fileSize: fileBytes.length,
    contentType: 'application/pdf',
  },
});
assert(init.response.ok, `upload init failed: ${init.payload?.error || init.response.status}`);
assert(init.payload?.upload?.id, 'Expected upload id from init');
assert(init.payload?.signedUrl, 'Expected signed upload URL from init');

const putResponse = await fetch(init.payload.signedUrl, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/pdf',
  },
  body: fileBytes,
});
if (!putResponse.ok) {
  const putBody = await putResponse.text().catch(() => '');
  throw new Error(`signed upload PUT failed: ${putResponse.status} ${putBody.slice(0, 300)}`);
}

const finalized = await api(`/api/uploads/${encodeURIComponent(init.payload.upload.id)}/finalize`, {
  method: 'POST',
  body: {},
});
assert(finalized.response.ok, `finalize failed: ${finalized.payload?.error || finalized.response.status}`);
assert(finalized.payload?.upload?.status === 'ready', `Expected ready upload, got ${finalized.payload?.upload?.status}`);
assert(finalized.payload?.upload?.courseId, 'Expected courseId after finalize');

const courseId = finalized.payload.upload.courseId;

const billingAfterUpload = await api('/api/billing');
assert(
  billingAfterUpload.payload?.billing?.remainingUploadCredits === 2,
  `Expected 2 credits after upload, got ${billingAfterUpload.payload?.billing?.remainingUploadCredits}`,
);

// 4) Course + lesson
const course = await api(`/api/courses/${encodeURIComponent(courseId)}`);
assert(course.response.ok, `course GET failed: ${course.payload?.error || course.response.status}`);
assert(Array.isArray(course.payload?.course?.topics) && course.payload.course.topics.length > 0, 'Expected topics on course');
const topicId = course.payload.course.topics[0].id || course.payload.course.firstTopicId;
assert(topicId, 'Expected a topic id');

const topic = await api(`/api/topics/${encodeURIComponent(topicId)}`);
assert(topic.response.ok, `topic GET failed: ${topic.payload?.error || topic.response.status}`);
assert(topic.payload?.topic?.content, 'Expected topic lesson content');

const notesSave = await api(`/api/topics/${encodeURIComponent(topicId)}/notes`, {
  method: 'PUT',
  body: { content: 'Smoke note: working memory is temporary storage.' },
});
assert(notesSave.response.ok, `notes save failed: ${notesSave.payload?.error || notesSave.response.status}`);

const notesGet = await api(`/api/topics/${encodeURIComponent(topicId)}/notes`);
assert(notesGet.payload?.note?.content?.includes('Smoke note'), 'Expected saved note content');

const explain = await api(`/api/topics/${encodeURIComponent(topicId)}/explain`, {
  method: 'POST',
  body: { selectedText: 'Working memory holds information briefly', style: 'simplify' },
});
assert(explain.response.ok, `explain failed: ${explain.payload?.error || explain.response.status}`);
assert(explain.payload?.explanation, 'Expected explanation text');

// 5) Quiz → results
const quiz = await api(`/api/topics/${encodeURIComponent(topicId)}/quiz`);
assert(quiz.response.ok, `quiz GET failed: ${quiz.payload?.error || quiz.response.status}`);
const questions = Array.isArray(quiz.payload?.questions) ? quiz.payload.questions : [];
assert(questions.length > 0, 'Expected quiz questions');

const submit = await api(`/api/topics/${encodeURIComponent(topicId)}/quiz`, {
  method: 'POST',
  body: {
    answers: questions.map((question) => ({
      questionId: question.id,
      selectedIndex: Number(question.correctIndex) || 0,
    })),
  },
});
assert(submit.response.ok, `quiz submit failed: ${submit.payload?.error || submit.response.status}`);
const attemptId = submit.payload?.attempt?.id || submit.payload?.attempt?.attemptId;
assert(attemptId, 'Expected attempt id after quiz submit');
assert(
  Number(submit.payload?.attempt?.score) === questions.length,
  `Expected perfect score, got ${submit.payload?.attempt?.score}/${submit.payload?.attempt?.total}`,
);

const results = await api(`/api/quiz-attempts/${encodeURIComponent(attemptId)}`);
assert(results.response.ok, `quiz attempt GET failed: ${results.payload?.error || results.response.status}`);
assert(results.payload?.attempt?.id === attemptId, 'Expected matching attempt id');
assert(
  Array.isArray(results.payload?.attempt?.answers) && results.payload.attempt.answers.length === questions.length,
  'Expected reviewable answers on attempt',
);
assert(results.payload?.attempt?.topicTitle, 'Expected topicTitle on attempt results');

// 6) Progress + billing snapshot
const progress = await api('/api/progress');
assert(progress.response.ok, `progress GET failed: ${progress.payload?.error || progress.response.status}`);
assert(
  Number(progress.payload?.progress?.stats?.topics) >= 1,
  `Expected practiced topics >= 1, got ${progress.payload?.progress?.stats?.topics}`,
);

const billingFinal = await api('/api/billing');
assert(
  billingFinal.payload?.billing?.remainingUploadCredits === 2,
  `Expected billing to remain at 2 credits, got ${billingFinal.payload?.billing?.remainingUploadCredits}`,
);

console.log('[study-loop-smoke] passed', {
  email,
  courseId,
  topicId,
  attemptId,
  questionCount: questions.length,
  score: submit.payload?.attempt?.score,
  remainingCredits: billingFinal.payload?.billing?.remainingUploadCredits,
  explainBackend: explain.payload?.backend,
});
