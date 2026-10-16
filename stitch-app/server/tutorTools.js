import { getPool } from "./db.js";

const clip = (value, max = 4000) => {
    const text = String(value || "").trim();
    if (text.length <= max) return text;
    return `${text.slice(0, max).trim()}…`;
};

const normalizeTitle = (value) =>
    String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();

const tokenize = (value) =>
    String(value || "")
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length > 2);

// ---------------------------------------------------------------------------
// Lesson → sections
// ---------------------------------------------------------------------------

// The tools read a topic's structured lesson (topics.lesson) section by section.
export const lessonSectionsOf = (topic) =>
    (Array.isArray(topic?.lesson?.sections) ? topic.lesson.sections : []).map((section, index) => ({
        index,
        title: section.title,
        role: section.role,
        content: section.body,
    }));

// ---------------------------------------------------------------------------
// Tool: search lesson sections by keyword
// ---------------------------------------------------------------------------

export const searchLessonSections = (lesson, query, limit = 4) => {
    const sections = lessonSectionsOf(lesson);
    const terms = tokenize(query);
    if (terms.length === 0) {
        return sections.slice(0, Math.max(1, limit)).map((section) => ({
            ...section,
            content: clip(section.content, 1200),
            score: 0,
        }));
    }

    const ranked = sections
        .map((section) => {
            const haystack = `${section.title}\n${section.content}`.toLowerCase();
            let score = 0;
            for (const term of terms) {
                if (haystack.includes(term)) score += 1;
                if (normalizeTitle(section.title).includes(term)) score += 2;
            }
            return { ...section, score };
        })
        .filter((section) => section.score > 0)
        .sort((a, b) => b.score - a.score || a.index - b.index)
        .slice(0, Math.max(1, Math.min(8, limit)));

    return ranked.map((section) => ({
        ...section,
        content: clip(section.content, 1200),
    }));
};

// ---------------------------------------------------------------------------
// Tool: find a specific section by title or index
// ---------------------------------------------------------------------------

export const findLessonSection = (lesson, input) => {
    const sections = lessonSectionsOf(lesson);
    if (typeof input.index === "number" && Number.isFinite(input.index)) {
        const exact = sections.find((section) => section.index === input.index);
        if (exact) return { ...exact, content: clip(exact.content) };
    }

    const wanted = normalizeTitle(input.title || "");
    if (wanted) {
        const exact = sections.find(
            (section) => normalizeTitle(section.title) === wanted,
        );
        if (exact) return { ...exact, content: clip(exact.content) };
        const partial = sections.find((section) =>
            normalizeTitle(section.title).includes(wanted),
        );
        if (partial) return { ...partial, content: clip(partial.content) };
    }

    return null;
};

// ---------------------------------------------------------------------------
// Tool: lesson outline with section previews
// ---------------------------------------------------------------------------

export const toOutline = (lesson) => {
    const sections = lessonSectionsOf(lesson);
    return {
        topicId: lesson.id,
        title: lesson.title,
        description: clip(lesson.description, 600),
        sections: sections.map((section) => ({
            index: section.index,
            title: section.title,
            preview: clip(section.content, 240),
        })),
    };
};

// ---------------------------------------------------------------------------
// Tool: list sibling lessons in the same course
// ---------------------------------------------------------------------------

export const listCourseLessonsForUser = async (userId, courseId) => {
    const db = getPool();
    const result = await db.query(
        `SELECT id, title, description, sort_order
         FROM topics
         WHERE course_id = $1 AND user_id = $2
         ORDER BY sort_order ASC, created_at ASC`,
        [courseId, userId],
    );
    return result.rows.map((row) => ({
        id: String(row.id),
        title: String(row.title || ""),
        description: String(row.description || ""),
        sortOrder: Number(row.sort_order || 0),
    }));
};
