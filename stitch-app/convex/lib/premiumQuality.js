"use node";

export const HARD_OBJECTIVE_DIFFICULTY_DISTRIBUTION = {
    easy: 0.1,
    medium: 0.3,
    hard: 0.6,
};

export const PREMIUM_MIN_QUESTION_SCORE = 0.8;
export const PREMIUM_MIN_RIGOR_SCORE = 0.74;
export const PREMIUM_MIN_CLARITY_SCORE = 0.72;
export const PREMIUM_MIN_DISTRACTOR_SCORE = 0.7;
export const PREMIUM_MIN_PREMIUM_RATIO = 0.75;
export const PREMIUM_MIN_DIVERSITY_RATIO = 0.58;

const clamp = (value, min = 0, max = 1) =>
    Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? Number(value) : min));

const normalizeText = (value) =>
    String(value || "")
        .replace(/\s+/g, " ")
        .trim();

const normalizeTokenKey = (value) =>
    normalizeText(value)
        .toLowerCase()
        .replace(/[^a-z0-9%]+/g, " ")
        .trim();

const normalizeDifficulty = (value) => {
    const difficulty = normalizeTokenKey(value);
    if (difficulty === "easy" || difficulty === "medium" || difficulty === "hard") {
        return difficulty;
    }
    return "medium";
};

const normalizeBloomLevel = (value) => {
    const normalized = normalizeTokenKey(value);
    if (!normalized) return "";
    const parts = normalized.split(" ").filter(Boolean);
    return parts.length > 0
        ? `${parts[0].charAt(0).toUpperCase()}${parts[0].slice(1)}`
        : "";
};

const BLOOM_RIGOR_SCORES = {
    Remember: 0.12,
    Understand: 0.24,
    Apply: 0.8,
    Analyze: 0.9,
    Evaluate: 0.94,
    Create: 0.98,
};

const HIGH_RIGOR_PATTERNS = [
    /\bapply\b/i,
    /\banaly[sz]e\b/i,
    /\bdiagnos(?:e|is|ing)\b/i,
    /\bcompare\b/i,
    /\bcontrast\b/i,
    /\bdifferentiat(?:e|ing|ion)\b/i,
    /\binterpret\b/i,
    /\bcalculate\b/i,
    /\bevaluate\b/i,
    /\bdetermine\b/i,
    /\bmost likely\b/i,
    /\bbest explains?\b/i,
    /\bwhat should\b/i,
    /\bwhich action\b/i,
];

const SCENARIO_PATTERNS = [
    /\bscenario\b/i,
    /\bcase\b/i,
    /\bstudent\b/i,
    /\bpatient\b/i,
    /\bteacher\b/i,
    /\bclient\b/i,
    /\bteam\b/i,
    /\borganisation\b/i,
    /\borganization\b/i,
    /\bfor example\b/i,
    /\bgiven that\b/i,
    /\bbased on\b/i,
    /\bin this situation\b/i,
    /\bunder these conditions\b/i,
];

const RECALL_PATTERNS = [
    /^\s*what is\b/i,
    /^\s*which statement defines\b/i,
    /^\s*which option defines\b/i,
    /^\s*who is\b/i,
    /^\s*when is\b/i,
    /^\s*where is\b/i,
    /\bdefinition\b/i,
    /\bmain idea\b/i,
    /\baccording to the text\b/i,
];

const DISALLOWED_OPTION_PATTERNS = [
    /^all of the above$/i,
    /^none of the above$/i,
    /^cannot be determined/i,
    /^insufficient information/i,
    /^not enough information/i,
    /^unknown$/i,
];

const tokenizeOption = (value) =>
    normalizeTokenKey(value)
        .split(" ")
        .map((token) => token.trim())
        .filter((token) => token.length >= 3);

const computeLexicalOverlap = (left, right) => {
    const leftTokens = new Set(tokenizeOption(left));
    const rightTokens = new Set(tokenizeOption(right));
    if (leftTokens.size === 0 || rightTokens.size === 0) {
        return 0;
    }
    let overlap = 0;
    for (const token of leftTokens) {
        if (rightTokens.has(token)) {
            overlap += 1;
        }
    }
    return overlap / Math.max(leftTokens.size, rightTokens.size);
};

