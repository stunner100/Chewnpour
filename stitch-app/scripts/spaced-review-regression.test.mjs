import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    REVIEW_INTERVAL_DAYS,
    isReviewDue,
    nextReviewState,
} from '../server/reviewSchedule.js';
import { formatReviewDay, reviewCardCopy } from '../src/lib/reviewQueue.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFile(path.join(root, rel), 'utf8');

const DAY = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 9, 18, 21, 30); // late evening, UTC
const today = Date.UTC(2026, 9, 18);

// A miss is due tomorrow (whole day), even when missed late at night.
const missed = nextReviewState(null, false, now);
assert.deepEqual(missed, { box: 0, dueAt: today + DAY, lapses: 1 });
assert.equal(isReviewDue(missed.dueAt, now), false, 'a fresh miss is not due the same day');
assert.equal(isReviewDue(missed.dueAt, today + DAY + 60_000), true, 'it is due all of tomorrow');

// Correct answers on never-missed questions are not tracked.
assert.equal(nextReviewState(null, true, now), null);

// Retaking straight away does not count as a spaced recall.
assert.equal(nextReviewState(missed, true, now), null, 'early correct answer must not advance');

// Walking the ladder: each due, correct review moves up one box.
let state = missed;
let clock = state.dueAt + 8 * 60 * 60 * 1000;
for (let box = 1; box < REVIEW_INTERVAL_DAYS.length; box += 1) {
    state = nextReviewState(state, true, clock);
    assert.equal(state.box, box);
    assert.equal(state.dueAt, Math.floor(clock / DAY) * DAY + REVIEW_INTERVAL_DAYS[box] * DAY);
    clock = state.dueAt + 60_000;
}
const graduated = nextReviewState(state, true, clock);
assert.equal(graduated.dueAt, null, 'past the last box the question graduates');
assert.equal(nextReviewState(graduated, true, clock + DAY), null);

// A miss at any box drops it back to the start and counts a lapse.
const lapsed = nextReviewState({ box: 3, dueAt: today, lapses: 1 }, false, now);
assert.deepEqual(lapsed, { box: 0, dueAt: today + DAY, lapses: 2 });

// Client copy.
assert.equal(formatReviewDay(today + 3 * 60 * 60 * 1000, now), 'today');
assert.equal(formatReviewDay(today + DAY, now), 'tomorrow');
assert.equal(formatReviewDay(today + 3 * DAY, now), 'in 3 days');
assert.equal(reviewCardCopy({ dueCount: 1 }, now).heading, '1 question to review today');
assert.equal(reviewCardCopy({ dueCount: 0, upcomingCount: 2, nextDueAt: today + DAY }, now).hint, 'Next review tomorrow. 2 questions scheduled.');
assert.equal(reviewCardCopy(null, now).state, 'empty');

// Wiring: quiz and exam grading feed the queue without being able to fail.
const [courses, exams, reviews, router, migration, app, dashboard, funnel, auth, studyProgress] = await Promise.all([
    read('server/courses.js'),
    read('server/exams.js'),
    read('server/reviews.js'),
    read('api/router.js'),
    read('supabase/migrations/20261018120000_question_reviews.sql'),
    read('src/App.jsx'),
    read('src/pages/StudentDashboard.jsx'),
    read('src/lib/funnelEvents.js'),
    read('src/contexts/AuthContext.jsx'),
    read('src/hooks/useStudyProgress.js'),
]);

assert.match(courses, /recordReviewOutcomes\([\s\S]*?filter\(\(item\) => !item\.skipped\)[\s\S]*?\)\.catch\(/, 'quiz submit records answered outcomes best-effort');
assert.match(exams, /if \(closed\.rowCount > 0\) \{\s*await recordReviewOutcomes\([\s\S]*?\)\.catch\(/, 'exam grading records outcomes once, best-effort');
assert.doesNotMatch(
    reviews.slice(reviews.indexOf('export const getReviewQueueForUser'), reviews.indexOf('export const answerReviewQuestion')),
    /correct_index/,
    'the review queue must not send answers to the client',
);
assert.match(reviews, /WHERE id = \$1 AND user_id = \$2/, 'answers are only graded for the owner');
assert.match(router, /pathname === "\/api\/review"[\s\S]*handleReviewRequest/);
assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
assert.match(migration, /REVOKE ALL ON TABLE "question_reviews" FROM anon, authenticated/);
assert.match(app, /path="\/dashboard\/review"/);
assert.match(dashboard, /fetch\('\/api\/review'[^\n]*\.catch\(\(\) => null\)/, 'review card failure must not blank the dashboard');

// Funnel events.
for (const event of ['signup_completed', 'lesson_completed', 'quiz_submitted', 'exam_submitted', 'review_answered', 'review_session_completed']) {
    assert.ok(funnel.includes(`'${event}'`), `funnel defines ${event}`);
}
assert.match(auth, /trackSignupIfNew\(sessionUser\)/);
assert.match(studyProgress, /patch\?\.completedAt && !completedAtRef\.current[\s\S]*?lessonCompleted/);

console.log('spaced-review regression passed');
