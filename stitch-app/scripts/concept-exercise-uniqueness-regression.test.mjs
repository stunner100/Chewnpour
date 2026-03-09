import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { buildConceptExerciseKey } from "../convex/lib/conceptExerciseGeneration.js";

// 1) Equivalent question/answer variants should normalize to the same dedupe key.
{
    const first = {
        questionText: "When is market equilibrium reached?",
        template: ["When ", "__", " equals ", "__", ", equilibrium happens."],
        answers: ["Demand", "Supply"],
    };
    const duplicateVariant = {
        questionText: "when is market equilibrium reached",
        template: ["When ", "__", " equals ", "__", " equilibrium happens!"],
        answers: [" demand ", "supply"],
    };

    assert.equal(
        buildConceptExerciseKey(first, { includeTemplate: false }),
        buildConceptExerciseKey(duplicateVariant, { includeTemplate: false }),
        "Expected equivalent concept exercises to share the same dedupe key."
    );
}

// 2) Different answer sets should produce different keys.
{
    const base = {
        questionText: "Explain osmosis in one sentence.",
        answers: ["water", "concentration gradient"],
    };
    const different = {
        questionText: "Explain osmosis in one sentence.",
        answers: ["diffusion", "semi permeable membrane"],
    };

    assert.notEqual(
        buildConceptExerciseKey(base, { includeTemplate: false }),
        buildConceptExerciseKey(different, { includeTemplate: false }),
        "Expected different answer sets to generate different dedupe keys."
    );
}

// 3) Prior attempt history should block re-serving the same concept exercise.
{
    const priorAttemptKey = buildConceptExerciseKey(
        {
            questionText: "Photosynthesis converts light into stored energy.",
            answers: ["light energy", "chemical energy"],
        },
        { includeTemplate: false }
    );
    const seenKeys = new Set([priorAttemptKey]);
    const candidateKey = buildConceptExerciseKey(
        {
            questionText: "photosynthesis converts light into stored energy",
            answers: ["Light Energy", "Chemical Energy"],
        },
        { includeTemplate: false }
    );

    assert.equal(
        seenKeys.has(candidateKey),
        true,
        "Expected prior concept attempt key to mark normalized duplicates as seen."
    );
}

// 4) Concept generation must pass through grounded acceptance with citations.
{
    const aiSource = await fs.readFile(path.join(process.cwd(), "convex", "ai.ts"), "utf8");
    assert.equal(
        /applyGroundedAcceptance\(\{[\s\S]*type:\s*"concept"/.test(aiSource),
        true,
        "Expected concept generation to use grounded acceptance."
    );
    assert.equal(
        /citations:\s*Array\.isArray\(exercise\?\.citations\)/.test(aiSource),
        true,
        "Expected concept generation candidates to include citations."
    );
}

console.log("concept-exercise-uniqueness-regression.test.mjs passed");
