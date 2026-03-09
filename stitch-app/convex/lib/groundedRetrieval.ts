"use node";

import type { EvidencePassage, GroundedEvidenceIndex } from "./groundedEvidenceIndex";

export type RetrievedEvidence = EvidencePassage & {
    score: number;
};

const tokenize = (value: string) =>
    Array.from(
        new Set(
            String(value || "")
                .toLowerCase()
                .split(/[^a-z0-9]+/)
                .map((item) => item.trim())
                .filter((item) => item.length >= 3)
        )
    );

const computeScore = (args: {
    passage: EvidencePassage;
    queryTokens: string[];
    preferFlags?: string[];
}) => {
    const text = `${args.passage.sectionHint}\n${args.passage.text}`.toLowerCase();
    const shared = args.queryTokens.reduce((sum, token) => sum + (text.includes(token) ? 1 : 0), 0);
    const coverage = args.queryTokens.length > 0 ? shared / args.queryTokens.length : 0;
    const lengthBoost = Math.min(1, args.passage.text.length / 900) * 0.08;
    const flagBoost = (args.preferFlags || []).reduce(
        (sum, flag) => sum + (args.passage.flags.includes(flag) ? 0.08 : 0),
        0
    );
    const base = coverage * 0.82 + lengthBoost + flagBoost;
    return Math.max(0, Math.min(1, base));
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

export const retrieveGroundedEvidence = (args: {
    index: GroundedEvidenceIndex;
    query: string;
    limit: number;
    preferFlags?: string[];
}): RetrievedEvidence[] => {
    const passages = Array.isArray(args.index?.passages) ? args.index.passages : [];
    if (passages.length === 0) return [];

    const queryTokens = tokenize(args.query).slice(0, 48);

    const scored = passages
        .map((passage) => ({
            ...passage,
            score: computeScore({
                passage,
                queryTokens,
                preferFlags: args.preferFlags,
            }),
        }))
        .filter((entry) => entry.score > 0.02)
        .sort((a, b) => b.score - a.score);

    const limit = Math.max(1, Math.floor(Number(args.limit || 1)));
    const spread = pickWithRegionSpread(scored, Math.max(limit, Math.min(limit + 4, limit * 2)));
    return spread.slice(0, limit);
};
