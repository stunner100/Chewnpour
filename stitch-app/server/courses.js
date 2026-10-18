import { nanoid } from "nanoid";
import { getPool } from "./db.js";
import { stripCourseTitle } from "./courseGeneration.js";
import { MAX_GENERATED_LESSONS } from "./lessonPlanning.js";
import { isCourseAiEnabled } from "./llmClient.js";
import {
    enqueueGenerationJob,
    kickGenerationWorker,
    resumeStalledGeneration,
} from "./generationJobs.js";
import { recordReviewOutcomes } from "./reviews.js";
import { formatExamDate } from "./courseExamDate.js";

// The course's queued or running generation job, as a column of a courses
// query aliased "c".
const ACTIVE_JOB_SQL = `(
    SELECT json_build_object('status', j.status, 'kind', j.kind, 'planIndexes', j.plan_indexes)
    FROM generation_jobs j
    WHERE j.course_id = c.id AND j.status IN ('queued', 'running')
    LIMIT 1
) AS active_job`;

const toClientCourse = (row, extras = {}) => {
    if (!row) return null;
    let quizTopics = extras.quizTopics;
    if (quizTopics == null && row.quiz_topics != null) {
        quizTopics = row.quiz_topics;
        if (typeof quizTopics === "string") {
            try {
                quizTopics = JSON.parse(quizTopics);
            } catch {
                quizTopics = [];
            }
        }
    }
    if (!Array.isArray(quizTopics)) quizTopics = [];
    return {
        id: row.id,
        userId: row.user_id,
        uploadId: row.upload_id || null,
        title: row.title,
        description: row.description || "",
        status: row.status,
        generationBackend: row.generation_backend || extras.generationBackend || null,
        shareToken: row.share_token || extras.shareToken || null,
        shareEnabled: Boolean(row.share_token || extras.shareToken),
        shareUrl: extras.shareUrl || (row.share_token ? `/c/${row.share_token}` : null),
        topicCount: Number(extras.topicCount ?? row.topic_count ?? 0),
        quizzesReady: Number(extras.quizzesReady ?? row.quizzes_ready ?? 0),
        firstTopicId: extras.firstTopicId ?? row.first_topic_id ?? null,
        firstQuizTopicId: extras.firstQuizTopicId ?? row.first_quiz_topic_id ?? null,
        quizTopics,
        examDate: formatExamDate(row.exam_date),
        // Plan entries are { title, kind, start, end, chars, status, topicId }:
        // status "written" has a topic; "failed" could not be written;
        // "pending" has not been written yet.
        lessonPlan: Array.isArray(row.lesson_plan) ? row.lesson_plan : [],
        // The background job writing this course's lessons, if one is queued
        // or running. A "lessons" job lists the plan entries it is writing or
        // rewriting in planIndexes.
        generation: row.active_job
            ? {
                active: true,
                kind: row.active_job.kind,
                planIndexes: Array.isArray(row.active_job.planIndexes) ? row.active_job.planIndexes : [],
            }
            : { active: false, kind: null, planIndexes: [] },
        createdAt: row.created_at ? new Date(row.created_at).getTime() : null,
        updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : null,
    };
};

const toClientTopic = (row, extras = {}) => {
    if (!row) return null;
    return {
        id: row.id,
        _id: row.id,
        courseId: row.course_id,
        uploadId: row.upload_id || null,
        sourceUploadId: row.upload_id || null,
        title: row.title,
        description: row.description || "",
        lesson: parsePayload(row.lesson),
        // { needsReview, droppedSections, unsupportedCoreSections, droppedTerms }
        grounding: parsePayload(row.grounding),
        sortOrder: Number(row.sort_order || 0),
        questionCount: Number(extras.questionCount ?? row.question_count ?? 0),
        orderingCheck: extras.orderingCheck ?? row.orderingCheck ?? null,
        inLessonChecks: extras.inLessonChecks ?? row.inLessonChecks ?? [],
        assessmentRoute: "topic_quiz",
        createdAt: row.created_at ? new Date(row.created_at).getTime() : null,
        updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : null,
    };
};

const quizQuestionSql = (alias = "") => {
    const prefix = alias ? `${alias}.` : "";
    return `COALESCE(${prefix}question_type, 'multiple_choice') = 'multiple_choice' AND COALESCE(${prefix}surface, 'quiz') = 'quiz'`;
};

