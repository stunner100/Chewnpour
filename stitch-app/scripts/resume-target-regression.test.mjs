import assert from 'node:assert/strict';
import { buildResumeTarget, hrefForResumeTarget } from '../server/resumeTarget.js';

const lesson = buildResumeTarget({
  latestProgress: {
    topicId: 'topic-hre',
    topicTitle: 'The Holy Roman Empire and Early German Fragmentation',
    courseId: 'course-german',
    courseTitle: 'German History',
    lastStudiedAt: '2026-08-13T19:00:00.000Z',
    lastActivityKind: 'lesson',
  },
  latestQuizAttempt: {
    topicId: 'topic-old',
    topicTitle: 'Older quiz',
    createdAt: '2026-08-12T12:00:00.000Z',
    score: 8,
    total: 10,
  },
});
assert.equal(lesson.kind, 'lesson');
assert.equal(lesson.href, '/dashboard/topic/topic-hre');
assert.match(lesson.title, /Holy Roman Empire/);

const quiz = buildResumeTarget({
  latestProgress: {
    topicId: 'topic-hre',
    topicTitle: 'The Holy Roman Empire and Early German Fragmentation',
    lastStudiedAt: '2026-08-13T19:10:00.000Z',
    lastActivityKind: 'quiz',
  },
});
assert.equal(quiz.kind, 'quiz');
assert.equal(quiz.href, '/dashboard/quiz/topic-hre');

const podcast = buildResumeTarget({
  latestProgress: {
    topicId: 'topic-hre',
    topicTitle: 'The Holy Roman Empire and Early German Fragmentation',
    lastStudiedAt: '2026-08-13T19:20:00.000Z',
    lastActivityKind: 'podcast',
  },
});
assert.equal(podcast.kind, 'podcast');
assert.equal(podcast.href, '/dashboard/topic/topic-hre?panel=podcast');

const exam = buildResumeTarget({
  inProgressExam: {
    courseId: 'course-german',
    courseTitle: 'German History',
    answers: { q1: 0, q2: 1 },
    totalQuestions: 10,
    updatedAt: '2026-08-13T18:00:00.000Z',
  },
  latestProgress: {
    topicId: 'topic-hre',
    lastStudiedAt: '2026-08-13T19:30:00.000Z',
    lastActivityKind: 'lesson',
  },
});
assert.equal(exam.kind, 'exam');
assert.equal(exam.href, '/dashboard/exam?courseId=course-german&resume=1');
assert.equal(exam.progressPercent, 20);

assert.equal(
  hrefForResumeTarget({ kind: 'lesson', topicId: 'abc' }),
  '/dashboard/topic/abc',
);

console.log('resume-target-regression.test.mjs passed');
