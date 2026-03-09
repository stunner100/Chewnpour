import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const aiSource = await fs.readFile(path.join(root, "convex", "ai.ts"), "utf8");
const conceptsSource = await fs.readFile(path.join(root, "convex", "concepts.ts"), "utf8");

if (!/buildGroundedConceptPrompt\(/.test(aiSource)) {
    throw new Error("Expected concept generation to use grounded concept prompts.");
}
if (!/applyGroundedAcceptance\(\{[\s\S]*type:\s*"concept"/.test(aiSource)) {
    throw new Error("Expected concept generation to enforce grounded acceptance.");
}
if (!/CONCEPT_TEMPLATE_BLANK_PATTERN/.test(aiSource) || !/normalizeConceptTemplate\(/.test(aiSource)) {
    throw new Error("Expected concept generation to normalize blank markers before validation.");
}
if (!/const template = normalizeConceptTemplate\(exercise\.template\);/.test(aiSource)) {
    throw new Error("Expected concept exercises to normalize template output before blank counting.");
}
if (!/createConceptExerciseInternal/.test(aiSource) || !/createConceptExerciseInternal\s*=\s*internalMutation/.test(conceptsSource)) {
    throw new Error("Expected concept exercises to persist through an internal mutation.");
}
if (!/citations:\s*Array\.isArray\(exercise\?\.citations\)/.test(aiSource)) {
    throw new Error("Expected concept candidates to carry citations from model output.");
}

console.log("grounded-concept-factuality-regression.test.mjs passed");
