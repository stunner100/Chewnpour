import { LlmAbortedError, LlmTruncatedError, callCourseLlmChat, isCourseAiEnabled } from "./llmClient.js";
import { SOURCE_DATA_RULE, extractJsonObject, untrustedSourceBlock } from "./promptSafety.js";
import { dedupeCourseTopics, isNearDuplicatePrompt, isValidMcq } from "./questionDedup.js";
import { sanitizeGeneratedHint } from "./hintSanitize.js";
import { pickTopicOrdering, snippetHasProcess } from "./processOrdering.js";
import { normalizeInLessonChecks } from "./inLessonChecks.js";
import { isTextGroundedInSource } from "./grounding.js";
import { groundLesson } from "./lessonGrounding.js";
import { segmentSource } from "./sourceSegments.js";
import {
    MAX_GENERATED_LESSONS,
    heuristicLessonPlan,
    lessonSourceText,
    planLessons,
} from "./lessonPlanning.js";
import { formatCourseTitle } from "../src/lib/courseTitle.js";
import { promptBlockForLessonKind } from "../src/lib/lessonKind.js";
import { lessonToMarkdown, normalizeLesson } from "../src/lib/lessonSchema.js";

// Course generation, one step at a time for the background job
// (generationJobs.js): planCourse splits the extracted text into segments and
// plans lessons over all of them in document order (lessonPlanning.js);
// writePlannedLesson writes one planned lesson from its own source span: one
// call writes the lesson, a second writes its quiz and in-lesson checks.

const MAX_QUESTIONS_PER_TOPIC = 3;
// Extra grounded MCQs per topic reserved for the timed exam, so the exam is not
// a replay of topic-quiz questions whose answers the student has already seen.
export const MAX_EXAM_QUESTIONS_PER_TOPIC = 3;
const MAX_GENERATED_MCQS_PER_TOPIC = MAX_QUESTIONS_PER_TOPIC + MAX_EXAM_QUESTIONS_PER_TOPIC;
const LESSON_MAX_TOKENS = 6000;
const QUESTIONS_MAX_TOKENS = 3000;
// A reply cut off at max_tokens is retried once with this much more room.
const TRUNCATION_RETRY_FACTOR = 1.6;

const LESSON_JSON_SHAPE =
    '{"hook":"string","sections":[{"title":"string","role":"core|steps|example|misconception|practice","body":"markdown","sourceQuote":"string"}],"recap":[{"prompt":"string","answer":"string"}],"wordBank":[{"term":"string","definition":"string"}]}';

const CHECK_JSON_SHAPE =
    '{"sectionIndex":0,"questionType":"multiple_choice","prompt":"string","options":["A","B","C","D"],"correctIndex":0,"explanation":"string","hint":"string"}';

const MCQ_JSON_SHAPE =
    '{"prompt":"string","options":["A","B","C","D"],"correctIndex":0,"explanation":"string","hint":"string"}';

// How a lesson is written.
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

