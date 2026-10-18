// Exam-date planner. Pure so the server (review queue bias) and the client
// (countdown, daily plan) share one set of rules and it can be unit-tested.
// An exam date is a calendar day, "YYYY-MM-DD". "Today" is passed in as the
// UTC-midnight ms of a calendar day: the server uses the UTC day, the client
// the student's local day.
const DAY_MS = 24 * 60 * 60 * 1000;
const EXAM_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

// Exams further out than this do not reorder the review queue.
export const EXAM_FOCUS_DAYS = 30;
export const FINAL_WEEK_DAYS = 7;
export const MAX_EXAM_DAYS_AHEAD = 730;

export const utcTodayMs = (now = Date.now()) => Math.floor(now / DAY_MS) * DAY_MS;

export const localTodayMs = (now = Date.now()) => {
    const date = new Date(now);
    return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
};

const examDayMs = (examDate) => {
    const match = EXAM_DATE_RE.exec(String(examDate || '').trim());
    if (!match) return null;
    const [, year, month, day] = match.map(Number);
    const ms = Date.UTC(year, month - 1, day);
    const check = new Date(ms);
    if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
        return null;
    }
    return ms;
};

// A real calendar day, not in the past and not absurdly far out; else null.
// The one-day grace keeps a student ahead of UTC from being refused "today".
export const parseExamDate = (value, todayMs = utcTodayMs()) => {
    const ms = examDayMs(value);
    if (ms == null) return null;
    const days = Math.round((ms - todayMs) / DAY_MS);
    if (days < -1 || days > MAX_EXAM_DAYS_AHEAD) return null;
    return String(value).trim();
};

// Whole days from today to the exam: 0 on exam day, negative once it passed.
export const daysUntilExam = (examDate, todayMs) => {
    const ms = examDayMs(examDate);
    if (ms == null) return null;
    return Math.round((ms - todayMs) / DAY_MS);
};

// How hard a course's exam pulls its questions up the review queue.
export const examWeight = (daysLeft) => {
    if (daysLeft == null || daysLeft < 0) return 0;
    if (daysLeft <= FINAL_WEEK_DAYS) return 3;
    if (daysLeft <= 14) return 2;
    if (daysLeft <= EXAM_FOCUS_DAYS) return 1;
    return 0;
};

/**
 * Order due review rows. With no near exams this is the plain schedule order
 * (oldest due first, most-missed first). Courses with a near exam come first,
 * by urgency bucket then nearest date, and inside them the weakest topics
 * (most lapses across their due questions) lead.
 *
 * @param rows [{questionId, courseId, topicId, dueAt, lapses}]
 * @param daysLeftByCourse Map<courseId, daysLeft>
 */
export const rankReviewRows = (rows = [], daysLeftByCourse = new Map()) => {
    const topicLapses = new Map();
    for (const row of rows) {
        const key = row.topicId || '';
        topicLapses.set(key, (topicLapses.get(key) || 0) + Number(row.lapses || 0));
    }
    const weightOf = (row) => examWeight(daysLeftByCourse.get(row.courseId) ?? null);
    return [...rows].sort((a, b) => {
        const weight = weightOf(b) - weightOf(a);
        if (weight) return weight;
        if (weightOf(a) > 0) {
            const nearer = daysLeftByCourse.get(a.courseId) - daysLeftByCourse.get(b.courseId);
            if (nearer) return nearer;
            const weak = (topicLapses.get(b.topicId || '') || 0) - (topicLapses.get(a.topicId || '') || 0);
            if (weak) return weak;
        }
        const due = Number(a.dueAt) - Number(b.dueAt);
        if (due) return due;
        const lapses = Number(b.lapses || 0) - Number(a.lapses || 0);
        if (lapses) return lapses;
        return String(a.questionId).localeCompare(String(b.questionId));
    });
};

/**
 * Today's plan for one course with an exam date.
 * @param exam {examDate, lessonsTotal, lessonsDone, reviewDue, hasQuestions, lastTimedExamAt}
 * @returns null when there is no upcoming exam
 */
export const buildDailyPlan = (exam, todayMs) => {
    const daysLeft = daysUntilExam(exam?.examDate, todayMs);
    if (daysLeft == null || daysLeft < 0) return null;

    const lessonsLeft = Math.max(0, Number(exam.lessonsTotal || 0) - Number(exam.lessonsDone || 0));
    // Finish new lessons the day before the exam; exam day is for review.
    const lessonDays = Math.max(1, daysLeft);
    const lessonsToday = daysLeft === 0 ? 0 : Math.ceil(lessonsLeft / lessonDays);
    const reviewDue = Math.max(0, Number(exam.reviewDue || 0));

    let timedExam = null;
    if (exam.hasQuestions && daysLeft <= FINAL_WEEK_DAYS) {
        const finalWeekStart = examDayMs(exam.examDate) - FINAL_WEEK_DAYS * DAY_MS;
        const last = exam.lastTimedExamAt == null ? null : Number(exam.lastTimedExamAt);
        timedExam = last != null && last >= finalWeekStart ? 'done' : 'due';
    }

    return { daysLeft, lessonsLeft, lessonsToday, reviewDue, timedExam };
};

export const examCountdownLabel = (daysLeft) => {
    if (daysLeft == null) return '';
    if (daysLeft < 0) return 'Exam date passed';
    if (daysLeft === 0) return 'Exam today';
    if (daysLeft === 1) return 'Exam tomorrow';
    return `Exam in ${daysLeft} days`;
};

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

// Short checklist lines for the plan card, most important first.
export const dailyPlanItems = (plan) => {
    if (!plan) return [];
    const items = [];
    if (plan.reviewDue > 0) {
        items.push({ kind: 'review', text: `Review ${plural(plan.reviewDue, 'missed question')}` });
    }
    if (plan.lessonsToday > 0) {
        items.push({
            kind: 'lessons',
            text: `Study ${plural(plan.lessonsToday, 'new lesson')} (${plan.lessonsLeft} left)`,
        });
    }
    if (plan.timedExam === 'due') {
        items.push({ kind: 'exam', text: 'Take one timed exam this week' });
    } else if (plan.timedExam === 'done') {
        items.push({ kind: 'exam-done', text: 'Timed exam done this week' });
    }
    if (items.length === 0) {
        items.push({
            kind: 'done',
            text: plan.lessonsLeft === 0 ? 'All lessons studied. Keep reviewing.' : 'Nothing due today.',
        });
    }
    return items;
};
