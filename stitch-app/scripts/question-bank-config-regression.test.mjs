import assert from "node:assert/strict";
import {
    calculateEvidenceRichMcqCap,
    calculateEvidenceRichEssayCap,
    QUESTION_BANK_BACKGROUND_PROFILE,
    QUESTION_BANK_INTERACTIVE_PROFILE,
    MCQ_ATTEMPT_MIN_COUNT,
    MCQ_ATTEMPT_MAX_COUNT,
    ESSAY_ATTEMPT_MIN_COUNT,
    ESSAY_ATTEMPT_MAX_COUNT,
    calculateQuestionBankTarget,
    clampGeneratedTargetToStoredTopicTarget,
    deriveQuestionGenerationRounds,
    rebaseQuestionBankTargetAfterRun,
    resolveAssessmentCapacity,
    resolveEvidenceRichEssayCap,
    resolveEvidenceRichMcqCap,
    resolveEssayAttemptTarget,
    resolveEssayBankTarget,
    resolveMcqAttemptTarget,
    resolveMcqBankTarget,
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
            15_000,
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
        assert.equal(QUESTION_BANK_INTERACTIVE_PROFILE.minTarget, 1, "Interactive profile minTarget should be 1.");
        assert.equal(QUESTION_BANK_INTERACTIVE_PROFILE.maxTarget, 35, "Interactive profile maxTarget should be 35.");
        assert.equal(QUESTION_BANK_INTERACTIVE_PROFILE.wordDivisor, 120, "Interactive profile wordDivisor should be 120.");
        assert.equal(QUESTION_BANK_INTERACTIVE_PROFILE.batchSize, 12, "Interactive profile batchSize should be 12.");
        assert.equal(QUESTION_BANK_INTERACTIVE_PROFILE.minBatchSize, 6, "Interactive profile minBatchSize should be 6.");
        assert.equal(QUESTION_BANK_INTERACTIVE_PROFILE.minRounds, 3, "Interactive profile minRounds should be 3.");
        assert.equal(QUESTION_BANK_INTERACTIVE_PROFILE.maxRounds, 8, "Interactive profile maxRounds should be 8.");
        assert.equal(QUESTION_BANK_INTERACTIVE_PROFILE.noProgressLimit, 3, "Interactive profile noProgressLimit should be 3.");
        assert.equal(QUESTION_BANK_INTERACTIVE_PROFILE.timeBudgetMs, 90_000, "Interactive profile timeBudgetMs should be 90000.");
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
            1,
            "Thin single-passage topics should cap MCQ generation to the smallest viable grounded bank."
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
            8,
            "Rich multi-passage evidence should be capped conservatively enough to avoid oversizing the grounded MCQ bank."
        );
    },
    () => {
        const broadEvidence = Array.from({ length: 9 }, (_, index) => ({
            passageId: `p${index + 1}-0`,
            page: index,
            text: [
                `Policy ${index + 1}: riders must accept orders quickly and handle deliveries professionally.`,
                "Definition: integrity means honest status updates and respectful conduct.",
                "Example: confirm pickup, use GPS, and contact the customer politely upon arrival.",
                "Target: complete delivery steps in the prescribed order without falsifying updates.",
            ].join(" "),
            flags: index % 2 === 0 ? ["table"] : [],
        }));
        const resolution = resolveEvidenceRichMcqCap({
            evidence: broadEvidence,
            topicTitle: "Deep Dive: NIGHT MARKET RIDER TRAINING MANUAL",
            topicDescription: "Focused exploration of NIGHT MARKET RIDER TRAINING MANUAL.",
            sourcePassageIds: broadEvidence.map((entry) => entry.passageId),
            minTarget: 1,
            maxTarget: 40,
        });
        assert.equal(
            resolution.cap,
            14,
            "Broad catch-all topics should be capped aggressively enough to avoid impossible 40-question targets."
        );
        assert.equal(
            resolution.broadTopicPenaltyApplied,
            true,
            "Catch-all topics should activate the broad-topic penalty path."
        );
    },
    () => {
        const rebased = rebaseQuestionBankTargetAfterRun({
            targetCount: 40,
            initialCount: 0,
            finalCount: 1,
            addedCount: 1,
            outcome: "no_progress_limit_reached",
        });
        assert.equal(
            rebased,
            1,
            "Stalled runs should rebase the persisted MCQ target down to the grounded yield."
        );
    },
    () => {
        const kept = rebaseQuestionBankTargetAfterRun({
            targetCount: 24,
            initialCount: 0,
            finalCount: 15,
            addedCount: 15,
            outcome: "time_budget_reached",
        });
        assert.equal(
            kept,
            24,
            "Time-budget exits that still make strong progress should keep the requested target for follow-up generation."
        );
    },
    () => {
        const cap = calculateEvidenceRichEssayCap({
            evidence: [
                {
                    passageId: "p1-0",
                    page: 0,
                    text: "A fraction represents part of a whole. The numerator names the selected parts and the denominator names the total parts.",
                    flags: [],
                },
            ],
            minTarget: 1,
            maxTarget: 6,
        });
        assert.equal(
            cap,
            1,
            "Thin single-passage topics should only request one grounded essay question."
        );
    },
    () => {
        const broadEvidence = Array.from({ length: 9 }, (_, index) => ({
            passageId: `p${index + 1}-0`,
            page: index,
            text: [
                `Policy ${index + 1}: riders must accept orders quickly and handle deliveries professionally.`,
                "Definition: integrity means honest status updates and respectful conduct.",
                "Example: confirm pickup, use GPS, and contact the customer politely upon arrival.",
                "Target: complete delivery steps in the prescribed order without falsifying updates.",
            ].join(" "),
            flags: index % 2 === 0 ? ["table"] : [],
        }));
        const resolution = resolveEvidenceRichEssayCap({
            evidence: broadEvidence,
            topicTitle: "Deep Dive: NIGHT MARKET RIDER TRAINING MANUAL",
            topicDescription: "Focused exploration of NIGHT MARKET RIDER TRAINING MANUAL.",
            sourcePassageIds: broadEvidence.map((entry) => entry.passageId),
            minTarget: 1,
            maxTarget: 6,
        });
        assert.equal(
            resolution.cap,
            4,
            "Broad manual-style topics should cap essay readiness to a small grounded target."
        );
        assert.equal(
            resolution.broadTopicPenaltyApplied,
            true,
            "Broad manual-style topics should trigger the essay broad-topic penalty."
        );
    },
    () => {
        const bankTarget = resolveMcqBankTarget({
            topicTargetCount: 42,
            usableQuestionCount: 17,
        });
        const attemptTarget = resolveMcqAttemptTarget({
            topicTargetCount: 42,
            usableQuestionCount: 17,
        });
        assert.equal(bankTarget, 42, "MCQ bank target should preserve the grounded topic target when present.");
        assert.equal(
            attemptTarget,
            MCQ_ATTEMPT_MAX_COUNT,
            "MCQ attempt target should clamp a large grounded bank to the interactive max."
        );
    },
    () => {
        const bankTarget = resolveMcqBankTarget({
            topicTargetCount: 1,
            usableQuestionCount: 1,
        });
        const attemptTarget = resolveMcqAttemptTarget({
            topicTargetCount: 1,
            usableQuestionCount: 1,
        });
        assert.equal(bankTarget, 1, "MCQ bank target should preserve tiny grounded banks for diagnostics.");
        assert.equal(
            attemptTarget,
            MCQ_ATTEMPT_MIN_COUNT,
            "MCQ attempt target should enforce the minimum viable exam floor."
        );
    },
    () => {
        const target = clampGeneratedTargetToStoredTopicTarget({
            storedTargetCount: 1,
            targetCount: 5,
            minTarget: 1,
        });
        assert.equal(
            target,
            1,
            "Generated MCQ targets should honor an existing tiny grounded topic target."
        );
    },
    () => {
        const target = clampGeneratedTargetToStoredTopicTarget({
            storedTargetCount: undefined,
            targetCount: 5,
            minTarget: 1,
        });
        assert.equal(
            target,
            5,
            "Generated MCQ targets should stay unchanged when no grounded topic target exists yet."
        );
    },
    () => {
        const bankTarget = resolveEssayBankTarget({
            topicTargetCount: 9,
            usableQuestionCount: 4,
        });
        const attemptTarget = resolveEssayAttemptTarget({
            topicTargetCount: 9,
            usableQuestionCount: 4,
        });
        assert.equal(bankTarget, 9, "Essay bank target should track the grounded essay target.");
        assert.equal(attemptTarget, 9, "Essay attempt target should follow the grounded bank when it stays within bounds.");
    },
    () => {
        const capacity = resolveAssessmentCapacity({
            examFormat: "essay",
            topicTargetCount: 1,
            usableQuestionCount: 1,
        });
        assert.equal(capacity.bankTargetCount, 1, "Assessment capacity should expose the grounded bank target.");
        assert.equal(
            capacity.attemptTargetCount,
            ESSAY_ATTEMPT_MIN_COUNT,
            "Assessment capacity should keep a minimum viable essay attempt size."
        );
        assert.equal(
            capacity.maximumAttemptCount,
            ESSAY_ATTEMPT_MAX_COUNT,
            "Assessment capacity should expose the essay attempt ceiling."
        );
    },
];

for (const run of tests) {
    run();
}

console.log("question-bank-config-regression tests passed");
