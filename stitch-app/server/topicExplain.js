import { getTopicForUser } from "./courses.js";
import { callCourseLlmChat, isCourseAiEnabled } from "./llmClient.js";

const STYLE_PROMPTS = {
    explain:
        "Explain the selected text clearly in plain language for a university student. Keep it under 180 words.",
    breakdown:
        "Break the selected text into clear steps or parts. Use short sentences. Keep it under 180 words.",
    simplify:
        "Simplify the selected text as if teaching a curious 12-year-old. Keep it under 160 words.",
};

const REEXPLAIN_STYLES = [
    "Teach me like I'm 12",
    "Use a real-world analogy",
    "Make it more concise",
    "Add more examples",
];

const stripMarkdownLikeFormatting = (value) =>
    String(value || "")
        .replace(/```[\s\S]*?```/g, (block) =>
            block.replace(/```\w*\n?/g, "").replace(/```/g, ""),
        )
        .replace(/[*_`#>-]+/g, " ")
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

const buildReExplainFallback = ({ topic, style }) => {
    const title = String(topic?.title || "this lesson").trim();
    const content = String(topic?.content || "").trim();
    const intro =
        style === "Teach me like I'm 12"
            ? `Let's make "${title}" easier.\n\n`
            : style === "Use a real-world analogy"
                ? `Think of "${title}" like something you already know.\n\n`
                : style === "Make it more concise"
                    ? `Quick version of "${title}":\n\n`
                    : `Expanded take on "${title}":\n\n`;
    if (!content) {
        return `${intro}Open the lesson again after generation finishes, then retry re-explain.`;
    }
    const trimmed =
        style === "Make it more concise"
            ? content.slice(0, 1800)
            : content.slice(0, 4500);
    return `${intro}${trimmed}${content.length > trimmed.length ? "…" : ""}`;
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
                            `LESSON CONTEXT:\n"""\n${String(topic.content || "").slice(0, 6000)}\n"""\n\n` +
                            `SELECTED TEXT:\n"""\n${cleaned}\n"""`,
                    },
                ],
                temperature: 0.2,
                maxTokens: 700,
            });
            explanation =
                stripMarkdownLikeFormatting(llm?.text || "") ||
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

export const reExplainTopicContent = async ({ userId, topicId, style }) => {
    const topicPayload = await getTopicForUser(userId, topicId);
    const topic = topicPayload?.topic;
    if (!topic) {
        const error = new Error("Topic not found");
        error.status = 404;
        throw error;
    }

    const resolvedStyle = REEXPLAIN_STYLES.includes(style)
        ? style
        : "Teach me like I'm 12";
    let content = "";
    let backend = "fallback";

    if (isCourseAiEnabled()) {
        try {
            const llm = await callCourseLlmChat({
                messages: [
                    {
                        role: "system",
                        content:
                            "Rewrite the lesson content for the student using the requested style. " +
                            "Preserve the key facts. Keep section headings when present. Return plain text only.",
                    },
                    {
                        role: "user",
                        content:
                            `STYLE: ${resolvedStyle}\n\n` +
                            `TITLE: ${topic.title || ""}\n` +
                            `DESCRIPTION: ${topic.description || ""}\n` +
                            `CONTENT:\n"""\n${String(topic.content || "").slice(0, 10000)}\n"""`,
                    },
                ],
                temperature: 0.3,
                maxTokens: 3500,
            });
            content =
                stripMarkdownLikeFormatting(llm?.text || "") ||
                buildReExplainFallback({ topic, style: resolvedStyle });
            backend = llm?.provider || "llm";
        } catch (error) {
            console.warn("[topicExplain] re-explain failed; using fallback", {
                message: error?.message || String(error),
            });
            content = buildReExplainFallback({ topic, style: resolvedStyle });
        }
    } else {
        content = buildReExplainFallback({ topic, style: resolvedStyle });
    }

    return {
        content,
        style: resolvedStyle,
        backend,
    };
};