const MCQ_TYPE_SQL = quizQuestionSql("");

const toClientQuestion = (row) => {
    if (!row) return null;
    return {
        id: row.id,
        topicId: row.topic_id,
        courseId: row.course_id,
        prompt: row.prompt,
        options: Array.isArray(row.options) ? row.options : row.options || [],
        correctIndex: Number(row.correct_index || 0),
        explanation: row.explanation || "",
        sortOrder: Number(row.sort_order || 0),
        questionType: row.question_type || "multiple_choice",
    };
};

const shuffleCopy = (items) => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
};

const parsePayload = (raw) => {
    if (!raw) return {};
    if (typeof raw === "string") {
        try {
            return JSON.parse(raw) || {};
        } catch {
            return {};
        }
    }
    return typeof raw === "object" ? raw : {};
};

const toPlayableInLessonCheck = (row) => {
    if (!row) return null;
    const payload = parsePayload(row.payload);
    const questionType = row.question_type || "multiple_choice";
    let options = Array.isArray(row.options) ? row.options : row.options || [];
    if (questionType === "ordering") {
        const steps = Array.isArray(payload.stepsInOrder) ? payload.stepsInOrder : options;
        options = shuffleCopy(steps.map((step) => String(step || "").trim()).filter(Boolean));
        if (options.length > 1 && options.every((step, index) => step === steps[index])) {
            [options[0], options[options.length - 1]] = [options[options.length - 1], options[0]];
        }
    }
    return {
        id: row.id,
        prompt: row.prompt,
        options,
        questionType,
        sectionIndex: Number.isInteger(payload.sectionIndex) ? payload.sectionIndex : null,
        sortOrder: Number(row.sort_order || 0),
    };
};

const toPlayableQuestion = (row) => {
    const full = toClientQuestion(row);
    if (!full) return null;
    return {
        id: full.id,
        topicId: full.topicId,
        courseId: full.courseId,
        prompt: full.prompt,
        options: full.options,
        sortOrder: full.sortOrder,
    };
};

export const getCourseByUploadId = async (userId, uploadId) => {
    const db = getPool();
    const result = await db.query(
        `SELECT * FROM courses WHERE user_id = $1 AND upload_id = $2 LIMIT 1`,
        [userId, uploadId],
    );
    return result.rows[0] || null;
};

const generationError = (message, status, code) => Object.assign(new Error(message), { status, code });

// Returns the upload's course, creating it and queuing its generation job on
// first call. Generation runs in the background (generationJobs.js); the
// course is listed as soon as its first lesson is saved. A course whose job
// has stalled is restarted here, since the upload page polls this.
export const ensureCourseGeneration = async ({ userId, uploadId, fileName, extractedText }) => {
    const db = getPool();
    let course = await getCourseByUploadId(userId, uploadId);
    if (!course) {
        if (!String(extractedText || "").trim()) {
            throw generationError("Cannot generate a course without extracted text.", 400, "EXTRACTION_INCOMPLETE");
        }
        const title = stripCourseTitle(fileName) || "Study material";
        try {
            const inserted = await db.query(
                `INSERT INTO courses (id, user_id, upload_id, title, status)
                 VALUES ($1, $2, $3, $4, 'generating')
                 RETURNING *`,
                [nanoid(), userId, uploadId, title.slice(0, 180)],
            );
            course = inserted.rows[0];
        } catch (error) {
            // Another request created it first.
            if (error?.code !== "23505") throw error;
            course = await getCourseByUploadId(userId, uploadId);
        }
    }
    if (course.status === "generating") {
        const resumed = await resumeStalledGeneration(course.id);
        if (!resumed) {
            const job = await enqueueGenerationJob({ courseId: course.id, userId, uploadId, kind: "course" });
            if (job?.status === "queued" && job.attempts === 0) kickGenerationWorker({ jobId: job.id });
        }
    }
    return getCourseForUser(userId, course.id);
};

const requireCourse = async (userId, courseId) => {
    const { rows } = await getPool().query(
        `SELECT * FROM courses WHERE id = $1 AND user_id = $2 LIMIT 1`,
        [courseId, userId],
    );
    if (!rows[0]) throw generationError("Course not found", 404);
    return rows[0];
};

