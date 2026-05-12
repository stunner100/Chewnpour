import { internal } from "../_generated/api";
import { embedText, isVoyageEmbeddingsConfigured } from "./voyageEmbeddings";
import type { EvidencePassage, GroundedEvidenceIndex } from "./groundedEvidenceIndex";

const GROUNDED_VECTOR_RETRIEVAL_ENABLED =
    String(process.env.GROUNDED_VECTOR_RETRIEVAL_ENABLED || "").trim().toLowerCase() === "true";

export type RetrievedEvidence = EvidencePassage & {
    score: number;
    lexicalScore?: number;
    vectorScore?: number;
    numericAgreement?: number;
    retrievalSource?: "lexical" | "vector" | "hybrid";
};

export type RetrievedEvidenceResult = {
    evidence: RetrievedEvidence[];
    retrievalMode: "hybrid" | "hybrid_lexical_only" | "lexical_only";
    lexicalHitCount: number;
    vectorHitCount: number;
    embeddingBacklogCount: number;
    latencyMs: number;
    diagnostics?: {
        queryTokens: string[];
        numericTokens: string[];
        preferFlags: string[];
        vectorWeightBackoff: {
            enabled: boolean;
            backoff: number;
            lexicalTopCoverage: number;
            lexicalAnchorCount: number;
            preferFlagAnchoredCount: number;
            lexicalWeight: number;
            vectorWeight: number;
        };
        lexicalTop: Array<{
            passageId: string;
            page: number;
            lexicalScore: number;
            vectorScore: number;
            numericAgreement: number;
            finalScore: number;
            retrievalSource: string;
            sectionHint: string;
        }>;
        vectorTop: Array<{
            passageId: string;
            page: number;
            lexicalScore: number;
            vectorScore: number;
            numericAgreement: number;
            finalScore: number;
            retrievalSource: string;
            sectionHint: string;
        }>;
        rerankedTop: Array<{
            passageId: string;
            page: number;
            lexicalScore: number;
            vectorScore: number;
            numericAgreement: number;
            finalScore: number;
            retrievalSource: string;
            sectionHint: string;
            preferFlagBoost: number;
            vectorOnlyMissingNumericPenalty: number;
            vectorOnlyBroadTopicPenalty: number;
        }>;
    };
};

const tokenize = (value: string) =>
    Array.from(
        new Set(
            String(value || "")
                .toLowerCase()
                .split(/[^a-z0-9%.-]+/)
                .map((item) => item.trim())
                .filter((item) => item.length >= 2)
        )
    );

const extractNumericTokens = (value: string) =>
    Array.from(
        new Set(
            String(value || "")
                .match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?%?/gi)
                ?.map((token) => token.trim()) || []
        )
    );

const computePreferFlagBoost = (passage: EvidencePassage, preferFlags?: string[]) =>
    (preferFlags || []).reduce(
        (sum, flag) => sum + (Array.isArray(passage?.flags) && passage.flags.includes(flag) ? 0.08 : 0),
        0
    );

const computeLexicalScore = (args: {
    passage: EvidencePassage;
    queryTokens: string[];
    preferFlags?: string[];
}) => {
    const text = `${args.passage.sectionHint}\n${args.passage.text}`.toLowerCase();
    const shared = args.queryTokens.reduce((sum, token) => sum + (text.includes(token) ? 1 : 0), 0);
    const coverage = args.queryTokens.length > 0 ? shared / args.queryTokens.length : 0;
    const lengthBoost = Math.min(1, args.passage.text.length / 900) * 0.08;
    const flagBoost = computePreferFlagBoost(args.passage, args.preferFlags);
    const base = coverage * 0.82 + lengthBoost + flagBoost;
    return Math.max(0, Math.min(1, base));
};

