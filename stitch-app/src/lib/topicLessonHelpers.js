export const isReExplainQuotaExceededError = (error) => {
    const code = String(error?.data?.code || '').trim().toUpperCase();
    if (code === 'REEXPLAIN_QUOTA_EXCEEDED') return true;
    const message = String(error?.message || error?.data?.message || '').toUpperCase();
    return message.includes('REEXPLAIN_QUOTA_EXCEEDED');
};

export const buildTopicQuizRoute = (topicId) =>
    topicId ? `/dashboard/quiz/${topicId}` : '/dashboard';
export const buildEssayQuizRoute = (topicId) =>
    topicId ? `/dashboard/quiz/${topicId}` : '/dashboard';
export const buildTimedExamRoute = (courseId) =>
    courseId ? `/dashboard/exam?courseId=${encodeURIComponent(courseId)}` : '/dashboard/exam';


export const getCurrentHashTargetId = () => {
    if (typeof window === 'undefined') return '';
    const rawHash = window.location.hash ? window.location.hash.slice(1) : '';
    if (!rawHash) return '';
    try {
        return decodeURIComponent(rawHash).trim();
    } catch {
        return rawHash.trim();
    }
};

export const scrollHashTargetIntoView = ({ behavior = 'auto' } = {}) => {
    const targetId = getCurrentHashTargetId();
    if (!targetId) return false;
    const node = document.getElementById(targetId);
    if (!node) return false;
    node.scrollIntoView({ behavior, block: 'start' });
    return true;
};
