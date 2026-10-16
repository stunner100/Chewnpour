// Shared by the server (check binding, course eval) and the lesson page, so a
// check bound to a section title on the server finds the same section on the
// client. A section is an H1 or H2 heading plus the markdown below it; H3+
// stay inside the section body.

const SKIP_STEPPER_TITLES = new Set([
    "quick check",
    "self-check",
    "self-check prompts",
    "review questions",
]);

const WORDBANK_STEPPER_TITLES = new Set(["word bank", "quick glossary", "glossary"]);

const INTRODUCTION_TITLE = "Introduction";

export const normalizeSectionTitle = (value) =>
    String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();

export const isSkippedStepperTitle = (title) =>
    SKIP_STEPPER_TITLES.has(normalizeSectionTitle(title));

export const isWordBankStepperTitle = (title) =>
    WORDBANK_STEPPER_TITLES.has(normalizeSectionTitle(title));

const FENCE_RE = /^\s{0,3}(`{3,}|~{3,})/;
const SECTION_HEADING_RE = /^\s{0,3}(#{1,2})\s+(.+?)\s*#*\s*$/;

// level is 0 for text before the first heading, else the heading level (1-2).
export const splitMarkdownIntoSections = (markdown) => {
    const lines = String(markdown || "").split(/\r?\n/);
    const sections = [];
    let current = { title: INTRODUCTION_TITLE, level: 0, lines: [] };
    let fence = null;

    const pushCurrent = () => {
        const content = current.lines.join("\n").trim();
        if (!content) return;
        sections.push({ title: current.title, level: current.level, content });
    };

    for (const line of lines) {
        const fenceMatch = line.match(FENCE_RE);
        if (fenceMatch) {
            const marker = fenceMatch[1];
            if (!fence) {
                fence = marker;
            } else if (marker[0] === fence[0] && marker.length >= fence.length) {
                fence = null;
            }
            current.lines.push(line);
            continue;
        }
        const heading = fence ? null : line.match(SECTION_HEADING_RE);
        if (heading) {
            pushCurrent();
            current = { title: heading[2].trim(), level: heading[1].length, lines: [] };
            continue;
        }
        current.lines.push(line);
    }
    pushCurrent();
    return sections.filter((section) => section.content.length >= 20 || !isSkippedStepperTitle(section.title));
};

export const matchCheckToSection = (check, sectionTitle) =>
    normalizeSectionTitle(check?.sectionTitle) === normalizeSectionTitle(sectionTitle);

export const eligibleLessonSectionTitles = (sections) =>
    (Array.isArray(sections) ? sections : [])
        .filter((section) => !isSkippedStepperTitle(section.title) && !isWordBankStepperTitle(section.title))
        .map((section) => section.title);

// A Word Bank section becomes the word bank widget only when its terms were
// parsed; otherwise it stays a readable section so its content is never lost.
export const buildLessonSteps = ({
    sections = [],
    checks = [],
    wordBankTerms = [],
    studyMode = "full",
} = {}) => {
    const remaining = [...(Array.isArray(checks) ? checks : [])];
    const hasWordBank = Array.isArray(wordBankTerms) && wordBankTerms.length > 0;
    const steps = [];
    for (const section of Array.isArray(sections) ? sections : []) {
        if (isSkippedStepperTitle(section.title)) continue;
        if (hasWordBank && isWordBankStepperTitle(section.title)) continue;
        const matchIndex = remaining.findIndex((check) => matchCheckToSection(check, section.title));
        let check = null;
        if (matchIndex >= 0) {
            [check] = remaining.splice(matchIndex, 1);
        }
        steps.push({
            type: "section",
            title: section.title,
            markdown: section.content,
            check,
        });
    }
    if (hasWordBank) {
        steps.push({
            type: "wordbank",
            title: "Word Bank",
            markdown: "",
            check: null,
        });
    }
    if (studyMode === "practice_only") {
        return steps.filter((step) => step.check || step.type === "wordbank");
    }
    return steps;
};
