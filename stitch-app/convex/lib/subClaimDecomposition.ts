import type { RetrievedEvidence } from "./groundedRetrieval";

export const SUB_CLAIM_TYPES = [
    "definition",
    "fact",
    "relationship",
    "process_step",
    "comparison",
    "condition",
    "classification",
    "quantitative",
    "temporal",
    "example",
] as const;

export const COGNITIVE_OPERATIONS = [
    "recognition",
    "recall",
    "discrimination",
    "application",
    "comparison",
    "inference",
    "evaluation",
    "synthesis",
] as const;

export const SUB_CLAIM_BLOOM_LEVELS = [
    "remember",
    "understand",
    "apply",
    "analyze",
    "evaluate",
    "create",
] as const;

export const SUB_CLAIM_DIFFICULTIES = [
    "easy",
    "medium",
    "hard",
] as const;

export type SubClaimType = typeof SUB_CLAIM_TYPES[number];
export type CognitiveOperation = typeof COGNITIVE_OPERATIONS[number];
export type SubClaimBloomLevel = typeof SUB_CLAIM_BLOOM_LEVELS[number];
export type SubClaimDifficulty = typeof SUB_CLAIM_DIFFICULTIES[number];

export type NormalizedSubClaim = {
    claimText: string;
    sourcePassageIds: string[];
    sourceQuotes: string[];
    claimType: SubClaimType;
    cognitiveOperations: CognitiveOperation[];
    bloomLevel: SubClaimBloomLevel;
    difficultyEstimate: SubClaimDifficulty;
    questionYieldEstimate: number;
};

const normalizeText = (value: unknown) =>
    String(value || "")
        .replace(/\s+/g, " ")
        .trim();

const uniqueStringArray = (value: unknown) =>
    Array.from(
        new Set(
            (Array.isArray(value) ? value : [])
                .map((entry) => normalizeText(entry))
                .filter(Boolean)
        )
    );

const clampInteger = (value: unknown, min: number, max: number) => {
    const numeric = Math.round(Number(value || 0));
    if (!Number.isFinite(numeric)) return min;
    return Math.max(min, Math.min(max, numeric));
};

const toLowerEnum = <T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number]) => {
    const normalized = normalizeText(value).toLowerCase();
    return (allowed as readonly string[]).includes(normalized) ? normalized as T[number] : fallback;
};

const inferDefaultOperations = (claimType: SubClaimType): CognitiveOperation[] => {
    switch (claimType) {
    case "definition":
    case "fact":
    case "classification":
    case "quantitative":
    case "example":
        return ["recognition", "recall", "discrimination"];
    case "relationship":
    case "condition":
        return ["recognition", "discrimination", "application", "inference", "evaluation"];
    case "process_step":
        return ["recognition", "recall", "application", "inference"];
    case "comparison":
        return ["recognition", "comparison", "discrimination", "evaluation"];
    case "temporal":
        return ["recognition", "recall", "discrimination", "inference"];
    default:
        return ["recognition"];
    }
};

const inferDefaultBloomLevel = (claimType: SubClaimType): SubClaimBloomLevel => {
    switch (claimType) {
    case "relationship":
    case "condition":
    case "process_step":
        return "understand";
    case "comparison":
    case "temporal":
        return "analyze";
    default:
        return "remember";
    }
};

const inferYieldEstimate = (claimType: SubClaimType, operations: CognitiveOperation[]) => {
    const base = Math.max(1, Math.min(operations.length, 4));
    if (claimType === "quantitative" || claimType === "comparison" || claimType === "relationship") {
        return Math.max(2, base + 1);
    }
    return base;
};

const evidenceMapFromPassages = (evidence: RetrievedEvidence[]) =>
    new Map(
        (Array.isArray(evidence) ? evidence : [])
            .map((entry) => [String(entry?.passageId || "").trim(), normalizeText(entry?.text)])
            .filter(([passageId, text]) => passageId && text)
    );

const quoteAppearsInEvidence = (quote: string, sourcePassageIds: string[], evidenceByPassageId: Map<string, string>) => {
    const normalizedQuote = normalizeText(quote).toLowerCase();
    if (!normalizedQuote) return false;
    return sourcePassageIds.some((passageId) => {
        const passageText = evidenceByPassageId.get(passageId);
        if (!passageText) return false;
        return passageText.toLowerCase().includes(normalizedQuote.slice(0, Math.min(80, normalizedQuote.length)));
    });
};

