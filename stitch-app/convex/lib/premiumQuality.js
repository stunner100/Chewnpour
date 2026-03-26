"use node";

const clamp = (value, min, max) => Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? Number(value) : min));

export const QUALITY_TIER_PREMIUM = "premium";
export const QUALITY_TIER_LIMITED = "limited";
export const QUALITY_TIER_UNAVAILABLE = "unavailable";

const PREMIUM_MIN_QUESTION_SCORE = 0.76;
const PREMIUM_MIN_RIGOR_SCORE = 0.62;
const PREMIUM_MIN_CLARITY_SCORE = 0.7;
const PREMIUM_MIN_DISTRACTOR_SCORE = 0.62;
const PREMIUM_MIN_PREMIUM_RATIO = 0.65;
const PREMIUM_MIN_DIVERSITY_RATIO = 0.55;

const normalizeText = (value) =>
    String(value || "")
        .replace(/\s+/g, " ")
        .trim();

export const normalizeQualityTier = (value) => {
    const normalized = normalizeText(value).toLowerCase();
    if (normalized === QUALITY_TIER_PREMIUM) return QUALITY_TIER_PREMIUM;
    if (normalized === QUALITY_TIER_LIMITED) return QUALITY_TIER_LIMITED;
    if (normalized === QUALITY_TIER_UNAVAILABLE) return QUALITY_TIER_UNAVAILABLE;
    return QUALITY_TIER_LIMITED;
};

const BLOOM_SCORES = {
    Remember: 0.34,
    Understand: 0.46,
    Apply: 0.64,
    Analyze: 0.82,
    Evaluate: 0.9,
    Create: 0.96,
};

const COGNITIVE_TASK_SCORES = {
    explain: 0.58,
    summarize: 0.46,
    define: 0.34,
    identify: 0.32,
    compare: 0.76,
    diagnose: 0.84,
    interpret: 0.8,
    critique: 0.9,
    justify: 0.88,
    design: 0.94,
    evaluate: 0.9,
    analyze: 0.84,
    apply: 0.68,
};

const difficultyScore = (difficulty) => {
    const normalized = normalizeText(difficulty).toLowerCase();
    if (normalized === "hard") return 0.9;
    if (normalized === "easy") return 0.52;
    return 0.72;
};

const bloomScore = (bloomLevel) => BLOOM_SCORES[normalizeText(bloomLevel)] || 0.45;

const inferQuestionTask = ({ cognitiveTask, questionText }) => {
    const explicit = normalizeText(cognitiveTask).toLowerCase();
    if (explicit) return explicit;

    const text = normalizeText(questionText).toLowerCase();
    const matches = [
        ["compare", /\bcompare|contrast|difference|best distinguishes\b/],
        ["diagnose", /\bdiagnose|most likely cause|error|mistake|incorrect approach\b/],
        ["interpret", /\binterpret|what does this suggest|what can be inferred|best explains\b/],
        ["critique", /\bcritique|evaluate the claim|assess the argument\b/],
        ["justify", /\bjustify|support your answer|why is the best answer\b/],
        ["design", /\bdesign|propose|develop a plan|construct\b/],
        ["analyze", /\banalyze|relationship|mechanism|reasoning\b/],
        ["apply", /\bapply|use the information|based on this scenario\b/],
    ];
    return matches.find(([, pattern]) => pattern.test(text))?.[0] || "";
};

const inferClarityScore = (questionText) => {
    const text = normalizeText(questionText);
    if (!text) return 0.35;
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const awkwardPenalty = /\bin what\b|\baccording to the evidence above\b|\bstrictly grounded\b/i.test(text) ? 0.18 : 0;
    const punctuationPenalty = /[?!.]{2,}/.test(text) ? 0.12 : 0;
    const lengthPenalty = wordCount < 8 ? 0.22 : wordCount > 42 ? 0.16 : 0;
    return clamp(0.9 - awkwardPenalty - punctuationPenalty - lengthPenalty, 0, 1);
};

