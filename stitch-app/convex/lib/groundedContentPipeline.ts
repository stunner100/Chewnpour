"use node";

import type { GroundedEvidenceIndex } from "./groundedEvidenceIndex";
import type { AssessmentBlueprint } from "./groundedGeneration";
import { retrieveGroundedEvidence, type RetrievedEvidence } from "./groundedRetrieval";
import { areQuestionPromptsNearDuplicate, buildQuestionPromptSignature } from "./questionPromptSimilarity";
import {
    GROUNDED_MIN_SCORE,
    mergeGroundingScores,
    runDeterministicGroundingCheck,
    type GroundedContentType,
} from "./groundedVerifier";
import { rankGroundedCandidates } from "./groundedRanking";

export type GroundedAcceptanceOutcome = {
    accepted: any[];
    rejected: Array<{ candidate: any; reasons: string[] }>;
    abstained: boolean;
    abstainCode?: string;
};

export type GroundedAcceptanceMetrics = {
    deterministicChecks: number;
    deterministicMs: number;
    repairAttempts: number;
    repairMs: number;
    repairSuccesses: number;
    llmVerifications: number;
    llmVerificationMs: number;
    llmVerificationErrors: number;
    llmRejected: number;
};

export const createGroundedAcceptanceMetrics = (): GroundedAcceptanceMetrics => ({
    deterministicChecks: 0,
    deterministicMs: 0,
    repairAttempts: 0,
    repairMs: 0,
    repairSuccesses: 0,
    llmVerifications: 0,
    llmVerificationMs: 0,
    llmVerificationErrors: 0,
    llmRejected: 0,
});

export const selectEvidenceForGroundedType = async (args: {
    index: GroundedEvidenceIndex;
    type: GroundedContentType;
    topicTitle: string;
    topicDescription?: string;
    keyPoints?: string[];
}) => {
    const query = [
        args.topicTitle,
        args.topicDescription || "",
        ...(args.keyPoints || []),
    ].join(" ");

    const target = args.type === "essay"
        ? 24
        : args.type === "multiple_choice"
            ? 18
            : args.type === "true_false"
                ? 14
                : args.type === "fill_blank"
                    ? 12
                    : 8;
    const preferFlags = args.type === "essay"
        ? ["table", "formula"]
        : args.type === "concept"
            ? ["formula"]
            : ["table"];

    const retrieval = await retrieveGroundedEvidence({
        index: args.index,
        query,
        limit: target,
        preferFlags,
    });
    return retrieval.evidence;
};

export const buildEvidenceSnippet = (evidence: RetrievedEvidence[]) =>
    evidence
        .map((entry, index) =>
            `E${index + 1}(${entry.passageId},p${entry.page}): ${String(entry.text || "").slice(0, 500)}`
        )
        .join("\n\n")
        .slice(0, 11000);

const normalizeLexicalTokens = (value: string) =>
    String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .split(" ")
        .map((token) => token.trim())
        .filter((token) => token.length >= 4);

const buildFallbackCitation = (candidate: any, evidenceIndex: GroundedEvidenceIndex) => {
    const passages = Array.isArray(evidenceIndex?.passages) ? evidenceIndex.passages : [];
    if (passages.length === 0) {
        return null;
    }

    const candidateCorpus = [
        String(candidate?.questionText || ""),
        String(candidate?.correctAnswer || ""),
        String(candidate?.explanation || ""),
        Array.isArray(candidate?.answers) ? candidate.answers.join(" ") : "",
    ].join(" ");
    const candidateTokens = Array.from(new Set(normalizeLexicalTokens(candidateCorpus))).slice(0, 60);
    const tokenSet = new Set(candidateTokens);

    let bestPassage = passages[0];
    let bestScore = -1;

    for (const passage of passages) {
        const passageTokens = Array.from(new Set(normalizeLexicalTokens(String(passage?.text || ""))));
        const overlap = passageTokens.filter((token) => tokenSet.has(token)).length;
        const score = overlap * 5 + Math.min(3, passageTokens.length);
        if (score > bestScore) {
            bestScore = score;
            bestPassage = passage;
        }
    }

    const quote = String(bestPassage?.text || "").trim().slice(0, 220);
    if (!quote) {
        return null;
    }

    return {
        passageId: String(bestPassage.passageId || ""),
        page: Number(bestPassage.page || 0),
        startChar: 0,
        endChar: Math.max(1, quote.length),
        quote,
    };
};

