const toMs = (value) => {
    if (value == null || value === "") return 0;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
};

export const normalizeActivityKind = (value, fallback = "lesson") => {
    const kind = String(value || "").trim().toLowerCase();
    if (kind === "quiz" || kind === "podcast" || kind === "exam" || kind === "lesson") {
        return kind;
    }
    return fallback;
};

export const hrefForResumeTarget = ({ kind, topicId, courseId } = {}) => {
    if (kind === "exam" && courseId) {
        return `/dashboard/exam?courseId=${encodeURIComponent(courseId)}&resume=1`;
    }
    if (kind === "quiz" && topicId) {
        return `/dashboard/quiz/${encodeURIComponent(topicId)}`;
    }
    if (kind === "podcast" && topicId) {
        return `/dashboard/topic/${encodeURIComponent(topicId)}?panel=podcast`;
    }
    if (topicId) {
        return `/dashboard/topic/${encodeURIComponent(topicId)}`;
    }
    return "/dashboard/lessons";
};

const countAnswered = (answers) => {
    if (!answers || typeof answers !== "object" || Array.isArray(answers)) return 0;
    return Object.keys(answers).length;
};

export const buildResumeTarget = ({
    inProgressExam,
    latestProgress,
    latestQuizAttempt,
    fallbackTopic,
} = {}) => {
    if (inProgressExam?.courseId) {
        const total = Number(inProgressExam.totalQuestions || 0);
        const answered = countAnswered(inProgressExam.answers);
        return {
            kind: "exam",
            topicId: null,
            topicTitle: "",
            courseId: inProgressExam.courseId,
            courseTitle: inProgressExam.courseTitle || "",
            title: inProgressExam.courseTitle || "Timed exam",
            href: hrefForResumeTarget({
                kind: "exam",
                courseId: inProgressExam.courseId,
            }),
            progressPercent: total > 0 ? Math.round((answered / total) * 100) : 0,
            lastActivityAt: toMs(inProgressExam.updatedAt || inProgressExam.startedAt),
        };
    }

    const progressAt = toMs(latestProgress?.lastStudiedAt);
    const quizAt = toMs(latestQuizAttempt?.createdAt);
    if (latestProgress?.topicId && progressAt >= quizAt) {
        const kind = normalizeActivityKind(latestProgress.lastActivityKind, "lesson");
        return {
            kind,
            topicId: latestProgress.topicId,
            topicTitle: latestProgress.topicTitle || "",
            courseId: latestProgress.courseId || null,
            courseTitle: latestProgress.courseTitle || "",
            title: latestProgress.topicTitle || latestProgress.courseTitle || "Continue learning",
            href: hrefForResumeTarget({
                kind,
                topicId: latestProgress.topicId,
                courseId: latestProgress.courseId,
            }),
            progressPercent: latestProgress.completedAt
                ? 100
                : Math.max(0, Math.min(100, Number(latestProgress.progressPercent || 0))),
            lastActivityAt: progressAt,
        };
    }

    if (latestQuizAttempt?.topicId) {
        const total = Number(latestQuizAttempt.total || 0);
        const score = Number(latestQuizAttempt.score || 0);
        return {
            kind: "quiz",
            topicId: latestQuizAttempt.topicId,
            topicTitle: latestQuizAttempt.topicTitle || "",
            courseId: latestQuizAttempt.courseId || null,
            courseTitle: latestQuizAttempt.courseTitle || "",
            title: latestQuizAttempt.topicTitle || "Topic quiz",
            href: hrefForResumeTarget({
                kind: "quiz",
                topicId: latestQuizAttempt.topicId,
            }),
            progressPercent: total > 0 ? Math.round((score / total) * 100) : 0,
            lastActivityAt: quizAt,
        };
    }

    if (fallbackTopic?.id || fallbackTopic?.topicId) {
        const topicId = fallbackTopic.id || fallbackTopic.topicId;
        const courseId = fallbackTopic.courseId || fallbackTopic.course_id || null;
        return {
            kind: "lesson",
            topicId,
            topicTitle: fallbackTopic.title || fallbackTopic.topicTitle || "",
            courseId,
            courseTitle: fallbackTopic.courseTitle || "",
            title: fallbackTopic.title || fallbackTopic.topicTitle || "Continue learning",
            href: hrefForResumeTarget({ kind: "lesson", topicId }),
            progressPercent: 0,
            lastActivityAt: toMs(fallbackTopic.createdAt || fallbackTopic.created_at),
        };
    }

    return null;
};