const inferDistractorScore = (question) => {
    const options = Array.isArray(question?.options) ? question.options : [];
    if (options.length < 2) return 0.5;
    const normalized = options
        .map((option) => normalizeText(option?.text || option))
        .filter(Boolean);
    if (normalized.length < 2) return 0.5;

    const lengths = normalized.map((option) => option.length);
    const averageLength = lengths.reduce((sum, length) => sum + length, 0) / lengths.length;
    const variance = lengths.reduce((sum, length) => sum + Math.abs(length - averageLength), 0) / lengths.length;
    const duplicatePenalty = new Set(normalized.map((option) => option.toLowerCase())).size < normalized.length ? 0.4 : 0;
    const trivialPenalty = normalized.some((option) => /all of the above|none of the above|insufficient information/i.test(option)) ? 0.35 : 0;
    const balanceBonus = variance <= 12 ? 0.18 : variance <= 24 ? 0.08 : 0;
    return clamp(0.56 + balanceBonus - duplicatePenalty - trivialPenalty, 0, 1);
};

export const buildQuestionDiversityCluster = (question) => {
    const outcomeKey = normalizeText(question?.outcomeKey).toLowerCase() || "outcome:none";
    const scenario = normalizeText(question?.authenticContext || question?.scenarioFrame)
        .toLowerCase()
        .slice(0, 48);
    const questionType = normalizeText(question?.questionType).toLowerCase() || "question";
    return `${questionType}::${outcomeKey}::${scenario || "context:none"}`;
};

export const evaluateQuestionQuality = (question) => {
    const questionType = normalizeText(question?.questionType).toLowerCase();
    const inferredTask = inferQuestionTask(question);
    const rigorScore = clamp(
        bloomScore(question?.bloomLevel) * 0.55
        + (COGNITIVE_TASK_SCORES[inferredTask] || 0.48) * 0.25
        + difficultyScore(question?.difficulty) * 0.2,
        0,
        1
    );
    const clarityScore = inferClarityScore(question?.questionText);
    const distractorScore = questionType === "essay"
        ? undefined
        : clamp(
            questionType === "multiple_choice"
                ? inferDistractorScore(question)
                : questionType === "true_false"
                    ? inferClarityScore(question?.questionText) * 0.9
                    : 0.66,
            0,
            1
        );
    const groundingScore = clamp(question?.groundingScore || question?.qualityScore || question?.rankingScore || 0, 0, 1);
    const citationScore = clamp((Array.isArray(question?.citations) ? question.citations.length : 0) / 3, 0, 1);
    const qualityScore = clamp(
        groundingScore * 0.24
        + rigorScore * 0.34
        + clarityScore * 0.22
        + (distractorScore === undefined ? 0.1 : distractorScore * 0.14)
        + citationScore * 0.06,
        0,
        1
    );

    const warnings = [];
    if (rigorScore < PREMIUM_MIN_RIGOR_SCORE) warnings.push("low_rigor");
    if (clarityScore < PREMIUM_MIN_CLARITY_SCORE) warnings.push("low_clarity");
    if (distractorScore !== undefined && distractorScore < PREMIUM_MIN_DISTRACTOR_SCORE) warnings.push("weak_distractors");
    const qualityTier =
        qualityScore >= PREMIUM_MIN_QUESTION_SCORE
        && rigorScore >= PREMIUM_MIN_RIGOR_SCORE
        && clarityScore >= PREMIUM_MIN_CLARITY_SCORE
        && (distractorScore === undefined || distractorScore >= PREMIUM_MIN_DISTRACTOR_SCORE)
            ? QUALITY_TIER_PREMIUM
            : QUALITY_TIER_LIMITED;

    return {
        qualityTier,
        premiumTargetMet: qualityTier === QUALITY_TIER_PREMIUM,
        qualityWarnings: warnings,
        qualitySignals: {
            qualityScore,
            groundingScore,
            rigorScore,
            clarityScore,
            distractorScore,
            cognitiveTask: inferredTask || undefined,
            diversityCluster: buildQuestionDiversityCluster(question),
        },
    };
};

