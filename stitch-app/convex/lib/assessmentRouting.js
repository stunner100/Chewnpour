export const TOPIC_KIND_LESSON = "lesson";
export const TOPIC_KIND_DOCUMENT_FINAL_EXAM = "document_final_exam";

export const ASSESSMENT_CLASSIFICATION_STRONG = "strong";
export const ASSESSMENT_CLASSIFICATION_MEDIUM = "medium";
export const ASSESSMENT_CLASSIFICATION_WEAK = "weak";
export const ASSESSMENT_CLASSIFICATION_DOCUMENT = "document";

export const ASSESSMENT_ROUTE_TOPIC_QUIZ = "topic_quiz";
export const ASSESSMENT_ROUTE_FINAL_EXAM_ONLY = "final_exam_only";
export const ASSESSMENT_ROUTE_DOCUMENT_FINAL_EXAM = "document_final_exam";

export const DOCUMENT_FINAL_EXAM_TITLE = "Comprehensive Revision Exam";

const TERM_STOPWORDS = new Set([
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
    "into",
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
    "we",
    "what",
    "when",
    "where",
    "which",
    "with",
    "your",
]);

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const countWords = (value) => String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .length;

const normalizeTerms = (value) => {
    const matches = String(value || "")
        .toLowerCase()
        .match(/[a-z0-9]+/g);
    if (!matches) return [];
    return matches.filter((term) => term.length >= 3 && !TERM_STOPWORDS.has(term));
};

const uniqueTerms = (value) => Array.from(new Set(normalizeTerms(value)));

const computeOverlapRatio = (sourceTerms, comparisonTerms) => {
    if (!Array.isArray(sourceTerms) || sourceTerms.length === 0) return 0;
    if (!Array.isArray(comparisonTerms) || comparisonTerms.length === 0) return 0;
    const comparisonSet = new Set(comparisonTerms);
    const sharedCount = sourceTerms.filter((term) => comparisonSet.has(term)).length;
    return sharedCount / Math.max(sourceTerms.length, 1);
};

const buildSupportedQuestionTypes = ({
    sourcePassageCount,
    sourceChunkCount,
    contentWordCount,
    hasDefinitionSignals,
    hasComparisonSignals,
}) => {
    const supported = [];
    if (sourcePassageCount >= 2 || sourceChunkCount >= 2 || contentWordCount >= 220) {
        supported.push("multiple_choice");
    }
    if (hasDefinitionSignals || contentWordCount >= 180) {
        supported.push("fill_blank");
    }
    if (hasComparisonSignals || (sourcePassageCount >= 3 && contentWordCount >= 320)) {
        supported.push("short_answer");
    }
    if (sourcePassageCount >= 4 && contentWordCount >= 480) {
        supported.push("essay");
    }
    return supported;
};

export const isDocumentFinalExamTopic = (topic) =>
    String(topic?.topicKind || "").trim() === TOPIC_KIND_DOCUMENT_FINAL_EXAM;

export const isLessonTopic = (topic) => !isDocumentFinalExamTopic(topic);

export const allowsStandaloneTopicExam = (topic) => {
    if (isDocumentFinalExamTopic(topic)) return true;
    return String(topic?.assessmentRoute || ASSESSMENT_ROUTE_TOPIC_QUIZ).trim() === ASSESSMENT_ROUTE_TOPIC_QUIZ;
};