const scoreRigor = (candidate) => {
    const bloomLevel = normalizeBloomLevel(candidate?.bloomLevel);
    const bloomScore = BLOOM_RIGOR_SCORES[bloomLevel] ?? 0.18;
    const difficulty = normalizeDifficulty(candidate?.difficulty);
    const difficultyScore = difficulty === "hard" ? 1 : difficulty === "medium" ? 0.72 : 0.34;
    const corpus = [
        candidate?.questionText,
        candidate?.learningObjective,
        candidate?.explanation,
        candidate?.authenticContext,
    ].map(normalizeText).join(" ");

    const highRigorHits = HIGH_RIGOR_PATTERNS.reduce(
        (count, pattern) => count + (pattern.test(corpus) ? 1 : 0),
        0
    );
    const scenarioHits = SCENARIO_PATTERNS.reduce(
        (count, pattern) => count + (pattern.test(corpus) ? 1 : 0),
        0
    );
    const recallHits = RECALL_PATTERNS.reduce(
        (count, pattern) => count + (pattern.test(corpus) ? 1 : 0),
        0
    );

    const advancedTaskScore = clamp(highRigorHits / 3, 0, 1);
    const scenarioScore = clamp(scenarioHits / 2, 0, 1);
    const recallPenalty = recallHits > 0 && scenarioHits === 0 ? 0.32 : recallHits > 0 ? 0.12 : 0;

    return clamp(
        bloomScore * 0.4
        + difficultyScore * 0.22
        + advancedTaskScore * 0.24
        + scenarioScore * 0.14
        - recallPenalty,
        0,
        1
    );
};

const scoreClarity = (candidate) => {
    const questionText = normalizeText(candidate?.questionText);
    const explanation = normalizeText(candidate?.explanation);
    const options = Array.isArray(candidate?.options) ? candidate.options : [];

    const questionLength = questionText.length;
    const questionShapeScore =
        questionLength >= 55 && questionLength <= 220
            ? 1
            : questionLength >= 36 && questionLength <= 260
                ? 0.82
                : 0.58;
    const punctuationPenalty = /[?!]{2,}|\.{4,}/.test(questionText) ? 0.12 : 0;
    const explanationScore =
        explanation.length >= 40 && explanation.length <= 280
            ? 1
            : explanation.length >= 18
                ? 0.78
                : 0.52;
    const optionLengths = options.map((option) => normalizeText(option?.text).length).filter(Boolean);
    const balancedOptions = optionLengths.length >= 4
        ? 1 - clamp(
            (Math.max(...optionLengths) - Math.min(...optionLengths)) / 90,
            0,
            1
        ) * 0.35
        : 0.68;

    return clamp(
        questionShapeScore * 0.5
        + explanationScore * 0.25
        + balancedOptions * 0.25
        - punctuationPenalty,
        0,
        1
    );
};

const scoreDistractors = (candidate) => {
    const options = (Array.isArray(candidate?.options) ? candidate.options : [])
        .map((option) => normalizeText(option?.text))
        .filter(Boolean)
        .slice(0, 4);
    if (options.length < 4) {
        return 0.2;
    }

    const uniqueKeyCount = new Set(options.map((option) => normalizeTokenKey(option))).size;
    const uniquenessScore = uniqueKeyCount === 4 ? 1 : uniqueKeyCount / 4;
    const disallowedPenalty = options.some((option) =>
        DISALLOWED_OPTION_PATTERNS.some((pattern) => pattern.test(option))
    )
        ? 0.35
        : 0;

    const lexicalOverlaps = [];
    for (let index = 0; index < options.length; index += 1) {
        for (let nestedIndex = index + 1; nestedIndex < options.length; nestedIndex += 1) {
            lexicalOverlaps.push(computeLexicalOverlap(options[index], options[nestedIndex]));
        }
    }
    const averageOverlap = lexicalOverlaps.length > 0
        ? lexicalOverlaps.reduce((sum, value) => sum + value, 0) / lexicalOverlaps.length
        : 0;
    const lengthValues = options.map((option) => option.length);
    const balancePenalty = clamp(
        (Math.max(...lengthValues) - Math.min(...lengthValues)) / 100,
        0,
        0.3
    );

    return clamp(
        uniquenessScore * 0.45
        + (1 - averageOverlap) * 0.35
        + (1 - balancePenalty) * 0.2
        - disallowedPenalty,
        0,
        1
    );
};

const scoreDiversity = (candidate) => {
    const questionText = normalizeText(candidate?.questionText);
    const tokens = Array.from(new Set(tokenizeOption(questionText)));
    return clamp(tokens.length / 12, 0, 1);
};

