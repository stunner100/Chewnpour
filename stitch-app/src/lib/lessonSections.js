// Splits lesson markdown into sections: an H1 or H2 heading plus the markdown
// below it (H3+ stay inside the body). Used to convert markdown lessons into
// the stored lesson shape (lessonFromMarkdown in lessonSchema.js).

// Normalized titles (see normalizeSectionTitle).
const SKIP_STEPPER_TITLES = new Set([
    "quick check",
    "self check",
    "self check prompts",
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
const SECTION_HEADING_RE = /^\s{0,3}(#{1,2})\s+(.+)$/;
// A closing run of #s counts only after a space, so "## C#" keeps its #.
const CLOSING_HASHES_RE = /\s+#+\s*$/;

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
            current = { title: heading[2].replace(CLOSING_HASHES_RE, "").trim(), level: heading[1].length, lines: [] };
            continue;
        }
        current.lines.push(line);
    }
    pushCurrent();
    return sections.filter((section) => section.content.length >= 20 || !isSkippedStepperTitle(section.title));
};