const normalizeSubClaimCandidate = (
    candidate: any,
    evidenceByPassageId: Map<string, string>,
): NormalizedSubClaim | null => {
    const claimText = normalizeText(candidate?.claimText);
    if (claimText.length < 12) {
        return null;
    }

    const sourcePassageIds = uniqueStringArray(candidate?.sourcePassageIds)
        .filter((passageId) => evidenceByPassageId.has(passageId))
        .slice(0, 4);
    if (sourcePassageIds.length === 0) {
        return null;
    }

    const sourceQuotes = uniqueStringArray(candidate?.sourceQuotes)
        .filter((quote) => quoteAppearsInEvidence(quote, sourcePassageIds, evidenceByPassageId))
        .slice(0, 4);
    if (sourceQuotes.length === 0) {
        return null;
    }

    const claimType = toLowerEnum(candidate?.claimType, SUB_CLAIM_TYPES, "fact");
    const cognitiveOperations = uniqueStringArray(candidate?.cognitiveOperations)
        .map((entry) => entry.toLowerCase())
        .filter((entry): entry is CognitiveOperation =>
            (COGNITIVE_OPERATIONS as readonly string[]).includes(entry)
        );
    const normalizedOperations = cognitiveOperations.length > 0
        ? cognitiveOperations
        : inferDefaultOperations(claimType);
    const bloomLevel = toLowerEnum(
        candidate?.bloomLevel,
        SUB_CLAIM_BLOOM_LEVELS,
        inferDefaultBloomLevel(claimType),
    );
    const difficultyEstimate = toLowerEnum(candidate?.difficultyEstimate, SUB_CLAIM_DIFFICULTIES, "medium");
    const questionYieldEstimate = clampInteger(
        candidate?.questionYieldEstimate,
        1,
        6,
    ) || inferYieldEstimate(claimType, normalizedOperations);

    return {
        claimText,
        sourcePassageIds,
        sourceQuotes,
        claimType,
        cognitiveOperations: normalizedOperations,
        bloomLevel,
        difficultyEstimate,
        questionYieldEstimate: questionYieldEstimate || inferYieldEstimate(claimType, normalizedOperations),
    };
};

export const normalizeSubClaimResponse = (payload: any, evidence: RetrievedEvidence[]): NormalizedSubClaim[] => {
    const evidenceByPassageId = evidenceMapFromPassages(evidence);
    const rawClaims = Array.isArray(payload?.claims)
        ? payload.claims
        : Array.isArray(payload)
            ? payload
            : [];
    const accepted: NormalizedSubClaim[] = [];
    const seenClaimTexts = new Set<string>();

    for (const candidate of rawClaims) {
        const normalized = normalizeSubClaimCandidate(candidate, evidenceByPassageId);
        if (!normalized) continue;
        const key = normalized.claimText.toLowerCase();
        if (seenClaimTexts.has(key)) continue;
        seenClaimTexts.add(key);
        accepted.push(normalized);
    }

    return accepted;
};

const formatEvidenceBlock = (evidence: RetrievedEvidence[]) =>
    evidence
        .map((entry, index) => {
            const passageId = String(entry?.passageId || "").trim() || `passage-${index + 1}`;
            const page = Math.max(0, Number(entry?.page || 0));
            const sectionHint = normalizeText(entry?.sectionHint);
            const heading = sectionHint
                ? `[PASSAGE ${index + 1}] id=${passageId} page=${page} section=${sectionHint}`
                : `[PASSAGE ${index + 1}] id=${passageId} page=${page}`;
            return `${heading}\n${normalizeText(entry?.text)}`;
        })
        .join("\n\n");

export const SUB_CLAIM_DECOMPOSITION_SYSTEM_PROMPT = `You are an expert educational content analyst. Extract atomic, testable sub-claims from grounded topic evidence.

Rules:
1. Return JSON only in the shape {"claims":[...]}.
2. Every claim must be directly supported by quoted source text from the provided passages.
3. Every claim must include sourcePassageIds and sourceQuotes.
4. Break compound statements into separate claims.
5. Prefer atomic facts, definitions, comparisons, process steps, conditions, quantitative facts, and examples.
6. Do not add background knowledge not present in the source.
7. Do not generate generic claims like "this topic is important".
8. Keep claimText concise and self-contained.

Allowed claimType values:
definition, fact, relationship, process_step, comparison, condition, classification, quantitative, temporal, example

Allowed cognitiveOperations values:
recognition, recall, discrimination, application, comparison, inference, evaluation, synthesis

Allowed bloomLevel values:
remember, understand, apply, analyze, evaluate, create

Allowed difficultyEstimate values:
easy, medium, hard`;

export const buildSubClaimDecompositionPrompt = (args: {
    topicTitle: string;
    topicDescription?: string;
    evidence: RetrievedEvidence[];
}) => `Topic title: ${normalizeText(args.topicTitle)}
Topic description: ${normalizeText(args.topicDescription)}

Grounded source passages:
${formatEvidenceBlock(args.evidence)}

Return JSON only:
{
  "claims": [
    {
      "claimText": "string",
      "sourcePassageIds": ["passage-id"],
      "sourceQuotes": ["exact supporting quote"],
      "claimType": "definition|fact|relationship|process_step|comparison|condition|classification|quantitative|temporal|example",
      "cognitiveOperations": ["recognition", "recall"],
      "bloomLevel": "remember|understand|apply|analyze|evaluate|create",
      "difficultyEstimate": "easy|medium|hard",
      "questionYieldEstimate": 2
    }
  ]
}`;
