import { nanoid } from "nanoid";
import { getPool } from "./db.js";
import { generateCourseCurriculumWithAi } from "./aiCourseGeneration.js";
import { stripCourseTitle } from "./courseGeneration.js";

const toClientCourse = (row, extras = {}) => {
    if (!row) return null;
    return {
        id: row.id,
        userId: row.user_id,
        uploadId: row.upload_id || null,
        title: row.title,
        description: row.description || "",
        status: row.status,
        generationBackend: row.generation_backend || extras.generationBackend || null,
        topicCount: Number(extras.topicCount ?? row.topic_count ?? 0),
        quizzesReady: Number(extras.quizzesReady ?? row.quizzes_ready ?? 0),
        firstTopicId: extras.firstTopicId ?? row.first_topic_id ?? null,
        firstQuizTopicId: extras.firstQuizTopicId ?? row.first_quiz_topic_id ?? null,
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
        content: row.content || "",
        sortOrder: Number(row.sort_order || 0),
        questionCount: Number(extras.questionCount ?? row.question_count ?? 0),
        assessmentRoute: "topic_quiz",
        createdAt: row.created_at ? new Date(row.created_at).getTime() : null,
        updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : null,
    };
};

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

export const ensureCourseFromUpload = async ({
    userId,
    uploadId,
    fileName,
    extractedText,
}) => {
    const existing = await getCourseByUploadId(userId, uploadId);
    if (existing) {
        return getCourseForUser(userId, existing.id);
    }

    const text = String(extractedText || "").trim();
    if (!text) {
        const error = new Error(
            "Cannot generate a course without extracted text.",
        );
        error.status = 400;
        error.code = "EXTRACTION_INCOMPLETE";
        throw error;
    }

    const title = stripCourseTitle(fileName) || "Study material";
    const curriculum = await generateCourseCurriculumWithAi({
        fileName,
        extractedText: text,
    });
    const topicSpecs = Array.isArray(curriculum.topics) ? curriculum.topics : [];
    const courseId = nanoid();
    const db = getPool();
    const description = String(curriculum.backend || "").includes("heuristic")
        ? "Generated from your upload"
        : "AI-generated from your upload";

    try {
        await db.query(
            `INSERT INTO courses (
                id, user_id, upload_id, title, description, status, generation_backend
             ) VALUES ($1, $2, $3, $4, $5, 'ready', $6)`,
            [
                courseId,
                userId,
                uploadId,
                title.slice(0, 180),
                description,
                curriculum.backend || "heuristic",
            ],
        );
    } catch (error) {
        // Unique upload_id race: another finalize already created the course.
        if (error?.code === "23505") {
            const raced = await getCourseByUploadId(userId, uploadId);
            if (raced) return getCourseForUser(userId, raced.id);
        }
        throw error;
    }

    for (let index = 0; index < topicSpecs.length; index += 1) {
        const spec = topicSpecs[index];
        const topicId = nanoid();
        await db.query(
            `INSERT INTO topics (
                id, course_id, user_id, upload_id, title, description, content, sort_order
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [
                topicId,
                courseId,
                userId,
                uploadId,
                String(spec.title || `Topic ${index + 1}`).slice(0, 180),
                String(spec.description || "").slice(0, 280) || null,
                String(spec.content || ""),
                index,
            ],
        );

        const questionSpecs = Array.isArray(spec.questions) ? spec.questions : [];
        for (const question of questionSpecs) {
            await db.query(
                `INSERT INTO questions (
                    id, topic_id, course_id, user_id, prompt, options, correct_index, explanation, sort_order
                 ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9)`,
                [
                    nanoid(),
                    topicId,
                    courseId,
                    userId,
                    question.prompt,
                    JSON.stringify(question.options),
                    question.correctIndex,
                    question.explanation || null,
                    question.sortOrder ?? 0,
                ],
            );
        }
    }

    return getCourseForUser(userId, courseId);
};

export const listCoursesForUser = async (userId) => {
    const db = getPool();
    const result = await db.query(
        `SELECT
            c.*,
            COALESCE(t.topic_count, 0) AS topic_count,
            COALESCE(q.quiz_topic_count, 0) AS quizzes_ready,
            first_topic.first_topic_id,
            first_quiz.first_quiz_topic_id
         FROM courses c
         LEFT JOIN (
            SELECT course_id, COUNT(*)::int AS topic_count
            FROM topics
            GROUP BY course_id
         ) t ON t.course_id = c.id
         LEFT JOIN (
            SELECT course_id, COUNT(DISTINCT topic_id)::int AS quiz_topic_count
            FROM questions
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
            INNER JOIN questions qq ON qq.topic_id = t2.id
            WHERE t2.course_id = c.id
            ORDER BY t2.sort_order ASC, t2.created_at ASC
            LIMIT 1
         ) first_quiz ON TRUE
         WHERE c.user_id = $1
         ORDER BY c.created_at DESC`,
        [userId],
    );
    return result.rows.map((row) => toClientCourse(row));
};

export const getCourseForUser = async (userId, courseId) => {
    const db = getPool();
    const courseResult = await db.query(
        `SELECT * FROM courses WHERE id = $1 AND user_id = $2 LIMIT 1`,
        [courseId, userId],
    );
    const course = courseResult.rows[0];
    if (!course) return null;

    const topicsResult = await db.query(
        `SELECT
            t.*,
            COALESCE(q.question_count, 0) AS question_count
         FROM topics t
         LEFT JOIN (
            SELECT topic_id, COUNT(*)::int AS question_count
            FROM questions
            GROUP BY topic_id
         ) q ON q.topic_id = t.id
         WHERE t.course_id = $1 AND t.user_id = $2
         ORDER BY t.sort_order ASC, t.created_at ASC`,
        [courseId, userId],
    );

    const topics = topicsResult.rows.map((row) => toClientTopic(row));
    const quizTopics = topics.filter((topic) => topic.questionCount > 0);

    return {
        ...toClientCourse(course, {
            topicCount: topics.length,
            quizzesReady: quizTopics.length,
            firstTopicId: topics[0]?.id || null,
            firstQuizTopicId: quizTopics[0]?.id || null,
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
            GROUP BY topic_id
         ) q ON q.topic_id = t.id
         WHERE t.id = $1 AND t.user_id = $2
         LIMIT 1`,
        [topicId, userId],
    );
    const topic = topicResult.rows[0];
    if (!topic) return null;

    const courseResult = await db.query(
        `SELECT * FROM courses WHERE id = $1 AND user_id = $2 LIMIT 1`,
        [topic.course_id, userId],
    );

    return {
        topic: toClientTopic(topic),
        course: toClientCourse(courseResult.rows[0] || null),
    };
};

export const getQuizForTopic = async (userId, topicId) => {
    const payload = await getTopicForUser(userId, topicId);
    if (!payload?.topic) return null;

    const db = getPool();
    const questionsResult = await db.query(
        `SELECT * FROM questions
         WHERE topic_id = $1 AND user_id = $2
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
         WHERE topic_id = $1 AND user_id = $2
         ORDER BY sort_order ASC, created_at ASC`,
        [topicId, userId],
    );

    return {
        ...payload,
        questions: questionsResult.rows.map(toClientQuestion),
    };
};

export const submitQuizAttempt = async ({ userId, topicId, answers }) => {
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

    const attemptId = nanoid();
    const total = quiz.questions.length;
    const percent = Math.round((score / total) * 100);
    const db = getPool();
    await db.query(
        `INSERT INTO quiz_attempts (
            id, topic_id, course_id, user_id, answers, score, total
         ) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7)`,
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
