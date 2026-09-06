import { getPool } from "./db.js";
import { getProfileForUser } from "./profiles.js";
import { listCoursesForUser } from "./courses.js";
import { buildResumeTarget } from "./resumeTarget.js";
import { splitLessonChecks } from "./studyPosition.js";

const toDayIndex = (timestampMs) => Math.floor(Number(timestampMs) / (1000 * 60 * 60 * 24));

const computeStreakDays = (timestamps) => {
    const uniqueDays = new Set(
        timestamps
            .map((value) => toDayIndex(value))
            .filter((value) => Number.isFinite(value)),
    );
    const sortedDays = Array.from(uniqueDays).sort((a, b) => b - a);
    if (!sortedDays.length) return 0;

    const todayIndex = toDayIndex(Date.now());
    if (todayIndex - sortedDays[0] > 1) return 0;

    let streakDays = 1;
    let prev = sortedDays[0];
    for (let index = 1; index < sortedDays.length; index += 1) {
        if (sortedDays[index] === prev - 1) {
            streakDays += 1;
            prev = sortedDays[index];
        } else {
            break;
        }
    }
    return streakDays;
};

export const getProgressSnapshotForUser = async (userId) => {
    const db = getPool();
    const [profile, courses, attemptsResult, topicsResult, progressResult, examResult] = await Promise.all([
        getProfileForUser(userId),
        listCoursesForUser(userId),
        db.query(
            `SELECT
                qa.id,
                qa.topic_id,
                qa.course_id,
                qa.score,
                qa.total,
                qa.created_at,
                t.title AS topic_title,
                c.title AS course_title
             FROM quiz_attempts qa
             LEFT JOIN topics t ON t.id = qa.topic_id
             LEFT JOIN courses c ON c.id = qa.course_id
             WHERE qa.user_id = $1
             ORDER BY qa.created_at DESC`,
            [userId],
        ),
        db.query(
            `SELECT id, course_id, title, created_at
             FROM topics
             WHERE user_id = $1
             ORDER BY sort_order ASC, created_at ASC`,
            [userId],
        ),
        db.query(
            `SELECT
                tp.topic_id,
                tp.course_id,
                tp.completed_at,
                tp.last_studied_at,
                tp.last_activity_kind,
                tp.lesson_checks,
                tp.best_score,
                t.title AS topic_title,
                c.title AS course_title,
                (
                    SELECT COUNT(*)::int
                    FROM questions q
                    WHERE q.topic_id = tp.topic_id
                      AND COALESCE(q.surface, 'quiz') = 'in_lesson'
                ) AS in_lesson_total
             FROM topic_progress tp
             LEFT JOIN topics t ON t.id = tp.topic_id
             LEFT JOIN courses c ON c.id = tp.course_id
             WHERE tp.user_id = $1
               AND tp.last_studied_at IS NOT NULL
             ORDER BY tp.last_studied_at DESC
             LIMIT 1`,
            [userId],
        ),
        db.query(
            `SELECT
                ea.course_id,
                ea.answers,
                ea.total_questions,
                ea.started_at,
                ea.updated_at,
                c.title AS course_title
             FROM exam_attempts ea
             INNER JOIN courses c ON c.id = ea.course_id
             WHERE ea.user_id = $1
               AND ea.status = 'in_progress'
               AND ea.ends_at > NOW()
             ORDER BY ea.updated_at DESC
             LIMIT 1`,
            [userId],
        ),
    ]);

    const attempts = attemptsResult.rows || [];
    const topics = topicsResult.rows || [];
    const uniqueTopicIds = new Set(attempts.map((row) => String(row.topic_id)));
    const streakFromAttempts = computeStreakDays(
        attempts.map((row) => new Date(row.created_at).getTime()),
    );

    let totalScore = 0;
    let totalQuestions = 0;
    for (const attempt of attempts) {
        totalScore += Number(attempt.score || 0);
        totalQuestions += Number(attempt.total || 0);
    }
    const accuracy =
        totalQuestions > 0 ? Math.round((totalScore / totalQuestions) * 100) : 0;

    const topicBest = new Map();
    for (const attempt of attempts) {
        const total = Number(attempt.total || 0);
        if (total <= 0) continue;
        const pct = Math.round((Number(attempt.score || 0) / total) * 100);
        const key = String(attempt.topic_id);
        const existing = topicBest.get(key);
        if (!existing || pct > existing.best) {
            topicBest.set(key, {
                topicId: key,
                title: attempt.topic_title || "Untitled topic",
                best: pct,
            });
        }
    }

    const insightTopics = Array.from(topicBest.values());
    const mastered = insightTopics.filter((item) => item.best >= 80).sort((a, b) => b.best - a.best);
    const progressing = insightTopics
        .filter((item) => item.best >= 50 && item.best < 80)
        .sort((a, b) => b.best - a.best);
    const needsWork = insightTopics.filter((item) => item.best < 50).sort((a, b) => a.best - b.best);
    const overallPreparedness = insightTopics.length
        ? Math.round(
            insightTopics.reduce((sum, item) => sum + item.best, 0) / insightTopics.length,
        )
        : accuracy;

    const topicsByCourse = new Map();
    for (const topic of topics) {
        const courseId = String(topic.course_id);
        if (!topicsByCourse.has(courseId)) topicsByCourse.set(courseId, []);
        topicsByCourse.get(courseId).push(topic);
    }

    const coursesWithProgress = courses.slice(0, 12).map((course) => {
        const courseTopics = topicsByCourse.get(String(course.id)) || [];
        const topicCount = courseTopics.length || Number(course.topicCount || 0);
        const practiced = courseTopics.filter((topic) => topicBest.has(String(topic.id))).length;
        const progress = topicCount > 0 ? Math.round((practiced / topicCount) * 100) : 0;
        return {
            id: course.id,
            _id: course.id,
            title: course.title,
            topicCount,
            progress,
        };
    });

    const latestProgressRow = progressResult.rows[0] || null;
    const examRow = examResult.rows[0] || null;
    const courseProgressById = new Map(
        coursesWithProgress.map((course) => [String(course.id), Number(course.progress || 0)]),
    );
    const resumeCourseProgress = latestProgressRow?.course_id
        ? courseProgressById.get(String(latestProgressRow.course_id)) || 0
        : attempts[0]?.course_id
            ? courseProgressById.get(String(attempts[0].course_id)) || 0
            : topics[0]?.course_id
                ? courseProgressById.get(String(topics[0].course_id)) || 0
                : 0;
    const resumeTarget = buildResumeTarget({
        inProgressExam: examRow
            ? {
                courseId: examRow.course_id,
                courseTitle: examRow.course_title || "",
                answers: examRow.answers,
                totalQuestions: examRow.total_questions,
                startedAt: examRow.started_at,
                updatedAt: examRow.updated_at,
            }
            : null,
        latestProgress: latestProgressRow
            ? {
                topicId: latestProgressRow.topic_id,
                topicTitle: latestProgressRow.topic_title || "",
                courseId: latestProgressRow.course_id,
                courseTitle: latestProgressRow.course_title || "",
                lastStudiedAt: latestProgressRow.last_studied_at,
                lastActivityKind: latestProgressRow.last_activity_kind,
                completedAt: latestProgressRow.completed_at,
                lessonChecks: latestProgressRow.lesson_checks,
                inLessonTotal: latestProgressRow.in_lesson_total,
                bestScore: latestProgressRow.best_score,
                courseProgress: resumeCourseProgress,
                studyPosition: splitLessonChecks(latestProgressRow.lesson_checks).studyPosition,
            }
            : null,
        latestQuizAttempt: attempts[0]
            ? {
                topicId: attempts[0].topic_id,
                topicTitle: attempts[0].topic_title || "",
                courseId: attempts[0].course_id,
                courseTitle: attempts[0].course_title || "",
                createdAt: attempts[0].created_at,
                score: attempts[0].score,
                total: attempts[0].total,
                courseProgress: resumeCourseProgress,
            }
            : null,
        fallbackTopic: topics[0]
            ? {
                id: topics[0].id,
                title: topics[0].title,
                courseId: topics[0].course_id,
                createdAt: topics[0].created_at,
                courseProgress: resumeCourseProgress,
            }
            : null,
    });

    return {
        stats: {
            topics: uniqueTopicIds.size,
            accuracy: overallPreparedness || accuracy,
            courses: courses.length,
            studyTime: Number(profile?.totalStudyHours || 0),
            streakDays: streakFromAttempts || Number(profile?.streakDays || 0),
        },
        performanceInsights: insightTopics.length
            ? {
                mastered,
                progressing,
                needsWork,
                overallPreparedness,
            }
            : null,
        courses: coursesWithProgress,
        resumeTarget,
        conceptReviewQueue: { items: [] },
    };
};
