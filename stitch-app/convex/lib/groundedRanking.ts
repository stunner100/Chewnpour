"use node";

import {
    areQuestionPromptsNearDuplicate,
    buildQuestionPromptSignature,
} from "./questionPromptSimilarity";
import { normalizeConceptTextKey } from "./conceptExerciseGeneration";
import { evaluateQuestionQuality } from "./premiumQuality.js";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const noveltyPenalty = (text: string, accepted: any[]) => {
    if (!text) return 0.35;
    const signature = buildQuestionPromptSignature(text);
    if (!signature?.normalized) return 0.35;

    for (const prior of accepted) {
        if (areQuestionPromptsNearDuplicate(signature, buildQuestionPromptSignature(String(prior?.questionText || "")))) {
            return 0.9;
        }
    }
    return 0;
};

const conceptNoveltyPenalty = (text: string, accepted: any[]) => {
    const key = normalizeConceptTextKey(text);
    if (!key) return 0.4;
    if (accepted.some((item) => normalizeConceptTextKey(item?.questionText || "") === key)) {
        return 0.95;
    }
    return 0;
};

export const rankGroundedCandidates = (args: {
    type: "multiple_choice" | "true_false" | "fill_blank" | "essay" | "concept";
    candidates: any[];
    targetCount: number;
}) => {
    const items = Array.isArray(args.candidates) ? args.candidates : [];
    const scored = items
        .map((candidate, index) => {
            const grounding = clamp(Number(candidate?.groundingScore || 0), 0, 1);
            const citationCount = Math.min(4, Array.isArray(candidate?.citations) ? candidate.citations.length : 0);
            const citationScore = citationCount / 4;
            const difficulty = String(candidate?.difficulty || "medium").toLowerCase();
            const difficultyScore = difficulty === "hard" ? 1 : difficulty === "easy" ? 0.6 : 0.8;
            const quality = evaluateQuestionQuality(candidate);

            const richness = clamp(
                (String(candidate?.explanation || candidate?.correctAnswer || "").length / 240),
                0,
                1
            );

            const score = clamp(
                grounding * 0.28
                + citationScore * 0.1
                + richness * 0.1
                + difficultyScore * 0.08
                + clamp(Number(quality?.qualitySignals?.rigorScore || 0), 0, 1) * 0.22
                + clamp(Number(quality?.qualitySignals?.clarityScore || 0), 0, 1) * 0.12
                + clamp(Number(quality?.qualitySignals?.distractorScore ?? 0.7), 0, 1) * 0.1,
                0,
                1
            );

            return {
                candidate: {
                    ...candidate,
                    qualityTier: quality.qualityTier,
                    qualityFlags: Array.from(
                        new Set([
                            ...(Array.isArray(candidate?.qualityFlags) ? candidate.qualityFlags : []),
                            ...quality.qualityWarnings,
                        ])
                    ),
                    qualityScore: Math.max(
                        clamp(Number(candidate?.qualityScore || 0), 0, 1),
                        clamp(Number(quality?.qualitySignals?.qualityScore || 0), 0, 1),
                    ),
                    rigorScore: clamp(Number(quality?.qualitySignals?.rigorScore || 0), 0, 1),
                    clarityScore: clamp(Number(quality?.qualitySignals?.clarityScore || 0), 0, 1),
                    distractorScore: quality?.qualitySignals?.distractorScore === undefined
                        ? undefined
                        : clamp(Number(quality.qualitySignals.distractorScore || 0), 0, 1),
                    diversityCluster: String(quality?.qualitySignals?.diversityCluster || ""),
                },
                index,
                score,
            };
        })
        .sort((a, b) => b.score - a.score);

    const selected: any[] = [];
    for (const entry of scored) {
        if (selected.length >= Math.max(1, Number(args.targetCount || 1))) break;
        const questionText = String(entry.candidate?.questionText || "");
        const penalty = args.type === "concept"
            ? conceptNoveltyPenalty(questionText, selected)
            : noveltyPenalty(questionText, selected);
        if (penalty >= 0.9) continue;

        selected.push({
            ...entry.candidate,
            rankingScore: clamp(entry.score - penalty, 0, 1),
        });
    }

    return selected;
};
