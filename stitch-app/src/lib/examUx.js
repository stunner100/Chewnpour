// Pure helpers for the timed exam screen. Mirrors the limits in
// server/exams.js so the start confirmation can show the real shape of the
// exam before the countdown begins.

export const EXAM_QUESTION_LIMIT = 20;
export const EXAM_SECONDS_PER_QUESTION = 60;
export const EXAM_MAX_DURATION_SECONDS = 45 * 60;

export const estimateExamShape = (course) => {
  const quizTopics = Array.isArray(course?.quizTopics) ? course.quizTopics : [];
  const available = quizTopics.reduce(
    (sum, topic) => sum + Math.max(0, Number(topic?.questionCount) || 0),
    0,
  );
  const questionCount = Math.min(EXAM_QUESTION_LIMIT, available);
  const durationSeconds = Math.min(
    EXAM_MAX_DURATION_SECONDS,
    Math.max(EXAM_SECONDS_PER_QUESTION, questionCount * EXAM_SECONDS_PER_QUESTION),
  );
  return {
    questionCount,
    durationSeconds,
    durationMinutes: Math.round(durationSeconds / 60),
  };
};

// Screen readers should hear the clock at a few milestones, not every second.
const ANNOUNCE_AT_SECONDS = [600, 300, 60, 30, 10];

export const timerAnnouncement = (secondsRemaining) => {
  const seconds = Math.round(Number(secondsRemaining));
  if (!ANNOUNCE_AT_SECONDS.includes(seconds)) return null;
  if (seconds >= 60) {
    const minutes = seconds / 60;
    return `${minutes} minute${minutes === 1 ? '' : 's'} remaining`;
  }
  return `${seconds} seconds remaining`;
};

// Group missed and skipped review items by topic so the results page can send
// the student back to the lessons that need work, worst first.
export const summarizeWeakTopics = (review = []) => {
  const byTopic = new Map();
  for (const item of Array.isArray(review) ? review : []) {
    if (!item?.topicId || item.isCorrect) continue;
    const entry = byTopic.get(item.topicId) || {
      topicId: item.topicId,
      topicTitle: item.topicTitle || 'Lesson',
      missed: 0,
    };
    entry.missed += 1;
    byTopic.set(item.topicId, entry);
  }
  return [...byTopic.values()].sort((a, b) => b.missed - a.missed);
};