// Lessons are written by the model; without it a lessons job could only fail.
const queueLessons = async (course, planIndexes) => {
    if (!isCourseAiEnabled()) {
        throw generationError("Lesson writing isn't available right now. Try again later.", 503, "AI_UNAVAILABLE");
    }
    const job = await enqueueGenerationJob({
        courseId: course.id,
        userId: course.user_id,
        uploadId: course.upload_id,
        kind: "lessons",
        planIndexes,
    });
    if (job?.kind === "course") {
        throw generationError("This course's lessons are still being written. Try again when they are done.", 409, "GENERATION_ACTIVE");
    }
    if (job?.status === "queued") kickGenerationWorker({ jobId: job.id });
    return getCourseForUser(course.user_id, course.id);
};

// Rewrites one lesson from its part of the upload. The topic keeps its id,
// progress and notes; its questions are replaced.
export const regenerateTopicForUser = async (userId, topicId) => {
    const { rows } = await getPool().query(
        `SELECT id, course_id FROM topics WHERE id = $1 AND user_id = $2 LIMIT 1`,
        [topicId, userId],
    );
    if (!rows[0]) throw generationError("Topic not found", 404);
    const course = await requireCourse(userId, rows[0].course_id);
    const plan = Array.isArray(course.lesson_plan) ? course.lesson_plan : [];
    const planIndex = plan.findIndex((entry) => entry?.topicId === topicId);
    if (planIndex < 0) throw generationError("This lesson has no source part to regenerate from.", 409, "NO_PLAN_ENTRY");
    return queueLessons(course, [planIndex]);
};

// Writes lessons for planned parts that have none yet (not reached, or failed).
export const generatePlannedLessonsForUser = async (userId, courseId, planIndexes) => {
    const course = await requireCourse(userId, courseId);
    const plan = Array.isArray(course.lesson_plan) ? course.lesson_plan : [];
    const requested = (Array.isArray(planIndexes) ? planIndexes : [])
        .map(Number)
        .filter((index) => Number.isInteger(index) && plan[index] && plan[index].status !== "written")
        .slice(0, MAX_GENERATED_LESSONS);
    if (requested.length === 0) throw generationError("No unwritten parts were selected.", 400, "NOTHING_TO_GENERATE");
    return queueLessons(course, requested);
};

// Replaces the whole course (hard cutover): its lessons, quizzes and progress
// are deleted and the course is planned and written again from the upload.
export const regenerateCourseForUser = async (userId, courseId) => {
    const course = await requireCourse(userId, courseId);
    const client = await getPool().connect();
    try {
        await client.query("BEGIN");
        await client.query(
            `UPDATE generation_jobs
             SET status = 'failed', error = 'Replaced by a course regenerate.', locked_until = NULL,
                 finished_at = NOW(), updated_at = NOW()
             WHERE course_id = $1 AND status IN ('queued', 'running')`,
            [course.id],
        );
        await client.query(`DELETE FROM topics WHERE course_id = $1`, [course.id]);
        await client.query(
            `UPDATE courses SET status = 'generating', lesson_plan = '[]'::jsonb, updated_at = NOW() WHERE id = $1`,
            [course.id],
        );
        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
    } finally {
        client.release();
    }
    const job = await enqueueGenerationJob({
        courseId: course.id,
        userId,
        uploadId: course.upload_id,
        kind: "course",
    });
    if (job) kickGenerationWorker({ jobId: job.id });
    return getCourseForUser(userId, course.id);
};

