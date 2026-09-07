import assert from 'node:assert/strict';
import { buildResumeTarget, hrefForResumeTarget, pickResumeProgressRow } from '../server/resumeTarget.js';

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

const lessonWithChecks = buildResumeTarget({
  latestProgress: {
    topicId: 'topic-hre',
    topicTitle: 'The Holy Roman Empire and Early German Fragmentation',
    lastStudiedAt: '2026-08-13T19:40:00.000Z',
    lastActivityKind: 'lesson',
    lessonChecks: { q1: { correct: true }, q2: { correct: false } },
    inLessonTotal: 4,
  },
});
assert.equal(lessonWithChecks.progressPercent, 50);

const lessonWithCourseProgress = buildResumeTarget({
  latestProgress: {
    topicId: 'topic-hre',
    topicTitle: 'The Holy Roman Empire and Early German Fragmentation',
    lastStudiedAt: '2026-08-13T19:41:00.000Z',
    lastActivityKind: 'lesson',
    courseProgress: 40,
  },
});
assert.equal(lessonWithCourseProgress.progressPercent, 40);

const lessonWithSection = buildResumeTarget({
  latestProgress: {
    topicId: 'topic-hre',
    topicTitle: 'Working Memory',
    lastStudiedAt: '2026-09-06T15:00:00.000Z',
    lastActivityKind: 'lesson',
    studyPosition: {
      sectionIndex: 1,
      sectionCount: 5,
      sectionTitle: 'Capacity limits',
    },
  },
});
assert.equal(lessonWithSection.progressPercent, 40);
assert.equal(lessonWithSection.sectionIndex, 1);
assert.equal(lessonWithSection.sectionCount, 5);
assert.equal(lessonWithSection.sectionTitle, 'Capacity limits');

assert.equal(
  hrefForResumeTarget({ kind: 'lesson', topicId: 'abc' }),
  '/dashboard/topic/abc',
);

const resumeRow = pickResumeProgressRow([
  {
    topic_id: 'completed-recent',
    completed_at: '2026-09-06T18:00:00.000Z',
    last_studied_at: '2026-09-06T18:00:00.000Z',
    lesson_checks: { __studyPosition: { sectionIndex: 4, sectionCount: 5, finished: true } },
  },
  {
    topic_id: 'unfinished-older',
    completed_at: null,
    last_studied_at: '2026-09-06T17:00:00.000Z',
    lesson_checks: { __studyPosition: { sectionIndex: 1, sectionCount: 5, finished: false } },
  },
]);
assert.equal(resumeRow.topic_id, 'unfinished-older');

const submittedQuiz = buildResumeTarget({
  latestProgress: {
    topicId: 'topic-working-memory',
    topicTitle: 'What working memory is',
    lastStudiedAt: '2026-09-07T18:00:00.000Z',
    lastActivityKind: 'quiz',
    bestScore: 67,
    studyPosition: {
      sectionIndex: 2,
      sectionCount: 7,
      sectionTitle: 'The Idea',
    },
  },
  latestQuizAttempt: {
    topicId: 'topic-working-memory',
    topicTitle: 'What working memory is',
    createdAt: '2026-09-07T17:59:00.000Z',
    score: 2,
    total: 3,
  },
});
assert.equal(submittedQuiz.kind, 'lesson');
assert.equal(submittedQuiz.href, '/dashboard/topic/topic-working-memory');
assert.notEqual(submittedQuiz.href, '/dashboard/quiz/topic-working-memory');

const submittedQuizNewerThanProgress = buildResumeTarget({
  latestProgress: {
    topicId: 'topic-working-memory',
    topicTitle: 'What working memory is',
    lastStudiedAt: '2026-09-07T17:00:00.000Z',
    lastActivityKind: 'lesson',
  },
  latestQuizAttempt: {
    topicId: 'topic-working-memory',
    topicTitle: 'What working memory is',
    createdAt: '2026-09-07T18:00:00.000Z',
    score: 3,
    total: 3,
  },
});
assert.equal(submittedQuizNewerThanProgress.kind, 'lesson');
assert.equal(submittedQuizNewerThanProgress.href, '/dashboard/topic/topic-working-memory');

const submittedQuizBestScoreOnly = buildResumeTarget({
  latestProgress: {
    topicId: 'topic-working-memory',
    topicTitle: 'What working memory is',
    lastStudiedAt: '2026-09-07T18:00:00.000Z',
    lastActivityKind: 'quiz',
    bestScore: 80,
  },
});
assert.equal(submittedQuizBestScoreOnly.kind, 'lesson');
assert.equal(submittedQuizBestScoreOnly.href, '/dashboard/topic/topic-working-memory');

console.log('resume-target-regression.test.mjs passed');
