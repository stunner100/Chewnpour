// Lessons are written as content-titled sections with roles. The outline's
// kind only hints which optional roles fit; there is no fixed section template
// and no keyword classifier.
import assert from "node:assert/strict";
import * as lessonKind from "../src/lib/lessonKind.js";
import { planCourse, writePlannedLesson } from "../server/aiCourseGeneration.js";
import { planEntrySource } from "../server/topicWrites.js";

const { LESSON_KINDS, normalizeLessonKind, promptBlockForLessonKind } = lessonKind;

assert.deepEqual(LESSON_KINDS, ["narrative", "procedure", "concept", "argument"]);
assert.equal(lessonKind.classifyLessonKind, undefined, "the keyword classifier is gone (L7)");
assert.equal(lessonKind.spineForLessonKind, undefined, "fixed section templates are gone");
assert.equal(normalizeLessonKind("Procedure"), "procedure");
assert.equal(normalizeLessonKind("recipe"), null);

const hints = LESSON_KINDS.map((kind) => promptBlockForLessonKind(kind));
assert.equal(new Set(hints).size, 4, "each kind has its own hint");
assert.equal(promptBlockForLessonKind(null), promptBlockForLessonKind("concept"), "unknown kinds read as concept");
assert.match(promptBlockForLessonKind("procedure"), /steps section/);
assert.match(promptBlockForLessonKind("narrative"), /Do not invent steps, calculations or rival accounts/);
assert.match(promptBlockForLessonKind("argument"), /opposing view only if the snippet states one/);

// The lesson writer's prompt asks for content titles and roles; the quiz
// writer's prompt binds checks to the lesson's sections by index.
const prompts = [];
const quizPrompts = [];
const chat = async ({ messages }) => {
    const system = messages[0].content;
    if (system.startsWith("You are ChewnPour's study curriculum planner.")) {
        return {
            text: JSON.stringify({
                lessons: [
                    { title: "Balancing redox equations", kind: "procedure", firstPart: 0 },
                    { title: "Oxidation numbers", kind: "concept", firstPart: 1 },
                ],
            }),
            provider: "stub",
        };
    }
    if (system.startsWith("You are ChewnPour's quiz writer.")) {
        quizPrompts.push(messages);
        return { text: JSON.stringify({ questions: [], inLessonChecks: [], ordering: null }), provider: "stub" };
    }
    prompts.push(system);
    const title = messages[1].content.match(/^Lesson title: (.+)$/m)[1];
    const body = `${title} is explained here in plain sentences for the student.`;
    // Quote the first sentence of the lesson's source, as a grounded lesson would.
    const source = messages[1].content.split(/`{3,}\n/)[1];
    const sourceQuote = source.split("\n").find((line) => line.trim() && !line.startsWith("#")).split(".")[0];
    return {
        text: JSON.stringify({
            lesson: {
                sections: [
                    { title: `How ${title} works`, role: "core", body, sourceQuote },
                    { title: `Practise ${title}`, role: "practice", body, sourceQuote },
                ],
            },
        }),
        provider: "stub",
    };
};
console.warn = () => {};
const redoxText = [
    "# Balancing redox equations",
    "Assign oxidation numbers first. Then write the half-reactions and balance electrons. ".repeat(20),
    "# Oxidation numbers",
    "Oxidation numbers track electron transfer between atoms in a reaction. ".repeat(20),
].join("\n\n");
const { plan } = await planCourse({ fileName: "redox.pdf", extractedText: redoxText, chat, aiEnabled: () => true });
for (const [planIndex, entry] of plan.entries()) {
    await writePlannedLesson({ fileName: "redox.pdf", entry, planIndex, source: planEntrySource(entry, redoxText), chat });
}
const [procedurePrompt, conceptPrompt] = prompts;
for (const prompt of [procedurePrompt, conceptPrompt]) {
    assert.match(prompt, /"lesson":\{"hook":"string","sections":\[\{"title":"string","role":"core\|steps\|example\|misconception\|practice"/);
    assert.match(prompt, /Never use generic titles such as Why This Matters, Key Terms, Introduction, Overview, The Idea, Summary or Recap\./);
    assert.match(prompt, /only when the source supports that section; otherwise leave it out/);
    assert.doesNotMatch(prompt, /Use exactly these H2 titles/);
}
for (const [system, user] of quizPrompts.map((messages) => [messages[0].content, messages[1].content])) {
    assert.match(system, /sectionIndex is the 0-based index in the lesson's section list below/);
    assert.match(system, /none on a practice section/);
    assert.match(user, /Lesson sections:\n\[0\] \(core\) How .+ works\n\[1\] \(practice\) Practise /);
}
assert.equal(quizPrompts.length, 4, "each lesson gets a quiz call, re-run once when it returns too few questions");
assert.ok(procedurePrompt.includes(promptBlockForLessonKind("procedure")));
assert.ok(conceptPrompt.includes(promptBlockForLessonKind("concept")));

console.log("lesson-kind-adaptive-structure-regression.test.mjs passed");
