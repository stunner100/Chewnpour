import fs from "node:fs";

const source = fs.readFileSync(new URL("../convex/ai.ts", import.meta.url), "utf8");

const freshObjectiveMatch = source.match(
  /const normalizeFreshObjectiveQuestion = \(candidate: any, index: number, blueprint: AssessmentBlueprint\) => \{[\s\S]*?\n\};/
);

if (!freshObjectiveMatch) {
  throw new Error("Expected fresh objective question normalizer to exist.");
}

const freshObjectiveNormalizer = freshObjectiveMatch[0];

if (!/markFreshCorrectOption\(/.test(freshObjectiveNormalizer)) {
  throw new Error("Expected fresh objective questions to mark the correct option from candidate answers.");
}

if (/ensureSingleCorrect\(/.test(freshObjectiveNormalizer)) {
  throw new Error("Fresh objective normalization must not default missing correct markers to option A.");
}

for (const field of [
  "candidate?.correctAnswer",
  "candidate?.answer",
  "candidate?.correctOption",
  "candidate?.correct_option",
]) {
  if (!source.includes(field)) {
    throw new Error(`Expected fresh correct-answer normalization to inspect ${field}.`);
  }
}

if (!/stripOptionLabelPrefix/.test(source)) {
  throw new Error("Expected answer text matching to ignore leading option labels.");
}

if (source.includes("objective-fallback-mcq-only")) {
  throw new Error("Interactive MCQ startup must not use an extra fallback authoring loop.");
}

console.log("fresh-exam-correct-answer-normalization-regression.test.mjs passed");
