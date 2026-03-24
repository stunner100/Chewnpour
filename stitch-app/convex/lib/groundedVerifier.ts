"use node";

import {
    doesQuoteMatchPassage,
    normalizeCitationQuote,
    type GroundedEvidenceIndex,
} from "./groundedEvidenceIndex";
import type {
    AssessmentBlueprint,
    GroundedCitation,
    GroundedConceptCandidate,
    GroundedFillBlankCandidate,
    GroundedEssayCandidate,
    GroundedMultipleChoiceCandidate,
    GroundedTrueFalseCandidate,
} from "./groundedGeneration";
import { getAssessmentQuestionMetadataIssues } from "./assessmentBlueprint.js";
import {
    QUESTION_TYPE_FILL_BLANK,
    QUESTION_TYPE_MULTIPLE_CHOICE,
    QUESTION_TYPE_TRUE_FALSE,
} from "./objectiveExam.js";

export type GroundedContentType =
    | "multiple_choice"
    | "true_false"
    | "fill_blank"
    | "essay"
    | "concept";

export const GROUNDED_MIN_SCORE: Record<GroundedContentType, number> = {
    multiple_choice: 0.85,
    true_false: 0.85,
    fill_blank: 0.88,
    essay: 0.88,
    concept: 0.9,
};

export type GroundingCheckResult = {
    deterministicPass: boolean;
    deterministicScore: number;
    reasons: string[];
    validCitations: GroundedCitation[];
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const SUPPORT_STOP_WORDS = new Set([
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "how",
    "in",
    "is",
    "it",
    "of",
    "on",
    "or",
    "that",
    "the",
    "their",
    "this",
    "to",
    "was",
    "were",
    "what",
    "when",
    "which",
    "who",
    "why",
    "with",
]);

const normalizeSupportText = (value: string) =>
    String(value || "")
        .toLowerCase()
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201c\u201d]/g, '"')
        .replace(/\b(\d+(?:\.\d+)?)\s*percent\b/g, "$1%")
        .replace(/[^a-z0-9%]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

const extractNumericTokens = (value: string) =>
    Array.from(
        new Set(
            normalizeSupportText(value).match(/\b\d+(?:\.\d+)?%?\b/g) || []
        )
    );

const extractSupportTokens = (value: string) =>
    normalizeSupportText(value)
        .split(" ")
        .map((token) => token.trim())
        .filter((token) => token.length >= 3)
        .filter((token) => !SUPPORT_STOP_WORDS.has(token))
        .filter((token) => !/^\d+(?:\.\d+)?%?$/.test(token));

const buildCitationSupportContext = (citations: GroundedCitation[], index: GroundedEvidenceIndex) => {
    const passageById = new Map((index?.passages || []).map((passage) => [passage.passageId, passage]));
    const quoteSeen = new Set<string>();
    const passageSeen = new Set<string>();
    const quotes: string[] = [];
    const passages: string[] = [];

    for (const citation of citations) {
        const normalizedQuote = normalizeSupportText(citation.quote);
        if (normalizedQuote && !quoteSeen.has(normalizedQuote)) {
            quoteSeen.add(normalizedQuote);
            quotes.push(String(citation.quote || "").trim());
        }

        const passage = passageById.get(citation.passageId);
        const passageText = String(passage?.text || "").trim();
        if (passageText && !passageSeen.has(citation.passageId)) {
            passageSeen.add(citation.passageId);
            passages.push(passageText);
        }
    }

    return {
        quoteText: quotes.join("\n\n").trim(),
        passageText: passages.join("\n\n").trim(),
    };
};

const computeTokenCoverage = (candidateText: string, supportText: string) => {
    const candidateTokens = extractSupportTokens(candidateText);
    if (candidateTokens.length === 0) return 0;
    const supportTokens = new Set(extractSupportTokens(supportText));
    if (supportTokens.size === 0) return 0;

    let matched = 0;
    for (const token of candidateTokens) {
        if (supportTokens.has(token)) {
            matched += 1;
        }
    }
    return matched / candidateTokens.length;
};

const isTextSupportedByEvidence = (candidateText: string, supportText: string) => {
    const normalizedCandidate = normalizeSupportText(candidateText);
    const normalizedSupport = normalizeSupportText(supportText);
    if (!normalizedCandidate || !normalizedSupport) return false;

    const numericTokens = extractNumericTokens(candidateText);
    if (numericTokens.length > 0) {
        const supportNumericTokens = new Set(extractNumericTokens(supportText));
        const allNumbersSupported = numericTokens.every((token) => supportNumericTokens.has(token));
        if (!allNumbersSupported) {
            return false;
        }
    }

    if (normalizedSupport.includes(normalizedCandidate)) {
        return true;
    }

    const candidateTokens = extractSupportTokens(candidateText);
    if (candidateTokens.length === 0) {
        return numericTokens.length > 0;
    }

    const coverage = computeTokenCoverage(candidateText, supportText);
    if (candidateTokens.length <= 3) return coverage >= 1;
    if (candidateTokens.length <= 6) return coverage >= 0.6;
    if (candidateTokens.length <= 10) return coverage >= 0.5;
    return coverage >= 0.45;
};

const normalizeCitation = (value: any): GroundedCitation | null => {
    if (!value || typeof value !== "object") return null;
    const passageId = String(value.passageId || "").trim();
    const page = Number(value.page ?? 0);
    const startChar = Number(value.startChar ?? 0);
    const endChar = Number(value.endChar ?? 0);
    const quote = String(value.quote || "").trim();
    if (!passageId || !quote) return null;
    return {
        passageId,
        page: Number.isFinite(page) ? Math.max(0, Math.floor(page)) : 0,
        startChar: Number.isFinite(startChar) ? Math.max(0, Math.floor(startChar)) : 0,
        endChar: Number.isFinite(endChar) ? Math.max(0, Math.floor(endChar)) : 0,
        quote,
    };
};

const validateCitationSpans = (citations: GroundedCitation[], index: GroundedEvidenceIndex) => {
    const passageById = new Map((index?.passages || []).map((passage) => [passage.passageId, passage]));
    const valid: GroundedCitation[] = [];
    const reasons: string[] = [];

    for (const citation of citations) {
        const passage = passageById.get(citation.passageId);
        if (!passage) {
            reasons.push(`citation passage not found: ${citation.passageId}`);
            continue;
        }

        if (!doesQuoteMatchPassage(citation.quote, passage.text)) {
            reasons.push(`citation quote mismatch: ${citation.passageId}`);
            continue;
        }

        const normalizedPassage = normalizeCitationQuote(passage.text);
        const normalizedQuote = normalizeCitationQuote(citation.quote);
        const quoteIndex = normalizedPassage.indexOf(normalizedQuote);
        const computedStart = quoteIndex >= 0
            ? quoteIndex
            : Math.max(0, Math.min(
                Number.isFinite(Number(citation.startChar))
                    ? Math.floor(Number(citation.startChar))
                    : 0,
                Math.max(0, normalizedPassage.length - 1)
            ));
        const computedEnd = quoteIndex >= 0
            ? quoteIndex + normalizedQuote.length
            : Math.max(
                computedStart + 1,
                Math.min(
                    normalizedPassage.length,
                    computedStart + Math.max(1, normalizedQuote.length)
                )
            );
        if (quoteIndex < 0) {
            reasons.push(`citation span approximated: ${citation.passageId}`);
        }
        valid.push({
            ...citation,
            startChar: computedStart,
            endChar: computedEnd,
            page: passage.page,
        });
    }

    return { valid, reasons };
};

const hasMinimalMultipleChoice = (candidate: GroundedMultipleChoiceCandidate) =>
    String(candidate?.questionText || "").trim().length >= 12;

const hasUsableTrueFalse = (candidate: GroundedTrueFalseCandidate) => {
    const questionText = String(candidate?.questionText || "").trim();
    const options = Array.isArray(candidate?.options) ? candidate.options : [];
    const optionTexts = options.map((option) => String(option?.text || "").trim().toLowerCase());
    const correctCount = options.filter((option) => option?.isCorrect === true).length;
    return questionText.length >= 12
        && options.length === 2
        && correctCount === 1
        && optionTexts.includes("true")
        && optionTexts.includes("false");
};

const hasUsableFillBlank = (candidate: GroundedFillBlankCandidate) => {
    const templateParts = Array.isArray(candidate?.templateParts) ? candidate.templateParts : [];
    const acceptedAnswers = Array.isArray(candidate?.acceptedAnswers) ? candidate.acceptedAnswers : [];
    const blanks = templateParts.filter((entry) => entry === "__").length;
    return String(candidate?.questionText || "").trim().length >= 12
        && blanks === 1
        && acceptedAnswers.filter((value) => String(value || "").trim()).length > 0;
};

const hasUsableEssay = (candidate: GroundedEssayCandidate) => {
    return String(candidate.questionText || "").trim().length >= 12
        && String(candidate.correctAnswer || "").trim().length >= 16;
};

const hasUsableConcept = (candidate: GroundedConceptCandidate) => {
    const template = Array.isArray(candidate.template) ? candidate.template : [];
    const answers = Array.isArray(candidate.answers) ? candidate.answers : [];
    const blanks = template.filter((entry) => entry === "__").length;
    return template.length > 0 && answers.length > 0 && blanks === answers.length;
};

const validateObjectiveSupport = (
    candidate: GroundedMultipleChoiceCandidate | GroundedTrueFalseCandidate | GroundedFillBlankCandidate,
    type: GroundedContentType,
    supportText: string,
) => {
    if (type === QUESTION_TYPE_TRUE_FALSE) {
        const options = Array.isArray(candidate?.options) ? candidate.options : [];
        const correctOptions = options.filter((option) => option && option.isCorrect === true);
        if (correctOptions.length !== 1) {
            return {
                pass: false,
                reasons: ["invalid true_false structure"],
            };
        }

        const statementText = String(candidate?.questionText || "").trim();
        const truthValue = String(correctOptions[0]?.text || "").trim().toLowerCase();
        if (!statementText) {
            return {
                pass: false,
                reasons: ["missing true_false statement text"],
            };
        }
        if (!supportText) {
            return {
                pass: false,
                reasons: ["missing citation support text"],
            };
        }

        const statementSupported = isTextSupportedByEvidence(statementText, supportText);
        if (truthValue === "true") {
            return statementSupported
                ? { pass: true, reasons: [] as string[] }
                : { pass: false, reasons: ["true statement unsupported by cited evidence"] };
        }

        if (truthValue === "false") {
            return statementSupported
                ? { pass: false, reasons: ["false statement supported by cited evidence"] }
                : { pass: true, reasons: [] as string[] };
        }

        return {
            pass: false,
            reasons: ["invalid true_false truth value"],
        };
    }

    if (type === QUESTION_TYPE_FILL_BLANK) {
        const acceptedAnswers = Array.isArray(candidate?.acceptedAnswers)
            ? candidate.acceptedAnswers.map((value) => String(value || "").trim()).filter(Boolean)
            : [];
        if (acceptedAnswers.length === 0) {
            return {
                pass: false,
                reasons: ["missing accepted answer text"],
            };
        }
        if (!isTextSupportedByEvidence(acceptedAnswers[0], supportText)) {
            return {
                pass: false,
                reasons: ["accepted answer unsupported by cited evidence"],
            };
        }
        return {
            pass: true,
            reasons: [] as string[],
        };
    }

    const options = Array.isArray(candidate?.options) ? candidate.options : [];
    const correctOptions = options.filter((option) => option && option.isCorrect === true);
    if (correctOptions.length !== 1) {
        return {
            pass: false,
            reasons: ["invalid objective structure"],
        };
    }

    const correctOptionText = String(correctOptions[0]?.text || "").trim();
    if (!correctOptionText) {
        return {
            pass: false,
            reasons: ["missing correct option text"],
        };
    }

    if (!isTextSupportedByEvidence(correctOptionText, supportText)) {
        return {
            pass: false,
            reasons: ["correct option unsupported by cited evidence"],
        };
    }

    return {
        pass: true,
        reasons: [] as string[],
    };
};

export const runDeterministicGroundingCheck = (args: {
    type: GroundedContentType;
    candidate:
        | GroundedMultipleChoiceCandidate
        | GroundedTrueFalseCandidate
        | GroundedFillBlankCandidate
        | GroundedEssayCandidate
        | GroundedConceptCandidate;
    evidenceIndex: GroundedEvidenceIndex;
    assessmentBlueprint?: AssessmentBlueprint | null;
}): GroundingCheckResult => {
    const reasons: string[] = [];
    const warnings: string[] = [];

    const citationsRaw = Array.isArray((args.candidate as any)?.citations)
        ? (args.candidate as any).citations
        : [];
    const normalizedCitations = citationsRaw.map(normalizeCitation).filter(Boolean) as GroundedCitation[];

    if (normalizedCitations.length === 0) {
        reasons.push("missing citations");
    }

    const citationValidation = validateCitationSpans(normalizedCitations, args.evidenceIndex);
    if (citationValidation.reasons.length > 0) {
        warnings.push(...citationValidation.reasons);
    }
    if (normalizedCitations.length > 0 && citationValidation.valid.length === 0) {
        reasons.push("no valid citation spans");
    }

    const supportContext = buildCitationSupportContext(citationValidation.valid, args.evidenceIndex);
    const supportText = [supportContext.quoteText, supportContext.passageText]
        .filter(Boolean)
        .join("\n\n")
        .trim();

    if (args.type === QUESTION_TYPE_MULTIPLE_CHOICE && !hasMinimalMultipleChoice(args.candidate as GroundedMultipleChoiceCandidate)) {
        reasons.push("invalid multiple_choice structure");
    }
    if (args.type === QUESTION_TYPE_TRUE_FALSE && !hasUsableTrueFalse(args.candidate as GroundedTrueFalseCandidate)) {
        reasons.push("invalid true_false structure");
    }
    if (args.type === QUESTION_TYPE_FILL_BLANK && !hasUsableFillBlank(args.candidate as GroundedFillBlankCandidate)) {
        reasons.push("invalid fill_blank structure");
    }
    if (args.type === "essay" && !hasUsableEssay(args.candidate as GroundedEssayCandidate)) {
        reasons.push("invalid essay structure");
    }
    if (args.type === "concept" && !hasUsableConcept(args.candidate as GroundedConceptCandidate)) {
        reasons.push("invalid concept structure");
    }
    if ((args.type === QUESTION_TYPE_MULTIPLE_CHOICE
        || args.type === QUESTION_TYPE_TRUE_FALSE
        || args.type === QUESTION_TYPE_FILL_BLANK
        || args.type === "essay") && args.assessmentBlueprint) {
        const metadataIssues = getAssessmentQuestionMetadataIssues({
            question: args.candidate,
            blueprint: args.assessmentBlueprint,
            questionType: args.type,
        });
        if (metadataIssues.length > 0) {
            reasons.push(...metadataIssues);
        }
    }
    if (
        (args.type === QUESTION_TYPE_MULTIPLE_CHOICE
            || args.type === QUESTION_TYPE_TRUE_FALSE
            || args.type === QUESTION_TYPE_FILL_BLANK)
        && supportText
    ) {
        const objectiveSupport = validateObjectiveSupport(
            args.candidate as GroundedMultipleChoiceCandidate | GroundedTrueFalseCandidate | GroundedFillBlankCandidate,
            args.type,
            supportText
        );
        if (!objectiveSupport.pass) {
            reasons.push(...objectiveSupport.reasons);
        }
    }

    const citationPrecision = normalizedCitations.length > 0
        ? citationValidation.valid.length / normalizedCitations.length
        : 0;
    const citationTargetCount = (() => {
        if (args.type === "essay") {
            return Math.min(2, Math.max(1, normalizedCitations.length));
        }
        return 1;
    })();
    const citationSupportScore = citationTargetCount > 0
        ? Math.min(1, citationValidation.valid.length / citationTargetCount)
        : 0;
    const citationPresenceScore = citationValidation.valid.length > 0 ? 1 : 0;
    const structurePenalty = reasons.some((reason) => reason.includes("invalid")) ? 0.2 : 0;
    const deterministicScore = clamp(
        (citationSupportScore * 0.75)
        + (citationPrecision * 0.2)
        + (citationPresenceScore * 0.05)
        - structurePenalty,
        0,
        1
    );

    return {
        deterministicPass: reasons.length === 0,
        deterministicScore,
        reasons: [...reasons, ...warnings.slice(0, 3)],
        validCitations: citationValidation.valid,
    };
};

export const buildGroundedVerifierPrompt = (args: {
    type: GroundedContentType;
    candidate: any;
    evidenceSnippet: string;
}) => {
    const typeSpecificRules = args.type === QUESTION_TYPE_MULTIPLE_CHOICE
        ? "For multiple-choice candidates, verify that the marked correct option is directly supported by the evidence. Reject if any number, percentage, threshold, rate, count, or definition in the correct option does not match the evidence exactly."
        : args.type === QUESTION_TYPE_TRUE_FALSE
            ? "For true/false candidates, verify that the correct truth value is directly supported by the evidence and that a false statement is explicitly contradicted by the evidence."
            : args.type === QUESTION_TYPE_FILL_BLANK
                ? "For fill-in-the-blank candidates, verify that the accepted answer is directly supported by the evidence and that no unsupported aliases were invented."
        : args.type === "essay"
            ? "For essay candidates, verify that every numeric or definitional claim in the model answer is supported by the evidence."
            : "For concept candidates, verify that the answers are directly supported by the evidence.";

    return `You are a strict factuality verifier.

CONTENT TYPE: ${args.type}
RULES:
${typeSpecificRules}

CANDIDATE JSON:
${JSON.stringify(args.candidate)}

EVIDENCE:
"""
${args.evidenceSnippet.slice(0, 10000)}
"""

Return JSON only:
{
  "groundingScore": 0.0,
  "factualityVerdict": "pass|fail",
  "reasons": ["..."]
}`;
};

export const parseGroundedVerifierResult = (raw: any) => {
    const score = Number(raw?.groundingScore ?? raw?.score ?? 0);
    const verdict = String(raw?.factualityVerdict || "fail").toLowerCase() === "pass" ? "pass" : "fail";
    const reasons = Array.isArray(raw?.reasons)
        ? raw.reasons.map((item: any) => String(item || "").trim()).filter(Boolean)
        : [];

    return {
        groundingScore: clamp(Number.isFinite(score) ? score : 0, 0, 1),
        factualityVerdict: verdict as "pass" | "fail",
        reasons,
    };
};

export const mergeGroundingScores = (args: {
    deterministicScore: number;
    llmScore: number;
}) => clamp(args.deterministicScore * 0.7 + args.llmScore * 0.3, 0, 1);
