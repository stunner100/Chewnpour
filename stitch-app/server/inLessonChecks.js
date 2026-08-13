import { isValidMcq, isNearDuplicatePrompt } from "./questionDedup.js";
import { sanitizeGeneratedHint } from "./hintSanitize.js";
import { normalizeOrderingQuestion, snippetHasProcess } from "./processOrdering.js";
import {
    eligibleLessonSectionTitles,
    isSkippedStepperTitle,
    isWordBankStepperTitle,
    normalizeSectionTitle,
    splitMarkdownIntoSections,
} from "../src/lib/lessonSections.js";

const MAX_IN_LESSON_CHECKS = 4;

const normalizeWhitespace = (value = "") =>
    String(value || "").replace(/\s+/g, " ").trim();

const trueFalseOptions = (options) => {
    const list = Array.isArray(options) ? options.map((item) => normalizeWhitespace(item)) : [];
    if (list.length === 2) return list;
    return ["True", "False"];
};

const normalizeTrueFalse = (raw, { sectionTitle = "" } = {}) => {
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
        sectionTitle: normalizeWhitespace(raw?.sectionTitle || sectionTitle).slice(0, 180),
        payload: {
            sectionTitle: normalizeWhitespace(raw?.sectionTitle || sectionTitle).slice(0, 180),
        },
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

const normalizeInLessonMcq = (raw, { sectionTitle = "", title = "" } = {}) => {
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
        sectionTitle: normalizeWhitespace(raw?.sectionTitle || sectionTitle).slice(0, 180),
        payload: {
            sectionTitle: normalizeWhitespace(raw?.sectionTitle || sectionTitle).slice(0, 180),
        },
        sortOrder: 0,
    };
    if (!isValidMcq(candidate, { title })) return null;
    candidate.hint = sanitizeGeneratedHint({
        hint: candidate.hint,
        questionType: "multiple_choice",
        options: candidate.options,
        correctIndex: candidate.correctIndex,
        answer: candidate.options[candidate.correctIndex],
    });
    return candidate;
};

export const normalizeInLessonChecks = (
    rawChecks,
    { content = "", title = "", quizPrompts = [], ordering = null } = {},
) => {
    const sections = splitMarkdownIntoSections(content);
    const eligible = eligibleLessonSectionTitles(sections);
    const eligibleSet = new Set(eligible.map((item) => normalizeSectionTitle(item)));
    const incoming = Array.isArray(rawChecks) ? rawChecks : [];
    const kept = [];
    const seenSections = new Set();
    let hasOrdering = false;

    const consider = (raw) => {
        if (kept.length >= MAX_IN_LESSON_CHECKS) return;
        const sectionTitle = normalizeWhitespace(raw?.sectionTitle || "");
        const sectionKey = normalizeSectionTitle(sectionTitle);
        if (sectionTitle && (isSkippedStepperTitle(sectionTitle) || isWordBankStepperTitle(sectionTitle))) {
            return;
        }
        if (sectionKey && !eligibleSet.has(sectionKey) && eligibleSet.size > 0) {
            const fallback = eligible.find((item) => !seenSections.has(normalizeSectionTitle(item)));
            if (fallback) raw = { ...raw, sectionTitle: fallback };
        }
        const boundTitle = normalizeWhitespace(raw?.sectionTitle || eligible[kept.length] || "");
        const boundKey = normalizeSectionTitle(boundTitle);
        if (boundKey && seenSections.has(boundKey)) return;

        const type = String(raw?.questionType || raw?.type || "multiple_choice").trim();
        let normalized = null;
        if (type === "ordering") {
            if (hasOrdering) return;
            const source = sections.find((section) => normalizeSectionTitle(section.title) === boundKey)?.content || content;
            if (!snippetHasProcess(source) && !raw?.stepsInOrder) return;
            normalized = normalizeOrderingQuestion(raw, { sourceText: source });
            if (!normalized) return;
            normalized = {
                ...normalized,
                surface: "in_lesson",
                sectionTitle: boundTitle,
                payload: { ...(normalized.payload || {}), sectionTitle: boundTitle },
                hint: sanitizeGeneratedHint({
                    hint: normalized.hint,
                    questionType: "ordering",
                    stepsInOrder: normalized.stepsInOrder,
                }),
            };
            hasOrdering = true;
        } else if (type === "true_false") {
            normalized = normalizeTrueFalse(raw, { sectionTitle: boundTitle });
        } else {
            normalized = normalizeInLessonMcq(raw, { sectionTitle: boundTitle, title });
        }
        if (!normalized) return;
        const duplicate = kept.some((existing) => isNearDuplicatePrompt(existing.prompt, normalized.prompt))
            || (Array.isArray(quizPrompts) ? quizPrompts : []).some((prompt) =>
                isNearDuplicatePrompt(prompt, normalized.prompt),
            );
        if (duplicate) return;
        if (boundKey) seenSections.add(boundKey);
        kept.push({ ...normalized, sortOrder: kept.length });
    };

    for (const raw of incoming) consider(raw);
    if (ordering) consider({ ...ordering, questionType: "ordering", sectionTitle: ordering.sectionTitle });

    return kept;
};
