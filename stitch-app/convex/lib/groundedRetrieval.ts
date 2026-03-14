import { internal } from "../_generated/api";
import { embedText, isGeminiEmbeddingsConfigured } from "./geminiEmbeddings";
import type { EvidencePassage, GroundedEvidenceIndex } from "./groundedEvidenceIndex";

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
};

const tokenize = (value: string) =>
    Array.from(
        new Set(
            String(value || "")
                .toLowerCase()
                .split(/[^a-z0-9%.-]+/)
                .map((item) => item.trim())
                .filter((item) => item.length >= 3)
        )
    );

const extractNumericTokens = (value: string) =>
    Array.from(
        new Set(
            String(value || "")
                .match(/\b\d+(?:\.\d+)?%?\b/g)
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

const pickWithRegionSpread = (candidates: RetrievedEvidence[], limit: number) => {
    if (candidates.length <= limit) return candidates;

    const firstThird: RetrievedEvidence[] = [];
    const midThird: RetrievedEvidence[] = [];
    const lastThird: RetrievedEvidence[] = [];

    for (const candidate of candidates) {
        const page = Math.max(0, Number(candidate.page || 0));
        if (page <= 4) {
            firstThird.push(candidate);
        } else if (page <= 12) {
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
    if (!args.ctx || !args.uploadId || !isGeminiEmbeddingsConfigured()) {
        return [];
    }

    try {
        const embedding = await embedText(args.query, { taskType: "RETRIEVAL_QUERY" });
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

    if (vectorCandidates.length === 0) {
        return {
            evidence: lexicalTop.slice(0, limit),
            retrievalMode: args.ctx && args.uploadId ? "hybrid_lexical_only" : "lexical_only",
            lexicalHitCount: lexicalTop.length,
            vectorHitCount: 0,
            embeddingBacklogCount: Math.max(0, Number(args.embeddingBacklogCount || 0)),
            latencyMs: Date.now() - startedAt,
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
            const vectorOnlyMissingNumericPenalty =
                numericTokens.length > 0 && vectorScore > 0 && lexicalScore < 0.02 && numericAgreement === 0
                    ? 0.18
                    : 0;
            const blendedScore = Math.max(
                0,
                Math.min(
                    1,
                    lexicalScore * 0.6
                    + vectorScore * 0.4
                    + preferFlagBoost * 0.5
                    + numericAgreement * 0.14
                    - vectorOnlyMissingNumericPenalty
                )
            );

            return {
                ...entry,
                score: blendedScore,
                lexicalScore,
                vectorScore,
                numericAgreement,
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
    };
};