export const summarizeQuestionSetQuality = (questions) => {
    const items = Array.isArray(questions) ? questions.filter(Boolean) : [];
    if (items.length === 0) {
        return {
            qualityTier: QUALITY_TIER_UNAVAILABLE,
            premiumTargetMet: false,
            qualityWarnings: ["no_usable_questions"],
            qualitySignals: {
                questionCount: 0,
                premiumQuestionRatio: 0,
                distinctOutcomeCount: 0,
                diversityRatio: 0,
                averageQualityScore: 0,
            },
        };
    }

    const premiumCount = items.filter((question) => normalizeQualityTier(question?.qualityTier) === QUALITY_TIER_PREMIUM).length;
    const averageQualityScore = items.reduce(
        (sum, question) => sum + clamp(question?.qualityScore || 0, 0, 1),
        0
    ) / items.length;
    const uniqueOutcomes = new Set(items.map((question) => normalizeText(question?.outcomeKey).toLowerCase()).filter(Boolean));
    const uniqueClusters = new Set(items.map((question) => buildQuestionDiversityCluster(question)));
    const diversityRatio = uniqueClusters.size / Math.max(1, items.length);
    const premiumQuestionRatio = premiumCount / Math.max(1, items.length);
    const warnings = [];
    const aggregatedFlags = new Set(
        items.flatMap((question) => {
            const flags = [];
            if (Array.isArray(question?.qualityFlags)) {
                flags.push(...question.qualityFlags);
            }
            if (Array.isArray(question?.qualityWarnings)) {
                flags.push(...question.qualityWarnings);
            }
            return flags.map((flag) => normalizeText(flag).toLowerCase()).filter(Boolean);
        })
    );
    if (premiumQuestionRatio < PREMIUM_MIN_PREMIUM_RATIO) warnings.push("premium_ratio_missed");
    if (diversityRatio < PREMIUM_MIN_DIVERSITY_RATIO) warnings.push("low_diversity");
    if (uniqueOutcomes.size < Math.min(3, items.length)) warnings.push("narrow_outcome_coverage");
    if (aggregatedFlags.has("fallback_evidence")) warnings.push("fallback_evidence");

    const qualityTier =
        premiumQuestionRatio >= PREMIUM_MIN_PREMIUM_RATIO
        && diversityRatio >= PREMIUM_MIN_DIVERSITY_RATIO
        && averageQualityScore >= PREMIUM_MIN_QUESTION_SCORE
        && !aggregatedFlags.has("fallback_evidence")
            ? QUALITY_TIER_PREMIUM
            : QUALITY_TIER_LIMITED;

    return {
        qualityTier,
        premiumTargetMet: qualityTier === QUALITY_TIER_PREMIUM,
        qualityWarnings: warnings,
        qualitySignals: {
            questionCount: items.length,
            premiumQuestionRatio,
            distinctOutcomeCount: uniqueOutcomes.size,
            distinctClusterCount: uniqueClusters.size,
            diversityRatio,
            averageQualityScore,
        },
    };
};

export const forceQuestionLimitedTier = (question, warning = "fallback_evidence") => {
    const normalizedWarning = normalizeText(warning).toLowerCase() || "fallback_evidence";
    const qualityFlags = new Set(
        (Array.isArray(question?.qualityFlags) ? question.qualityFlags : [])
            .map((flag) => normalizeText(flag).toLowerCase())
            .filter(Boolean)
    );
    qualityFlags.add(normalizedWarning);

    return {
        ...question,
        qualityTier: QUALITY_TIER_LIMITED,
        qualityFlags: Array.from(qualityFlags),
    };
};

export const compareQuestionsByPremiumQuality = (left, right) => {
    const leftTier = normalizeQualityTier(left?.qualityTier);
    const rightTier = normalizeQualityTier(right?.qualityTier);
    if (leftTier !== rightTier) {
        return leftTier === QUALITY_TIER_PREMIUM ? -1 : 1;
    }

    const scoreKeys = [
        "qualityScore",
        "rigorScore",
        "clarityScore",
        "distractorScore",
        "groundingScore",
    ];
    for (const key of scoreKeys) {
        const delta = clamp(right?.[key] || 0, 0, 1) - clamp(left?.[key] || 0, 0, 1);
        if (Math.abs(delta) > 0.0001) {
            return delta > 0 ? 1 : -1;
        }
    }
    return 0;
};
