// Phone-first study loop: lesson -> quiz -> review -> exam -> tutor at 375px,
// and quiz/review answers that survive a flaky connection.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

const [css, quizPlayer, quizQuestion, review, exam, welcome, composer, voice] = await Promise.all([
  read('src/index.css'),
  read('src/pages/TopicQuizPlayer.jsx'),
  read('src/components/quiz/QuizQuestion.jsx'),
  read('src/pages/ReviewSession.jsx'),
  read('src/pages/ExamMode.jsx'),
  read('src/components/tutor/TutorMessageRow.jsx'),
  read('src/components/tutor/TutorChatSurface.jsx'),
  read('src/components/opensource-ui/VoiceAssistantWidget.tsx'),
]);

// Long unbroken words (chemical names, URLs, code) must wrap instead of
// pushing question cards past a 375px screen. Fieldsets default to
// min-width: min-content, so they also need min-w-0.
assert.match(quizQuestion, /<fieldset className="min-w-0 [^"]*\[overflow-wrap:anywhere\]/, 'Quiz question fieldset must wrap long words.');
assert.match(review, /<fieldset className="[^"]*min-w-0 [^"]*\[overflow-wrap:anywhere\]/, 'Review question fieldset must wrap long words.');
assert.match(exam, /<section className="min-w-0 [^"]*\[overflow-wrap:anywhere\]/, 'Exam question card must wrap long words.');

// .safe-area-bottom replaces padding-bottom, so bars with py-3 lost their
// bottom padding (0px on phones without a home indicator).
assert.match(css, /\.safe-area-pad-bottom\s*{\s*padding-bottom: calc\(0\.75rem \+ var\(--safe-bottom\)\);/, 'Action bars need padding plus the safe-area inset.');
for (const [label, source] of [['Quiz', quizPlayer], ['Exam', exam]]) {
  assert.doesNotMatch(source, /py-3[^"]*safe-area-bottom/, `${label} action bar must not let safe-area-bottom cancel py-3.`);
  assert.match(source, /pt-3[^"]*safe-area-pad-bottom/, `${label} action bar must use safe-area-pad-bottom.`);
}

// 44px tap targets.
assert.match(welcome, /inline-flex min-h-11 items-center rounded-\[999px\]/, 'Tutor welcome prompt chips must be 44px tall.');
assert.match(composer, /className="min-h-11 rounded-full/, 'Tutor composer prompt chips must be 44px tall.');
assert.match(voice, /compact \? "size-11 shrink-0"/, 'Lesson audio play button must be 44px.');

// Answers survive a flaky connection.
assert.match(quizPlayer, /requestJsonWithRetry\(`\/api\/topics\/\$\{encodeURIComponent\(topicId\)\}\/quiz`/, 'Quiz submit must retry.');
assert.match(quizPlayer, /loadQuizDraft\(user\.id, topicId/, 'Quiz must restore saved answers.');
assert.match(quizPlayer, /saveQuizDraft\(user\?\.id, topicId/, 'Quiz must save answers as they are picked.');
assert.match(quizPlayer, /clearQuizDraft\(user\?\.id, topicId\)/, 'Quiz must clear saved answers after submitting.');
assert.match(review, /requestJsonWithRetry\('\/api\/review\/answer'/, 'Review answers must retry.');
assert.doesNotMatch(review, /catch \(err\) {\s*setSelectedIndex\(null\)/, 'A failed review check must keep the picked option.');
assert.match(review, /onClick={\(\) => handleAnswer\(selectedIndex\)}/, 'Review must offer a one-tap retry.');
assert.match(review, /resultRef\.current\?\.scrollIntoView/, 'Review feedback must scroll into view on phones.');
assert.match(exam, /requestJsonWithRetry\(`\/api\/exams\/\$\{exam\.id\}\/submit`/, 'Exam submit must retry.');

// requestJsonWithRetry behaviour.
const { requestJsonWithRetry, OFFLINE_MESSAGE } = await import('../src/lib/requestWithRetry.js');
const noSleep = async () => {};
const respond = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const withFetch = async (responses, run) => {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    calls.push(url);
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return next;
  };
  try {
    return { result: await run(), calls };
  } finally {
    globalThis.fetch = original;
  }
};

{
  const { result, calls } = await withFetch(
    [new TypeError('Failed to fetch'), respond(503, {}), respond(200, { ok: 1 })],
    () => requestJsonWithRetry('/x', {}, { sleep: noSleep }),
  );
  assert.deepEqual(result, { ok: 1 }, 'Network drops and 503s are retried until success.');
  assert.equal(calls.length, 3);
}
{
  const { calls } = await withFetch([respond(400, { error: 'Bad answer' })], async () => {
    await assert.rejects(requestJsonWithRetry('/x', {}, { sleep: noSleep }), /Bad answer/);
  });
  assert.equal(calls.length, 1, 'Validation errors are not retried.');
}
{
  const { calls } = await withFetch(
    [new TypeError('x'), new TypeError('x'), new TypeError('x')],
    async () => {
      await assert.rejects(requestJsonWithRetry('/x', {}, { sleep: noSleep }), (error) => error.message === OFFLINE_MESSAGE && error.retryable);
    },
  );
  assert.equal(calls.length, 3, 'Gives up after three attempts with an offline message.');
}

// quizDraft behaviour.
const store = new Map();
globalThis.window = {
  localStorage: {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  },
};
const { loadQuizDraft, saveQuizDraft, clearQuizDraft } = await import('../src/lib/quizDraft.js');
const questions = [
  { id: 'q1', options: ['a', 'b'] },
  { id: 'q2', options: ['a', 'b', 'c'] },
];
saveQuizDraft('u1', 't1', { answers: { q1: 1, q2: 5, gone: 0 }, questionIndex: 1 });
assert.deepEqual(loadQuizDraft('u1', 't1', questions), { answers: { q1: 1 }, questionIndex: 1 }, 'Restores only answers that still fit the quiz.');
assert.deepEqual(loadQuizDraft('u2', 't1', questions), { answers: {}, questionIndex: 0 }, 'Drafts are per user.');
clearQuizDraft('u1', 't1');
assert.deepEqual(loadQuizDraft('u1', 't1', questions), { answers: {}, questionIndex: 0 }, 'Submitting clears the draft.');
store.set('cp:quiz-draft:u1:t1', '{not json');
assert.deepEqual(loadQuizDraft('u1', 't1', questions), { answers: {}, questionIndex: 0 }, 'A corrupt draft is ignored.');

console.log('study-loop-phone-regression: ok');
