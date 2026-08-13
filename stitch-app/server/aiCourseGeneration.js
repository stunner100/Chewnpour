import { callCourseLlmChat, isCourseAiEnabled } from "./llmClient.js";
import {
    buildQuestionsForTopic,
    buildTopicsFromExtractedText,
} from "./courseGeneration.js";
import { dedupeCourseTopics, isValidMcq } from "./questionDedup.js";
import { sanitizeGeneratedHint } from "./hintSanitize.js";
import { pickTopicOrdering, snippetHasProcess } from "./processOrdering.js";
import { normalizeInLessonChecks } from "./inLessonChecks.js";
import {
    splitMarkdownIntoSections,
    eligibleLessonSectionTitles,
} from "../src/lib/lessonSections.js";

const MAX_SOURCE_CHARS = 12000;
const MAX_TOPICS = 5;
const MAX_QUESTIONS_PER_TOPIC = 3;
const MAX_TOPIC_CONTENT_CHARS = 8000;
const TOPIC_SNIPPET_CHARS = 2500;
const TOPIC_GEN_CONCURRENCY = 3;
const STEPPER_SECTION_TITLES = [
    "Simple Introduction",
    "Key Ideas in Plain English",
    "Step-by-Step Breakdown",
    "Worked Example",
    "Common Mistakes and Misconceptions",
    "Everyday Analogy",
    "Practical Use Cases",
    "Word Bank",
    "Summary",
];

const normalizeWhitespace = (value = "") =>
    String(value || "").replace(/\s+/g, " ").trim();