export const listCoursesForUser = async (userId) => {
    const db = getPool();
    const result = await db.query(
        `SELECT
            c.*,
            ${ACTIVE_JOB_SQL},
            COALESCE(t.topic_count, 0) AS topic_count,
            COALESCE(q.quiz_topic_count, 0) AS quizzes_ready,
            first_topic.first_topic_id,
            first_quiz.first_quiz_topic_id,
            COALESCE(quiz_topics.quiz_topics, '[]'::json) AS quiz_topics
         FROM courses c
         LEFT JOIN (
            SELECT course_id, COUNT(*)::int AS topic_count
            FROM topics
            GROUP BY course_id
         ) t ON t.course_id = c.id
         LEFT JOIN (
            SELECT course_id, COUNT(DISTINCT topic_id)::int AS quiz_topic_count
            FROM questions
            WHERE ${MCQ_TYPE_SQL}
            GROUP BY course_id
         ) q ON q.course_id = c.id
         LEFT JOIN LATERAL (
            SELECT id AS first_topic_id
            FROM topics
            WHERE course_id = c.id
            ORDER BY sort_order ASC, created_at ASC
            LIMIT 1
         ) first_topic ON TRUE
         LEFT JOIN LATERAL (
            SELECT t2.id AS first_quiz_topic_id
            FROM topics t2
            INNER JOIN questions qq ON qq.topic_id = t2.id AND ${quizQuestionSql("qq")}
            WHERE t2.course_id = c.id
            ORDER BY t2.sort_order ASC, t2.created_at ASC
            LIMIT 1
         ) first_quiz ON TRUE
         LEFT JOIN LATERAL (
            SELECT json_agg(
                json_build_object(
                    'topicId', t3.id,
                    'title', t3.title,
                    'questionCount', qq3.question_count
                )
                ORDER BY t3.sort_order ASC, t3.created_at ASC
            ) AS quiz_topics
            FROM topics t3
            INNER JOIN (
                SELECT topic_id, COUNT(*)::int AS question_count
                FROM questions
                WHERE ${MCQ_TYPE_SQL}
                GROUP BY topic_id
            ) qq3 ON qq3.topic_id = t3.id
            WHERE t3.course_id = c.id
              AND qq3.question_count > 0
         ) quiz_topics ON TRUE
         WHERE c.user_id = $1
           AND (c.status = 'ready' OR COALESCE(t.topic_count, 0) > 0)
         ORDER BY c.created_at DESC`,
        [userId],
    );
    return result.rows.map((row) => toClientCourse(row));
};

export const getCourseForUser = async (userId, courseId) => {
    const db = getPool();
    const courseResult = await db.query(
        `SELECT c.*, ${ACTIVE_JOB_SQL} FROM courses c WHERE c.id = $1 AND c.user_id = $2 LIMIT 1`,
        [courseId, userId],
    );
    const course = courseResult.rows[0];
    if (!course) return null;
    if (course.active_job) await resumeStalledGeneration(course.id);

    const topicsResult = await db.query(
        `SELECT
            t.*,
            COALESCE(q.question_count, 0) AS question_count
         FROM topics t
         LEFT JOIN (
            SELECT topic_id, COUNT(*)::int AS question_count
            FROM questions
            WHERE ${MCQ_TYPE_SQL}
            GROUP BY topic_id
         ) q ON q.topic_id = t.id
         WHERE t.course_id = $1 AND t.user_id = $2
         ORDER BY t.sort_order ASC, t.created_at ASC`,
        [courseId, userId],
    );

    const topics = topicsResult.rows.map((row) => toClientTopic(row));
    const quizTopics = topics
        .filter((topic) => topic.questionCount > 0)
        .map((topic) => ({
            topicId: topic.id,
            title: topic.title,
            questionCount: topic.questionCount,
        }));

    return {
        ...toClientCourse(course, {
            topicCount: topics.length,
            quizzesReady: quizTopics.length,
            firstTopicId: topics[0]?.id || null,
            firstQuizTopicId: quizTopics[0]?.topicId || null,
            quizTopics,
        }),
        topics,
    };
};

export const getTopicForUser = async (userId, topicId) => {
    const db = getPool();
    const topicResult = await db.query(
        `SELECT
            t.*,
            COALESCE(q.question_count, 0) AS question_count
         FROM topics t
         LEFT JOIN (
            SELECT topic_id, COUNT(*)::int AS question_count
            FROM questions
            WHERE ${MCQ_TYPE_SQL}
            GROUP BY topic_id
         ) q ON q.topic_id = t.id
         WHERE t.id = $1 AND t.user_id = $2
         LIMIT 1`,
        [topicId, userId],
    );
    const topic = topicResult.rows[0];
    if (!topic) return null;

    const courseResult = await db.query(
        `SELECT c.*, ${ACTIVE_JOB_SQL} FROM courses c WHERE c.id = $1 AND c.user_id = $2 LIMIT 1`,
        [topic.course_id, userId],
    );
    if (courseResult.rows[0]?.active_job) await resumeStalledGeneration(topic.course_id);

    const inLessonResult = await db.query(
        `SELECT id, prompt, options, question_type, payload, sort_order
         FROM questions
         WHERE topic_id = $1 AND user_id = $2 AND COALESCE(surface, 'quiz') = 'in_lesson'
         ORDER BY sort_order ASC, created_at ASC`,
        [topicId, userId],
    );
    const inLessonChecks = inLessonResult.rows.map(toPlayableInLessonCheck).filter(Boolean);

    return {
        topic: toClientTopic(topic, {
            inLessonChecks,
        }),
        course: toClientCourse(courseResult.rows[0] || null),
    };
};

