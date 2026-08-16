import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  classifyLessonKind,
  LESSON_KIND_SPINES,
  promptBlockForLessonKind,
  spineForLessonKind,
} from "../src/lib/lessonKind.js";

const root = process.cwd();

assert.equal(
  classifyLessonKind({
    title: "The Holy Roman Empire and Early German Fragmentation",
    snippet: "After 1648 the empire stayed a patchwork of princes and electors.",
  }),
  "narrative",
);
assert.equal(
  classifyLessonKind({
    title: "German History",
    description: "A survey of medieval and early modern Germany",
  }),
  "narrative",
);
assert.equal(
  classifyLessonKind({
    title: "How to balance a redox equation",
    snippet: "First assign oxidation numbers, then set up the half-reactions.",
  }),
  "procedure",
);
assert.equal(
  classifyLessonKind({
    title: "What is photosynthesis",
    snippet: "Photosynthesis is the process plants use to convert light into chemical energy.",
  }),
  "concept",
);
assert.equal(
  classifyLessonKind({
    title: "Should the emperor share power with the electors?",
    snippet: "The debate turns on whether imperial authority should yield to princely rights.",
  }),
  "argument",
);

assert.notDeepEqual(
  spineForLessonKind("narrative"),
  spineForLessonKind("procedure"),
);
assert.notDeepEqual(
  spineForLessonKind("concept"),
  spineForLessonKind("argument"),
);

for (const kind of ["narrative", "procedure", "concept", "argument"]) {
  const titles = spineForLessonKind(kind);
  assert.ok(titles.length >= 5, `${kind} spine should keep full lesson depth`);
  assert.equal(titles.includes("Simple Introduction"), false);
  assert.equal(titles.includes("Everyday Analogy"), false);
  const prompt = promptBlockForLessonKind(kind);
  assert.match(prompt, /Do not use the same nine-section template/);
  assert.ok(
    titles.every((title) => prompt.includes(title)),
    `${kind} prompt must name its H2 spine`,
  );
}

assert.ok(LESSON_KIND_SPINES.procedure.includes("The Steps"));
assert.ok(LESSON_KIND_SPINES.narrative.includes("Causal Chain"));
assert.ok(LESSON_KIND_SPINES.concept.includes("The Attractive Wrong Idea"));
assert.ok(LESSON_KIND_SPINES.argument.includes("The Counterargument"));

const generation = await fs.readFile(
  path.join(root, "server", "aiCourseGeneration.js"),
  "utf8",
);
assert.match(generation, /promptBlockForLessonKind/);
assert.match(generation, /classifyLessonKind/);
assert.doesNotMatch(
  generation,
  /Use these H2 titles where they fit/,
  "Generation must not force the old nine-section list onto every topic.",
);
assert.match(
  generation,
  /Different topics must use different H2 spines/,
);

const formatting = await fs.readFile(
  path.join(root, "src", "lib", "topicContentFormatting.js"),
  "utf8",
);
assert.match(formatting, /Why This Matters/);
assert.match(formatting, /Causal Chain/);
assert.match(formatting, /The Attractive Wrong Idea/);

console.log("lesson-kind-adaptive-structure-regression.test.mjs passed");