export const computeTopicAssessmentRouting = ({ topic, neighboringTopics = [] }) => {
    const sourcePassageCount = Array.isArray(topic?.sourcePassageIds) ? topic.sourcePassageIds.length : 0;
    const sourceChunkCount = Array.isArray(topic?.sourceChunkIds) ? topic.sourceChunkIds.length : 0;
    const contentWordCount = countWords(topic?.content);
    const descriptionWordCount = countWords(topic?.description);
    const combinedTerms = uniqueTerms(`${topic?.title || ""} ${topic?.description || ""}`);
    const strongestNeighborOverlap = neighboringTopics.reduce((maxOverlap, neighbor) => {
        const neighborTerms = uniqueTerms(`${neighbor?.title || ""} ${neighbor?.description || ""}`);
        return Math.max(maxOverlap, computeOverlapRatio(combinedTerms, neighborTerms));
    }, 0);

    const hasDefinitionSignals = /\b(is|means|defined as|refers to|consists of)\b/i.test(
        `${topic?.title || ""} ${topic?.description || ""} ${topic?.content || ""}`.slice(0, 1200)
    );
    const hasComparisonSignals = /\b(compare|contrast|difference|versus|vs\.?|relative to|before|after)\b/i.test(
        `${topic?.title || ""} ${topic?.description || ""} ${topic?.content || ""}`.slice(0, 1200)
    );

    let evidenceVolumeScore = sourcePassageCount * 8 + sourceChunkCount * 4;
    if (contentWordCount >= 220) evidenceVolumeScore += 4;
    if (contentWordCount >= 420) evidenceVolumeScore += 2;
    evidenceVolumeScore = clamp(evidenceVolumeScore, 0, 30);

    let evidenceDiversityScore = 0;
    if (sourcePassageCount >= 2) evidenceDiversityScore += 6;
    if (sourcePassageCount >= 4) evidenceDiversityScore += 4;
    if (descriptionWordCount >= 12) evidenceDiversityScore += 4;
    if (hasDefinitionSignals) evidenceDiversityScore += 3;
    if (hasComparisonSignals) evidenceDiversityScore += 3;
    evidenceDiversityScore = clamp(evidenceDiversityScore, 0, 20);

    const distinctivenessScore = clamp(Math.round(15 - strongestNeighborOverlap * 18), 0, 15);

    const supportedQuestionTypes = buildSupportedQuestionTypes({
        sourcePassageCount,
        sourceChunkCount,
        contentWordCount,
        hasDefinitionSignals,
        hasComparisonSignals,
    });
    const questionVarietyScore = clamp(
        supportedQuestionTypes.length * 6 + (supportedQuestionTypes.includes("essay") ? 2 : 0),
        0,
        20,
    );

    let redundancyRiskScore = clamp(
        Math.round(strongestNeighborOverlap * 15)
        + (sourcePassageCount <= 1 ? 4 : 0)
        + (supportedQuestionTypes.length <= 1 ? 3 : 0),
        0,
        15,
    );
    if (contentWordCount >= 400 && sourcePassageCount >= 3) {
        redundancyRiskScore = clamp(redundancyRiskScore - 2, 0, 15);
    }

    const readinessScore = clamp(
        Math.round(
            evidenceVolumeScore
            + evidenceDiversityScore
            + distinctivenessScore
            + questionVarietyScore
            + (15 - redundancyRiskScore)
        ),
        0,
        100,
    );

    const classification = (
        readinessScore >= 70
        && sourcePassageCount >= 3
        && supportedQuestionTypes.length >= 2
        && strongestNeighborOverlap < 0.65
    )
        ? ASSESSMENT_CLASSIFICATION_STRONG
        : readinessScore >= 45
            ? ASSESSMENT_CLASSIFICATION_MEDIUM
            : ASSESSMENT_CLASSIFICATION_WEAK;

    const assessmentRoute = classification === ASSESSMENT_CLASSIFICATION_STRONG
        ? ASSESSMENT_ROUTE_TOPIC_QUIZ
        : ASSESSMENT_ROUTE_FINAL_EXAM_ONLY;

    const reason = classification === ASSESSMENT_CLASSIFICATION_STRONG
        ? "This topic has enough grounded evidence to support a standalone quiz."
        : "This topic is better assessed in the final exam to avoid thin or repetitive questions.";

    return {
        topicKind: TOPIC_KIND_LESSON,
        assessmentClassification: classification,
        assessmentRoute,
        assessmentRouteReason: reason,
        assessmentReadinessScore: readinessScore,
        evidenceVolumeScore,
        evidenceDiversityScore,
        distinctivenessScore,
        questionVarietyScore,
        redundancyRiskScore,
        supportedQuestionTypes,
        strongestNeighborOverlap,
    };
};

export const buildDocumentFinalExamTopic = ({ courseTitle, lessonTopics = [] }) => {
    const orderedTopics = Array.isArray(lessonTopics)
        ? [...lessonTopics].sort((a, b) => Number(a?.orderIndex || 0) - Number(b?.orderIndex || 0))
        : [];
    const coveredTitles = orderedTopics
        .map((topic) => String(topic?.title || "").trim())
        .filter(Boolean);
    const sourcePassageIds = Array.from(new Set(
        orderedTopics.flatMap((topic) => Array.isArray(topic?.sourcePassageIds) ? topic.sourcePassageIds : [])
    )).slice(0, 160);

    const coverageLines = orderedTopics
        .map((topic) => {
            const title = String(topic?.title || "").trim();
            if (!title) return null;
            const description = String(topic?.description || "").trim();
            return description ? `- ${title}: ${description}` : `- ${title}`;
        })
        .filter(Boolean);

    const description = coveredTitles.length > 0
        ? `This comprehensive revision exam covers the strongest concepts across ${coveredTitles.join(", ")}.`
        : `This comprehensive revision exam covers the strongest concepts across ${String(courseTitle || "your document").trim() || "your document"}.`;

    const content = [
        `# ${DOCUMENT_FINAL_EXAM_TITLE}`,
        "",
        "## Covered Topics",
        ...(coverageLines.length > 0 ? coverageLines : ["- Key concepts from this document"]),
        "",
        "## Exam Focus",
        "- Core definitions and explanations",
        "- Relationships between major concepts",
        "- Applied understanding across the document",
    ].join("\n");

    return {
        topicKind: TOPIC_KIND_DOCUMENT_FINAL_EXAM,
        assessmentClassification: ASSESSMENT_CLASSIFICATION_DOCUMENT,
        assessmentRoute: ASSESSMENT_ROUTE_DOCUMENT_FINAL_EXAM,
        assessmentRouteReason: "This document-level assessment combines the strongest concepts across the upload.",
        assessmentReadinessScore: 100,
        evidenceVolumeScore: 30,
        evidenceDiversityScore: 20,
        distinctivenessScore: 15,
        questionVarietyScore: 20,
        redundancyRiskScore: 0,
        title: DOCUMENT_FINAL_EXAM_TITLE,
        description,
        content,
        sourcePassageIds,
    };
};
