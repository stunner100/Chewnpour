import { nanoid } from "nanoid";
import { segmentSource } from "./sourceSegments.js";
import { indexTopicPassages } from "./topicPassages.js";

// Writes generated lessons: the topic row, its quiz, exam and in-lesson
// questions, and its source passages.

// The text a planned lesson is written from: the segments of the upload
// inside the entry's span, so contents lists, page numbers and running
// headers that segmentation dropped stay out. Pass segments when computing
// several entries of one upload.
export const planEntrySource = (entry, extractedText, segments = null) => {
    if (!entry || !Number.isInteger(entry.start) || !Number.isInteger(entry.end)) return "";
    const parts = segments || segmentSource(String(extractedText || "").trim()).segments;
    return parts
        .filter((segment) => segment.start >= entry.start && segment.end <= entry.end)
        .map((segment) => segment.text)
        .join("\n\n");
};

const insertQuestions = async (client, { topicId, courseId, userId, spec }) => {
    const questionSpecs = [
        ...(Array.isArray(spec.questions) ? spec.questions : []).map((question) => ({
            ...question,
            surface: question.surface || "quiz",
        })),
        ...(Array.isArray(spec.inLessonChecks) ? spec.inLessonChecks : []).map((question) => ({
            ...question,
            surface: "in_lesson",
        })),
    ];
    for (const question of questionSpecs) {
        if (!question?.prompt) continue;
        const ordering = question.questionType === "ordering";
        await client.query(
            `INSERT INTO questions (
                id, topic_id, course_id, user_id, prompt, options, correct_index, explanation, sort_order,
                question_type, payload, hint, surface
             ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11::jsonb,$12,$13)`,
            [
                nanoid(),
                topicId,
                courseId,
                userId,
                question.prompt,
                JSON.stringify(ordering ? question.stepsInOrder || question.options || [] : question.options || []),
                ordering ? 0 : question.correctIndex,
                question.explanation || null,
                question.sortOrder ?? 0,
                question.questionType || "multiple_choice",
                JSON.stringify({
                    ...(question.payload && typeof question.payload === "object" ? question.payload : {}),
                    ...(Number.isInteger(question.sectionIndex) ? { sectionIndex: question.sectionIndex } : {}),
                    ...(ordering ? { stepsInOrder: question.stepsInOrder || question.options || [] } : {}),
                }),
                question.hint || null,
                question.surface || "quiz",
            ],
        );
    }
};

// Saves a generated lesson in document order (sort_order is its plan index).
// With topicId, the existing topic is rewritten in place (Regenerate): it
// keeps its id, so progress, notes and attempts stay attached, and its
// questions are replaced. Returns the topic id.
export const saveTopic = async (client, { topicId = null, courseId, userId, uploadId, spec, sortOrder }) => {
    const title = String(spec.title || `Lesson ${sortOrder + 1}`).slice(0, 180);
    const description = String(spec.description || "").slice(0, 280) || null;
    let id = topicId;
    if (id) {
        await client.query(
            `UPDATE topics
             SET title = $2, description = $3, lesson = $4::jsonb, grounding = $5::jsonb,
                 sort_order = $6, updated_at = NOW()
             WHERE id = $1`,
            [id, title, description, JSON.stringify(spec.lesson), JSON.stringify(spec.grounding || {}), sortOrder],
        );
        await client.query(`DELETE FROM questions WHERE topic_id = $1`, [id]);
    } else {
        id = nanoid();
        await client.query(
            `INSERT INTO topics (
                id, course_id, user_id, upload_id, title, description, lesson, sort_order, grounding
             ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9::jsonb)`,
            [id, courseId, userId, uploadId, title, description, JSON.stringify(spec.lesson), sortOrder,
                JSON.stringify(spec.grounding || {})],
        );
    }
    await insertQuestions(client, { topicId: id, courseId, userId, spec });
    return id;
};

// "View source" and tutor retrieval read the lesson's own part of the
// upload, never the generated lesson. Best-effort.
export const indexTopicSource = async ({ topicId, courseId, uploadId, userId, content }) => {
    if (!content) return;
    try {
        await indexTopicPassages({ topicId, courseId, uploadId, userId, content });
    } catch (error) {
        console.warn("[topicWrites] topic passage indexing failed", {
            topicId,
            message: error?.message || String(error),
        });
    }
};
