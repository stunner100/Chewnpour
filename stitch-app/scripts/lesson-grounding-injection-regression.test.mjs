import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isTextGroundedInSource } from "../server/grounding.js";
import { normalizeAiCoursePayload } from "../server/aiCourseGeneration.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const source =
    "Cellular respiration converts glucose into usable energy in the mitochondria.";

assert.equal(
    isTextGroundedInSource("converts glucose into usable energy", source),
    true,
    "a source-backed answer must be grounded",
);
assert.equal(
    isTextGroundedInSource("The moon is made of green cheese", source),
    false,
    "a hallucinated answer must not be grounded",
);
assert.equal(
    isTextGroundedInSource("anything at all", ""),
    true,
    "a missing source must fail open instead of dropping everything",
);

// A hallucinated correct answer is dropped before persistence; the topic then
// falls back to heuristic questions drawn from its content.
const normalized = normalizeAiCoursePayload(
    {
        topics: [
            {
                title: "Cellular respiration",
                content: source,
                questions: [
                    {
                        prompt: "What powers the cell?",
                        options: [
                            "The moon is made of green cheese",
                            "Photosynthesis only",
                            "Cellular respiration converts glucose into usable energy",
                            "Gravity",
                        ],
                        correctIndex: 0,
                        explanation: "hallucinated answer",
                    },
                ],
            },
        ],
    },
    { fileName: "bio.pdf", extractedText: source },
);

assert.equal(normalized.topics.length, 1);
assert.ok(
    normalized.topics[0].questions.length >= 1,
    "a topic with no grounded AI questions must keep heuristic questions",
);
assert.ok(
    normalized.topics[0].questions.every(
        (question) =>
            !(Array.isArray(question.options) ? question.options : []).includes(
                "The moon is made of green cheese",
            ),
    ),
    "hallucinated options must never survive normalization",
);

const aiSource = await fs.readFile(path.join(root, "server", "aiCourseGeneration.js"), "utf8");
assert.match(
    aiSource,
    /untrusted user-uploaded data/,
    "prompts must declare the source text untrusted data",
);
assert.match(
    aiSource,
    /COURSE_GENERATION_TIMEOUT_MS/,
    "generation must honor an overall deadline budget",
);
assert.match(
    aiSource,
    /sourceTruncated/,
    "long documents must signal source truncation",
);

console.log("lesson-grounding-injection-regression.test.mjs passed");
