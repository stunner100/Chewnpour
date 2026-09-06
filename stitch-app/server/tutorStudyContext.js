import { getPool } from "./db.js";
import { splitLessonChecks } from "./studyPosition.js";

const MAX_TITLE = 180;
const MAX_EXCERPT = 1200;
const MAX_MISSED = 3;

export const sanitizeStudyContext = (raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

    const sectionIndex = Number.isFinite(Number(raw.sectionIndex))
        ? Math.max(0, Math.round(Number(raw.sectionIndex)))
        : null;
    const sectionCount = Number.isFinite(Number(raw.sectionCount))
        ? Math.max(0, Math.round(Number(raw.sectionCount)))
        : null;
    const sectionTitle = String(raw.sectionTitle || "").trim().slice(0, MAX_TITLE);
    const sectionExcerpt = String(raw.sectionExcerpt || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, MAX_EXCERPT);

    if (sectionIndex == null && !sectionTitle && !sectionExcerpt) return null;

    return {
        sectionIndex,
        sectionCount,
        sectionTitle,
        sectionExcerpt,
    };
};

const missedQuestionTexts = (answers) => {
    if (!Array.isArray(answers)) return [];
    return answers
        .filter((answer) => answer && answer.isCorrect === false)
        .map((answer) => String(answer.questionText || answer.prompt || "").trim())
        .filter(Boolean)
        .slice(0, MAX_MISSED);
};

export const formatTutorStudyBlock = ({ studyContext, snapshot } = {}) => {
    const lines = [];
    const context = sanitizeStudyContext(studyContext);

    if (context) {
        lines.push("CURRENT SECTION:");
        if (context.sectionCount > 0 && context.sectionIndex != null) {
            lines.push(`Index: ${context.sectionIndex + 1} of ${context.sectionCount}`);
        } else if (context.sectionIndex != null) {
            lines.push(`Index: ${context.sectionIndex + 1}`);
        }
        if (context.sectionTitle) lines.push(`Title: ${context.sectionTitle}`);
        if (context.sectionExcerpt) lines.push(`Excerpt: ${context.sectionExcerpt}`);
    }

    if (snapshot) {
        if (lines.length) lines.push("");
        lines.push("LEARNER PERFORMANCE ON THIS TOPIC:");
        lines.push(snapshot.completedAt ? "Lesson completed: yes" : "Lesson completed: no");
        if (Number.isFinite(Number(snapshot.bestScore))) {
            lines.push(`Best quiz score: ${Math.round(Number(snapshot.bestScore))}%`);
        } else {
            lines.push("Best quiz score: none yet");
        }
        if (snapshot.latestQuiz && Number.isFinite(Number(snapshot.latestQuiz.total))) {
            const score = Number(snapshot.latestQuiz.score || 0);
            const total = Number(snapshot.latestQuiz.total || 0);
            const percent = total > 0 ? Math.round((score / total) * 100) : 0;
            lines.push(`Latest quiz: ${score} / ${total} (${percent}%)`);
            if (Array.isArray(snapshot.missedQuestions) && snapshot.missedQuestions.length) {
                lines.push(`Missed questions: ${snapshot.missedQuestions.join(" | ")}`);
            }
        } else {
            lines.push("Latest quiz: none yet");
        }
    }

    return lines.join("\n");
};

export const loadTopicTutorSnapshot = async ({ userId, topicId }) => {
    const db = getPool();
    const [progressResult, attemptResult] = await Promise.all([
        db.query(
            `SELECT completed_at, best_score, lesson_checks
             FROM topic_progress
             WHERE user_id = $1 AND topic_id = $2
             LIMIT 1`,
            [userId, topicId],
        ),
        db.query(
            `SELECT score, total, answers, created_at
             FROM quiz_attempts
             WHERE user_id = $1 AND topic_id = $2
             ORDER BY created_at DESC
             LIMIT 1`,
            [userId, topicId],
        ),
    ]);

    const progress = progressResult.rows[0] || null;
    const attempt = attemptResult.rows[0] || null;
    const missedQuestions = missedQuestionTexts(attempt?.answers);

    return {
        completedAt: progress?.completed_at
            ? new Date(progress.completed_at).getTime()
            : null,
        bestScore:
            progress?.best_score == null || Number.isNaN(Number(progress.best_score))
                ? null
                : Number(progress.best_score),
        studyPosition: splitLessonChecks(progress?.lesson_checks).studyPosition,
        latestQuiz: attempt
            ? {
                score: Number(attempt.score || 0),
                total: Number(attempt.total || 0),
                createdAt: attempt.created_at
                    ? new Date(attempt.created_at).getTime()
                    : null,
            }
            : null,
        missedQuestions,
    };
};
