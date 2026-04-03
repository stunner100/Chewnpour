"use node";

import {
    areQuestionPromptsNearDuplicate,
    buildQuestionPromptSignature,
} from "./questionPromptSimilarity";
import { normalizeConceptTextKey } from "./conceptExerciseGeneration";
import { evaluateObjectiveQuestionQuality } from "./premiumQuality.js";

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
    type: "mcq" | "essay" | "concept";
    candidates: any[];
    targetCount: number;
}) => {
    const items = Array.isArray(args.candidates) ? args.candidates : [];
    const scored = items
        .map((candidate, index) => {
            const grounding = clamp(Number(candidate?.groundingScore || 0), 0, 1);
            const citationCount = Math.min(4, Array.isArray(candidate?.citations) ? candidate.citations.length : 0);
            const citationScore = citationCount / 4;
            const richness = clamp(
                (String(candidate?.explanation || candidate?.correctAnswer || "").length / 240),
                0,
                1
            );
            const objectiveQuality = args.type === "mcq"
                ? evaluateObjectiveQuestionQuality(candidate)
                : null;

            const score = objectiveQuality
                ? clamp(
                    objectiveQuality.qualityScore * 0.7
                    + objectiveQuality.rigorScore * 0.15
                    + citationScore * 0.05
                    + richness * 0.05
                    + grounding * 0.05,
                    0,
                    1
                )
                : clamp(
                    grounding * 0.5
                    + citationScore * 0.2
                    + richness * 0.3,
                    0,
                    1
                );

            return {
                candidate: objectiveQuality
                    ? {
                        ...candidate,
                        qualityScore: objectiveQuality.qualityScore,
                        qualityTier: objectiveQuality.qualityTier,
                        rigorScore: objectiveQuality.rigorScore,
                        clarityScore: objectiveQuality.clarityScore,
                        distractorScore: objectiveQuality.distractorScore,
                        qualityFlags: objectiveQuality.qualityFlags,
                    }
                    : candidate,
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