export const getQuizForTopic = async (userId, topicId) => {
    const payload = await getTopicForUser(userId, topicId);
    if (!payload?.topic) return null;

    const db = getPool();
    const questionsResult = await db.query(
        `SELECT * FROM questions
         WHERE topic_id = $1 AND user_id = $2 AND ${MCQ_TYPE_SQL}
         ORDER BY sort_order ASC, created_at ASC`,
        [topicId, userId],
    );

    return {
        ...payload,
        questions: questionsResult.rows.map(toPlayableQuestion),
    };
};

const getQuizForTopicWithAnswers = async (userId, topicId) => {
    const payload = await getTopicForUser(userId, topicId);
    if (!payload?.topic) return null;

    const db = getPool();
    const questionsResult = await db.query(
        `SELECT * FROM questions
         WHERE topic_id = $1 AND user_id = $2 AND ${MCQ_TYPE_SQL}
         ORDER BY sort_order ASC, created_at ASC`,
        [topicId, userId],
    );

    return {
        ...payload,
        questions: questionsResult.rows.map(toClientQuestion),
    };
};

// Client-chosen attempt ids make quiz submission safe to retry.
const ATTEMPT_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

export const submitQuizAttempt = async ({ userId, topicId, answers, attemptId: requestedAttemptId }) => {
    const quiz = await getQuizForTopicWithAnswers(userId, topicId);
    if (!quiz?.topic) {
        const error = new Error("Topic not found");
        error.status = 404;
        throw error;
    }
    if (!quiz.questions.length) {
        const error = new Error("No quiz questions available for this topic");
        error.status = 400;
        throw error;
    }

    const answerMap = new Map(
        (Array.isArray(answers) ? answers : []).map((item) => [
            String(item.questionId || ""),
            Number(item.selectedIndex),
        ]),
    );

    let score = 0;
    const graded = quiz.questions.map((question) => {
        const options = Array.isArray(question.options) ? question.options : [];
        const selectedIndex = answerMap.has(question.id)
            ? answerMap.get(question.id)
            : -1;
        const skipped = !Number.isFinite(selectedIndex) || selectedIndex < 0;
        const isCorrect = !skipped && selectedIndex === question.correctIndex;
        if (isCorrect) score += 1;
        const optionLabel = (index) => {
            if (!Number.isFinite(index) || index < 0 || index >= options.length) {
                return null;
            }
            return String.fromCharCode(65 + index);
        };
        return {
            questionId: question.id,
            questionText: question.prompt,
            questionType: "mcq",
            options,
            selectedIndex,
            selectedAnswer: skipped
                ? null
                : optionLabel(selectedIndex) || options[selectedIndex] || null,
            correctIndex: question.correctIndex,
            correctAnswer:
                optionLabel(question.correctIndex) ||
                options[question.correctIndex] ||
                null,
            isCorrect,
            skipped,
            explanation: question.explanation || "",
            difficulty: "Medium",
        };
    });

    const attemptId = ATTEMPT_ID_PATTERN.test(String(requestedAttemptId || ""))
        ? String(requestedAttemptId)
        : nanoid();
    const total = quiz.questions.length;
    const percent = Math.round((score / total) * 100);
    const db = getPool();
    const inserted = await db.query(
        `INSERT INTO quiz_attempts (
            id, topic_id, course_id, user_id, answers, score, total
         ) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7)
         ON CONFLICT (id) DO NOTHING`,
        [
            attemptId,
            topicId,
            quiz.topic.courseId,
            userId,
            JSON.stringify(graded),
            score,
            total,
        ],
    );
    if (inserted.rowCount === 0) {
        // A retry of a submission that already landed: return what was saved
        // instead of grading (and scheduling reviews) twice.
        const existing = await getQuizAttemptForUser(userId, attemptId);
        if (!existing) {
            const error = new Error("Quiz attempt id already used");
            error.status = 409;
            throw error;
        }
        return { ...existing, results: existing.answers, topic: quiz.topic, course: quiz.course };
    }

    // Scheduling reviews must never fail the quiz the student just finished.
    await recordReviewOutcomes(
        userId,
        graded
            .filter((item) => !item.skipped)
            .map((item) => ({ questionId: item.questionId, isCorrect: item.isCorrect })),
    ).catch((error) => console.error("[reviews] quiz outcomes", error));

    return {
        id: attemptId,
        attemptId,
        score,
        total,
        percent,
        percentage: percent,
        results: graded,
        answers: graded,
        topic: quiz.topic,
        course: quiz.course,
        topicId: quiz.topic.id,
        topicTitle: quiz.topic.title,
        courseId: quiz.topic.courseId,
        examFormat: "objective",
        totalQuestions: total,
        tutorFeedback: null,
    };
};

