import { getTopicForUser } from "./courses.js";
import { callCourseLlmChat, isCourseAiEnabled } from "./llmClient.js";
import { lessonToMarkdown } from "../src/lib/lessonSchema.js";
import { extractJsonObject } from "./promptSafety.js";
import { reExplainStyleById } from "../src/lib/reExplainStyles.js";

const STYLE_PROMPTS = {
    explain:
        "Explain the selected text clearly in plain language for a university student. Keep it under 180 words.",
    breakdown:
        "Break the selected text into clear steps or parts. Use short sentences. Keep it under 180 words.",
    simplify:
        "Simplify the selected text as if teaching a curious 12-year-old. Keep it under 160 words.",
    example:
        "Give one concrete, everyday example that illustrates the selected text. Keep it under 160 words.",
};

// The highlight popover shows plain text: drop markdown emphasis, heading and
// code markers, but never hyphens or minus signs ("-40 °C" stays as written).
const toPlainExplanation = (value) =>
    String(value || "")
        .replace(/```\w*\n?/g, "")
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/__([^_]+)__/g, "$1")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/^\s{0,3}#{1,6}\s+/gm, "")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/[ \t]{2,}/g, " ")
        .trim();

const buildExplainFallback = ({ selectedText, style }) => {
    const snippet = String(selectedText || "").replace(/\s+/g, " ").trim().slice(0, 280);
    if (style === "simplify") {
        return `In simple terms: ${snippet || "this idea"} means focusing on the core point and saying it in everyday words.`;
    }
    if (style === "breakdown") {
        return (
            `Breakdown:\n` +
            `1) Identify the main claim in the selection.\n` +
            `2) Note the supporting detail or reason.\n` +
            `3) Restate the takeaway in your own words.\n` +
            `Selection: ${snippet || "your highlighted text"}`
        );
    }
    return `Explanation: ${snippet || "This selection"} is highlighting a key idea from your lesson. Re-read the surrounding paragraph and connect it to the section heading for full context.`;
};

export const explainTopicSelection = async ({
    userId,
    topicId,
    selectedText,
    style = "explain",
}) => {
    const cleaned = String(selectedText || "").trim().slice(0, 1000);
    if (!cleaned) {
        const error = new Error("Select some text first.");
        error.status = 400;
        throw error;
    }

    const topicPayload = await getTopicForUser(userId, topicId);
    const topic = topicPayload?.topic;
    if (!topic) {
        const error = new Error("Topic not found");
        error.status = 404;
        throw error;
    }

    const normalizedStyle = STYLE_PROMPTS[style] ? style : "explain";
    let explanation = "";
    let backend = "fallback";

    if (isCourseAiEnabled()) {
        try {
            const llm = await callCourseLlmChat({
                messages: [
                    {
                        role: "system",
                        content:
                            "You help students understand highlighted lesson text. " +
                            "Use the lesson context when helpful. Return plain text only.",
                    },
                    {
                        role: "user",
                        content:
                            `STYLE INSTRUCTION: ${STYLE_PROMPTS[normalizedStyle]}\n\n` +
                            `LESSON TITLE: ${topic.title || ""}\n` +
                            `LESSON CONTEXT:\n"""\n${lessonToMarkdown(topic.lesson).slice(0, 6000)}\n"""\n\n` +
                            `SELECTED TEXT:\n"""\n${cleaned}\n"""`,
                    },
                ],
                temperature: 0.2,
                maxTokens: 700,
                run: { purpose: "explain_selection", userId, topicId: topic.id, courseId: topic.courseId },
            });
            explanation =
                toPlainExplanation(llm?.text || "") ||
                buildExplainFallback({ selectedText: cleaned, style: normalizedStyle });
            backend = llm?.provider || "llm";
        } catch (error) {
            console.warn("[topicExplain] explain failed; using fallback", {
                message: error?.message || String(error),
            });
            explanation = buildExplainFallback({
                selectedText: cleaned,
                style: normalizedStyle,
            });
        }
    } else {
        explanation = buildExplainFallback({
            selectedText: cleaned,
            style: normalizedStyle,
        });
    }

    return {
        explanation,
        style: normalizedStyle,
        backend,
    };
};

const reExplainUnavailable = (message, status = 502) => {
    const error = new Error(message);
    error.status = status;
    return error;
};

// Rewrites each section body in the requested style and keeps everything
// else: titles, roles, order, hook, recap and word bank. In-lesson checks bind
// to a section by index, so they still apply to the rewritten lesson. Throws
// when the model's answer does not have one usable body per section.
export const rewriteLessonForStyle = async ({ lesson, title = "", style, run = {}, chat = callCourseLlmChat }) => {
    const sections = Array.isArray(lesson?.sections) ? lesson.sections : [];
    if (sections.length === 0) {
        throw reExplainUnavailable("This lesson has no sections to re-explain yet.", 409);
    }
    const llm = await chat({
        messages: [
            {
                role: "system",
                content: [
                    "You rewrite a lesson for a student in a requested style.",
                    'Return ONLY valid JSON: {"sections":[{"body":"markdown"}]} with exactly one entry per input section, in the same order.',
                    "Rewrite each body in the style; do not merge, split, drop or reorder sections, and do not write titles.",
                    "Keep every fact, name and number from the original exactly as written, including signs and units such as -40 °C. Do not add facts that are not in the lesson.",
                    "Each body is markdown: paragraphs, lists, tables or code blocks as needed; use ### for a sub-heading, never # or ##.",
                ].join(" "),
            },
            {
                role: "user",
                content:
                    `STYLE: ${style}\n` +
                    `LESSON TITLE: ${title}\n\n` +
                    `SECTIONS:\n${JSON.stringify(sections.map((section, index) => ({ index, title: section.title, body: section.body })))}`,
            },
        ],
        temperature: 0.3,
        maxTokens: 6000,
        responseFormat: "json_object",
        run: { purpose: "re_explain", ...run },
    });
    const rewritten = extractJsonObject(llm?.text)?.sections;
    const bodies = (Array.isArray(rewritten) ? rewritten : []).map((item) => String(item?.body || "").trim());
    if (bodies.length !== sections.length || bodies.some((body) => body.length < 20)) {
        throw reExplainUnavailable("We couldn't re-explain this lesson. Try again.");
    }
    return {
        lesson: { ...lesson, sections: sections.map((section, index) => ({ ...section, body: bodies[index] })) },
        backend: llm?.provider || "llm",
    };
};

export const reExplainTopicContent = async ({ userId, topicId, style }) => {
    const topicPayload = await getTopicForUser(userId, topicId);
    const topic = topicPayload?.topic;
    if (!topic) {
        const error = new Error("Topic not found");
        error.status = 404;
        throw error;
    }
    if (!isCourseAiEnabled()) {
        throw reExplainUnavailable("Re-explain is not available right now.", 503);
    }

    const resolvedStyle = reExplainStyleById(style);
    try {
        const { lesson, backend } = await rewriteLessonForStyle({
            lesson: topic.lesson,
            title: topic.title || "",
            style: resolvedStyle.instruction,
            run: { userId, topicId: topic.id, courseId: topic.courseId, label: resolvedStyle.id },
        });
        return { lesson, style: resolvedStyle.id, backend };
    } catch (error) {
        if (error?.status) throw error;
        console.warn("[topicExplain] re-explain failed", { message: error?.message || String(error) });
        throw reExplainUnavailable("We couldn't re-explain this lesson. Try again.");
    }
};
