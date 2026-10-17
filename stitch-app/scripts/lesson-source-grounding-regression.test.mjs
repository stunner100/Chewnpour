// Lessons, word bank terms and true/false checks are checked against the
// lesson's own source span: whole words only, every number and name must be
// in the source, invented optional sections are dropped and an unsupported
// core section flags the lesson for review.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isTextGroundedInSource, namesIn, numbersIn, sourceHasWord } from "../server/grounding.js";
import { checkSection, groundLesson } from "../server/lessonGrounding.js";
import { normalizeInLessonChecks } from "../server/inLessonChecks.js";
import { planEntrySource } from "../server/topicWrites.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const source = [
    "Osmosis is the movement of water across a semi-permeable membrane from a dilute solution to a concentrated one.",
    "In 1877 Wilhelm Pfeffer measured osmotic pressure with a copper ferrocyanide membrane.",
    "Plant cells placed in pure water become turgid; animal cells may burst.",
].join(" ");

// Whole words: "cat" is not found inside "education" or "concatenate".
assert.equal(sourceHasWord("cat", "Education helps concatenate ideas."), false);
assert.equal(sourceHasWord("cells", source), true, "plural matches");
assert.equal(sourceHasWord("cell", source), true, "singular matches the plural");

// Numbers and names must be exact.
assert.deepEqual(numbersIn("1. First\n2. In 1877 it was 3.5 bar"), ["1877", "3", "5"]);
assert.deepEqual(namesIn("Pfeffer met Hugo de Vries. The DNA was fine."), ["Hugo", "Vries", "DNA"]);
assert.equal(isTextGroundedInSource("Pfeffer measured osmotic pressure in 1877", source), true);
assert.equal(isTextGroundedInSource("Pfeffer measured osmotic pressure in 1887", source), false, "a wrong year fails");
assert.equal(isTextGroundedInSource("Van't Hoff measured osmotic pressure in 1877", source), false, "a new name fails");

// Sections.
const core = {
    title: "Water moves toward the concentrated side",
    role: "core",
    body: "Water crosses a semi-permeable membrane from a dilute solution to a concentrated one.",
    sourceQuote: "movement of water across a semi-permeable membrane",
};
assert.deepEqual(checkSection(core, source), { supported: true, reasons: [] });
assert.deepEqual(checkSection({ ...core, sourceQuote: "" }, source).reasons, ["no source quote"]);
assert.match(checkSection({ ...core, body: `${core.body} It was first seen in 1748.` }, source).reasons[0], /numbers not in source: 1748/);

const invented = {
    title: "A worked example from Jean-Antoine Nollet",
    role: "example",
    body: "Nollet's pig bladder experiment of 1748 showed the effect in wine.",
    sourceQuote: "Nollet sealed wine in a pig bladder",
};
const unsupportedCore = {
    title: "Reverse osmosis",
    role: "core",
    body: "Pressure can push water the other way through a membrane.",
    sourceQuote: "Reverse osmosis desalinates seawater",
};
const { lesson, report } = groundLesson({
    hook: "",
    sections: [core, invented, unsupportedCore],
    recap: [],
    wordBank: [
        { term: "turgid", definition: "Swollen with water." },
        { term: "plasmolysis", definition: "Shrinking away from the wall." },
    ],
}, source);
assert.deepEqual(lesson.sections.map((section) => section.title), [core.title, unsupportedCore.title], "the invented example is dropped, both cores kept");
assert.deepEqual(report.droppedSections.map((section) => section.title), [invented.title]);
assert.deepEqual(report.unsupportedCoreSections.map((section) => section.title), ["Reverse osmosis"]);
assert.equal(report.needsReview, true);
assert.deepEqual(lesson.wordBank.map((entry) => entry.term), ["turgid"]);
assert.deepEqual(report.droppedTerms, ["plasmolysis"]);
assert.equal(groundLesson({ sections: [invented], wordBank: [] }, "").lesson.sections.length, 1, "no source: nothing dropped");

// True/false checks: a statement keyed True must be stated by the source; one
// keyed False must still be about the source.
const checks = (raw) => normalizeInLessonChecks(raw, { lesson: { sections: [core, core] }, sourceText: source });
const trueFalse = (prompt, answer, sectionIndex = 0) => ({ questionType: "true_false", prompt, answer, sectionIndex });
assert.equal(checks([trueFalse("Plant cells placed in pure water become turgid.", true)]).length, 1);
assert.equal(checks([trueFalse("Plant cells placed in pure water shrink and lose their walls entirely.", true)]).length, 0, "a wrong True key is rejected");
assert.equal(checks([trueFalse("Plant cells placed in pure water burst.", false)]).length, 1, "a False statement about the source is kept");
assert.equal(checks([trueFalse("Volcanoes erupt basaltic magma near tectonic ridges.", false)]).length, 0, "an off-topic False statement is rejected");

// A lesson's source is the segments inside its plan entry's span, so lines
// segmentation dropped (a contents list) stay out of it.
const extractedText = "# Part one\nAlpha text.\n# Part two\nBeta text.";
assert.equal(planEntrySource({ start: 23, end: extractedText.length }, extractedText), "# Part two\n\nBeta text.");
assert.equal(planEntrySource(undefined, extractedText), "", "no plan entry, no span");
const withContents = fs.readFileSync(path.join(root, "scripts/fixtures/sources/toc-heavy-cell-biology.md"), "utf8").trim();
const firstLesson = planEntrySource({ start: 0, end: withContents.length }, withContents);
assert.match(firstLesson, /Prokaryotic cells lack a nucleus/);
assert.doesNotMatch(firstLesson, /\.{4,}/, "contents lines are not part of the lesson source");

console.log("lesson-source-grounding-regression.test.mjs passed");