export const getQuizAttemptForUser = async (userId, attemptId) => {
    const db = getPool();
    const result = await db.query(
        `SELECT
            qa.*,
            t.title AS topic_title,
            c.title AS course_title
         FROM quiz_attempts qa
         LEFT JOIN topics t ON t.id = qa.topic_id
         LEFT JOIN courses c ON c.id = qa.course_id
         WHERE qa.id = $1 AND qa.user_id = $2
         LIMIT 1`,
        [attemptId, userId],
    );
    const row = result.rows[0];
    if (!row) return null;

    const answers = Array.isArray(row.answers) ? row.answers : row.answers || [];
    const totalQuestions = Number(row.total || answers.length || 0);
    const score = Number(row.score || 0);
    const percentage =
        totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;

    return {
        id: row.id,
        _id: row.id,
        attemptId: row.id,
        topicId: row.topic_id,
        courseId: row.course_id,
        topicTitle: row.topic_title || "Topic quiz",
        courseTitle: row.course_title || "",
        score,
        total: totalQuestions,
        totalQuestions,
        percentage,
        percent: percentage,
        answers,
        examFormat: "objective",
        tutorFeedback: null,
        createdAt: row.created_at ? new Date(row.created_at).getTime() : null,
    };
};

const publicShareUrl = (token) => (token ? `/c/${encodeURIComponent(token)}` : null);

export const enableCourseShare = async (userId, courseId) => {
    const course = await getCourseForUser(userId, courseId);
    if (!course) return null;
    if (course.shareToken) {
        return {
            ...course,
            shareUrl: publicShareUrl(course.shareToken),
        };
    }
    const db = getPool();
    const shareToken = nanoid(16);
    await db.query(
        `UPDATE courses
         SET share_token = $3, updated_at = NOW()
         WHERE id = $1 AND user_id = $2`,
        [courseId, userId, shareToken],
    );
    const updated = await getCourseForUser(userId, courseId);
    return updated
        ? { ...updated, shareUrl: publicShareUrl(updated.shareToken) }
        : null;
};

export const disableCourseShare = async (userId, courseId) => {
    const course = await getCourseForUser(userId, courseId);
    if (!course) return null;
    const db = getPool();
    await db.query(
        `UPDATE courses
         SET share_token = NULL, updated_at = NOW()
         WHERE id = $1 AND user_id = $2`,
        [courseId, userId],
    );
    const updated = await getCourseForUser(userId, courseId);
    return updated ? { ...updated, shareUrl: null } : null;
};

export const getPublicCourseByShareToken = async (token) => {
    const shareToken = String(token || "").trim();
    if (!shareToken) return null;
    const db = getPool();
    const courseResult = await db.query(
        `SELECT id, title, description, status
         FROM courses
         WHERE share_token = $1
         LIMIT 1`,
        [shareToken],
    );
    const course = courseResult.rows[0];
    if (!course) return null;

    const topicsResult = await db.query(
        `SELECT id, title, description, lesson, sort_order
         FROM topics
         WHERE course_id = $1
         ORDER BY sort_order ASC, created_at ASC`,
        [course.id],
    );
    const checksResult = await db.query(
        `SELECT id, topic_id, prompt, options, question_type, payload, sort_order
         FROM questions
         WHERE course_id = $1 AND COALESCE(surface, 'quiz') = 'in_lesson'
         ORDER BY sort_order ASC, created_at ASC`,
        [course.id],
    );
    const checksByTopic = new Map();
    for (const row of checksResult.rows) {
        const list = checksByTopic.get(row.topic_id) || [];
        list.push(toPlayableInLessonCheck(row));
        checksByTopic.set(row.topic_id, list);
    }

    return {
        title: course.title,
        description: course.description || "",
        topics: topicsResult.rows.map((row) => ({
            id: row.id,
            title: row.title,
            description: row.description || "",
            lesson: parsePayload(row.lesson),
            sortOrder: Number(row.sort_order || 0),
            inLessonChecks: (checksByTopic.get(row.id) || []).filter(Boolean),
        })),
    };
};

