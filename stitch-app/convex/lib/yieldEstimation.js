"use node";

const OBJECTIVE_OPERATIONS = new Set([
    "recognition",
    "recall",
    "discrimination",
    "application",
    "comparison",
    "inference",
]);

const ESSAY_OPERATIONS = new Set([
    "evaluation",
    "synthesis",
    "inference",
]);

const clampInteger = (value, min, max) => {
    const numeric = Math.round(Number(value || 0));
    if (!Number.isFinite(numeric)) return min;
    return Math.max(min, Math.min(max, numeric));
};

const normalizeClaimList = (claims) =>
    (Array.isArray(claims) ? claims : []).filter((claim) => String(claim?.status || "active") !== "merged");

export const computeDynamicYieldTargets = (subClaims, distractors = [], config = {}) => {
    const activeClaims = normalizeClaimList(subClaims);
    const distractorList = Array.isArray(distractors) ? distractors : [];

    const minObjectiveTarget = clampInteger(config.minObjectiveTarget ?? 4, 1, 30);
    const maxObjectiveTarget = clampInteger(config.maxObjectiveTarget ?? 18, minObjectiveTarget, 40);
    const minEssayTarget = clampInteger(config.minEssayTarget ?? 1, 0, 10);
    const maxEssayTarget = clampInteger(config.maxEssayTarget ?? 4, Math.max(1, minEssayTarget), 12);
    const expectedPassRate = Math.max(0.2, Math.min(1, Number(config.expectedPassRate ?? 0.65)));

    let totalObjectiveSeeds = 0;
    let totalClaimYield = 0;
    let essayCapableClaims = 0;

    for (const claim of activeClaims) {
        const operations = Array.isArray(claim?.cognitiveOperations) ? claim.cognitiveOperations : [];
        const objectiveOpCount = operations.filter((op) => OBJECTIVE_OPERATIONS.has(String(op || ""))).length;
        const essayCapable = operations.some((op) => ESSAY_OPERATIONS.has(String(op || "")));
        totalObjectiveSeeds += Math.max(1, objectiveOpCount);
        totalClaimYield += Math.max(1, Math.round(Number(claim?.questionYieldEstimate || objectiveOpCount || 1)));
        if (essayCapable) essayCapableClaims += 1;
    }

    const avgDistractorsPerClaim = activeClaims.length > 0
        ? distractorList.length / activeClaims.length
        : 0;
    const distractorBoost = activeClaims.length > 0
        ? Math.min(1.35, 1 + avgDistractorsPerClaim * 0.12)
        : 1;
    const rawObjectiveYield = Math.max(
        totalObjectiveSeeds * 0.55,
        totalClaimYield * expectedPassRate * distractorBoost,
    );
    const totalObjectiveTarget = clampInteger(
        Math.floor(rawObjectiveYield),
        minObjectiveTarget,
        maxObjectiveTarget,
    );

    const mcqTarget = Math.max(1, Math.ceil(totalObjectiveTarget * 0.5));
    const trueFalseTarget = Math.max(0, Math.floor(totalObjectiveTarget * 0.25));
    const fillInTarget = Math.max(0, totalObjectiveTarget - mcqTarget - trueFalseTarget);

    const rawEssayYield = Math.floor(essayCapableClaims / 3);
    const essayTarget = activeClaims.length === 0
        ? 0
        : clampInteger(rawEssayYield, minEssayTarget, maxEssayTarget);

    let confidence = "low";
    if (activeClaims.length >= 10 && avgDistractorsPerClaim >= 1.5) {
        confidence = "high";
    } else if (activeClaims.length >= 5) {
        confidence = "medium";
    }

    return {
        mcqTarget,
        trueFalseTarget,
        fillInTarget,
        essayTarget,
        totalObjectiveTarget,
        confidence,
        reasoning: `${activeClaims.length} active claims, ${totalObjectiveSeeds} objective seeds, ${essayCapableClaims} essay-capable claims, ${distractorList.length} distractors, expected pass rate ${expectedPassRate}.`,
    };
};
