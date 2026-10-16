// Lessons are written as content-titled sections with roles. The outline's
// kind only hints which optional roles fit; there is no fixed section template
// and no keyword classifier.
import assert from "node:assert/strict";
import * as lessonKind from "../src/lib/lessonKind.js";
import { generateCourseCurriculumWithAi } from "../server/aiCourseGeneration.js";

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

// The lesson writer's prompt asks for content titles, roles and index-bound checks.
const prompts = [];
const chat = async ({ messages }) => {
    const system = messages[0].content;
    if (system.startsWith("You are ChewnPour's study curriculum planner.")) {
        return {
            text: JSON.stringify({
                topics: [
                    { title: "Balancing redox equations", description: "Half-reactions", focus: "half-reactions", kind: "procedure" },
                    { title: "Oxidation numbers", description: "Assigning them", focus: "oxidation numbers", kind: "concept" },
                ],
            }),
            provider: "stub",
        };
    }
    prompts.push(system);
    throw new Error("stub: stop after the prompt");
};
console.warn = () => {};
await generateCourseCurriculumWithAi({
    fileName: "redox.pdf",
    extractedText: "Assign oxidation numbers first. Then write the half-reactions and balance electrons. Oxidation numbers track electron transfer.",
    chat,
    aiEnabled: () => true,
});
const [procedurePrompt, conceptPrompt] = prompts;
for (const prompt of [procedurePrompt, conceptPrompt]) {
    assert.match(prompt, /"lesson":\{"hook":"string","sections":\[\{"title":"string","role":"core\|steps\|example\|misconception\|practice"/);
    assert.match(prompt, /Never use generic titles such as Why This Matters, Key Terms, Introduction, Overview, The Idea, Summary or Recap\./);
    assert.match(prompt, /only when the source supports that section; otherwise leave it out/);
    assert.match(prompt, /sectionIndex is the 0-based index in lesson\.sections/);
    assert.doesNotMatch(prompt, /Use exactly these H2 titles/);
}
assert.ok(procedurePrompt.includes(promptBlockForLessonKind("procedure")));
assert.ok(conceptPrompt.includes(promptBlockForLessonKind("concept")));

console.log("lesson-kind-adaptive-structure-regression.test.mjs passed");