const ensureCandidateCitations = (candidate: any, evidenceIndex: GroundedEvidenceIndex) => {
    const existing = Array.isArray(candidate?.citations) ? candidate.citations.filter(Boolean) : [];
    if (existing.length > 0) {
        return candidate;
    }
    const fallback = buildFallbackCitation(candidate, evidenceIndex);
    if (!fallback) {
        return candidate;
    }
    return {
        ...candidate,
        citations: [fallback],
    };
};

const areGeneratedCandidatesNearDuplicate = (type: GroundedContentType, candidate: any, accepted: any[]) => {
    if (type === "concept") {
        return false;
    }
    const candidateSignature = buildQuestionPromptSignature(String(candidate?.questionText || ""));
    if (!candidateSignature?.normalized) {
        return false;
    }

    return accepted.some((prior) =>
        areQuestionPromptsNearDuplicate(
            candidateSignature,
            buildQuestionPromptSignature(String(prior?.questionText || ""))
        )
    );
};

export const applyGroundedAcceptance = async (args: {
    type: GroundedContentType;
    requestedCount: number;
    evidenceIndex: GroundedEvidenceIndex;
    assessmentBlueprint?: AssessmentBlueprint | null;
    candidates: any[];
    repairCandidate?: (args: {
        type: GroundedContentType;
        candidate: any;
        reasons: string[];
    }) => Promise<any | null>;
    maxRepairCandidates?: number;
    llmVerify?: (candidate: any) => Promise<{
        score: number;
        verdict: "pass" | "fail";
        reasons: string[];
        error?: boolean;
    }>;
    maxLlmVerifications?: number;
    metrics?: GroundedAcceptanceMetrics;
}): Promise<GroundedAcceptanceOutcome> => {
    const acceptedPreRank: any[] = [];
    const deterministicAccepted: any[] = [];
    const rejected: Array<{ candidate: any; reasons: string[] }> = [];
    const maxLlmVerifications = args.llmVerify
        ? Math.max(
            0,
            Number.isFinite(Number(args.maxLlmVerifications))
                ? Math.floor(Number(args.maxLlmVerifications))
                : Number.POSITIVE_INFINITY
        )
        : 0;
    const maxRepairCandidates = args.repairCandidate
        ? Math.max(
            0,
            Number.isFinite(Number(args.maxRepairCandidates))
                ? Math.floor(Number(args.maxRepairCandidates))
                : Number.POSITIVE_INFINITY
        )
        : 0;
    let llmVerificationCount = 0;
    let repairCount = 0;

    for (const candidate of args.candidates || []) {
        let candidateWithCitations = ensureCandidateCitations(candidate, args.evidenceIndex);
        const deterministicStartedAt = Date.now();
        let deterministic = runDeterministicGroundingCheck({
            type: args.type,
            candidate: candidateWithCitations,
            evidenceIndex: args.evidenceIndex,
            assessmentBlueprint: args.assessmentBlueprint,
        });
        if (args.metrics) {
            args.metrics.deterministicChecks += 1;
            args.metrics.deterministicMs += Date.now() - deterministicStartedAt;
        }
        if (
            !deterministic.deterministicPass
            && args.repairCandidate
            && repairCount < maxRepairCandidates
        ) {
            repairCount += 1;
            if (args.metrics) {
                args.metrics.repairAttempts += 1;
            }
            const repairStartedAt = Date.now();
            try {
                const repairedCandidate = await args.repairCandidate({
                    type: args.type,
                    candidate: candidateWithCitations,
                    reasons: deterministic.reasons,
                });
                if (args.metrics) {
                    args.metrics.repairMs += Date.now() - repairStartedAt;
                }
                if (repairedCandidate) {
                    if (args.metrics) {
                        args.metrics.repairSuccesses += 1;
                    }
                    candidateWithCitations = ensureCandidateCitations(repairedCandidate, args.evidenceIndex);
                    const recheckStartedAt = Date.now();
                    deterministic = runDeterministicGroundingCheck({
                        type: args.type,
                        candidate: candidateWithCitations,
                        evidenceIndex: args.evidenceIndex,
                        assessmentBlueprint: args.assessmentBlueprint,
                    });
                    if (args.metrics) {
                        args.metrics.deterministicChecks += 1;
                        args.metrics.deterministicMs += Date.now() - recheckStartedAt;
                    }
                }
            } catch {
                if (args.metrics) {
                    args.metrics.repairMs += Date.now() - repairStartedAt;
                }
                // Repair is best-effort; deterministic rejection still protects persistence.
            }
        }
        if (!deterministic.deterministicPass) {
            rejected.push({
                candidate: candidateWithCitations,
                reasons: deterministic.reasons.length > 0
                    ? deterministic.reasons
                    : ["deterministic grounding failed"],
            });
            continue;
        }
        if (areGeneratedCandidatesNearDuplicate(args.type, candidateWithCitations, deterministicAccepted)) {
            rejected.push({
                candidate: candidateWithCitations,
                reasons: ["near-duplicate generated candidate"],
            });
            continue;
        }
        deterministicAccepted.push(candidateWithCitations);

        let llmScore = deterministic.deterministicScore;
        let llmVerdict: "pass" | "fail" = "pass";
        let llmReasons: string[] = [];
        let llmVerified = false;
        let llmVerifierErrored = false;

        if (args.llmVerify && llmVerificationCount < maxLlmVerifications) {
            llmVerificationCount += 1;
            if (args.metrics) {
                args.metrics.llmVerifications += 1;
            }
            const llmVerificationStartedAt = Date.now();
            try {
                const llm = await args.llmVerify(candidateWithCitations);
                if (args.metrics) {
                    args.metrics.llmVerificationMs += Date.now() - llmVerificationStartedAt;
                }
                llmVerified = true;
                llmScore = Number.isFinite(Number(llm?.score))
                    ? Number(llm?.score)
                    : deterministic.deterministicScore;
                llmVerdict = llm?.verdict === "pass" ? "pass" : "fail";
                llmReasons = Array.isArray(llm?.reasons) ? llm.reasons : [];
                llmVerifierErrored = Boolean(llm?.error);
                if (llmVerifierErrored && args.metrics) {
                    args.metrics.llmVerificationErrors += 1;
                }
            } catch {
                if (args.metrics) {
                    args.metrics.llmVerificationMs += Date.now() - llmVerificationStartedAt;
                    args.metrics.llmVerificationErrors += 1;
                }
                llmVerifierErrored = true;
                llmScore = deterministic.deterministicScore;
                llmVerdict = "pass";
                llmReasons = ["llm verifier failed"];
            }
        }

        const mergedScore = llmVerified && !llmVerifierErrored
            ? mergeGroundingScores({
                deterministicScore: deterministic.deterministicScore,
                llmScore,
            })
            : deterministic.deterministicScore;
        const threshold = GROUNDED_MIN_SCORE[args.type];
        const llmHardReject =
            llmVerified
            && !llmVerifierErrored
            && llmVerdict === "fail"
            && deterministic.deterministicScore < threshold + 0.05;
        const passes = !llmHardReject && mergedScore >= threshold;

        if (!passes) {
            if (llmHardReject && args.metrics) {
                args.metrics.llmRejected += 1;
            }
            rejected.push({
                candidate: candidateWithCitations,
                reasons: [
                    ...deterministic.reasons,
                    ...llmReasons,
                    llmHardReject ? "llm verifier flagged unsupported candidate" : "",
                    mergedScore < threshold ? `below threshold ${threshold}` : "",
                ].filter(Boolean),
            });
            continue;
        }

        const factualityStatus =
            llmVerified && !llmVerifierErrored && llmVerdict === "pass"
                ? "verified"
                : "deterministic_verified";

        acceptedPreRank.push({
            ...candidateWithCitations,
            citations: deterministic.validCitations,
            groundingScore: mergedScore,
            factualityStatus,
        });
    }

    const accepted = rankGroundedCandidates({
        type: args.type,
        candidates: acceptedPreRank,
        targetCount: Math.max(1, Number(args.requestedCount || 1)),
    });

    if (accepted.length === 0) {
        return {
            accepted: [],
            rejected,
            abstained: true,
            abstainCode: "INSUFFICIENT_EVIDENCE",
        };
    }

    return {
        accepted,
        rejected,
        abstained: false,
    };
};
