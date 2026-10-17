import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFile(path.join(root, rel), "utf8");

process.env.DATABASE_URL ||= "postgres://user:pass@localhost:5432/unused";

const {
    normalizeAiCoursePayload,
    MAX_EXAM_QUESTIONS_PER_TOPIC,
} = await import("../server/aiCourseGeneration.js");
const { selectExamQuestions } = await import("../server/exams.js");
const { resolveGenerationStageIndex, GENERATION_STAGES } = await import("../src/lib/generationStages.js");

// 1. Long sources are planned across their whole span, not just the opening
// (coverage itself is checked in lesson-planning-regression).
{
    const { segmentSource } = await import("../server/sourceSegments.js");
    const { heuristicLessonPlan } = await import("../server/lessonPlanning.js");
    const text = Array.from({ length: 40 }, (_, i) => `# Chapter ${i + 1}\n\n${"Cells divide and grow. ".repeat(40)}`).join("\n\n");
    const { segments } = segmentSource(text);
    const plan = heuristicLessonPlan(segments);
    assert.equal(plan[0].start, 0, "the plan starts at the beginning");
    assert.equal(plan[plan.length - 1].end, text.length, "the plan reaches the end of the source");
}

// 2. Generated MCQs beyond the topic-quiz cap are held back for the exam.
{
    const facts = [
        ["Which organelle produces ATP?", "Mitochondria", ["Ribosome", "Nucleus", "Golgi apparatus"]],
        ["Which organelle holds DNA?", "Nucleus", ["Lysosome", "Vacuole", "Centriole"]],
        ["Which organelle builds proteins?", "Ribosome", ["Vacuole", "Lysosome", "Centriole"]],
        ["Which organelle packages proteins?", "Golgi apparatus", ["Nucleus", "Vacuole", "Centriole"]],
        ["Which organelle digests waste?", "Lysosome", ["Ribosome", "Nucleus", "Centriole"]],
        ["Which organelle stores water in plants?", "Vacuole", ["Ribosome", "Lysosome", "Golgi apparatus"]],
    ];
    const source = "Mitochondria produce ATP. The Nucleus holds DNA. The Ribosome builds proteins. "
        + "The Golgi apparatus packages proteins. The Lysosome digests waste. The Vacuole stores water. "
        + "The Centriole organizes the spindle.";
    const lesson = {
        sections: [{ title: "What each organelle does", role: "core", body: `${source}\n\n${source}` }],
    };
    const payload = {
        topics: [{
            title: "Cell organelles",
            description: "Parts of the cell",
            lesson,
            questions: facts.map(([prompt, answer, distractors]) => ({
                prompt,
                options: [answer, ...distractors],
                correctIndex: 0,
                explanation: `${answer} is correct.`,
            })),
        }],
    };
    const normalized = normalizeAiCoursePayload(payload, { extractedText: source, backend: "test" });
    const questions = normalized.topics[0].questions.filter((q) => q.questionType !== "ordering");
    const quiz = questions.filter((q) => q.surface === "quiz");
    const exam = questions.filter((q) => q.surface === "exam");
    assert.equal(quiz.length, 3, "topic quiz keeps three questions");
    assert.ok(exam.length >= 1 && exam.length <= MAX_EXAM_QUESTIONS_PER_TOPIC, "extra questions go to the exam pool");
    const quizPrompts = new Set(quiz.map((q) => q.prompt));
    assert.ok(exam.every((q) => !quizPrompts.has(q.prompt)), "exam questions are not quiz questions");
}

// 3. Exams draw exam-only questions first and fill with quiz questions.
{
    const rows = [
        ...Array.from({ length: 6 }, (_, i) => ({ id: `q${i}`, surface: "quiz" })),
        ...Array.from({ length: 4 }, (_, i) => ({ id: `e${i}`, surface: "exam" })),
    ];
    for (let run = 0; run < 20; run += 1) {
        const picked = selectExamQuestions(rows, 5);
        assert.equal(picked.length, 5);
        assert.equal(picked.filter((row) => row.surface === "exam").length, 4, "every exam-only question is used first");
    }
    assert.equal(selectExamQuestions(rows.slice(0, 6), 4).length, 4, "older courses fall back to quiz questions");
}

// 4. Upload progress reflects the real generation step.
{
    const base = { status: "ready", extractionStatus: "complete", topicCount: 0, quizzesReady: 0 };
    assert.equal(resolveGenerationStageIndex({ ...base, processingStep: "structuring" }), 2);
    assert.equal(resolveGenerationStageIndex({ ...base, processingStep: "writing" }), 3);
    assert.equal(resolveGenerationStageIndex({ ...base, processingStep: "saving" }), 4);
    assert.equal(resolveGenerationStageIndex({ ...base, processingStep: "ready", topicCount: 3, quizzesReady: 3 }), 5);
    // A ready course with topics but no quiz questions is study-ready, not "Saving".
    assert.equal(resolveGenerationStageIndex({ ...base, processingStep: "ready", topicCount: 3, quizzesReady: 0 }), 5);
    assert.equal(GENERATION_STAGES[3].label, "Writing lessons and questions");

    const library = await read("src/pages/MyMaterialsLibrary.jsx");
    assert.match(library, /const studyReady = stageIndex === GENERATION_STAGES\.length - 1;/, "the material card button follows the resolved stage");

    // The generation job records planning and writing; each lesson is saved
    // as it is written, so there is no separate saving step.
    const jobs = await read("server/generationJobs.js");
    for (const step of ['"structuring"', '"writing"', '"ready"']) {
        assert.ok(jobs.includes(step), `generationJobs.js records the ${step} step`);
    }
}

// 5. Lesson completion offers the next lesson, or the course exam after the last one.
{
    const completion = await read("src/components/study/LessonCompletion.jsx");
    assert.match(completion, /nextLesson\?\.href/);
    assert.match(completion, /Take the course exam/);
    const shell = await read("src/components/topic/TopicLessonViews.jsx");
    assert.match(shell, /nextLesson=\{nextTopic \?/);
    assert.match(shell, /\/dashboard\/exam\?courseId=/);
}

console.log("course-coverage-exam-pool-regression.test.mjs passed");
