import { getPool } from "./db.js";
import { getProfileForUser } from "./profiles.js";
import { listCoursesForUser } from "./courses.js";

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
    const [profile, courses, attemptsResult, topicsResult] = await Promise.all([
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
                t.title AS topic_title
             FROM quiz_attempts qa
             LEFT JOIN topics t ON t.id = qa.topic_id
             WHERE qa.user_id = $1
             ORDER BY qa.created_at DESC`,
            [userId],
        ),
        db.query(
            `SELECT id, course_id, title
             FROM topics
             WHERE user_id = $1
             ORDER BY sort_order ASC, created_at ASC`,
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

    let resumeTarget = null;
    if (attempts[0]?.topic_id) {
        resumeTarget = {
            topicId: attempts[0].topic_id,
            topicTitle: attempts[0].topic_title || "Latest lesson",
            courseId: attempts[0].course_id || null,
        };
    } else if (topics[0]) {
        resumeTarget = {
            topicId: topics[0].id,
            topicTitle: topics[0].title,
            courseId: topics[0].course_id,
        };
    }

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
