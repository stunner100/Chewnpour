import { callCourseLlmChat, isCourseAiEnabled } from "./llmClient.js";
import { SOURCE_DATA_RULE, extractJsonObject, untrustedSourceBlock } from "./promptSafety.js";
import { dedupeCourseTopics, isValidMcq } from "./questionDedup.js";
import { sanitizeGeneratedHint } from "./hintSanitize.js";
import { pickTopicOrdering, snippetHasProcess } from "./processOrdering.js";
import { normalizeInLessonChecks } from "./inLessonChecks.js";
import { isTextGroundedInSource } from "./grounding.js";
import { segmentSource } from "./sourceSegments.js";
import {
    MAX_GENERATED_LESSONS,
    heuristicLessonPlan,
    lessonSourceText,
    planLessons,
} from "./lessonPlanning.js";
import { formatCourseTitle } from "../src/lib/courseTitle.js";
import { normalizeLessonKind, promptBlockForLessonKind } from "../src/lib/lessonKind.js";
import { lessonToMarkdown, normalizeLesson } from "../src/lib/lessonSchema.js";

// Course generation: split the extracted text into segments, plan lessons
// over all of them in document order (lessonPlanning.js), then write the first
// MAX_GENERATED_LESSONS lessons from their own source spans. The full plan is
// returned so the course can show which parts have no lesson yet.

const MAX_QUESTIONS_PER_TOPIC = 3;
// Extra grounded MCQs per topic reserved for the timed exam, so the exam is not
// a replay of topic-quiz questions whose answers the student has already seen.
export const MAX_EXAM_QUESTIONS_PER_TOPIC = 3;
const MAX_GENERATED_MCQS_PER_TOPIC = MAX_QUESTIONS_PER_TOPIC + MAX_EXAM_QUESTIONS_PER_TOPIC;
const TOPIC_GEN_CONCURRENCY = 3;
const GENERATION_TIMEOUT_MS = Number(process.env.COURSE_GENERATION_TIMEOUT_MS || 150000);

const LESSON_JSON_SHAPE =
    '{"hook":"string","sections":[{"title":"string","role":"core|steps|example|misconception|practice","body":"markdown","sourceQuote":"string"}],"recap":[{"prompt":"string","answer":"string"}],"wordBank":[{"term":"string","definition":"string"}]}';

const CHECK_JSON_SHAPE =
    '{"sectionIndex":0,"questionType":"multiple_choice","prompt":"string","options":["A","B","C","D"],"correctIndex":0,"explanation":"string","hint":"string"}';

const MCQ_JSON_SHAPE =
    '{"prompt":"string","options":["A","B","C","D"],"correctIndex":0,"explanation":"string","hint":"string"}';

// How a lesson is written. Shared by the per-topic and single-pass prompts.
const LESSON_WRITING_RULES = [
    "Write the lesson as 3-6 sections, fewer when the source is short.",
    "Each section title says what that section teaches, in plain words (for example \"Where a prokaryote keeps its DNA\"). Never use generic titles such as Why This Matters, Key Terms, Introduction, Overview, The Idea, Summary or Recap.",
    "Give each section a role. At least one section is core (explains the material). Use steps (a process the learner performs, as a numbered list), example (a concrete case from the source), misconception (a mistake students make, then the correct account) or practice (a short task to try) only when the source supports that section; otherwise leave it out.",
    "Never invent examples, events, numbers, opposing views or mistakes that the source does not contain.",
    "A section body is markdown: paragraphs, lists, tables or code blocks as the material needs. Use ### for a sub-heading; never # or ## inside a body. Write for a student, in plain language.",
    "sourceQuote is a short phrase copied word for word from the source that the section rests on.",
    "hook is one sentence on why the topic matters, only if the source gives a reason; otherwise an empty string.",
    "recap is 3-4 short recall questions about the lesson, each with a one-line answer.",
    "wordBank lists 4-8 terms from the source with plain definitions. Bold each term where it first appears in a section body.",
].join(" ");

// A lesson made of one source excerpt, for topics the model could not write.
export const excerptLesson = (title, text) => ({
    hook: "",
    sections: [{ title: String(title || "Lesson").slice(0, 120), role: "core", body: String(text || "").trim() }],
    recap: [],
    wordBank: [],
});