export const evaluateObjectiveQuestionQuality = (candidate) => {
    const rigorScore = scoreRigor(candidate);
    const clarityScore = scoreClarity(candidate);
    const distractorScore = scoreDistractors(candidate);
    const groundingScore = clamp(candidate?.groundingScore ?? 0, 0, 1);
    const diversityRatio = scoreDiversity(candidate);
    const difficulty = normalizeDifficulty(candidate?.difficulty);
    const difficultyBonus = difficulty === "hard" ? 0.06 : difficulty === "medium" ? 0.03 : 0;

    const qualityScore = clamp(
        rigorScore * 0.34
        + distractorScore * 0.24
        + groundingScore * 0.24
        + clarityScore * 0.18
        + difficultyBonus,
        0,
        1
    );

    const qualityFlags = [];
    if (normalizeBloomLevel(candidate?.bloomLevel) === "Remember" || normalizeBloomLevel(candidate?.bloomLevel) === "Understand") {
        qualityFlags.push("low_bloom");
    }
    if (RECALL_PATTERNS.some((pattern) => pattern.test(normalizeText(candidate?.questionText)))) {
        qualityFlags.push("recall_style");
    }
    if (rigorScore < PREMIUM_MIN_RIGOR_SCORE) {
        qualityFlags.push("low_rigor");
    }
    if (clarityScore < PREMIUM_MIN_CLARITY_SCORE) {
        qualityFlags.push("low_clarity");
    }
    if (distractorScore < PREMIUM_MIN_DISTRACTOR_SCORE) {
        qualityFlags.push("weak_distractors");
    }
    if (groundingScore < 0.85) {
        qualityFlags.push("low_grounding_margin");
    }

    const premiumRatio = clamp(
        (qualityScore + rigorScore + distractorScore + clarityScore + groundingScore) / 5,
        0,
        1
    );

    const qualityTier =
        qualityScore >= PREMIUM_MIN_QUESTION_SCORE
        && rigorScore >= PREMIUM_MIN_RIGOR_SCORE
        && clarityScore >= PREMIUM_MIN_CLARITY_SCORE
        && distractorScore >= PREMIUM_MIN_DISTRACTOR_SCORE
            ? "premium"
            : qualityScore >= 0.72
                ? "strong"
                : "standard";

    return {
        qualityScore,
        qualityTier,
        rigorScore,
        clarityScore,
        distractorScore,
        groundingScore,
        premiumRatio,
        diversityRatio,
        difficulty,
        qualityFlags,
    };
};

export const passesObjectivePremiumQuality = (candidate) => {
    const quality = evaluateObjectiveQuestionQuality(candidate);
    return (
        quality.qualityScore >= PREMIUM_MIN_QUESTION_SCORE
        && quality.rigorScore >= PREMIUM_MIN_RIGOR_SCORE
        && quality.clarityScore >= PREMIUM_MIN_CLARITY_SCORE
        && quality.distractorScore >= PREMIUM_MIN_DISTRACTOR_SCORE
        && quality.premiumRatio >= PREMIUM_MIN_PREMIUM_RATIO
        && quality.diversityRatio >= PREMIUM_MIN_DIVERSITY_RATIO
    );
};

const OBJECTIVE_DIFFICULTY_PRIORITY = {
    hard: 3,
    medium: 2,
    easy: 1,
};

export const buildObjectiveSelectionScore = (candidate) => {
    const quality = evaluateObjectiveQuestionQuality(candidate);
    const difficultyPriority = OBJECTIVE_DIFFICULTY_PRIORITY[quality.difficulty] || 0;
    return quality.qualityScore + difficultyPriority * 0.05 + quality.rigorScore * 0.05;
};

export const compareObjectiveQuestionsByQuality = (left, right) => {
    const leftScore = buildObjectiveSelectionScore(left);
    const rightScore = buildObjectiveSelectionScore(right);
    if (rightScore !== leftScore) {
        return rightScore - leftScore;
    }

    const leftDifficultyPriority =
        OBJECTIVE_DIFFICULTY_PRIORITY[normalizeDifficulty(left?.difficulty)] || 0;
    const rightDifficultyPriority =
        OBJECTIVE_DIFFICULTY_PRIORITY[normalizeDifficulty(right?.difficulty)] || 0;
    if (rightDifficultyPriority !== leftDifficultyPriority) {
        return rightDifficultyPriority - leftDifficultyPriority;
    }

    return normalizeText(left?.questionText).localeCompare(normalizeText(right?.questionText));
};
