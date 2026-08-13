import { strToU8, zipSync } from "fflate";

const OPTION_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export const sanitizeExportFileStem = (fileName = "") => {
    const stripped = String(fileName || "material")
        .replace(/\.[^.]+$/, "")
        .replace(/[^\w\s-]+/g, " ")
        .trim()
        .replace(/[\s_]+/g, "-")
        .replace(/-+/g, "-")
        .slice(0, 60)
        .replace(/-$/, "");
    return stripped || "material";
};

export const asciiDownloadFilename = (filename = "download.zip") =>
    String(filename || "download.zip")
        .replace(/[^\w.-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "") || "download.zip";

const asText = (value) => String(value || "").trim();

const parseOptions = (options) => {
    if (Array.isArray(options)) return options.map((item) => asText(item)).filter(Boolean);
    if (typeof options === "string") {
        try {
            return parseOptions(JSON.parse(options));
        } catch {
            return [];
        }
    }
    return [];
};

export const buildExtractedSourceMarkdown = ({
    fileName = "",
    extractedText = "",
    pageCount = null,
    charCount = null,
} = {}) => {
    const lines = [
        "# Extracted source",
        "",
        `From: ${asText(fileName) || "upload"}`,
    ];
    if (pageCount != null && Number.isFinite(Number(pageCount))) {
        lines.push(`Pages: ${Number(pageCount)}`);
    }
    if (charCount != null && Number.isFinite(Number(charCount))) {
        lines.push(`Characters: ${Number(charCount)}`);
    }
    lines.push("", "---", "", asText(extractedText) || "(No extracted text.)", "");
    return lines.join("\n");
};

export const buildLessonsMarkdown = ({ title = "", fileName = "", topics = [] } = {}) => {
    const heading = asText(title) || asText(fileName) || "Lessons";
    const blocks = [
        `# ${heading}`,
        "",
        `Generated from ${asText(fileName) || "your upload"}.`,
        "",
    ];
    (Array.isArray(topics) ? topics : []).forEach((topic, index) => {
        const topicTitle = asText(topic?.title) || `Lesson ${index + 1}`;
        const description = asText(topic?.description);
        const content = asText(topic?.content);
        blocks.push(`## ${index + 1}. ${topicTitle}`, "");
        if (description) blocks.push(description, "");
        blocks.push(content || "(No lesson content.)", "", "");
    });
    return blocks.join("\n").trim() + "\n";
};

export const buildQuizzesMarkdown = ({ quizzes = [] } = {}) => {
    const rows = Array.isArray(quizzes) ? quizzes : [];
    const grouped = new Map();
    for (const row of rows) {
        const topicTitle = asText(row?.topicTitle) || "Quiz";
        const list = grouped.get(topicTitle) || [];
        list.push(row);
        grouped.set(topicTitle, list);
    }

    const blocks = ["# Quizzes", ""];
    for (const [topicTitle, questions] of grouped.entries()) {
        blocks.push(`## ${topicTitle}`, "");
        questions.forEach((question, index) => {
            const prompt = asText(question?.prompt) || `Question ${index + 1}`;
            const options = parseOptions(question?.options);
            const surface =
                String(question?.surface || "quiz").toLowerCase() === "in_lesson"
                    ? "In-lesson check"
                    : "Quiz";
            blocks.push(`### ${index + 1}. ${prompt}`, "", `_${surface}_`, "");
            options.forEach((option, optionIndex) => {
                const letter = OPTION_LETTERS[optionIndex] || String(optionIndex + 1);
                blocks.push(`- ${letter}. ${option}`);
            });
            const correctIndex = Number(question?.correctIndex);
            if (Number.isInteger(correctIndex) && options[correctIndex]) {
                const letter = OPTION_LETTERS[correctIndex] || String(correctIndex + 1);
                blocks.push("", `Answer: ${letter}. ${options[correctIndex]}`);
            }
            const explanation = asText(question?.explanation);
            if (explanation) blocks.push("", explanation);
            blocks.push("");
        });
    }
    return blocks.join("\n").trim() + "\n";
};

export const buildTransformedExportZip = ({
    fileName = "",
    title = "",
    extractedText = "",
    pageCount = null,
    charCount = null,
    topics = [],
    quizzes = [],
} = {}) => {
    const files = {};
    const extracted = asText(extractedText);
    const topicList = Array.isArray(topics) ? topics : [];
    const quizList = Array.isArray(quizzes) ? quizzes : [];

    if (extracted) {
        files["extracted-source.md"] = strToU8(
            buildExtractedSourceMarkdown({
                fileName,
                extractedText: extracted,
                pageCount,
                charCount,
            }),
        );
    }
    if (topicList.length > 0) {
        files["lessons.md"] = strToU8(
            buildLessonsMarkdown({ title, fileName, topics: topicList }),
        );
    }
    if (quizList.length > 0) {
        files["quizzes.md"] = strToU8(buildQuizzesMarkdown({ quizzes: quizList }));
    }

    if (Object.keys(files).length === 0) {
        const error = new Error("Transformed content is not ready yet.");
        error.status = 409;
        error.code = "EXPORT_NOT_READY";
        throw error;
    }

    const stem = sanitizeExportFileStem(title || fileName);
    const filename = asciiDownloadFilename(`${stem}-chewnpour.zip`);
    const zipped = zipSync(files, { level: 6 });
    return {
        filename,
        mimeType: "application/zip",
        body: zipped,
        fileCount: Object.keys(files).length,
    };
};
