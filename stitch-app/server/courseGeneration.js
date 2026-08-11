import { formatCourseTitle } from "../src/lib/courseTitle.js";

const stripExtension = (fileName = "") =>
    String(fileName || "Untitled material").replace(
        /\.(pdf|pptx|docx|mp3|m4a|mp4|wav|webm|ogg|aac|flac)$/i,
        "",
    );

const normalizeWhitespace = (value = "") =>
    String(value || "").replace(/\s+/g, " ").trim();

const splitIntoSentences = (text = "") =>
    String(text || "")
        .split(/(?<=[.!?])\s+/)
        .map((part) => normalizeWhitespace(part))
        .filter((part) => part.length >= 24);

const splitByHeadings = (text = "") => {
    const lines = String(text || "").split(/\r?\n/);
    const sections = [];
    let current = { title: "", body: [] };

    for (const line of lines) {
        const heading = line.match(/^#{1,3}\s+(.+)$/);
        if (heading) {
            if (current.title || current.body.length) {
                sections.push({
                    title: current.title || "Section",
                    content: current.body.join("\n").trim(),
                });
            }
            current = { title: normalizeWhitespace(heading[1]).slice(0, 120), body: [] };
            continue;
        }
        current.body.push(line);
    }

    if (current.title || current.body.length) {
        sections.push({
            title: current.title || "Section",
            content: current.body.join("\n").trim(),
        });
    }

    return sections.filter((section) => normalizeWhitespace(section.content).length >= 40);
};

const chunkByParagraphs = (text = "", maxChunks = 5) => {
    const paragraphs = String(text || "")
        .split(/\n{2,}/)
        .map((part) => part.trim())
        .filter((part) => part.length >= 40);

    if (paragraphs.length === 0) {
        const compact = normalizeWhitespace(text);
        return compact
            ? [{ title: "Overview", content: compact.slice(0, 4000) }]
            : [];
    }

    const chunkSize = Math.max(1, Math.ceil(paragraphs.length / maxChunks));
    const chunks = [];
    for (let index = 0; index < paragraphs.length && chunks.length < maxChunks; index += chunkSize) {
        const body = paragraphs.slice(index, index + chunkSize).join("\n\n");
        const firstSentence = splitIntoSentences(body)[0] || body;
        chunks.push({
            title: normalizeWhitespace(firstSentence).slice(0, 80) || `Topic ${chunks.length + 1}`,
            content: body.slice(0, 4000),
        });
    }
    return chunks;
};

export const buildTopicsFromExtractedText = ({ fileName, extractedText }) => {
    const titleBase = formatCourseTitle(fileName) || "Study material";
    const text = String(extractedText || "").trim();

    if (!text) {
        return [
            {
                title: titleBase,
                description: "Source file is stored. Extraction is still pending.",
                content:
                    "This course was created from an uploaded file, but no extractable text was found. Re-upload a text-based PDF/DOCX, or use a cloud OCR service for scanned pages.",
            },
        ];
    }

    const headingSections = splitByHeadings(text);
    const sections =
        headingSections.length >= 2 ? headingSections.slice(0, 6) : chunkByParagraphs(text, 5);

    if (sections.length === 0) {
        return [
            {
                title: titleBase,
                description: "Generated from your upload",
                content: text.slice(0, 4000),
            },
        ];
    }

    return sections.map((section, index) => ({
        title: section.title || `Topic ${index + 1}`,
        description: normalizeWhitespace(section.content).slice(0, 160),
        content: section.content.slice(0, 4000),
    }));
};

const DISTRACTORS = [
    "This detail is not supported by the uploaded material.",
    "The material does not discuss this claim.",
    "This statement contradicts the source excerpt.",
];

const shuffleOptionsWithCorrect = (options, correctIndex) => {
    const items = options.map((option, index) => ({
        option,
        isCorrect: index === correctIndex,
    }));
    for (let i = items.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
    }
    return {
        options: items.map((item) => item.option),
        correctIndex: items.findIndex((item) => item.isCorrect),
    };
};

export const buildQuestionsForTopic = ({ topicTitle, topicContent, limit = 3 }) => {
    const allSentences = splitIntoSentences(topicContent);
    const sentences = allSentences.slice(0, Math.max(1, limit));
    if (sentences.length === 0) {
        return [];
    }

    return sentences.map((sentence, index) => {
        const correct = sentence.slice(0, 180);
        const alternate = allSentences
            .filter((candidate) => candidate !== sentence)
            .slice(0, 3)
            .map((candidate) => candidate.slice(0, 180));
        const distractors = [...alternate, ...DISTRACTORS].slice(0, 3);
        const unshuffled = [correct, ...distractors].slice(0, 4);
        const shuffled = shuffleOptionsWithCorrect(unshuffled, 0);
        return {
            prompt: `According to “${normalizeWhitespace(topicTitle).slice(0, 60) || "this topic"}”, which statement is accurate?`,
            options: shuffled.options,
            correctIndex: shuffled.correctIndex,
            explanation: `Drawn from the source excerpt: ${correct}`,
            sortOrder: index,
        };
    });
};

export const stripCourseTitle = (fileName = "") =>
    formatCourseTitle(fileName) || stripExtension(fileName);