const computeNumericAgreement = (passage: EvidencePassage, numericTokens: string[]) => {
    if (numericTokens.length === 0) return 0;
    const text = `${passage.sectionHint}\n${passage.text}`.toLowerCase();
    const matched = numericTokens.reduce((sum, token) => sum + (text.includes(token.toLowerCase()) ? 1 : 0), 0);
    return Math.max(0, Math.min(1, matched / numericTokens.length));
};

const average = (values: number[]) =>
    values.length > 0
        ? values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length
        : 0;

const resolveVectorWeightBackoff = (args: {
    lexicalTop: RetrievedEvidence[];
    numericTokens: string[];
    preferFlags?: string[];
}) => {
    const topLexical = args.lexicalTop.slice(0, 6);
    const lexicalTopCoverage = average(
        topLexical.slice(0, 3).map((entry) => Math.max(0, Math.min(1, Number(entry.lexicalScore || 0))))
    );
    const lexicalAnchorCount = topLexical.filter(
        (entry) => Math.max(0, Math.min(1, Number(entry.lexicalScore || 0))) >= 0.35
    ).length;
    const preferFlagAnchoredCount = topLexical.filter(
        (entry) => computePreferFlagBoost(entry, args.preferFlags) > 0
    ).length;

    const eligible =
        args.numericTokens.length === 0
        && preferFlagAnchoredCount === 0
        && topLexical.length >= 3;
    const enabled = eligible && lexicalTopCoverage >= 0.34 && lexicalAnchorCount >= 3;
    const backoff = enabled
        ? Math.min(0.22, 0.08 + lexicalTopCoverage * 0.28)
        : 0;

    return {
        enabled,
        backoff,
        lexicalTopCoverage,
        lexicalAnchorCount,
        preferFlagAnchoredCount,
        lexicalWeight: 0.6 + backoff,
        vectorWeight: Math.max(0.18, 0.4 - backoff),
    };
};

const toDiagnosticsEntry = (entry: RetrievedEvidence, extras?: {
    finalScore?: number;
    preferFlagBoost?: number;
    vectorOnlyMissingNumericPenalty?: number;
    vectorOnlyBroadTopicPenalty?: number;
}) => {
    const finalScore = extras?.finalScore ?? entry?.score ?? 0;
    return ({
    passageId: String(entry?.passageId || ""),
    page: Math.max(0, Number(entry?.page || 0)),
    lexicalScore: Math.max(0, Math.min(1, Number(entry?.lexicalScore || 0))),
    vectorScore: Math.max(0, Math.min(1, Number(entry?.vectorScore || 0))),
    numericAgreement: Math.max(0, Math.min(1, Number(entry?.numericAgreement || 0))),
    finalScore: Math.max(0, Math.min(1, Number(finalScore))),
    retrievalSource: String(entry?.retrievalSource || ""),
    sectionHint: String(entry?.sectionHint || ""),
    ...(extras
        ? {
            preferFlagBoost: Math.max(0, Number(extras.preferFlagBoost || 0)),
            vectorOnlyMissingNumericPenalty: Math.max(0, Number(extras.vectorOnlyMissingNumericPenalty || 0)),
            vectorOnlyBroadTopicPenalty: Math.max(0, Number(extras.vectorOnlyBroadTopicPenalty || 0)),
        }
        : {}),
    });
};

const pickWithRegionSpread = (candidates: RetrievedEvidence[], limit: number) => {
    if (candidates.length <= limit) return candidates;

    const maxPage = Math.max(1, ...candidates.map((c) => Math.max(0, Number(c.page || 0))));
    const firstThirdEnd = Math.floor(maxPage / 3);
    const midThirdEnd = Math.floor((maxPage * 2) / 3);

    const firstThird: RetrievedEvidence[] = [];
    const midThird: RetrievedEvidence[] = [];
    const lastThird: RetrievedEvidence[] = [];

    for (const candidate of candidates) {
        const page = Math.max(0, Number(candidate.page || 0));
        if (page <= firstThirdEnd) {
            firstThird.push(candidate);
        } else if (page <= midThirdEnd) {
            midThird.push(candidate);
        } else {
            lastThird.push(candidate);
        }
    }

    const result: RetrievedEvidence[] = [];
    const buckets = [firstThird, midThird, lastThird].filter((bucket) => bucket.length > 0);
    for (const bucket of buckets) {
        if (result.length >= limit) break;
        result.push(bucket[0]);
    }

    for (const candidate of candidates) {
        if (result.length >= limit) break;
        if (result.some((entry) => entry.passageId === candidate.passageId)) continue;
        result.push(candidate);
    }

    return result.slice(0, limit);
};