const gradeInLessonRow = (row, { selectedIndex, orderedSteps } = {}) => {
    const questionType = row.question_type || "multiple_choice";
    const payload = parsePayload(row.payload);
    const options = Array.isArray(row.options) ? row.options : [];
    if (questionType === "ordering") {
        const canonical = (Array.isArray(payload.stepsInOrder) ? payload.stepsInOrder : options)
            .map((step) => String(step || "").trim())
            .filter(Boolean);
        const submitted = (Array.isArray(orderedSteps) ? orderedSteps : [])
            .map((step) => String(step || "").trim())
            .filter(Boolean);
        const correct =
            canonical.length === submitted.length
            && canonical.length >= 3
            && canonical.every((step, index) => step === submitted[index]);
        return {
            correct,
            explanation: row.explanation || "",
            hint: row.hint || "",
            correctIndex: 0,
            stepsInOrder: canonical,
            questionType,
        };
    }
    const selected = Number(selectedIndex);
    const correctIndex = Number(row.correct_index || 0);
    return {
        correct: Number.isFinite(selected) && selected === correctIndex,
        explanation: row.explanation || "",
        hint: row.hint || "",
        correctIndex,
        questionType,
    };
};

export const submitLessonCheck = async ({
    userId,
    topicId,
    questionId,
    selectedIndex,
    orderedSteps,
}) => {
    const payload = await getTopicForUser(userId, topicId);
    if (!payload?.topic) {
        const error = new Error("Topic not found");
        error.status = 404;
        throw error;
    }
    const db = getPool();
    const result = await db.query(
        `SELECT *
         FROM questions
         WHERE id = $1 AND topic_id = $2 AND user_id = $3 AND COALESCE(surface, 'quiz') = 'in_lesson'
         LIMIT 1`,
        [questionId, topicId, userId],
    );
    const row = result.rows[0];
    if (!row) {
        const error = new Error("Lesson check not found");
        error.status = 404;
        throw error;
    }
    const graded = gradeInLessonRow(row, { selectedIndex, orderedSteps });
    try {
        const { getTopicProgressForUser, upsertTopicProgressForUser } = await import("./topicNotes.js");
        const existing = await getTopicProgressForUser(userId, topicId);
        const nextChecks = {
            ...(existing?.lessonChecks || {}),
            [questionId]: {
                selectedIndex: Number.isFinite(Number(selectedIndex)) ? Number(selectedIndex) : null,
                orderedSteps: Array.isArray(orderedSteps) ? orderedSteps : null,
                correct: graded.correct,
                at: Date.now(),
            },
        };
        await upsertTopicProgressForUser(userId, topicId, {
            lastStudiedAt: Date.now(),
            lastActivityKind: "lesson",
            lessonChecks: nextChecks,
        });
    } catch (error) {
        console.warn("[courses] lesson check progress failed", {
            message: error?.message || String(error),
        });
    }
    return { questionId, ...graded };
};

export const submitPublicLessonCheck = async ({
    token,
    questionId,
    selectedIndex,
    orderedSteps,
}) => {
    const shareToken = String(token || "").trim();
    if (!shareToken || !questionId) {
        const error = new Error("Shared course not found");
        error.status = 404;
        throw error;
    }
    const db = getPool();
    const result = await db.query(
        `SELECT q.*
         FROM questions q
         INNER JOIN courses c ON c.id = q.course_id
         WHERE q.id = $1
           AND c.share_token = $2
           AND COALESCE(q.surface, 'quiz') = 'in_lesson'
         LIMIT 1`,
        [questionId, shareToken],
    );
    const row = result.rows[0];
    if (!row) {
        const error = new Error("Lesson check not found");
        error.status = 404;
        throw error;
    }
    return { questionId, ...gradeInLessonRow(row, { selectedIndex, orderedSteps }) };
};

