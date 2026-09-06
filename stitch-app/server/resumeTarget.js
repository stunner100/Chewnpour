import {
    lessonCheckCount,
    normalizeStudyPosition,
    splitLessonChecks,
    studyPositionPercent,
} from "./studyPosition.js";

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

export const clampPercent = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.min(100, Math.round(numeric)));
};

export const computeResumeProgressPercent = ({
    kind,
    completedAt,
    lessonChecks,
    inLessonTotal,
    bestScore,
    courseProgress,
    quizScore,
    quizTotal,
    examAnswers,
    examTotal,
    studyPosition,
} = {}) => {
    if (kind === "exam") {
        const total = Number(examTotal || 0);
        if (total > 0) {
            return clampPercent((countAnswered(examAnswers) / total) * 100);
        }
    }
    if (kind === "quiz") {
        const total = Number(quizTotal || 0);
        if (total > 0) {
            return clampPercent((Number(quizScore || 0) / total) * 100);
        }
    }
    if (completedAt) return 100;
    const fromSection = studyPositionPercent(normalizeStudyPosition(studyPosition), completedAt);
    if (fromSection != null) return fromSection;
    const checks = lessonCheckCount(lessonChecks);
    const checkTotal = Math.max(Number(inLessonTotal || 0), checks);
    if (checkTotal > 0 && checks > 0) {
        return clampPercent((checks / checkTotal) * 100);
    }
    const best = Number(bestScore);
    if (Number.isFinite(best) && best > 0) return clampPercent(best);
    const course = Number(courseProgress);
    if (Number.isFinite(course) && course > 0) return clampPercent(course);
    return 0;
};

export const buildResumeTarget = ({
    inProgressExam,
    latestProgress,
    latestQuizAttempt,
    fallbackTopic,
} = {}) => {
    if (inProgressExam?.courseId) {
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
            progressPercent: computeResumeProgressPercent({
                kind: "exam",
                examAnswers: inProgressExam.answers,
                examTotal: inProgressExam.totalQuestions,
            }),
            lastActivityAt: toMs(inProgressExam.updatedAt || inProgressExam.startedAt),
        };
    }

    const progressAt = toMs(latestProgress?.lastStudiedAt);
    const quizAt = toMs(latestQuizAttempt?.createdAt);
    if (latestProgress?.topicId && progressAt >= quizAt) {
        const kind = normalizeActivityKind(latestProgress.lastActivityKind, "lesson");
        const matchingQuiz =
            latestQuizAttempt?.topicId &&
            String(latestQuizAttempt.topicId) === String(latestProgress.topicId)
                ? latestQuizAttempt
                : null;
        const studyPosition = normalizeStudyPosition(latestProgress.studyPosition)
            || splitLessonChecks(latestProgress.lessonChecks).studyPosition;
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
            progressPercent: computeResumeProgressPercent({
                kind,
                completedAt: latestProgress.completedAt,
                lessonChecks: latestProgress.lessonChecks,
                inLessonTotal: latestProgress.inLessonTotal,
                bestScore: latestProgress.bestScore,
                courseProgress: latestProgress.courseProgress,
                quizScore: matchingQuiz?.score,
                quizTotal: matchingQuiz?.total,
                studyPosition,
            }),
            lastActivityAt: progressAt,
            completedAt: latestProgress.completedAt || null,
            sectionIndex: studyPosition?.sectionIndex ?? null,
            sectionCount: studyPosition?.sectionCount ?? null,
            sectionTitle: studyPosition?.sectionTitle || "",
            finished: Boolean(studyPosition?.finished || latestProgress.completedAt),
        };
    }

    if (latestQuizAttempt?.topicId) {
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
            progressPercent: computeResumeProgressPercent({
                kind: "quiz",
                quizScore: latestQuizAttempt.score,
                quizTotal: latestQuizAttempt.total,
                courseProgress: latestQuizAttempt.courseProgress,
            }),
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
            progressPercent: computeResumeProgressPercent({
                kind: "lesson",
                courseProgress: fallbackTopic.courseProgress,
            }),
            lastActivityAt: toMs(fallbackTopic.createdAt || fallbackTopic.created_at),
        };
    }

    return null;
};
