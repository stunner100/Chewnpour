import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    buildReviewReminderEmail,
    firstName,
    signUnsubscribeToken,
    verifyUnsubscribeToken,
} from '../server/reviewReminderEmail.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFile(path.join(root, rel), 'utf8');

// Unsubscribe tokens: round-trip, and reject tampering or another secret.
const token = signUnsubscribeToken('user_123', 'secret-a');
assert.equal(verifyUnsubscribeToken(token, 'secret-a'), 'user_123');
assert.equal(verifyUnsubscribeToken(token, 'secret-b'), null);
const [encoded, signature] = token.split('.');
assert.equal(verifyUnsubscribeToken(`${Buffer.from('user_999').toString('base64url')}.${signature}`, 'secret-a'), null);
assert.equal(verifyUnsubscribeToken(encoded, 'secret-a'), null);
assert.equal(verifyUnsubscribeToken('', 'secret-a'), null);

assert.equal(firstName('Ama Mensah'), 'Ama');
assert.equal(firstName(''), 'there');

const links = { appUrl: 'https://app.test', unsubscribeUrl: 'https://app.test/unsubscribe?token=t' };
const plain = buildReviewReminderEmail({ name: 'Kofi', dueCount: 5, topics: [{ title: 'Cells', dueCount: 3 }] }, links);
assert.equal(plain.subject, '5 questions are due for review');
assert.match(plain.text, /https:\/\/app\.test\/dashboard\/review/);
assert.match(plain.text, /Stop review reminders: https:\/\/app\.test\/unsubscribe\?token=t/);
assert.match(plain.html, /Cells: 3 questions/);

const exam = buildReviewReminderEmail({ name: 'Kofi', dueCount: 1, examDaysLeft: 3, examCourseTitle: 'Biology' }, links);
assert.equal(exam.subject, 'Exam in 3 days: 1 question to review');
assert.match(exam.text, /Your exam is in 3 days\. \(Biology\)/);
assert.equal(buildReviewReminderEmail({ dueCount: 0, examDaysLeft: 1 }, links).subject, 'Exam tomorrow: time for a quick review');

const xss = buildReviewReminderEmail({ name: '<b>x', dueCount: 1, topics: [{ title: '<script>', dueCount: 1 }] }, links);
assert.doesNotMatch(xss.html, /<script>/, 'topic titles are escaped');

const [reminders, http, router, vercel, unsubscribePage, migration] = await Promise.all([
    read('server/reviewReminders.js'),
    read('server/reminderHttp.js'),
    read('api/router.js'),
    read('vercel.json'),
    read('src/pages/Unsubscribe.jsx'),
    read('supabase/migrations/20261018160000_email_sends.sql'),
]);
assert.match(reminders, /REVIEW_REMINDERS_ENABLED \|\| ""\)\.trim\(\) !== "true"/, 'sending is a dry run unless explicitly enabled');
assert.match(reminders, /dailyReminders'\)::boolean, true\)/, 'the settings toggle is respected');
assert.match(reminders, /e\.sent_at > NOW\(\) - \(\$5::int \* INTERVAL '1 hour'\)/, 'reminders are spaced out');
assert.match(reminders, /"List-Unsubscribe-Post": "List-Unsubscribe=One-Click"/);
assert.match(http, /Bearer \$\{secret\}/, 'the cron endpoint requires CRON_SECRET');
assert.match(router, /\/api\/cron\/review-reminders[\s\S]*handleReminderRequest/);
assert.deepEqual(JSON.parse(vercel).crons, [{ path: '/api/cron/review-reminders', schedule: '0 7 * * *' }]);
assert.match(unsubscribePage, /fetch\('\/api\/email\/unsubscribe'/);
assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
assert.match(migration, /REVOKE ALL ON TABLE "email_sends" FROM anon, authenticated/);

console.log('review-reminders regression passed');
