// Pure data-shaping helpers for the /dashboard/progress page.
// Kept component-free so component files stay fast-refresh clean.
import { formatCourseTitle } from '../../lib/courseTitle.js';

export const STATUS_STRONG = 'Strong';
export const STATUS_DEVELOPING = 'Developing';
export const STATUS_NEEDS_REVIEW = 'Needs review';
export const STATUS_NOT_PRACTICED = 'Not practiced';

export const topicStatusLabel = (score) => {
    if (score == null || score === '') return STATUS_NOT_PRACTICED;
    const value = Number(score);
    if (!Number.isFinite(value)) return STATUS_NOT_PRACTICED;
    if (value >= 80) return STATUS_STRONG;
    if (value >= 50) return STATUS_DEVELOPING;
    return STATUS_NEEDS_REVIEW;
};

export const buildTopicRows = (performanceInsights) => {
    if (!performanceInsights) return [];
    // Attention-first ordering: weakest topics surface at the top.
    return [
        ...(performanceInsights.needsWork || []),
        ...(performanceInsights.progressing || []),
        ...(performanceInsights.mastered || []),
    ].map((topic) => {
        const hasScore = topic?.best != null && Number.isFinite(Number(topic.best));
        const score = hasScore ? Math.round(Number(topic.best)) : null;
        return {
            id: String(topic.topicId || topic.title),
            title: String(topic.title || 'Untitled topic'),
            courseTitle: topic.courseTitle ? String(topic.courseTitle) : '',
            score,
            status: topicStatusLabel(score),
        };
    });
};

export const buildCourseRows = (courses) =>
    (Array.isArray(courses) ? courses : [])
        .slice(0, 12)
        .map((course) => {
            const topicCount = Math.max(0, Number(course.topicCount || 0));
            const progress = Math.max(0, Math.min(100, Math.round(Number(course.progress || 0))));
            return {
                id: String(course.id || course._id || course.title),
                title: formatCourseTitle(course.title) || String(course.title || 'Untitled course'),
                topicCount,
                progress,
                practiced: Math.min(topicCount, Math.round((progress / 100) * topicCount)),
            };
        });

export const formatLastStudied = (value) => {
    if (!value) return '';
    const ms = typeof value === 'number' ? value : new Date(value).getTime();
    if (!Number.isFinite(ms) || ms <= 0) return '';
    const diffMinutes = Math.max(0, Math.round((Date.now() - ms) / 60000));
    if (diffMinutes < 1) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes} min ago`;
    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} hr ago`;
    const diffDays = Math.round(diffHours / 24);
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 30) return `${diffDays} days ago`;
    return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};
