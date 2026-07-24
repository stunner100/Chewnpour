import { callCourseLlmChat, isCourseAiEnabled } from "./llmClient.js";
import {
    buildQuestionsForTopic,
    buildTopicsFromExtractedText,
} from "./courseGeneration.js";

const MAX_SOURCE_CHARS = 12000;
const MAX_TOPICS = 5;
const MAX_QUESTIONS_PER_TOPIC = 3;

const normalizeWhitespace = (value = "") =>
    String(value || "").replace(/\s+/g, " ").trim();

const extractJsonObject = (raw = "") => {
    const text = String(raw || "").trim();
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch {
        const start = text.indexOf("{");
        const end = text.lastIndexOf("}");
        if (start >= 0 && end > start) {
            try {
                return JSON.parse(text.slice(start, end + 1));
            } catch {
                return null;
            }
        }
        return null;
    }
};

const normalizeOptions = (value) => {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => normalizeWhitespace(item))
        .filter(Boolean)
        .slice(0, 4);
};

export const normalizeAiCoursePayload = (payload, { fileName = "", extractedText = "" } = {}) => {
    const topicsInput = Array.isArray(payload?.topics) ? payload.topics : [];
    const topics = [];

    for (const item of topicsInput) {
        if (topics.length >= MAX_TOPICS) break;
        const title = normalizeWhitespace(item?.title).slice(0, 180);
        const content = String(item?.content || "").trim().slice(0, 4000);
        if (!title || content.length < 40) continue;

        const questions = [];
        const questionItems = Array.isArray(item?.questions) ? item.questions : [];
        for (const question of questionItems) {
            if (questions.length >= MAX_QUESTIONS_PER_TOPIC) break;
            const prompt = normalizeWhitespace(question?.prompt);
            const options = normalizeOptions(question?.options);
            const correctIndex = Number(question?.correctIndex);
            if (!prompt || options.length < 2) continue;
            if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
                continue;
            }
            questions.push({
                prompt: prompt.slice(0, 400),
                options,
                correctIndex,
                explanation: normalizeWhitespace(question?.explanation).slice(0, 500),
                sortOrder: questions.length,
            });
        }

        if (questions.length === 0) {
            questions.push(
                ...buildQuestionsForTopic({
                    topicTitle: title,
                    topicContent: content,
                    limit: MAX_QUESTIONS_PER_TOPIC,
                }),
            );
        }

        topics.push({
            title,
            description: normalizeWhitespace(item?.description || content).slice(0, 280),
            content,
            questions,
        });
    }

    if (topics.length === 0) {
        return {
            backend: "heuristic",
            topics: buildTopicsFromExtractedText({ fileName, extractedText }).map((topic) => ({
                ...topic,
                questions: buildQuestionsForTopic({
                    topicTitle: topic.title,
                    topicContent: topic.content,
                    limit: MAX_QUESTIONS_PER_TOPIC,
                }),
            })),
        };
    }

    return {
        backend: "deepseek",
        topics,
    };
};

export const generateCourseCurriculumWithAi = async ({ fileName, extractedText }) => {
    const text = String(extractedText || "").trim();
    if (!text) {
        return {
            backend: "heuristic",
            topics: buildTopicsFromExtractedText({ fileName, extractedText: "" }).map((topic) => ({
                ...topic,
                questions: [],
            })),
        };
    }

    if (!isCourseAiEnabled()) {
        return {
            backend: "heuristic",
            topics: buildTopicsFromExtractedText({ fileName, extractedText: text }).map((topic) => ({
                ...topic,
                questions: buildQuestionsForTopic({
                    topicTitle: topic.title,
                    topicContent: topic.content,
                    limit: MAX_QUESTIONS_PER_TOPIC,
                }),
            })),
        };
    }

    const clipped = text.slice(0, MAX_SOURCE_CHARS);
    const system = [
        "You are ChewnPour's study curriculum generator.",
        "Return ONLY valid JSON with this shape:",
        '{"topics":[{"title":"string","description":"string","content":"markdown lesson string","questions":[{"prompt":"string","options":["A","B","C","D"],"correctIndex":0,"explanation":"string"}]}]}',
        `Create 3-${MAX_TOPICS} topics grounded only in the source text.`,
        `Each topic needs 2-${MAX_QUESTIONS_PER_TOPIC} multiple-choice questions.`,
        "correctIndex must point at the correct option.",
        "Do not invent facts that are absent from the source.",
    ].join(" ");

    const user = [
        `Source file name: ${fileName || "upload"}`,
        "",
        "Source text:",
        clipped,
    ].join("\n");

    try {
        const result = await callCourseLlmChat({
            messages: [
                { role: "system", content: system },
                { role: "user", content: user },
            ],
            temperature: 0.2,
            maxTokens: 4096,
            responseFormat: "json_object",
        });
        const parsed = extractJsonObject(result.text);
        if (!parsed) {
            throw new Error("AI returned non-JSON curriculum payload.");
        }
        const normalized = normalizeAiCoursePayload(parsed, { fileName, extractedText: text });
        const provider = result.provider || "deepseek";
        return {
            ...normalized,
            backend:
                normalized.backend === "heuristic"
                    ? `${provider}_fallback_heuristic`
                    : provider,
            model: result.model,
        };
    } catch (error) {
        console.warn("[aiCourseGeneration] falling back to heuristic curriculum", {
            message: error?.message || String(error),
        });
        return {
            backend: "heuristic_fallback",
            topics: buildTopicsFromExtractedText({ fileName, extractedText: text }).map((topic) => ({
                ...topic,
                questions: buildQuestionsForTopic({
                    topicTitle: topic.title,
                    topicContent: topic.content,
                    limit: MAX_QUESTIONS_PER_TOPIC,
                }),
            })),
            error: error?.message || String(error),
        };
    }
};
