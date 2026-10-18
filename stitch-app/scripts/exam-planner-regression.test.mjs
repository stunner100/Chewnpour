import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    buildDailyPlan,
    dailyPlanItems,
    daysUntilExam,
    examCountdownLabel,
    examWeight,
    localTodayMs,
    parseExamDate,
    rankReviewRows,
    utcTodayMs,
} from '../src/lib/examPlan.js';
import { formatExamDate } from '../server/courseExamDate.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFile(path.join(root, rel), 'utf8');

const DAY = 24 * 60 * 60 * 1000;
const today = Date.UTC(2026, 9, 18);
const now = today + 21 * 60 * 60 * 1000;

// Dates: real calendar days only, today onwards (one day of slack for
// students behind UTC), at most two years out.
assert.equal(utcTodayMs(now), today);
assert.equal(parseExamDate('2026-11-02', today), '2026-11-02');
assert.equal(parseExamDate(' 2026-10-18 ', today), '2026-10-18');
assert.equal(parseExamDate('2026-10-17', today), '2026-10-17', 'yesterday in UTC can still be today locally');
assert.equal(parseExamDate('2026-10-16', today), null, 'past exams are refused');
assert.equal(parseExamDate('2026-02-30', today), null, 'impossible dates are refused');
assert.equal(parseExamDate('18/10/2026', today), null);
assert.equal(parseExamDate('2030-01-01', today), null, 'too far out');
assert.equal(typeof localTodayMs(now), 'number');

// node-postgres DATE values come back as local-midnight Dates.
assert.equal(formatExamDate(new Date(2026, 10, 2)), '2026-11-02');
assert.equal(formatExamDate('2026-11-02'), '2026-11-02');
assert.equal(formatExamDate(null), null);

// Countdown.
assert.equal(daysUntilExam('2026-10-18', today), 0);
assert.equal(daysUntilExam('2026-10-25', today), 7);
assert.equal(daysUntilExam('2026-10-10', today), -8);
assert.equal(daysUntilExam(null, today), null);
assert.equal(examCountdownLabel(0), 'Exam today');
assert.equal(examCountdownLabel(1), 'Exam tomorrow');
assert.equal(examCountdownLabel(12), 'Exam in 12 days');
assert.equal(examCountdownLabel(-1), 'Exam date passed');

// Urgency: final week pulls hardest, nothing beyond a month or after the exam.
assert.deepEqual([0, 7, 8, 14, 15, 30, 31, -1, null].map(examWeight), [3, 3, 2, 2, 1, 1, 0, 0, 0]);

// Queue ordering.
const row = (questionId, courseId, topicId, dueDay, lapses = 1) => ({
    questionId, courseId, topicId, dueAt: today - dueDay * DAY, lapses,
});
const rows = [
    row('a1', 'algebra', 'a-t1', 5),
    row('a2', 'algebra', 'a-t1', 4, 3),
    row('b1', 'biology', 'b-cells', 1, 1),
    row('b2', 'biology', 'b-genes', 1, 1),
    row('b3', 'biology', 'b-genes', 2, 2),
    row('c1', 'chem', 'c-t1', 3),
];
const ids = (list) => list.map((item) => item.questionId);

// No exams: plain schedule order (oldest due first, then most missed).
assert.deepEqual(ids(rankReviewRows(rows)), ['a1', 'a2', 'c1', 'b3', 'b1', 'b2']);

// Biology exam in 5 days: its questions lead, weakest topic (b-genes) first.
const bioSoon = new Map([['biology', 5]]);
assert.deepEqual(ids(rankReviewRows(rows, bioSoon)), ['b3', 'b2', 'b1', 'a1', 'a2', 'c1']);

// Two exams: the nearer one wins; a far-off exam changes nothing.
const twoExams = new Map([['biology', 20], ['chem', 3], ['algebra', 90]]);
assert.deepEqual(ids(rankReviewRows(rows, twoExams)), ['c1', 'b3', 'b2', 'b1', 'a1', 'a2']);

// Same urgency bucket: the nearer exam still goes first, even when the other
// course has weaker topics.
const bothFinalWeek = new Map([['biology', 5], ['algebra', 4]]);
assert.deepEqual(ids(rankReviewRows(rows, bothFinalWeek)), ['a1', 'a2', 'b3', 'b2', 'b1', 'c1']);

