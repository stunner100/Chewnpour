import assert from "node:assert/strict";
import {
    AUTO_GENERATION_ERROR_RETRY_MESSAGE,
    AUTO_GENERATION_EXHAUSTED_MESSAGE,
    AUTO_GENERATION_TIMEOUT_MESSAGE,
    resolveAutoGenerationError,
    resolveAutoGenerationResult,
} from "../src/lib/examAutoGenerationState.js";

const tests = [
    () => {
        const outcome = resolveAutoGenerationResult({
            result: { success: false, count: 0 },
            previousQuestionCount: 0,
            attemptCount: 0,
            maxAttempts: 3,
            minExamQuestions: 1,
        });
        assert.equal(outcome.nextAttemptCount, 1, "Expected failed generation to increment attempt count.");
        assert.equal(outcome.pauseAutoGeneration, false, "Expected retries to continue before max attempts.");
        assert.equal(
            outcome.errorMessage,
            "Still preparing questions (0 of 1). Retrying automatically...",
            "Expected first no-progress result to show retry message."
        );
    },
    () => {
        const outcome = resolveAutoGenerationResult({
            result: { success: true, count: 0 },
            previousQuestionCount: 0,
            attemptCount: 2,
            maxAttempts: 3,
            minExamQuestions: 1,
        });
        assert.equal(outcome.nextAttemptCount, 3, "Expected max-attempt no-progress run to advance attempt counter.");
        assert.equal(outcome.pauseAutoGeneration, true, "Expected retries to pause at max attempts.");
        assert.equal(
            outcome.errorMessage,
            AUTO_GENERATION_EXHAUSTED_MESSAGE,
            "Expected exhausted retries to use the exhaustion message."
        );
    },
    () => {
        const outcome = resolveAutoGenerationResult({
            result: { success: true, count: 2 },
            previousQuestionCount: 0,
            attemptCount: 2,
            maxAttempts: 3,
            minExamQuestions: 1,
        });
        assert.equal(outcome.nextAttemptCount, 0, "Expected progress to reset auto-generation attempts.");
        assert.equal(outcome.pauseAutoGeneration, false, "Expected progress to keep auto-generation active.");
        assert.equal(outcome.errorMessage, "", "Expected progress to clear retry errors.");
    },
    () => {
        const outcome = resolveAutoGenerationError({
            error: new Error("socket reset"),
            attemptCount: 0,
            maxAttempts: 3,
        });
        assert.equal(outcome.pauseAutoGeneration, false, "Expected non-timeout error before max attempts to keep retrying.");
        assert.equal(outcome.errorMessage, AUTO_GENERATION_ERROR_RETRY_MESSAGE, "Expected retry error message.");
    },
    () => {
        const outcome = resolveAutoGenerationError({
            error: new Error("request timed out"),
            attemptCount: 0,
            maxAttempts: 3,
        });
        assert.equal(outcome.timedOut, true, "Expected timeout detection for timed-out errors.");
        assert.equal(outcome.pauseAutoGeneration, true, "Expected timeout to immediately pause retries.");
        assert.equal(outcome.errorMessage, AUTO_GENERATION_TIMEOUT_MESSAGE, "Expected timeout error message.");
    },
    () => {
        const outcome = resolveAutoGenerationError({
            error: new Error("upstream 500"),
            attemptCount: 2,
            maxAttempts: 3,
        });
        assert.equal(outcome.exhaustedAutoRetries, true, "Expected max-attempt error to mark retries exhausted.");
        assert.equal(outcome.pauseAutoGeneration, true, "Expected exhausted retries to pause auto-generation.");
        assert.equal(outcome.errorMessage, AUTO_GENERATION_TIMEOUT_MESSAGE, "Expected exhausted retries message.");
    },
];

for (const run of tests) {
    run();
}

console.log("exam-auto-generation-exhaustion-regression tests passed");