const normalizeVectorScores = (results: Array<{ _score?: number }>) => {
    const finiteScores = results
        .map((result) => Number(result?._score || 0))
        .filter((score) => Number.isFinite(score) && score > 0);
    const maxScore = finiteScores.length > 0 ? Math.max(...finiteScores) : 0;
    if (!maxScore) {
        return results.map(() => 0);
    }
    return results.map((result) => {
        const score = Number(result?._score || 0);
        if (!Number.isFinite(score) || score <= 0) return 0;
        return Math.max(0, Math.min(1, score / maxScore));
    });
};

const fetchVectorCandidates = async (args: {
    ctx?: any;
    query: string;
    uploadId?: any;
}) => {
    if (
        !GROUNDED_VECTOR_RETRIEVAL_ENABLED
        || !args.ctx
        || !args.uploadId
        || !isVoyageEmbeddingsConfigured()
    ) {
        return [];
    }

    try {
        const embedding = await embedText(args.query, { inputType: "query" });
        if (!Array.isArray(embedding.embedding) || embedding.embedding.length === 0) {
            return [];
        }

        const rawResults = await args.ctx.vectorSearch("evidencePassages", "by_embedding", {
            vector: embedding.embedding,
            limit: 12,
            filter: (q: any) => q.eq("uploadId", args.uploadId),
        });
        if (!Array.isArray(rawResults) || rawResults.length === 0) {
            return [];
        }

        const ids = rawResults.map((result: any) => result?._id).filter(Boolean);
        if (ids.length === 0) return [];

        const passages = await args.ctx.runQuery((internal as any).grounded.getEvidencePassagesByIds, {
            ids,
        });
        const scoreById = new Map<string, number>();
        const normalizedScores = normalizeVectorScores(rawResults);
        rawResults.forEach((result: any, index: number) => {
            if (result?._id) {
                scoreById.set(String(result._id), normalizedScores[index] || 0);
            }
        });

        return (Array.isArray(passages) ? passages : []).map((passage: any) => ({
            passageId: String(passage?.passageId || ""),
            page: Math.max(0, Number(passage?.page || 0)),
            startChar: Math.max(0, Number(passage?.startChar || 0)),
            endChar: Math.max(0, Number(passage?.endChar || 0)),
            sectionHint: String(passage?.sectionHint || ""),
            text: String(passage?.text || ""),
            flags: Array.isArray(passage?.flags)
                ? passage.flags.map((flag: any) => String(flag || "").trim()).filter(Boolean)
                : [],
            blockType: String(passage?.blockType || "").trim() || undefined,
            headingPath: Array.isArray(passage?.headingPath)
                ? passage.headingPath.map((entry: any) => String(entry || "").trim()).filter(Boolean)
                : [],
            sourceBackend: String(passage?.sourceBackend || "").trim() || undefined,
            score: scoreById.get(String(passage?._id || "")) || 0,
        }));
    } catch (error) {
        console.warn("[GroundedRetrieval] vector_search_failed", {
            uploadId: String(args.uploadId || ""),
            message: error instanceof Error ? error.message : String(error),
        });
        return [];
    }
};