const normalizeWhitespace = (value = "") =>
    String(value || "").replace(/\s+/g, " ").trim();

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

const NO_TEXT_MESSAGE =
    "This course was created from an uploaded file, but no extractable text was found. Re-upload a text-based PDF/DOCX, or use a cloud OCR service for scanned pages.";

// Without the model there is no way to write distractors that are verifiably
// false, so heuristic topics ship as lessons only: no quiz, no in-lesson checks.
// The plan groups segments by heading and size; each lesson is its source text.
export const heuristicCurriculum = ({ fileName, segments }) => {
    if (!segments.length) {
        const title = formatCourseTitle(fileName) || "Study material";
        return {
            backend: "heuristic",
            plan: [],
            topics: [{
                title,
                description: "No text could be extracted from this file.",
                lesson: excerptLesson(title, NO_TEXT_MESSAGE),
                questions: [],
                inLessonChecks: [],
                orderingCheck: null,
            }],
        };
    }
    const plan = heuristicLessonPlan(segments);
    const topics = plan.slice(0, MAX_GENERATED_LESSONS).map((entry, planIndex) => {
        const text = lessonSourceText(entry, segments);
        return {
            title: entry.title,
            description: normalizeWhitespace(text.replace(/^\s{0,3}#{1,6}\s.*$/gm, "")).slice(0, 280),
            lesson: excerptLesson(entry.title, text),
            questions: [],
            inLessonChecks: [],
            orderingCheck: null,
            planIndex,
        };
    });
    return { backend: "heuristic", plan, topics: dedupeCourseTopics(topics) };
};

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

const normalizeTopicQuestions = (item, { title, lesson, sourceText = "" }) => {
    const questions = [];
    const questionItems = Array.isArray(item?.questions) ? item.questions : [];
    for (const question of questionItems) {
        if (questions.length >= MAX_GENERATED_MCQS_PER_TOPIC) break;
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
        // Gate hallucinated answers: the correct option must be grounded in the
        // source document, not invented by the model.
        if (!isTextGroundedInSource(candidate.options[candidate.correctIndex], sourceText)) continue;
        questions.push({
            ...candidate,
            hint: sanitizeMcqHint(candidate),
        });
    }

    const ordering = pickTopicOrdering(item?.ordering || item?.orderingCheck, {
        content: lessonToMarkdown(lesson),
        questions,
    });
    const quizPrompts = questions.map((question) => question.prompt);
    // The first MAX_QUESTIONS_PER_TOPIC valid MCQs are the topic quiz; the rest
    // are held back for the timed exam.
    let quizCount = 0;
    const inLessonChecks = normalizeInLessonChecks(item?.inLessonChecks, {
        lesson,
        title,
        quizPrompts,
        ordering,
    });
    return {
        questions: questions.map((question) => {
            const isQuiz = quizCount < MAX_QUESTIONS_PER_TOPIC;
            if (isQuiz) quizCount += 1;
            return {
                ...question,
                surface: isQuiz ? "quiz" : "exam",
                questionType: question.questionType || "multiple_choice",
            };
        }),
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
        const title = normalizeWhitespace(item?.title).slice(0, 180);
        const lesson = normalizeLesson(item?.lesson);
        if (!title || !lesson) continue;
        const { questions, orderingCheck, inLessonChecks } = normalizeTopicQuestions(item, {
            title,
            lesson,
            sourceText: extractedText,
        });
        topics.push({
            title,
            description: normalizeWhitespace(item?.description || lesson.hook || lesson.sections[0].body).slice(0, 280),
            lesson,
            questions,
            inLessonChecks,
            orderingCheck,
            ...(Number.isInteger(item?.planIndex) ? { planIndex: item.planIndex } : {}),
        });
    }

    if (topics.length === 0) {
        return heuristicCurriculum({ fileName, segments: segmentSource(extractedText).segments });
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

const generateOneTopic = async ({
    chat,
    fileName,
    title,
    description,
    snippet,
    kind = null,
    previousQuestions = [],
}) => {
    const lessonKind = normalizeLessonKind(kind) || "concept";
    const allowOrdering =
        lessonKind === "procedure" ||
        lessonKind === "narrative" ||
        snippetHasProcess(snippet);
    const previous = (Array.isArray(previousQuestions) ? previousQuestions : [])
        .filter(Boolean)
        .slice(-12);
    const system = [
        "You are ChewnPour's study lesson writer.",
        "Return ONLY valid JSON with this shape:",
        `{"lesson":${LESSON_JSON_SHAPE},"questions":[${MCQ_JSON_SHAPE}],"inLessonChecks":[${CHECK_JSON_SHAPE}],"ordering":null}`,
        "The source is this lesson's part of the uploaded document, given below.",
        LESSON_WRITING_RULES,
        promptBlockForLessonKind(lessonKind),
        `Create ${MAX_QUESTIONS_PER_TOPIC + 1}-${MAX_GENERATED_MCQS_PER_TOPIC} distinct multiple-choice questions from THIS source text only in questions[]. The first ${MAX_QUESTIONS_PER_TOPIC} are the topic quiz; the rest are held back for the course exam, so each must test a different fact.`,
        "Also create inLessonChecks: at most one per section, cap 4, none on a practice section. sectionIndex is the 0-based index in lesson.sections of the section the check tests. questionType may be multiple_choice or true_false (options True/False).",
        "correctIndex must point at the correct option. Options must be unique. Prompts must not restate the topic title.",
        "inLessonChecks must not duplicate the topic-quiz questions.",
        "Hints must not name the correct option, unique answer terms, a true/false verdict, or the ordered steps.",
        allowOrdering
            ? 'If the source describes a process or sequence, include at most one ordering check in inLessonChecks or set ordering to {"prompt":"string","stepsInOrder":["step 1","step 2","step 3"],"explanation":"string","hint":"string","sectionIndex":0} with exactly 3 source-backed steps and the sectionIndex of the section that teaches the process. Otherwise set ordering to null.'
            : "Set ordering to null. Do not invent a process check.",
        "Do not invent facts that are absent from the source text.",
        SOURCE_DATA_RULE,
        previous.length
            ? `Do not repeat or paraphrase any of these existing questions: ${JSON.stringify(previous)}`
            : "",
    ]
        .filter(Boolean)
        .join(" ");

    const result = await chat({
        messages: [
            { role: "system", content: system },
            {
                role: "user",
                content: [
                    `Source file name: ${fileName || "upload"}`,
                    `Topic title: ${title}`,
                    `Topic description: ${description || title}`,
                    "",
                    untrustedSourceBlock(snippet, "Lesson source text"),
                ].join("\n"),
            },
        ],
        temperature: previous.length ? 0.35 : 0.2,
        maxTokens: 4096,
        responseFormat: "json_object",
        run: { purpose: previous.length ? "lesson_questions_retry" : "lesson", label: title },
    });
    const parsed = extractJsonObject(result.text);
    if (!parsed) {
        throw new Error("AI returned non-JSON topic payload.");
    }
    return parsed;
};

// Writes the first MAX_GENERATED_LESSONS planned lessons, each from its full
// source span. Every topic keeps the index of its plan entry.
const writeLessons = async ({ chat, fileName, extractedText, segments, plan, provider, model }) => {
    const lessons = plan.slice(0, MAX_GENERATED_LESSONS);
    const snippets = lessons.map((entry) => lessonSourceText(entry, segments));

    let failedLessons = 0;
    const generated = await mapWithConcurrency(
        lessons,
        TOPIC_GEN_CONCURRENCY,
        async (topic, index) => {
            try {
                return await generateOneTopic({
                    chat,
                    fileName,
                    title: topic.title,
                    snippet: snippets[index],
                    kind: topic.kind,
                });
            } catch (error) {
                failedLessons += 1;
                console.warn("[aiCourseGeneration] topic generation failed", {
                    title: topic.title,
                    message: error?.message || String(error),
                });
                return {
                    lesson: excerptLesson(topic.title, snippets[index]),
                    questions: [],
                    inLessonChecks: [],
                    ordering: null,
                };
            }
        },
    );

    // Nothing the model wrote survived: this is the heuristic course.
    if (failedLessons === lessons.length) {
        return { ...heuristicCurriculum({ fileName, segments }), backend: "heuristic_fallback" };
    }

    const assembled = {
        topics: lessons.map((topic, index) => ({
            title: topic.title,
            lesson: generated[index]?.lesson,
            questions: generated[index]?.questions,
            inLessonChecks: generated[index]?.inLessonChecks,
            ordering: generated[index]?.ordering,
            planIndex: index,
        })),
    };

    const backend = provider || "ai";
    let normalized = normalizeAiCoursePayload(assembled, { fileName, extractedText, backend });
    if (normalized.backend === "heuristic") return heuristicCurriculum({ fileName, segments });

    for (let index = 0; index < normalized.topics.length; index += 1) {
        const topic = normalized.topics[index];
        const mcqCount = (topic.questions || []).filter(
            (question) => question.questionType !== "ordering" && question.surface !== "exam",
        ).length;
        if (mcqCount >= 2) continue;
        try {
            const extra = await generateOneTopic({
                chat,
                fileName,
                title: topic.title,
                description: topic.description,
                snippet: snippets[topic.planIndex],
                kind: lessons[topic.planIndex]?.kind,
                previousQuestions: collectPrompts(normalized.topics),
            });
            // Checks bind by section index, so they must come from the same
            // lesson they were written for.
            const useExtraLesson = Boolean(normalizeLesson(extra.lesson));
            const merged = normalizeAiCoursePayload(
                {
                    topics: [
                        {
                            ...topic,
                            lesson: useExtraLesson ? extra.lesson : topic.lesson,
                            questions: [
                                ...(topic.questions || []).filter(
                                    (question) => question.questionType !== "ordering" && question.surface !== "in_lesson",
                                ),
                                ...(Array.isArray(extra.questions) ? extra.questions : []),
                            ],
                            inLessonChecks: useExtraLesson ? extra.inLessonChecks : topic.inLessonChecks,
                            ordering: useExtraLesson ? extra.ordering : topic.orderingCheck,
                        },
                    ],
                },
                { fileName, extractedText, backend },
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
        model,
        plan,
    };
    return normalized;
};

const notifyProgress = (onProgress, stage) => {
    if (typeof onProgress !== "function") return;
    Promise.resolve()
        .then(() => onProgress(stage))
        .catch(() => {});
};

const raceWithDeadline = (promise, { fallback, timeoutMs, onTimeout }) =>
    new Promise((resolve) => {
        let settled = false;
        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            console.warn(`[aiCourseGeneration] generation exceeded ${timeoutMs}ms; using heuristic fallback`);
            onTimeout?.();
            resolve(fallback());
        }, Math.max(1000, Number(timeoutMs) || GENERATION_TIMEOUT_MS));
        const finish = (value) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve(value);
        };
        Promise.resolve(promise).then(finish, () => finish(fallback()));
    });

// onProgress(stage) is best-effort: "writing" fires once the lesson plan
// exists and lessons and questions are being written. runContext ({ userId,
// courseId, uploadId }) is attached to every model call's usage record. chat,
// aiEnabled and timeoutMs default to the live providers; regression scripts
// stub them.
export const generateCourseCurriculumWithAi = async ({
    fileName,
    extractedText,
    onProgress,
    runContext = {},
    chat = callCourseLlmChat,
    aiEnabled = isCourseAiEnabled,
    timeoutMs = GENERATION_TIMEOUT_MS,
}) => {
    const text = String(extractedText || "").trim();
    const { segments } = segmentSource(text);
    if (!segments.length || !aiEnabled()) {
        return heuristicCurriculum({ fileName, segments });
    }
    const fallback = () => ({ ...heuristicCurriculum({ fileName, segments }), backend: "heuristic_timeout" });
    // Calls still running at the deadline are cancelled, not left to bill.
    const controller = new AbortController();
    const tracedChat = (args) => chat({
        ...args,
        signal: controller.signal,
        run: { ...runContext, ...(args.run || {}) },
    });

    const work = (async () => {
        let planned;
        try {
            planned = await planLessons({ chat: tracedChat, segments, fileName });
        } catch (error) {
            console.warn("[aiCourseGeneration] lesson plan failed; grouping by headings", {
                message: error?.message || String(error),
            });
            planned = { plan: heuristicLessonPlan(segments), provider: null, model: null };
        }
        notifyProgress(onProgress, "writing");
        return writeLessons({
            chat: tracedChat,
            fileName,
            extractedText: text,
            segments,
            plan: planned.plan,
            provider: planned.provider,
            model: planned.model,
        });
    })();

    return raceWithDeadline(work, { fallback, timeoutMs, onTimeout: () => controller.abort() });
};