// A passed exam stops biasing.
assert.deepEqual(ids(rankReviewRows(rows, new Map([['biology', -2]]))), ids(rankReviewRows(rows)));
assert.equal(rows[0].questionId, 'a1', 'ranking does not mutate its input');

// Daily plan.
const exam = (overrides = {}) => ({
    examDate: '2026-10-28',
    lessonsTotal: 12,
    lessonsDone: 2,
    reviewDue: 4,
    hasQuestions: true,
    lastTimedExamAt: null,
    ...overrides,
});
const farPlan = buildDailyPlan(exam(), today);
assert.deepEqual(farPlan, { daysLeft: 10, lessonsLeft: 10, lessonsToday: 1, reviewDue: 4, timedExam: null });
assert.deepEqual(dailyPlanItems(farPlan).map((item) => item.text), [
    'Review 4 missed questions',
    'Study 1 new lesson (10 left)',
]);

// Final week: lessons spread over the days before the exam, one timed exam.
const finalWeek = buildDailyPlan(exam({ examDate: '2026-10-21' }), today);
assert.equal(finalWeek.daysLeft, 3);
assert.equal(finalWeek.lessonsToday, 4, '10 lessons over 3 days rounds up');
assert.equal(finalWeek.timedExam, 'due');
assert.ok(dailyPlanItems(finalWeek).some((item) => item.text === 'Take one timed exam this week'));

// A timed exam inside the final week counts; one taken before it does not.
const inWeek = Date.UTC(2026, 9, 15, 10);
assert.equal(buildDailyPlan(exam({ examDate: '2026-10-21', lastTimedExamAt: inWeek }), today).timedExam, 'done');
const beforeWeek = Date.UTC(2026, 9, 13, 10);
assert.equal(buildDailyPlan(exam({ examDate: '2026-10-21', lastTimedExamAt: beforeWeek }), today).timedExam, 'due');

// No questions yet: no timed exam suggestion.
assert.equal(buildDailyPlan(exam({ examDate: '2026-10-21', hasQuestions: false }), today).timedExam, null);

// Exam day: review only, no new lessons.
const examDay = buildDailyPlan(exam({ examDate: '2026-10-18' }), today);
assert.equal(examDay.daysLeft, 0);
assert.equal(examDay.lessonsToday, 0);

// Everything done.
const allDone = buildDailyPlan(exam({ lessonsDone: 12, reviewDue: 0 }), today);
assert.deepEqual(dailyPlanItems(allDone).map((item) => item.text), ['All lessons studied. Keep reviewing.']);

// No plan without an upcoming exam.
assert.equal(buildDailyPlan(exam({ examDate: '2026-10-10' }), today), null);
assert.equal(buildDailyPlan(exam({ examDate: null }), today), null);
assert.equal(buildDailyPlan(null, today), null);

// Wiring.
const [migration, courses, courseHttp, reviews, dashboard, lessons, funnel] = await Promise.all([
    read('supabase/migrations/20261018130000_course_exam_dates.sql'),
    read('server/courses.js'),
    read('server/courseHttp.js'),
    read('server/reviews.js'),
    read('src/pages/StudentDashboard.jsx'),
    read('src/pages/LessonMemoryNeuralBasis.jsx'),
    read('src/lib/funnelEvents.js'),
]);
assert.match(migration, /ADD COLUMN IF NOT EXISTS "exam_date" DATE;/);
assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
assert.match(migration, /REVOKE ALL ON TABLE "courses" FROM anon, authenticated/);
assert.match(courses, /examDate: formatExamDate\(row\.exam_date\)/);
assert.match(await read('server/courseExamDate.js'), /WHERE id = \$1 AND user_id = \$2`,\s*\[courseId, userId, value\]/, 'exam date is only set by the owner');
assert.match(courseHttp, /parts\[1\] === "exam-date" && method === "PUT"/);
assert.match(reviews, /rankReviewRows\(/);
assert.match(reviews, /WHERE q\.user_id = \$1 AND q\.id = ANY/, 'session details are owner-scoped');
assert.doesNotMatch(
    reviews.slice(reviews.indexOf('export const getReviewQueueForUser'), reviews.indexOf('export const answerReviewQuestion')),
    /correct_index/,
    'the review queue must not send answers to the client',
);
assert.match(dashboard, /<ExamPlanCard /);
assert.match(lessons, /<ExamDateControl/);
assert.match(lessons, /<ExamCountdownBadge examDate=\{course\.examDate\}/);
assert.ok(funnel.includes("'exam_date_set'"));

console.log('exam-planner regression passed');