export const extractJsonObject = (raw = "") => {
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

export const mapWithConcurrency = async (items, limit, mapper) => {
    const list = Array.isArray(items) ? items : [];
    const results = new Array(list.length);
    let nextIndex = 0;
    const workerCount = Math.max(1, Math.min(Number(limit) || 1, list.length || 1));
    const workers = Array.from({ length: workerCount }, async () => {
        while (nextIndex < list.length) {
            const index = nextIndex;
            nextIndex += 1;
            results[index] = await mapper(list[index], index);
        }
    });
    await Promise.all(workers);
    return results;
};

export const sliceSourceForTopic = (source, { title = "", focus = "", index = 0, total = 1 } = {}) => {
    const text = String(source || "");
    if (!text) return "";
    const needles = [focus, title]
        .map((value) => normalizeWhitespace(value))
        .filter((value) => value.length >= 4);
    for (const needle of needles) {
        const at = text.toLowerCase().indexOf(needle.toLowerCase());
        if (at >= 0) {
            const start = Math.max(0, at - 200);
            return text.slice(start, start + TOPIC_SNIPPET_CHARS);
        }
    }
    const count = Math.max(1, Number(total) || 1);
    const sliceSize = Math.max(TOPIC_SNIPPET_CHARS, Math.ceil(text.length / count));
    const start = Math.min(text.length, Math.max(0, Number(index) || 0) * sliceSize);
    return text.slice(start, start + sliceSize);
};

const heuristicTopics = ({ fileName, extractedText }) =>
    buildTopicsFromExtractedText({ fileName, extractedText }).map((topic) => {
        const quizQuestions = buildQuestionsForTopic({
            topicTitle: topic.title,
            topicContent: topic.content,
            limit: MAX_QUESTIONS_PER_TOPIC,
        }).map((question) => ({
            ...question,
            questionType: "multiple_choice",
            surface: "quiz",
            payload: {},
        }));
        const sections = eligibleLessonSectionTitles(splitMarkdownIntoSections(topic.content));
        const inLessonChecks = normalizeInLessonChecks(
            sections.slice(0, 4).map((sectionTitle, index) => {
                const generated = buildQuestionsForTopic({
                    topicTitle: sectionTitle,
                    topicContent: topic.content,
                    limit: 1,
                })[0];
                if (!generated) return null;
                return {
                    ...generated,
                    sectionTitle,
                    questionType: "multiple_choice",
                    sortOrder: index,
                };
            }).filter(Boolean),
            {
                content: topic.content,
                title: topic.title,
                quizPrompts: quizQuestions.map((question) => question.prompt),
            },
        );
        return {
            ...topic,
            questions: quizQuestions,
            inLessonChecks,
            orderingCheck: null,
        };
    });

const sanitizeMcqHint = (question) =>
    sanitizeGeneratedHint({
        hint: question?.hint,
        questionType: "multiple_choice",
        options: question?.options,
        correctIndex: question?.correctIndex,
        answer: Array.isArray(question?.options)
            ? question.options[question?.correctIndex]
            : "",
    });

const normalizeTopicQuestions = (item, { title, content }) => {
    const questions = [];
    const questionItems = Array.isArray(item?.questions) ? item.questions : [];
    for (const question of questionItems) {
        if (questions.length >= MAX_QUESTIONS_PER_TOPIC) break;
        if (question?.questionType === "ordering") continue;
        const prompt = normalizeWhitespace(question?.prompt || question?.question);
        const options = normalizeOptions(question?.options);
        const correctIndex = Number(question?.correctIndex);
        const candidate = {
            prompt: prompt.slice(0, 400),
            options,
            correctIndex,
            explanation: normalizeWhitespace(question?.explanation).slice(0, 500),
            hint: String(question?.hint || "").trim().slice(0, 280),
            questionType: "multiple_choice",
            payload: {},
            sortOrder: questions.length,
        };
        if (!isValidMcq(candidate, { title })) continue;
        questions.push({
            ...candidate,
            hint: sanitizeMcqHint(candidate),
        });
    }

    if (questions.length === 0) {
        questions.push(
            ...buildQuestionsForTopic({
                topicTitle: title,
                topicContent: content,
                limit: MAX_QUESTIONS_PER_TOPIC,
            }).map((question) => ({
                ...question,
                questionType: "multiple_choice",
                payload: {},
                hint: sanitizeMcqHint(question),
            })),
        );
    }

    const ordering = pickTopicOrdering(item?.ordering || item?.orderingCheck, {
        content,
        questions,
    });
    const quizPrompts = questions.map((question) => question.prompt);
    const inLessonChecks = normalizeInLessonChecks(item?.inLessonChecks, {
        content,
        title,
        quizPrompts,
        ordering,
    });
    return {
        questions: questions.map((question) => ({
            ...question,
            surface: "quiz",
            questionType: question.questionType || "multiple_choice",
        })),
        inLessonChecks,
        orderingCheck: inLessonChecks.find((check) => check.questionType === "ordering") || null,
    };
};

export const normalizeAiCoursePayload = (
    payload,
    { fileName = "", extractedText = "", backend = "deepseek" } = {},
) => {
    const topicsInput = Array.isArray(payload?.topics) ? payload.topics : [];
    const topics = [];

    for (const item of topicsInput) {
        if (topics.length >= MAX_TOPICS) break;
        const title = normalizeWhitespace(item?.title).slice(0, 180);
        const content = String(item?.content || "").trim().slice(0, MAX_TOPIC_CONTENT_CHARS);
        if (!title || content.length < 40) continue;
        const { questions, orderingCheck, inLessonChecks } = normalizeTopicQuestions(item, { title, content });
        topics.push({
            title,
            description: normalizeWhitespace(item?.description || content).slice(0, 280),
            content,
            questions,
            inLessonChecks,
            orderingCheck,
        });
    }

    if (topics.length === 0) {
        return {
            backend: "heuristic",
            topics: dedupeCourseTopics(heuristicTopics({ fileName, extractedText })),
        };
    }

    return {
        backend,
        topics: dedupeCourseTopics(topics),
    };
};

const collectPrompts = (topics) =>
    (Array.isArray(topics) ? topics : []).flatMap((topic) =>
        (Array.isArray(topic?.questions) ? topic.questions : [])
            .filter((question) => question?.questionType !== "ordering")
            .map((question) => question.prompt),
    );

const parseOutlinePayload = (parsed) => {
    const topics = (Array.isArray(parsed?.topics) ? parsed.topics : [])
        .map((item) => ({
            title: normalizeWhitespace(item?.title).slice(0, 180),
            description: normalizeWhitespace(item?.description).slice(0, 280),
            focus: normalizeWhitespace(item?.focus || item?.sourceSpan || item?.span).slice(0, 280),
        }))
        .filter((item) => item.title)
        .slice(0, MAX_TOPICS);
    return topics.length >= 2 ? topics : null;
};

const generateOutline = async ({ fileName, clipped }) => {
    const result = await callCourseLlmChat({
        messages: [
            {
                role: "system",
                content: [
                    "You are ChewnPour's study curriculum planner.",
                    "Return ONLY valid JSON with this shape:",
                    '{"topics":[{"title":"string","description":"string","focus":"short source phrase this topic owns"}]}',
                    `Create 3-${MAX_TOPICS} topics grounded only in the source text.`,
                    "Each focus must be a distinctive heading, term, or sentence span from the source.",
                    "Do not write the lesson body yet.",
                ].join(" "),
            },
            {
                role: "user",
                content: [`Source file name: ${fileName || "upload"}`, "", "Source text:", clipped].join("\n"),
            },
        ],
        temperature: 0.2,
        maxTokens: 1200,
        responseFormat: "json_object",
    });
    const parsed = extractJsonObject(result.text);
    const topics = parseOutlinePayload(parsed);
    if (!topics) {
        throw new Error("AI returned an unusable topic outline.");
    }
    return { topics, provider: result.provider || "deepseek", model: result.model };
};

const generateOneTopic = async ({
    fileName,
    title,
    description,
    snippet,
    previousQuestions = [],
}) => {
    const allowOrdering = snippetHasProcess(snippet);
    const previous = (Array.isArray(previousQuestions) ? previousQuestions : [])
        .filter(Boolean)
        .slice(-12);
    const system = [
        "You are ChewnPour's study lesson writer.",
        "Return ONLY valid JSON with this shape:",
        '{"content":"markdown lesson string","questions":[{"prompt":"string","options":["A","B","C","D"],"correctIndex":0,"explanation":"string","hint":"string"}],"inLessonChecks":[{"sectionTitle":"string","questionType":"multiple_choice","prompt":"string","options":["A","B","C","D"],"correctIndex":0,"explanation":"string","hint":"string"}],"ordering":null}',
        "Write a full grounded lesson in markdown: at least four paragraphs plus headings. Do not shrink the lesson to three sentences or flashcards.",
        `Use these H2 titles where they fit: ${STEPPER_SECTION_TITLES.join(", ")}.`,
        "Do not write a Quick Check Q/A section.",
        `Create 2-${MAX_QUESTIONS_PER_TOPIC} topic-quiz multiple-choice questions from THIS snippet only in questions[].`,
        "Also create inLessonChecks: at most one check per major H2 (not Word Bank or Summary), cap 4. questionType may be multiple_choice or true_false (options True/False).",
        "correctIndex must point at the correct option. Options must be unique. Prompts must not restate the topic title.",
        "inLessonChecks must not duplicate the topic-quiz questions.",
        "Hints must not name the correct option, unique answer terms, a true/false verdict, or the ordered steps.",
        allowOrdering
            ? 'If the snippet describes a process or sequence, include at most one ordering check in inLessonChecks or set ordering to {"prompt":"string","stepsInOrder":["step 1","step 2","step 3"],"explanation":"string","hint":"string","sectionTitle":"Step-by-Step Breakdown"} with exactly 3 source-backed steps. Otherwise set ordering to null.'
            : "Set ordering to null. Do not invent a process check.",
        "Do not invent facts that are absent from the snippet.",
        previous.length
            ? `Do not repeat or paraphrase any of these existing questions: ${JSON.stringify(previous)}`
            : "",
    ]
        .filter(Boolean)
        .join(" ");

    const result = await callCourseLlmChat({
        messages: [
            { role: "system", content: system },
            {
                role: "user",
                content: [
                    `Source file name: ${fileName || "upload"}`,
                    `Topic title: ${title}`,
                    `Topic description: ${description || title}`,
                    "",
                    "Topic source snippet:",
                    snippet,
                ].join("\n"),
            },
        ],
        temperature: previous.length ? 0.35 : 0.2,
        maxTokens: 4096,
        responseFormat: "json_object",
    });
    const parsed = extractJsonObject(result.text);
    if (!parsed) {
        throw new Error("AI returned non-JSON topic payload.");
    }
    return parsed;
};

const generateCurriculumFromOutline = async ({ fileName, extractedText, outline, clipped }) => {
    const snippets = outline.topics.map((topic, index) =>
        sliceSourceForTopic(clipped, {
            title: topic.title,
            focus: topic.focus,
            index,
            total: outline.topics.length,
        }) || extractedText.slice(0, TOPIC_SNIPPET_CHARS),
    );

    const generated = await mapWithConcurrency(
        outline.topics,
        TOPIC_GEN_CONCURRENCY,
        async (topic, index) => {
            try {
                return await generateOneTopic({
                    fileName,
                    title: topic.title,
                    description: topic.description,
                    snippet: snippets[index],
                });
            } catch (error) {
                console.warn("[aiCourseGeneration] topic generation failed", {
                    title: topic.title,
                    message: error?.message || String(error),
                });
                return {
                    content: snippets[index] || `## ${topic.title}\n\n${topic.description}`,
                    questions: [],
                    inLessonChecks: [],
                    ordering: null,
                };
            }
        },
    );

    const assembled = {
        topics: outline.topics.map((topic, index) => ({
            title: topic.title,
            description: topic.description,
            content: generated[index]?.content,
            questions: generated[index]?.questions,
            inLessonChecks: generated[index]?.inLessonChecks,
            ordering: generated[index]?.ordering,
        })),
    };

    let normalized = normalizeAiCoursePayload(assembled, {
        fileName,
        extractedText,
        backend: outline.provider || "deepseek",
    });

    for (let index = 0; index < normalized.topics.length; index += 1) {
        const topic = normalized.topics[index];
        const mcqCount = (topic.questions || []).filter(
            (question) => question.questionType !== "ordering",
        ).length;
        if (mcqCount >= 2) continue;
        try {
            const extra = await generateOneTopic({
                fileName,
                title: topic.title,
                description: topic.description,
                snippet: snippets[index],
                previousQuestions: collectPrompts(normalized.topics),
            });
            const merged = normalizeAiCoursePayload(
                {
                    topics: [
                        {
                            ...topic,
                            content: extra.content || topic.content,
                            questions: [
                                ...(topic.questions || []).filter(
                                    (question) => question.questionType !== "ordering" && question.surface !== "in_lesson",
                                ),
                                ...(Array.isArray(extra.questions) ? extra.questions : []),
                            ],
                            inLessonChecks: extra.inLessonChecks || topic.inLessonChecks,
                            ordering: extra.ordering || topic.orderingCheck,
                        },
                    ],
                },
                { fileName, extractedText, backend: outline.provider || "deepseek" },
            );
            if (merged.topics[0]) {
                normalized.topics[index] = merged.topics[0];
            }
        } catch (error) {
            console.warn("[aiCourseGeneration] serial question regen failed", {
                title: topic.title,
                message: error?.message || String(error),
            });
        }
    }

    normalized = {
        ...normalized,
        topics: dedupeCourseTopics(normalized.topics),
        model: outline.model,
    };
    return normalized;
};

const generateCurriculumSinglePass = async ({ fileName, extractedText, clipped }) => {
    const system = [
        "You are ChewnPour's study curriculum generator.",
        "Return ONLY valid JSON with this shape:",
        '{"topics":[{"title":"string","description":"string","content":"markdown lesson string","questions":[{"prompt":"string","options":["A","B","C","D"],"correctIndex":0,"explanation":"string","hint":"string"}],"inLessonChecks":[{"sectionTitle":"string","questionType":"multiple_choice","prompt":"string","options":["A","B","C","D"],"correctIndex":0,"explanation":"string","hint":"string"}],"ordering":null}]}',
        `Create 3-${MAX_TOPICS} topics grounded only in the source text.`,
        `Each topic needs 2-${MAX_QUESTIONS_PER_TOPIC} topic-quiz multiple-choice questions in questions[].`,
        `Use these H2 titles where they fit: ${STEPPER_SECTION_TITLES.join(", ")}. Do not write Quick Check Q/A pairs.`,
        "Write full markdown lessons, at least four paragraphs each. Do not shrink lessons to three sentences.",
        "Also include inLessonChecks: at most one check per major H2, cap 4, distinct from the quiz bank.",
        "correctIndex must point at the correct option. Options must be unique.",
        "If a topic describes a process, include at most one ordering check; otherwise set ordering to null.",
        "Hints must not leak answers.",
        "Do not invent facts that are absent from the source.",
    ].join(" ");

    const result = await callCourseLlmChat({
        messages: [
            { role: "system", content: system },
            {
                role: "user",
                content: [`Source file name: ${fileName || "upload"}`, "", "Source text:", clipped].join("\n"),
            },
        ],
        temperature: 0.2,
        maxTokens: 4096,
        responseFormat: "json_object",
    });
    const parsed = extractJsonObject(result.text);
    if (!parsed) {
        throw new Error("AI returned non-JSON curriculum payload.");
    }
    const normalized = normalizeAiCoursePayload(parsed, {
        fileName,
        extractedText,
        backend: result.provider || "deepseek",
    });
    return {
        ...normalized,
        backend:
            normalized.backend === "heuristic"
                ? `${result.provider || "deepseek"}_fallback_heuristic`
                : result.provider || normalized.backend,
        model: result.model,
    };
};

export const generateCourseCurriculumWithAi = async ({ fileName, extractedText }) => {
    const text = String(extractedText || "").trim();
    if (!text) {
        return {
            backend: "heuristic",
            topics: heuristicTopics({ fileName, extractedText: "" }),
        };
    }

    if (!isCourseAiEnabled()) {
        return {
            backend: "heuristic",
            topics: dedupeCourseTopics(heuristicTopics({ fileName, extractedText: text })),
        };
    }

    const clipped = text.slice(0, MAX_SOURCE_CHARS);

    try {
        const outline = await generateOutline({ fileName, clipped });
        return await generateCurriculumFromOutline({
            fileName,
            extractedText: text,
            outline,
            clipped,
        });
    } catch (outlineError) {
        console.warn("[aiCourseGeneration] outline failed; using single-pass curriculum", {
            message: outlineError?.message || String(outlineError),
        });
        try {
            return await generateCurriculumSinglePass({
                fileName,
                extractedText: text,
                clipped,
            });
        } catch (error) {
            console.warn("[aiCourseGeneration] falling back to heuristic curriculum", {
                message: error?.message || String(error),
            });
            return {
                backend: "heuristic_fallback",
                topics: dedupeCourseTopics(heuristicTopics({ fileName, extractedText: text })),
                error: error?.message || String(error),
            };
        }
    }
};
