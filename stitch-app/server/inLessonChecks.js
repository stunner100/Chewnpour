import { isValidMcq, isNearDuplicatePrompt } from "./questionDedup.js";
import { sanitizeGeneratedHint } from "./hintSanitize.js";
import { normalizeOrderingQuestion, snippetHasProcess } from "./processOrdering.js";
import { isTextGroundedInSource } from "./grounding.js";
import { lessonToMarkdown } from "../src/lib/lessonSchema.js";

const MAX_IN_LESSON_CHECKS = 4;

const normalizeWhitespace = (value = "") =>
    String(value || "").replace(/\s+/g, " ").trim();

const trueFalseOptions = (options) => {
    const list = Array.isArray(options) ? options.map((item) => normalizeWhitespace(item)) : [];
    if (list.length === 2) return list;
    return ["True", "False"];
};

const normalizeTrueFalse = (raw, { sectionIndex }) => {
    const prompt = normalizeWhitespace(raw?.prompt || raw?.question).slice(0, 400);
    if (!prompt || prompt.length < 12) return null;
    const options = trueFalseOptions(raw?.options);
    let correctIndex = Number(raw?.correctIndex);
    if (raw?.answer === true || String(raw?.answer).toLowerCase() === "true") correctIndex = 0;
    if (raw?.answer === false || String(raw?.answer).toLowerCase() === "false") {
        correctIndex = options.findIndex((option) => /^false$/i.test(option));
        if (correctIndex < 0) correctIndex = 1;
    }
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
        return null;
    }
    const candidate = {
        prompt,
        options,
        correctIndex,
        explanation: normalizeWhitespace(raw?.explanation).slice(0, 500),
        hint: String(raw?.hint || "").trim().slice(0, 280),
        questionType: "true_false",
        surface: "in_lesson",
        sectionIndex,
        payload: { sectionIndex },
        sortOrder: 0,
    };
    candidate.hint = sanitizeGeneratedHint({
        hint: candidate.hint,
        questionType: "true_false",
        answer: options[correctIndex],
        options,
        correctIndex,
    });
    return candidate;
};

const normalizeInLessonMcq = (raw, { sectionIndex, title = "", sourceText = "" }) => {
    const prompt = normalizeWhitespace(raw?.prompt || raw?.question).slice(0, 400);
    const options = (Array.isArray(raw?.options) ? raw.options : [])
        .map((item) => normalizeWhitespace(item))
        .filter(Boolean)
        .slice(0, 4);
    const candidate = {
        prompt,
        options,
        correctIndex: Number(raw?.correctIndex),
        explanation: normalizeWhitespace(raw?.explanation).slice(0, 500),
        hint: String(raw?.hint || "").trim().slice(0, 280),
        questionType: "multiple_choice",
        surface: "in_lesson",
        sectionIndex,
        payload: { sectionIndex },
        sortOrder: 0,
    };
    if (!isValidMcq(candidate, { title })) return null;
    if (!isTextGroundedInSource(candidate.options[candidate.correctIndex], sourceText)) {
        return null;
    }
    candidate.hint = sanitizeGeneratedHint({
        hint: candidate.hint,
        questionType: "multiple_choice",
        options: candidate.options,
        correctIndex: candidate.correctIndex,
        answer: candidate.options[candidate.correctIndex],
    });
    return candidate;
};

// Checks bind to a lesson section by its index in lesson.sections. A check
// whose index does not name a section is dropped, never moved elsewhere. An
// ordering check without an index binds to the first steps section, or the
// first section that describes a process.
export const normalizeInLessonChecks = (
    rawChecks,
    { lesson = null, title = "", quizPrompts = [], ordering = null } = {},
) => {
    const sections = Array.isArray(lesson?.sections) ? lesson.sections : [];
    const lessonText = lessonToMarkdown(lesson);
    const incoming = Array.isArray(rawChecks) ? rawChecks : [];
    const kept = [];
    const seenSections = new Set();
    let hasOrdering = false;

    const validIndex = (value) => {
        const index = Number(value);
        return Number.isInteger(index) && index >= 0 && index < sections.length ? index : null;
    };

    const consider = (raw) => {
        if (kept.length >= MAX_IN_LESSON_CHECKS) return;
        const type = String(raw?.questionType || raw?.type || "multiple_choice").trim();
        let sectionIndex = validIndex(raw?.sectionIndex);
        if (sectionIndex === null && type === "ordering") {
            const fallback = sections.findIndex((section, index) => !seenSections.has(index)
                && (section.role === "steps" || snippetHasProcess(section.body)));
            sectionIndex = fallback >= 0 ? fallback : null;
        }
        if (sectionIndex === null || seenSections.has(sectionIndex)) return;
        const section = sections[sectionIndex];

        let normalized = null;
        if (type === "ordering") {
            if (hasOrdering) return;
            if (!snippetHasProcess(section.body) && !raw?.stepsInOrder) return;
            normalized = normalizeOrderingQuestion(raw, { sourceText: section.body });
            if (!normalized) return;
            normalized = {
                ...normalized,
                surface: "in_lesson",
                sectionIndex,
                payload: { ...(normalized.payload || {}), sectionIndex },
                hint: sanitizeGeneratedHint({
                    hint: normalized.hint,
                    questionType: "ordering",
                    stepsInOrder: normalized.stepsInOrder,
                }),
            };
            hasOrdering = true;
        } else if (type === "true_false") {
            normalized = normalizeTrueFalse(raw, { sectionIndex });
        } else {
            normalized = normalizeInLessonMcq(raw, { sectionIndex, title, sourceText: lessonText });
        }
        if (!normalized) return;
        const duplicate = kept.some((existing) => isNearDuplicatePrompt(existing.prompt, normalized.prompt))
            || (Array.isArray(quizPrompts) ? quizPrompts : []).some((prompt) =>
                isNearDuplicatePrompt(prompt, normalized.prompt),
            );
        if (duplicate) return;
        seenSections.add(sectionIndex);
        kept.push({ ...normalized, sortOrder: kept.length });
    };

    for (const raw of incoming) consider(raw);
    if (ordering) consider({ ...ordering, questionType: "ordering" });

    return kept;
};
