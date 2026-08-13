export const resumeActivityCopy = (target) => {
    const kind = String(target?.kind || 'lesson');
    const title = String(target?.topicTitle || target?.title || target?.courseTitle || '').trim();
    const heading = title || 'Continue learning';

    if (kind === 'quiz') {
        return {
            badge: 'Quiz in progress',
            heading,
            hint: title ? `Continue the quiz on ${title}` : 'Continue the quiz you started.',
            cta: 'Continue quiz',
            nextStep: 'Finish your quiz',
        };
    }
    if (kind === 'podcast') {
        return {
            badge: 'Listening',
            heading,
            hint: title ? `Keep listening to ${title}` : 'Continue the podcast you started.',
            cta: 'Continue listening',
            nextStep: 'Continue listening',
        };
    }
    if (kind === 'exam') {
        const courseTitle = String(target?.courseTitle || title || 'your course').trim();
        return {
            badge: 'Exam in progress',
            heading: courseTitle,
            hint: `Finish your timed exam in ${courseTitle}`,
            cta: 'Continue exam',
            nextStep: 'Finish your exam',
        };
    }
    return {
        badge: title ? 'In progress' : 'Ready',
        heading,
        hint: title ? `Pick up ${title}` : 'Open the latest course and keep moving through lessons and quizzes.',
        cta: 'Continue studying',
        nextStep: 'Continue a lesson',
    };
};

export const recordStudyActivity = (topicId, kind) => {
    if (!topicId) return Promise.resolve(null);
    return fetch(`/api/topics/${encodeURIComponent(topicId)}/progress`, {
        method: 'POST',
        credentials: 'include',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            lastStudiedAt: Date.now(),
            lastActivityKind: kind,
        }),
    }).catch(() => null);
};
