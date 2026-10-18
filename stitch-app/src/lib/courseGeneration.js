// Client view of background lesson generation (server/generationJobs.js):
// which parts of a course are written, being written, waiting or failed, and
// the requests that start generation.

export const GENERATION_POLL_MS = 4000;
// Lessons one "write these parts" request may ask for.
export const MAX_LESSONS_PER_REQUEST = 12;

const planOf = (course) => (Array.isArray(course?.lessonPlan) ? course.lessonPlan : []);

// The plan entries the active job is writing: all pending ones for a course
// job, the listed ones for a lessons job.
const inProgressIndexes = (course) => {
    const generation = course?.generation;
    if (!generation?.active) return new Set();
    if (generation.kind === 'lessons') return new Set(generation.planIndexes || []);
    return new Set(planOf(course)
        .map((entry, index) => (entry?.status === 'pending' ? index : null))
        .filter((index) => index !== null)
        .slice(0, MAX_LESSONS_PER_REQUEST));
};

// { writing, failedCourse, total, written, parts } where parts are the plan
// entries without a lesson, in document order, each with its number and a
// state: "writing", "failed" or "waiting".
export const courseGenerationState = (course) => {
    const plan = planOf(course);
    const writingIndexes = inProgressIndexes(course);
    const parts = plan
        .map((entry, index) => ({ ...entry, index, number: index + 1 }))
        .filter((entry) => !entry.topicId)
        .map((entry) => ({
            ...entry,
            state: writingIndexes.has(entry.index) ? 'writing' : entry.status === 'failed' ? 'failed' : 'waiting',
        }));
    return {
        writing: Boolean(course?.generation?.active),
        failedCourse: course?.status === 'failed',
        total: plan.length,
        written: plan.filter((entry) => entry?.topicId).length,
        parts,
    };
};

// Whether the topic's lesson is being rewritten by an active job.
export const isTopicRewriting = (topicId, course) => {
    if (!topicId || !course?.generation?.active || course.generation.kind !== 'lessons') return false;
    const planIndex = planOf(course).findIndex((entry) => entry?.topicId === topicId);
    return planIndex >= 0 && (course.generation.planIndexes || []).includes(planIndex);
};

const postJson = async (url, body) => {
    const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Could not start generation.');
    return payload.course || null;
};

export const requestTopicRegenerate = (topicId) =>
    postJson(`/api/topics/${encodeURIComponent(topicId)}/regenerate`);

export const requestCourseRegenerate = (courseId) =>
    postJson(`/api/courses/${encodeURIComponent(courseId)}/regenerate`);

export const requestPlannedLessons = (courseId, planIndexes) =>
    postJson(`/api/courses/${encodeURIComponent(courseId)}/lessons`, {
        planIndexes: planIndexes.slice(0, MAX_LESSONS_PER_REQUEST),
    });
