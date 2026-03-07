import assert from "node:assert/strict";
import {
    calculateEvidenceRichMcqCap,
    QUESTION_BANK_BACKGROUND_PROFILE,
    QUESTION_BANK_INTERACTIVE_PROFILE,
    calculateQuestionBankTarget,
    deriveQuestionGenerationRounds,
    resolveQuestionBankProfile,
} from "../convex/lib/questionBankConfig.js";

const tests = [
    () => {
        const target = calculateQuestionBankTarget({
            wordCount: 10_000,
            minTarget: QUESTION_BANK_BACKGROUND_PROFILE.minTarget,
            maxTarget: QUESTION_BANK_BACKGROUND_PROFILE.maxTarget,
            wordDivisor: QUESTION_BANK_BACKGROUND_PROFILE.wordDivisor,
        });
        assert.equal(
            target,
            QUESTION_BANK_BACKGROUND_PROFILE.maxTarget,
            "Background target should clamp to configured max."
        );
    },
    () => {
        const target = calculateQuestionBankTarget({
            wordCount: 8_000,
            minTarget: QUESTION_BANK_INTERACTIVE_PROFILE.minTarget,
            maxTarget: QUESTION_BANK_INTERACTIVE_PROFILE.maxTarget,
            wordDivisor: QUESTION_BANK_INTERACTIVE_PROFILE.wordDivisor,
        });
        assert.equal(
            target,
            QUESTION_BANK_INTERACTIVE_PROFILE.maxTarget,
            "Interactive target should remain capped for fast exam readiness."
        );
    },
    () => {
        const rounds = deriveQuestionGenerationRounds({
            targetCount: 120,
            existingCount: 0,
            batchSize: QUESTION_BANK_BACKGROUND_PROFILE.batchSize,
            minRounds: QUESTION_BANK_BACKGROUND_PROFILE.minRounds,
            maxRounds: QUESTION_BANK_BACKGROUND_PROFILE.maxRounds,
            bufferRounds: QUESTION_BANK_BACKGROUND_PROFILE.bufferRounds,
        });
        assert.equal(
            rounds,
            QUESTION_BANK_BACKGROUND_PROFILE.maxRounds,
            "Round calculation should clamp to configured max rounds."
        );
    },
    () => {
        const resolved = resolveQuestionBankProfile({
            minTarget: 15,
            maxTarget: 8,
            batchSize: 0,
            minBatchSize: 50,
            maxBatchAttempts: 0,
            requestTimeoutMs: 100,
            repairTimeoutMs: 50,
            minRounds: 0,
            maxRounds: -5,
            noProgressLimit: 0,
            timeBudgetMs: 500,
            parallelRequests: 0,
        });

        assert.equal(resolved.maxTarget, 15, "Profile maxTarget should never drop below minTarget.");
        assert.equal(resolved.batchSize, 1, "Profile batchSize should enforce a minimum of 1.");
        assert.equal(resolved.minBatchSize, 1, "Profile minBatchSize should be clamped to batch size.");
        assert.equal(resolved.maxBatchAttempts, 1, "Profile maxBatchAttempts should enforce a minimum of 1.");
        assert.equal(resolved.requestTimeoutMs, 1000, "Profile requestTimeoutMs should enforce a minimum of 1000ms.");
        assert.equal(resolved.repairTimeoutMs, 1000, "Profile repairTimeoutMs should enforce a minimum of 1000ms.");
        assert.equal(resolved.minRounds, 1, "Profile minRounds should enforce a minimum of 1.");
        assert.equal(resolved.maxRounds, 1, "Profile maxRounds should not be below minRounds.");
        assert.equal(resolved.noProgressLimit, 1, "Profile noProgressLimit should enforce a minimum of 1.");
        assert.equal(resolved.timeBudgetMs, 1000, "Profile timeBudgetMs should enforce a minimum of 1000ms.");
        assert.equal(resolved.parallelRequests, 1, "Profile parallelRequests should enforce a minimum of 1.");
    },
    () => {
        assert.equal(
            QUESTION_BANK_INTERACTIVE_PROFILE.maxBatchAttempts,
            1,
            "Interactive profile should use a single attempt per batch request for low-latency UX."
        );
        assert.equal(
            QUESTION_BANK_INTERACTIVE_PROFILE.requestTimeoutMs,
            12_000,
            "Interactive request timeout should remain bounded for exam readiness."
        );
    },
    () => {
        assert.equal(QUESTION_BANK_BACKGROUND_PROFILE.minTarget, 40, "Background profile minTarget should be 40.");
        assert.equal(QUESTION_BANK_BACKGROUND_PROFILE.maxTarget, 60, "Background profile maxTarget should be 60.");
        assert.equal(QUESTION_BANK_BACKGROUND_PROFILE.batchSize, 14, "Background profile batchSize should be 14.");
        assert.equal(QUESTION_BANK_BACKGROUND_PROFILE.minBatchSize, 7, "Background profile minBatchSize should be 7.");
        assert.equal(QUESTION_BANK_BACKGROUND_PROFILE.minRounds, 3, "Background profile minRounds should be 3.");
        assert.equal(QUESTION_BANK_BACKGROUND_PROFILE.maxRounds, 12, "Background profile maxRounds should be 12.");
        assert.equal(QUESTION_BANK_BACKGROUND_PROFILE.bufferRounds, 3, "Background profile bufferRounds should be 3.");
        assert.equal(QUESTION_BANK_BACKGROUND_PROFILE.noProgressLimit, 4, "Background profile noProgressLimit should be 4.");
        assert.equal(QUESTION_BANK_BACKGROUND_PROFILE.timeBudgetMs, 180_000, "Background profile timeBudgetMs should be 180000.");
    },
    () => {
        assert.equal(QUESTION_BANK_INTERACTIVE_PROFILE.minTarget, 20, "Interactive profile minTarget should be 20.");
        assert.equal(QUESTION_BANK_INTERACTIVE_PROFILE.maxTarget, 30, "Interactive profile maxTarget should be 30.");
        assert.equal(QUESTION_BANK_INTERACTIVE_PROFILE.wordDivisor, 120, "Interactive profile wordDivisor should be 120.");
        assert.equal(QUESTION_BANK_INTERACTIVE_PROFILE.batchSize, 10, "Interactive profile batchSize should be 10.");
        assert.equal(QUESTION_BANK_INTERACTIVE_PROFILE.minBatchSize, 5, "Interactive profile minBatchSize should be 5.");
        assert.equal(QUESTION_BANK_INTERACTIVE_PROFILE.minRounds, 2, "Interactive profile minRounds should be 2.");
        assert.equal(QUESTION_BANK_INTERACTIVE_PROFILE.maxRounds, 6, "Interactive profile maxRounds should be 6.");
        assert.equal(QUESTION_BANK_INTERACTIVE_PROFILE.noProgressLimit, 3, "Interactive profile noProgressLimit should be 3.");
        assert.equal(QUESTION_BANK_INTERACTIVE_PROFILE.timeBudgetMs, 60_000, "Interactive profile timeBudgetMs should be 60000.");
    },
    () => {
        const cap = calculateEvidenceRichMcqCap({
            evidence: [
                {
                    passageId: "p1-0",
                    page: 0,
                    text: "A fraction represents part of a whole. Key ideas: numerator and denominator. Example: 1/4 + 2/4 = 3/4.",
                    flags: [],
                },
            ],
            minTarget: 1,
            maxTarget: 60,
        });
        assert.equal(
            cap,
            2,
            "Thin single-passage topics should cap MCQ generation to a small grounded bank."
        );
    },
    () => {
        const richEvidence = Array.from({ length: 4 }, (_, index) => ({
            passageId: `p${index + 1}-0`,
            page: index,
            text: [
                "Revenue target is 10% week over week growth.",
                "Vendor app adoption target is 20% weekly.",
                "New vendor target is 10 new vendors per week.",
                "Missing items rate should remain 10% or less.",
                "Example: compare this week's result to last week's baseline.",
                "Definition: active vendors made at least one sale in the week.",
            ].join(" "),
            flags: index % 2 === 0 ? ["table"] : [],
        }));
        const cap = calculateEvidenceRichMcqCap({
            evidence: richEvidence,
            minTarget: 1,
            maxTarget: 12,
        });
        assert.equal(
            cap,
            12,
            "Rich multi-passage evidence should still be allowed to fill a larger MCQ bank up to the configured max."
        );
    },
];

for (const run of tests) {
    run();
}

console.log("question-bank-config-regression tests passed");
