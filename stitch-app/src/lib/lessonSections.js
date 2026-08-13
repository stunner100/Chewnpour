const SKIP_STEPPER_TITLES = new Set([
    "quick check",
    "self-check",
    "self-check prompts",
    "review questions",
]);

const WORDBANK_STEPPER_TITLES = new Set(["word bank", "quick glossary", "glossary"]);

export const normalizeSectionTitle = (value) =>
    String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();

export const isSkippedStepperTitle = (title) =>
    SKIP_STEPPER_TITLES.has(normalizeSectionTitle(title));

export const isWordBankStepperTitle = (title) =>
    WORDBANK_STEPPER_TITLES.has(normalizeSectionTitle(title));

export const splitMarkdownIntoSections = (markdown) => {
    const lines = String(markdown || "").split(/\r?\n/);
    const sections = [];
    let current = { title: "Introduction", lines: [] };

    const pushCurrent = () => {
        const content = current.lines.join("\n").trim();
        if (!current.title && !content) return;
        sections.push({ title: current.title, content });
    };

    for (const line of lines) {
        const heading = line.match(/^#{1,3}\s+(.+)$/);
        if (heading) {
            pushCurrent();
            current = { title: heading[1].trim(), lines: [] };
            continue;
        }
        current.lines.push(line);
    }
    pushCurrent();
    return sections.filter((section) => section.content.length >= 20 || !isSkippedStepperTitle(section.title));
};

export const splitBlocksIntoSections = (blocks) => {
    const sections = [];
    let current = { title: "Introduction", blocks: [] };

    const pushCurrent = () => {
        if (!current.title && current.blocks.length === 0) return;
        const hasBody = current.blocks.some((block) => block.type !== "header");
        if (!hasBody && isSkippedStepperTitle(current.title)) return;
        sections.push({ title: current.title, blocks: current.blocks });
    };

    for (const block of Array.isArray(blocks) ? blocks : []) {
        if (block?.type === "header" && Number(block.level || 2) <= 2) {
            if (current.blocks.length > 0 || current.title !== "Introduction") {
                pushCurrent();
            }
            current = { title: String(block.text || "Section").trim(), blocks: [block] };
            continue;
        }
        current.blocks.push(block);
    }
    pushCurrent();
    return sections.filter((section) => {
        if (isSkippedStepperTitle(section.title)) return false;
        return section.blocks.some((block) => block.type !== "header") || isWordBankStepperTitle(section.title);
    });
};

export const matchCheckToSection = (check, sectionTitle) =>
    normalizeSectionTitle(check?.sectionTitle) === normalizeSectionTitle(sectionTitle);

export const eligibleLessonSectionTitles = (sections) =>
    (Array.isArray(sections) ? sections : [])
        .filter((section) => !isSkippedStepperTitle(section.title) && !isWordBankStepperTitle(section.title))
        .map((section) => section.title);

export const markdownToSimpleBlocks = (title, content, keyPrefix = "s") => {
    const blocks = [];
    if (title) {
        blocks.push({
            type: "header",
            level: 2,
            text: title,
            key: `${keyPrefix}-h`,
            id: normalizeSectionTitle(title).replace(/\s+/g, "-") || "section",
        });
    }
    const chunks = String(content || "")
        .split(/\n{2,}/)
        .map((chunk) => chunk.trim())
        .filter(Boolean);
    chunks.forEach((chunk, index) => {
        if (/^#{1,3}\s+/.test(chunk.split("\n")[0] || "")) {
            const lines = chunk.split("\n");
            const heading = lines[0].replace(/^#{1,3}\s+/, "").trim();
            if (normalizeSectionTitle(heading) === normalizeSectionTitle(title)) {
                chunk = lines.slice(1).join("\n").trim();
                if (!chunk) return;
            }
        }
        const lines = chunk.split("\n");
        const bulletLines = lines.filter((line) => line.trim());
        if (bulletLines.length > 0 && bulletLines.every((line) => /^[-*]\s+/.test(line))) {
            bulletLines.forEach((line, bulletIndex) => {
                blocks.push({
                    type: "bullet",
                    text: line.replace(/^[-*]\s+/, "").trim(),
                    key: `${keyPrefix}-b-${index}-${bulletIndex}`,
                });
            });
            return;
        }
        blocks.push({
            type: "paragraph",
            text: chunk,
            key: `${keyPrefix}-p-${index}`,
        });
    });
    return blocks;
};

export const blocksToSpeechText = (blocks) =>
    (Array.isArray(blocks) ? blocks : [])
        .map((block) => String(block?.text || "").trim())
        .filter(Boolean)
        .join(" ")
        .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/\*(.*?)\*/g, "$1")
        .replace(/[#>`_~-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

export const buildLessonSteps = ({
    sections = [],
    checks = [],
    wordBankTerms = [],
    studyMode = "full",
} = {}) => {
    const remaining = [...(Array.isArray(checks) ? checks : [])];
    const steps = [];
    for (const section of Array.isArray(sections) ? sections : []) {
        if (isSkippedStepperTitle(section.title) || isWordBankStepperTitle(section.title)) {
            continue;
        }
        const matchIndex = remaining.findIndex((check) => matchCheckToSection(check, section.title));
        let check = null;
        if (matchIndex >= 0) {
            [check] = remaining.splice(matchIndex, 1);
        }
        steps.push({
            type: "section",
            title: section.title,
            blocks: Array.isArray(section.blocks) && section.blocks.length > 0
                ? section.blocks
                : markdownToSimpleBlocks(section.title, section.content, `sec-${steps.length}`),
            check,
        });
    }
    if (Array.isArray(wordBankTerms) && wordBankTerms.length > 0) {
        steps.push({
            type: "wordbank",
            title: "Word Bank",
            blocks: [{ type: "wordbank_widget", key: "wordbank-step" }],
            check: null,
        });
    }
    if (studyMode === "practice_only") {
        return steps.filter((step) => step.check || step.type === "wordbank");
    }
    return steps;
};