const retrieveLexicalGroundedEvidence = (args: {
    index: GroundedEvidenceIndex;
    query: string;
    limit: number;
    preferFlags?: string[];
}) => {
    const passages = Array.isArray(args.index?.passages) ? args.index.passages : [];
    if (passages.length === 0) return [] as RetrievedEvidence[];

    const queryTokens = tokenize(args.query).slice(0, 48);

    const scored = passages
        .map((passage) => {
            const lexicalScore = computeLexicalScore({
                passage,
                queryTokens,
                preferFlags: args.preferFlags,
            });
            return {
                ...passage,
                score: lexicalScore,
                lexicalScore,
                vectorScore: 0,
                numericAgreement: 0,
                retrievalSource: "lexical" as const,
            };
        })
        .filter((entry) => entry.score > 0.02)
        .sort((a, b) => b.score - a.score);

    const limit = Math.max(1, Math.floor(Number(args.limit || 1)));
    const spread = pickWithRegionSpread(scored, Math.max(limit, Math.min(limit + 4, limit * 2)));
    return spread.slice(0, limit);
};

export const retrieveGroundedEvidence = async (args: {
    ctx?: any;
    index: GroundedEvidenceIndex;
    query: string;
    limit: number;
    preferFlags?: string[];
    uploadId?: any;
    embeddingBacklogCount?: number;
    debug?: boolean;
}): Promise<RetrievedEvidenceResult> => {
    const startedAt = Date.now();
    const lexical = retrieveLexicalGroundedEvidence(args);
    const limit = Math.max(1, Math.floor(Number(args.limit || 1)));
    const lexicalTop = lexical.slice(0, Math.max(limit, 12));
    const vectorCandidates = await fetchVectorCandidates({
        ctx: args.ctx,
        query: args.query,
        uploadId: args.uploadId,
    });
    const numericTokens = extractNumericTokens(args.query);
    const vectorWeightBackoff = resolveVectorWeightBackoff({
        lexicalTop,
        numericTokens,
        preferFlags: args.preferFlags,
    });

    if (vectorCandidates.length === 0) {
        return {
            evidence: lexicalTop.slice(0, limit),
            retrievalMode: args.ctx && args.uploadId ? "hybrid_lexical_only" : "lexical_only",
            lexicalHitCount: lexicalTop.length,
            vectorHitCount: 0,
            embeddingBacklogCount: Math.max(0, Number(args.embeddingBacklogCount || 0)),
            latencyMs: Date.now() - startedAt,
            diagnostics: args.debug
                ? {
                    queryTokens: tokenize(args.query).slice(0, 48),
                    numericTokens,
                    preferFlags: Array.isArray(args.preferFlags) ? args.preferFlags : [],
                    vectorWeightBackoff,
                    lexicalTop: lexicalTop.slice(0, 8).map((entry) => toDiagnosticsEntry(entry)),
                    vectorTop: [],
                    rerankedTop: lexicalTop.slice(0, 8).map((entry) => toDiagnosticsEntry(entry)),
                }
                : undefined,
        };
    }

    const lexicalByPassageId = new Map(
        lexicalTop.map((entry) => [String(entry.passageId || ""), entry])
    );
    const indexPassagesByPassageId = new Map(
        (Array.isArray(args.index?.passages) ? args.index.passages : [])
            .map((passage) => [String(passage?.passageId || ""), passage])
    );
    const mergedByPassageId = new Map<string, RetrievedEvidence>();

    for (const entry of lexicalTop) {
        mergedByPassageId.set(String(entry.passageId || ""), {
            ...entry,
            numericAgreement: computeNumericAgreement(entry, numericTokens),
            retrievalSource: "lexical",
        });
    }

    for (const vectorEntry of vectorCandidates.slice(0, 12)) {
        const passageId = String(vectorEntry.passageId || "");
        if (!passageId) continue;
        const basePassage = indexPassagesByPassageId.get(passageId) || vectorEntry;
        const existing = mergedByPassageId.get(passageId);
        const lexicalScore = Number(existing?.lexicalScore || 0);
        const vectorScore = Math.max(0, Math.min(1, Number(vectorEntry.score || 0)));
        const numericAgreement = computeNumericAgreement(basePassage, numericTokens);
        mergedByPassageId.set(passageId, {
            ...basePassage,
            score: Math.max(lexicalScore, vectorScore),
            lexicalScore,
            vectorScore,
            numericAgreement,
            retrievalSource: existing ? "hybrid" : "vector",
        });
    }

    const reranked = Array.from(mergedByPassageId.values())
        .map((entry) => {
            const lexicalScore = Math.max(0, Math.min(1, Number(entry.lexicalScore || 0)));
            const vectorScore = Math.max(0, Math.min(1, Number(entry.vectorScore || 0)));
            const numericAgreement = Math.max(0, Math.min(1, Number(entry.numericAgreement || 0)));
            const preferFlagBoost = computePreferFlagBoost(entry, args.preferFlags);
            const lexicalWeight = vectorWeightBackoff.lexicalWeight;
            const vectorWeight = vectorWeightBackoff.vectorWeight;
            const vectorOnlyMissingNumericPenalty =
                numericTokens.length > 0 && vectorScore > 0 && lexicalScore < 0.02 && numericAgreement === 0
                    ? 0.18
                    : 0;
            const vectorOnlyBroadTopicPenalty =
                vectorWeightBackoff.enabled && vectorScore > 0 && lexicalScore < 0.02
                    ? 0.12
                    : 0;
            const blendedScore = Math.max(
                0,
                Math.min(
                    1,
                    lexicalScore * lexicalWeight
                    + vectorScore * vectorWeight
                    + preferFlagBoost * 0.5
                    + numericAgreement * 0.14
                    - vectorOnlyMissingNumericPenalty
                    - vectorOnlyBroadTopicPenalty
                )
            );

            return {
                ...entry,
                score: blendedScore,
                lexicalScore,
                vectorScore,
                numericAgreement,
                _diagnostics: {
                    preferFlagBoost,
                    vectorOnlyMissingNumericPenalty,
                    vectorOnlyBroadTopicPenalty,
                },
                retrievalSource:
                    lexicalScore > 0 && vectorScore > 0
                        ? "hybrid"
                        : lexicalScore > 0
                            ? "lexical"
                            : "vector",
            };
        })
        .filter((entry) => entry.score > 0.02)
        .sort((a, b) => b.score - a.score);

    const spread = pickWithRegionSpread(
        reranked,
        Math.max(limit, Math.min(limit + 4, limit * 2))
    );

    return {
        evidence: spread.slice(0, limit),
        retrievalMode: "hybrid",
        lexicalHitCount: lexicalTop.length,
        vectorHitCount: vectorCandidates.length,
        embeddingBacklogCount: Math.max(0, Number(args.embeddingBacklogCount || 0)),
        latencyMs: Date.now() - startedAt,
        diagnostics: args.debug
            ? {
                queryTokens: tokenize(args.query).slice(0, 48),
                numericTokens,
                preferFlags: Array.isArray(args.preferFlags) ? args.preferFlags : [],
                vectorWeightBackoff,
                lexicalTop: lexicalTop.slice(0, 8).map((entry) => toDiagnosticsEntry(entry)),
                vectorTop: vectorCandidates.slice(0, 8).map((entry) => toDiagnosticsEntry(entry)),
                rerankedTop: reranked.slice(0, 8).map((entry: RetrievedEvidence & { _diagnostics?: any }) =>
                    toDiagnosticsEntry(entry, {
                        finalScore: entry.score,
                        preferFlagBoost: entry?._diagnostics?.preferFlagBoost,
                        vectorOnlyMissingNumericPenalty: entry?._diagnostics?.vectorOnlyMissingNumericPenalty,
                        vectorOnlyBroadTopicPenalty: entry?._diagnostics?.vectorOnlyBroadTopicPenalty,
                    })
                ),
            }
            : undefined,
    };
};