// A lesson made of one source excerpt, for the course built without the model.
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
        content: sourceText || lessonToMarkdown(lesson),
        questions,
    });
    const quizPrompts = questions.map((question) => question.prompt);
    // The first MAX_QUESTIONS_PER_TOPIC valid MCQs are the topic quiz; the rest
    // are held back for the timed exam.
    let quizCount = 0;
    const inLessonChecks = normalizeInLessonChecks(item?.inLessonChecks, {
        lesson,
        sourceText,
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

// One model-written topic, checked against its source text: the lesson's
// unsupported optional sections and terms are dropped (lessonGrounding.js),
// MCQs, checks and ordering steps must be supported by the source, MCQs are
// split into quiz and exam, and checks bind to the lesson's sections.
// Returns null when the lesson is unusable.
export const normalizeAiTopic = (item, { sourceText = "" } = {}) => {
    const title = normalizeWhitespace(item?.title).slice(0, 180);
    const written = normalizeLesson(item?.lesson);
    if (!title || !written) return null;
    const { lesson, report } = groundLesson(written, sourceText);
    const { questions, orderingCheck, inLessonChecks } = normalizeTopicQuestions(item, {
        title,
        lesson,
        sourceText,
    });
    return {
        title,
        description: normalizeWhitespace(item?.description || lesson.hook || lesson.sections[0].body).slice(0, 280),
        lesson,
        questions,
        inLessonChecks,
        orderingCheck,
        grounding: report,
        ...(Number.isInteger(item?.planIndex) ? { planIndex: item.planIndex } : {}),
    };
};

// De-duplication can drop questions, so the quiz/exam split is made after it:
// the first MAX_QUESTIONS_PER_TOPIC MCQs left in a topic are its quiz, the
// rest go to the exam.
const splitQuizAndExam = (topic) => {
    let quizCount = 0;
    return {
        ...topic,
        questions: (topic.questions || []).map((question) => {
            if (question.questionType === "ordering") return question;
            const isQuiz = quizCount < MAX_QUESTIONS_PER_TOPIC;
            if (isQuiz) quizCount += 1;
            return { ...question, surface: isQuiz ? "quiz" : "exam" };
        }),
    };
};

const dedupeAndSplitQuestions = (topics) => dedupeCourseTopics(topics).map(splitQuizAndExam);

// One lesson written on its own: de-duplicated within itself and against the
// prompts already in its course, then split.
const splitTopicQuestions = (topic, existingPrompts = []) => {
    const [deduped] = dedupeCourseTopics([topic]);
    return splitQuizAndExam({
        ...deduped,
        questions: deduped.questions.filter((question) => question.questionType === "ordering"
            || !existingPrompts.some((prompt) => isNearDuplicatePrompt(prompt, question.prompt))),
    });
};

export const normalizeAiCoursePayload = (
    payload,
    { fileName = "", extractedText = "", backend = "ai" } = {},
) => {
    const topics = (Array.isArray(payload?.topics) ? payload.topics : [])
        .map((item) => normalizeAiTopic(item, { sourceText: extractedText }))
        .filter(Boolean);
    if (topics.length === 0) {
        return heuristicCurriculum({ fileName, segments: segmentSource(extractedText).segments });
    }
    return { backend, topics: dedupeAndSplitQuestions(topics) };
};

const quizPrompts = (topic) =>
    (Array.isArray(topic?.questions) ? topic.questions : [])
        .filter((question) => question?.questionType !== "ordering")
        .map((question) => question.prompt);

// Calls the model for JSON. A reply cut off at max_tokens is retried once
// with more room; any other failure is thrown to the caller.
const chatJson = async (chat, args, what) => {
    let request = args;
    for (let attempt = 1; ; attempt += 1) {
        try {
            const result = await chat(request);
            const parsed = extractJsonObject(result.text);
            if (!parsed) throw new Error(`AI returned non-JSON ${what}.`);
            return parsed;
        } catch (error) {
            if (!(error instanceof LlmTruncatedError) || attempt === 2) throw error;
            request = {
                ...args,
                maxTokens: Math.round(args.maxTokens * TRUNCATION_RETRY_FACTOR),
                run: { ...args.run, purpose: `${args.run.purpose}_retry` },
            };
        }
    }
};

const sourceMessage = ({ fileName, title, source, extra = [] }) => [
    `Source file name: ${fileName || "upload"}`,
    `Lesson title: ${title}`,
    ...extra,
    "",
    untrustedSourceBlock(source, "Lesson source text"),
].join("\n");

// Call A: the lesson itself.
const writeLessonCall = async ({ chat, fileName, title, kind, source }) => {
    const system = [
        "You are ChewnPour's study lesson writer.",
        "Return ONLY valid JSON with this shape:",
        `{"lesson":${LESSON_JSON_SHAPE}}`,
        "The source is this lesson's part of the uploaded document, given below.",
        LESSON_WRITING_RULES,
        promptBlockForLessonKind(kind),
        "Do not invent facts that are absent from the source text.",
        SOURCE_DATA_RULE,
    ].join(" ");
    const parsed = await chatJson(chat, {
        messages: [
            { role: "system", content: system },
            { role: "user", content: sourceMessage({ fileName, title, source }) },
        ],
        temperature: 0.2,
        maxTokens: LESSON_MAX_TOKENS,
        responseFormat: "json_object",
        run: { purpose: "lesson", label: title },
    }, "lesson");
    const lesson = normalizeLesson(parsed?.lesson);
    if (!lesson) throw new Error("AI returned an unusable lesson.");
    return lesson;
};

// Call B: the topic quiz, exam questions, in-lesson checks and an optional
// ordering check, from the same source and the lesson's section list.
const writeQuestionsCall = async ({ chat, fileName, title, kind, source, lesson, avoidPrompts = [], isRetry = false }) => {
    const allowOrdering = kind === "procedure" || kind === "narrative" || snippetHasProcess(source);
    const avoid = avoidPrompts.filter(Boolean).slice(-12);
    const system = [
        "You are ChewnPour's quiz writer.",
        "Return ONLY valid JSON with this shape:",
        `{"questions":[${MCQ_JSON_SHAPE}],"inLessonChecks":[${CHECK_JSON_SHAPE}],"ordering":null}`,
        `Create ${MAX_QUESTIONS_PER_TOPIC + 1}-${MAX_GENERATED_MCQS_PER_TOPIC} distinct multiple-choice questions from THIS source text only in questions[]. The first ${MAX_QUESTIONS_PER_TOPIC} are the topic quiz; the rest are held back for the course exam, so each must test a different fact. The correct option must be stated in the source.`,
        "Also create inLessonChecks: at most one per section, cap 4, none on a practice section. sectionIndex is the 0-based index in the lesson's section list below. questionType may be multiple_choice or true_false (options True/False).",
        "correctIndex must point at the correct option. Options must be unique. Prompts must not restate the lesson title.",
        "inLessonChecks must not duplicate the topic-quiz questions.",
        "Hints must not name the correct option, unique answer terms, a true/false verdict, or the ordered steps.",
        allowOrdering
            ? 'If the source describes a process or sequence, include at most one ordering check in inLessonChecks or set ordering to {"prompt":"string","stepsInOrder":["step 1","step 2","step 3"],"explanation":"string","hint":"string","sectionIndex":0} with exactly 3 source-backed steps and the sectionIndex of the section that teaches the process. Otherwise set ordering to null.'
            : "Set ordering to null. Do not invent a process check.",
        "Do not invent facts that are absent from the source text.",
        SOURCE_DATA_RULE,
        avoid.length ? `Do not repeat or paraphrase any of these existing questions: ${JSON.stringify(avoid)}` : "",
    ].filter(Boolean).join(" ");
    const sections = lesson.sections.map((section, index) => `[${index}] (${section.role}) ${section.title}`);
    return chatJson(chat, {
        messages: [
            { role: "system", content: system },
            { role: "user", content: sourceMessage({ fileName, title, source, extra: ["Lesson sections:", ...sections] }) },
        ],
        temperature: isRetry ? 0.35 : 0.2,
        maxTokens: QUESTIONS_MAX_TOKENS,
        responseFormat: "json_object",
        run: { purpose: isRetry ? "lesson_questions_retry" : "lesson_questions", label: title },
    }, "questions");
};

const isAbort = (error) => error instanceof LlmAbortedError;

const countQuizQuestions = (topic) =>
    (topic?.questions || []).filter((question) => question.surface === "quiz").length;

// Writes one planned lesson. A lesson that cannot be written throws; a lesson
// whose questions fail is kept without a quiz. Too few usable quiz questions
// re-runs only the questions call.
const writeTopic = async ({ chat, fileName, entry, planIndex, source, seenPrompts }) => {
    const { title, kind } = entry;
    const written = await writeLessonCall({ chat, fileName, title, kind, source });
    // Ground the lesson first: the quiz call binds checks to the sections
    // that survive.
    const grounded = normalizeAiTopic({ title, lesson: written, planIndex }, { sourceText: source });
    if (!grounded) throw new Error("AI returned an unusable lesson.");
    const { lesson } = grounded;
    // The lesson is already grounded; keep the report of what was dropped.
    const build = (payload) => ({
        ...normalizeAiTopic({ title, lesson, planIndex, ...payload }, { sourceText: source }),
        grounding: grounded.grounding,
    });
    let topic = grounded;
    try {
        topic = build(await writeQuestionsCall({ chat, fileName, title, kind, source, lesson, avoidPrompts: seenPrompts }));
        if (countQuizQuestions(topic) < 2) {
            const retry = build(await writeQuestionsCall({
                chat,
                fileName,
                title,
                kind,
                source,
                lesson,
                avoidPrompts: [...seenPrompts, ...quizPrompts(topic)],
                isRetry: true,
            }));
            if (countQuizQuestions(retry) > countQuizQuestions(topic)) topic = retry;
        }
    } catch (error) {
        if (isAbort(error)) throw error;
        console.warn("[aiCourseGeneration] questions failed; keeping the lesson without a quiz", {
            title,
            message: error?.message || String(error),
        });
    }
    seenPrompts.push(...quizPrompts(topic));
    return topic;
};

// Every model call carries the job's context ({ userId, courseId, uploadId })
// into its usage record.
const withRunContext = (chat, runContext) => (args) => chat({
    ...args,
    run: { ...runContext, ...(args.run || {}) },
});

// Plans an upload's lessons over its segments, in document order. Without
// text or without the model, returns { heuristic }: the whole course built
// from the source text, with no model calls. Otherwise returns { plan,
// provider, model }; a failed planning call falls back to grouping segments
// by heading. chat and aiEnabled default to the live providers; regression
// scripts stub them.
export const planCourse = async ({
    fileName,
    extractedText,
    runContext = {},
    chat = callCourseLlmChat,
    aiEnabled = isCourseAiEnabled,
}) => {
    const { segments } = segmentSource(String(extractedText || "").trim());
    if (!segments.length || !aiEnabled()) {
        return { heuristic: heuristicCurriculum({ fileName, segments }) };
    }
    try {
        const planned = await planLessons({ chat: withRunContext(chat, runContext), segments, fileName });
        return { plan: planned.plan, provider: planned.provider, model: planned.model };
    } catch (error) {
        console.warn("[aiCourseGeneration] lesson plan failed; grouping by headings", {
            message: error?.message || String(error),
        });
        return { plan: heuristicLessonPlan(segments), provider: null, model: null };
    }
};

// Writes one planned lesson, its quiz, exam questions and checks from the
// lesson's own source span. existingPrompts are the quiz and exam prompts
// already in the course: near-duplicates of them are dropped before the
// quiz/exam split. Throws when the lesson itself cannot be written.
export const writePlannedLesson = async ({
    fileName,
    entry,
    planIndex,
    source,
    existingPrompts = [],
    runContext = {},
    chat = callCourseLlmChat,
}) => {
    const topic = await writeTopic({
        chat: withRunContext(chat, runContext),
        fileName,
        entry,
        planIndex,
        source,
        seenPrompts: [...existingPrompts],
    });
    return splitTopicQuestions(topic, existingPrompts);
};
