import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import {
    assertAuthorizedUser,
    isUsableExamQuestion,
    resolveAuthUserId,
    sanitizeExamQuestionForClient,
} from "./lib/examSecurity";
import {
    filterQuestionsForActiveAssessment,
    getAssessmentQuestionMetadataIssues,
    ASSESSMENT_BLUEPRINT_VERSION,
} from "./lib/assessmentBlueprint.js";
import {
    normalizeQuestionType,
    QUESTION_TYPE_FILL_BLANK,
    QUESTION_TYPE_MULTIPLE_CHOICE,
    QUESTION_TYPE_TRUE_FALSE,
} from "./lib/objectiveExam.js";
import { resolveIllustrationUrl } from "./lib/illustrationUrl";
import { areMcqQuestionsNearDuplicate, buildMcqUniquenessSignature } from "./lib/mcqUniqueness";
import { areQuestionPromptsNearDuplicate, buildQuestionPromptSignature } from "./lib/questionPromptSimilarity";

const DEFAULT_TOPIC_ILLUSTRATION_URL =
    String(process.env.TOPIC_PLACEHOLDER_ILLUSTRATION_URL || "/topic-placeholder.svg").trim()
    || "/topic-placeholder.svg";

const resolveDefaultTopicIllustrationUrl = () => {
    if (
        DEFAULT_TOPIC_ILLUSTRATION_URL.startsWith("http://")
        || DEFAULT_TOPIC_ILLUSTRATION_URL.startsWith("https://")
        || DEFAULT_TOPIC_ILLUSTRATION_URL.startsWith("data:")
    ) {
        return DEFAULT_TOPIC_ILLUSTRATION_URL;
    }
    return DEFAULT_TOPIC_ILLUSTRATION_URL.startsWith("/")
        ? DEFAULT_TOPIC_ILLUSTRATION_URL
        : `/${DEFAULT_TOPIC_ILLUSTRATION_URL}`;
};

const EXAM_READY_MIN_MCQ_COUNT = 10;
const EXAM_READY_MIN_ESSAY_COUNT = 3;

const resolveTopicMcqTargetCount = (value: any) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return EXAM_READY_MIN_MCQ_COUNT;
    }
    return Math.max(1, Math.round(numeric));
};

const resolveTopicEssayTargetCount = (value: any) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return EXAM_READY_MIN_ESSAY_COUNT;
    }
    return Math.max(1, Math.round(numeric));
};

const resolveOptionalTargetCount = (value: any, fallback = 0) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return Math.max(0, Math.round(Number(fallback) || 0));
    }
    return Math.max(0, Math.round(numeric));
};

const normalizeReadinessRatio = (value: any) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.min(1, numeric));
};

const buildTopicReadinessPatch = (readiness: any, extras: Record<string, any> = {}) => ({
    examReady: readiness.examReady,
    mcqTargetCount: readiness.mcqTargetCount,
    trueFalseTargetCount: readiness.trueFalseTargetCount,
    fillInTargetCount: readiness.fillInTargetCount,
    totalObjectiveTargetCount: readiness.totalObjectiveTargetCount,
    essayTargetCount: readiness.essayTargetCount,
    objectiveReady: readiness.objectiveReady,
    essayReady: readiness.essayReady,
    usableObjectiveCount: readiness.usableObjectiveCount,
    usableObjectiveBreakdown: readiness.usableObjectiveBreakdown,
    usableMcqCount: readiness.usableMcqCount,
    usableTrueFalseCount: readiness.usableTrueFalseCount,
    usableFillInCount: readiness.usableFillInCount,
    usableEssayCount: readiness.usableEssayCount,
    tier1Count: readiness.tier1Count,
    tier2Count: readiness.tier2Count,
    tier3Count: readiness.tier3Count,
    difficultyDistribution: readiness.difficultyDistribution,
    bloomCoverage: readiness.bloomCoverage,
    readinessScore: readiness.readinessScore,
    claimCoverage: readiness.claimCoverage,
    canImprove: readiness.canImprove,
    improvementActions: readiness.improvementActions,
    ...extras,
});

export const computeTopicExamReadinessFromQuestions = (
    topic: any,
    questions: any[],
    options?: {
        mcqTargetCount?: number;
        trueFalseTargetCount?: number;
        fillInTargetCount?: number;
        totalObjectiveTargetCount?: number;
        essayTargetCount?: number;
        subClaims?: any[];
    },
) => {
    const activeQuestions = filterQuestionsForActiveAssessment({ topic, questions });
    const usableObjectiveQuestions = activeQuestions.filter(
        (question) => question?.questionType !== "essay" && isUsableExamQuestion(question)
    );
    const usableEssayQuestions = activeQuestions.filter(
        (question) =>
            question?.questionType === "essay"
            && isUsableExamQuestion(question, { allowEssay: true })
    );
    const usableMcqCount = usableObjectiveQuestions.filter(
        (question) => normalizeQuestionType(question?.questionType) === QUESTION_TYPE_MULTIPLE_CHOICE
    ).length;
    const usableTrueFalseCount = usableObjectiveQuestions.filter(
        (question) => normalizeQuestionType(question?.questionType) === QUESTION_TYPE_TRUE_FALSE
    ).length;
    const usableFillInCount = usableObjectiveQuestions.filter(
        (question) => normalizeQuestionType(question?.questionType) === QUESTION_TYPE_FILL_BLANK
    ).length;
    const usableObjectiveCount = usableObjectiveQuestions.length;
    const usableEssayCount = usableEssayQuestions.length;
    const mcqTargetCount = resolveTopicMcqTargetCount(options?.mcqTargetCount);
    const trueFalseTargetCount = resolveOptionalTargetCount(options?.trueFalseTargetCount, topic?.trueFalseTargetCount);
    const fillInTargetCount = resolveOptionalTargetCount(options?.fillInTargetCount, topic?.fillInTargetCount);
    const totalObjectiveTargetCount = Math.max(
        1,
        resolveOptionalTargetCount(
            options?.totalObjectiveTargetCount,
            topic?.totalObjectiveTargetCount ?? topic?.objectiveTargetCount ?? mcqTargetCount,
        ) || mcqTargetCount,
    );
    const essayTargetCount = resolveTopicEssayTargetCount(options?.essayTargetCount);
    const objectiveReady = usableObjectiveCount >= totalObjectiveTargetCount;
    const essayReady = usableEssayCount >= essayTargetCount;
    const tier1Count = usableObjectiveQuestions.filter((question) => Number(question?.tier || 0) === 1).length;
    const tier2Count = usableObjectiveQuestions.filter((question) => Number(question?.tier || 0) === 2).length;
    const tier3Count = usableObjectiveQuestions.filter((question) => Number(question?.tier || 0) === 3).length;
    const usableQuestions = [...usableObjectiveQuestions, ...usableEssayQuestions];
    const difficultyDistribution = {
        easy: usableQuestions.filter((question) => String(question?.difficulty || "").trim().toLowerCase() === "easy").length,
        medium: usableQuestions.filter((question) => String(question?.difficulty || "").trim().toLowerCase() === "medium").length,
        hard: usableQuestions.filter((question) => String(question?.difficulty || "").trim().toLowerCase() === "hard").length,
    };
    const bloomCoverage = Array.from(
        new Set(
            usableQuestions
                .map((question) => String(question?.bloomLevel || "").trim())
                .filter(Boolean)
        )
    );
    const coveredSubClaimIds = new Set(
        usableQuestions.flatMap((question) => [
            String(question?.subClaimId || "").trim(),
            ...(
                Array.isArray(question?.sourceSubClaimIds)
                    ? question.sourceSubClaimIds.map((value: any) => String(value || "").trim())
                    : []
            ),
        ].filter(Boolean))
    );
    const totalSubClaimCount = Array.isArray(options?.subClaims) ? options!.subClaims.length : 0;
    const claimCoverage = totalSubClaimCount > 0
        ? normalizeReadinessRatio(coveredSubClaimIds.size / totalSubClaimCount)
        : 0;
    const tier1Threshold = usableObjectiveCount < 3
        ? Math.min(1, usableObjectiveCount)
        : Math.ceil(usableObjectiveCount * 0.4);
    const tier1Sufficient = usableObjectiveCount === 0 ? false : tier1Count >= tier1Threshold;
    const difficultySpreadSufficient = usableQuestions.length < 3
        ? usableQuestions.length > 0
        : difficultyDistribution.easy > 0 && difficultyDistribution.medium > 0 && difficultyDistribution.hard > 0;
    const claimCoverageThreshold = totalSubClaimCount <= 0
        ? 1
        : totalSubClaimCount <= 2
            ? 1
            : 0.5;
    const claimCoverageSufficient = totalSubClaimCount > 0 && claimCoverage >= claimCoverageThreshold;
    const objectiveFill = normalizeReadinessRatio(usableObjectiveCount / Math.max(totalObjectiveTargetCount, 1));
    const essayFill = normalizeReadinessRatio(usableEssayCount / Math.max(essayTargetCount, 1));
    const readinessScore = normalizeReadinessRatio(
        objectiveFill * 0.5
        + essayFill * 0.3
        + claimCoverage * 0.2
    );
    const improvementActions = [];
    if (!objectiveReady) {
        improvementActions.push(`Generate ${Math.max(0, totalObjectiveTargetCount - usableObjectiveCount)} more objective items`);
    }
    if (!essayReady) {
        improvementActions.push(`Generate ${Math.max(0, essayTargetCount - usableEssayCount)} more essay items`);
    }
    if (!tier1Sufficient) {
        improvementActions.push(`Need more Tier 1 objective questions; currently ${tier1Count}/${Math.max(usableObjectiveCount, 1)}`);
    }
    if (!difficultySpreadSufficient) {
        if (difficultyDistribution.easy === 0) improvementActions.push("Add at least one easy question for difficulty spread");
        if (difficultyDistribution.medium === 0) improvementActions.push("Add at least one medium question for difficulty spread");
        if (difficultyDistribution.hard === 0) improvementActions.push("Add at least one hard question for difficulty spread");
    }
    if (!claimCoverageSufficient) {
        improvementActions.push(`Only ${Math.round(claimCoverage * 100)}% of sub-claims are covered`);
    }
    if (trueFalseTargetCount > 0 && usableTrueFalseCount < trueFalseTargetCount) {
        improvementActions.push(`Generate ${trueFalseTargetCount - usableTrueFalseCount} more true/false items`);
    }
    if (fillInTargetCount > 0 && usableFillInCount < fillInTargetCount) {
        improvementActions.push(`Generate ${fillInTargetCount - usableFillInCount} more fill-in-the-blank items`);
    }
    const examReady =
        objectiveReady
        && essayReady
        && tier1Sufficient
        && difficultySpreadSufficient
        && claimCoverageSufficient;

    return {
        mcqTargetCount,
        trueFalseTargetCount,
        fillInTargetCount,
        totalObjectiveTargetCount,
        essayTargetCount,
        objectiveReady,
        essayReady,
        usableObjectiveCount,
        usableObjectiveBreakdown: {
            multiple_choice: usableMcqCount,
            true_false: usableTrueFalseCount,
            fill_blank: usableFillInCount,
        },
        usableMcqCount,
        usableTrueFalseCount,
        usableFillInCount,
        usableEssayCount,
        tier1Count,
        tier2Count,
        tier3Count,
        difficultyDistribution,
        bloomCoverage,
        readinessScore,
        claimCoverage,
        canImprove: improvementActions.length > 0,
        improvementActions,
        examReady,
    };
};

const dedupeTopicQuestions = (questions: any[]) => {
    const items = Array.isArray(questions) ? questions : [];
    const seenMcqSignatures: any[] = [];
    const seenEssaySignatures: any[] = [];
    const deduped = [];

    for (const question of items) {
        if (!question) continue;
        if (String(question?.questionType || "") === "essay") {
            const essaySignature = buildQuestionPromptSignature(question?.questionText || "");
            if (
                essaySignature?.normalized
                && seenEssaySignatures.some((prior) =>
                    areQuestionPromptsNearDuplicate(essaySignature, prior)
                )
            ) {
                continue;
            }
            if (essaySignature?.normalized) {
                seenEssaySignatures.push(essaySignature);
            }
            deduped.push(question);
            continue;
        }

        const signature = buildMcqUniquenessSignature(question);
        if (seenMcqSignatures.some((prior) => areMcqQuestionsNearDuplicate(signature, prior))) {
            continue;
        }

        seenMcqSignatures.push(signature);
        deduped.push(question);
    }

    return deduped;
};

const getTopicWithQuestionsPayload = async (ctx: any, topicId: any) => {
    const safeGetDocument = async (id: any) => {
        if (!id) return null;
        try {
            return await ctx.db.get(id);
        } catch {
            return null;
        }
    };

    const topic = await safeGetDocument(topicId);
    if (!topic) return null;
    const course = await safeGetDocument(topic.courseId);
    if (!course) return null;

    let freshIllustrationUrl: string | undefined =
        topic.illustrationUrl || resolveDefaultTopicIllustrationUrl();
    if (topic.illustrationStorageId) {
        const resolvedStorageUrl =
            (await resolveIllustrationUrl({
                illustrationStorageId: topic.illustrationStorageId,
                getUrl: (storageId) => ctx.storage.getUrl(storageId),
            })) || undefined;
        if (resolvedStorageUrl) {
            freshIllustrationUrl = resolvedStorageUrl;
        }
    }

    let questions: any[] = [];
    try {
        questions = await ctx.db
            .query("questions")
            .withIndex("by_topicId", (q: any) => q.eq("topicId", topicId))
            .collect();
    } catch {
        questions = [];
    }
    const activeQuestions = filterQuestionsForActiveAssessment({ topic, questions });
    const dedupedQuestions = dedupeTopicQuestions(activeQuestions);
    const subClaims = await ctx.db
        .query("topicSubClaims")
        .withIndex("by_topicId", (q) => q.eq("topicId", topicId))
        .collect();
    const safeQuestions = dedupedQuestions
        .filter((question: any) =>
            isUsableExamQuestion(question, {
                allowEssay: String(question?.questionType || "") === "essay",
            })
        )
        .map((question: any) => sanitizeExamQuestionForClient(question));
    const computedReadiness = computeTopicExamReadinessFromQuestions(topic, dedupedQuestions, {
        mcqTargetCount: topic?.mcqTargetCount,
        trueFalseTargetCount: topic?.trueFalseTargetCount,
        fillInTargetCount: topic?.fillInTargetCount,
        totalObjectiveTargetCount: topic?.totalObjectiveTargetCount,
        essayTargetCount: topic?.essayTargetCount,
        subClaims,
    });

    return {
        topic: {
            ...topic,
            illustrationUrl: freshIllustrationUrl,
            ...buildTopicReadinessPatch(computedReadiness),
            questions: safeQuestions,
        },
        ownerUserId: course.userId,
    };
};

const resolveTopicIdFromRoute = (ctx: any, routeId: unknown) => {
    const normalizedRouteId = typeof routeId === "string" ? routeId.trim() : "";
    if (!normalizedRouteId) return null;
    try {
        return ctx.db.normalizeId("topics", normalizedRouteId);
    } catch {
        return null;
    }
};

// Get all topics for a course
export const getTopicsByCourse = query({
    args: { courseId: v.id("courses") },
    handler: async (ctx, args) => {
        const topics = await ctx.db
            .query("topics")
            .withIndex("by_courseId", (q) => q.eq("courseId", args.courseId))
            .order("asc")
            .collect();

        const topicsWithIllustrations = await Promise.all(
            topics.map(async (topic) => {
                let freshIllustrationUrl: string | undefined =
                    topic.illustrationUrl || resolveDefaultTopicIllustrationUrl();

                if (topic.illustrationStorageId) {
                    const resolvedStorageUrl = await resolveIllustrationUrl({
                        illustrationStorageId: topic.illustrationStorageId,
                        getUrl: (storageId) => ctx.storage.getUrl(storageId),
                    });
                    if (resolvedStorageUrl) {
                        freshIllustrationUrl = resolvedStorageUrl;
                    }
                }

                return {
                    ...topic,
                    // Convex storage URLs are signed and can expire; refresh on each read.
                    illustrationUrl: freshIllustrationUrl,
                };
            })
        );

        return topicsWithIllustrations;
    },
});

// Get single topic with its questions
export const getTopicWithQuestions = query({
    args: { topicId: v.string() },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        const authUserId = resolveAuthUserId(identity);
        if (!authUserId) return null;

        const topicId = resolveTopicIdFromRoute(ctx, args.topicId);
        if (!topicId) return null;

        const payload = await getTopicWithQuestionsPayload(ctx, topicId);
        if (!payload) return null;

        try {
            assertAuthorizedUser({
                authUserId,
                resourceOwnerUserId: payload.ownerUserId,
            });
        } catch {
            return null;
        }

        return payload.topic;
    },
});

export const getTopicWithQuestionsInternal = internalQuery({
    args: { topicId: v.id("topics") },
    handler: async (ctx, args) => {
        const payload = await getTopicWithQuestionsPayload(ctx, args.topicId);
        if (!payload) return null;
        const rawQuestions = await ctx.db
            .query("questions")
            .withIndex("by_topicId", (q) => q.eq("topicId", args.topicId))
            .collect();
        const activeQuestions = dedupeTopicQuestions(filterQuestionsForActiveAssessment({
            topic: payload.topic,
            questions: rawQuestions,
        }));
        const subClaims = await ctx.db
            .query("topicSubClaims")
            .withIndex("by_topicId", (q) => q.eq("topicId", args.topicId))
            .collect();
        const computedReadiness = computeTopicExamReadinessFromQuestions(payload.topic, activeQuestions, {
            mcqTargetCount: payload.topic?.mcqTargetCount,
            trueFalseTargetCount: payload.topic?.trueFalseTargetCount,
            fillInTargetCount: payload.topic?.fillInTargetCount,
            totalObjectiveTargetCount: payload.topic?.totalObjectiveTargetCount,
            essayTargetCount: payload.topic?.essayTargetCount,
            subClaims,
        });
        return {
            ...payload.topic,
            ...buildTopicReadinessPatch(computedReadiness),
            questions: activeQuestions,
        };
    },
});

// Get topic owner user id (for server-side authorization checks)
export const getTopicOwnerUserIdInternal = internalQuery({
    args: { topicId: v.id("topics") },
    handler: async (ctx, args) => {
        const topic = await ctx.db.get(args.topicId);
        if (!topic) return null;
        const course = await ctx.db.get(topic.courseId);
        if (!course) return null;
        return {
            topicId: topic._id,
            courseId: topic.courseId,
            userId: course.userId,
        };
    },
});

// Get questions for a topic (for exam mode)
export const getQuestionsByTopic = query({
    args: { topicId: v.id("topics") },
    handler: async (ctx, args) => {
        const topic = await ctx.db.get(args.topicId);
        const questions = await ctx.db
            .query("questions")
            .withIndex("by_topicId", (q) => q.eq("topicId", args.topicId))
            .collect();

        // Shuffle questions for randomized exams
        return dedupeTopicQuestions(filterQuestionsForActiveAssessment({
            topic,
            questions,
        }))
            .filter((question) =>
                isUsableExamQuestion(question, {
                    allowEssay: String(question?.questionType || "") === "essay",
                })
            )
            .map((question) => sanitizeExamQuestionForClient(question))
            .sort(() => Math.random() - 0.5);
    },
});

export const getRawQuestionsByTopicInternal = internalQuery({
    args: { topicId: v.id("topics") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("questions")
            .withIndex("by_topicId", (q) => q.eq("topicId", args.topicId))
            .collect();
    },
});

export const getSubClaimsByTopicInternal = internalQuery({
    args: { topicId: v.id("topics") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("topicSubClaims")
            .withIndex("by_topicId", (q) => q.eq("topicId", args.topicId))
            .order("asc")
            .collect();
    },
});

export const getDistractorsByTopicInternal = internalQuery({
    args: { topicId: v.id("topics") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("distractorBank")
            .withIndex("by_topicId", (q) => q.eq("topicId", args.topicId))
            .order("asc")
            .collect();
    },
});

// Create a new topic
export const createTopic = mutation({
    args: {
        courseId: v.id("courses"),
        sourceUploadId: v.optional(v.id("uploads")),
        title: v.string(),
        description: v.optional(v.string()),
        content: v.optional(v.string()),
        sourceChunkIds: v.optional(v.array(v.number())),
        sourcePassageIds: v.optional(v.array(v.string())),
        structuredSubtopics: v.optional(v.array(v.string())),
        structuredDefinitions: v.optional(v.array(v.object({
            term: v.string(),
            meaning: v.string(),
        }))),
        structuredExamples: v.optional(v.array(v.string())),
        structuredFormulas: v.optional(v.array(v.string())),
        structuredLikelyConfusions: v.optional(v.array(v.string())),
        structuredLearningObjectives: v.optional(v.array(v.string())),
        structuredSourcePages: v.optional(v.array(v.number())),
        structuredSourceBlockIds: v.optional(v.array(v.string())),
        contentGraph: v.optional(v.object({
            title: v.string(),
            description: v.optional(v.string()),
            keyPoints: v.array(v.string()),
            subtopics: v.array(v.string()),
            definitions: v.array(v.object({
                term: v.string(),
                meaning: v.string(),
            })),
            examples: v.array(v.string()),
            formulas: v.array(v.string()),
            likelyConfusions: v.array(v.string()),
            learningObjectives: v.array(v.string()),
            sourcePages: v.array(v.number()),
            sourceBlockIds: v.array(v.string()),
            sourcePassages: v.array(v.object({
                passageId: v.string(),
                page: v.number(),
                sectionHint: v.optional(v.string()),
                text: v.string(),
            })),
        })),
        groundingVersion: v.optional(v.string()),
        illustrationStorageId: v.optional(v.id("_storage")),
        illustrationUrl: v.optional(v.string()),
        orderIndex: v.number(),
        isLocked: v.boolean(),
    },
    handler: async (ctx, args) => {
        const questionSetVersion = Date.now();
        const topicId = await ctx.db.insert("topics", {
            courseId: args.courseId,
            sourceUploadId: args.sourceUploadId,
            title: args.title,
            description: args.description,
            content: args.content,
            sourceChunkIds: args.sourceChunkIds,
            sourcePassageIds: args.sourcePassageIds,
            structuredSubtopics: args.structuredSubtopics,
            structuredDefinitions: args.structuredDefinitions,
            structuredExamples: args.structuredExamples,
            structuredFormulas: args.structuredFormulas,
            structuredLikelyConfusions: args.structuredLikelyConfusions,
            structuredLearningObjectives: args.structuredLearningObjectives,
            structuredSourcePages: args.structuredSourcePages,
            structuredSourceBlockIds: args.structuredSourceBlockIds,
            contentGraph: args.contentGraph,
            groundingVersion: args.groundingVersion,
            illustrationStorageId: args.illustrationStorageId,
            illustrationUrl: args.illustrationUrl || resolveDefaultTopicIllustrationUrl(),
            questionSetVersion,
            examReady: false,
            mcqTargetCount: EXAM_READY_MIN_MCQ_COUNT,
            trueFalseTargetCount: 0,
            fillInTargetCount: 0,
            totalObjectiveTargetCount: EXAM_READY_MIN_MCQ_COUNT,
            essayTargetCount: EXAM_READY_MIN_ESSAY_COUNT,
            objectiveReady: false,
            essayReady: false,
            usableObjectiveCount: 0,
            usableObjectiveBreakdown: {
                multiple_choice: 0,
                true_false: 0,
                fill_blank: 0,
            },
            usableMcqCount: 0,
            usableTrueFalseCount: 0,
            usableFillInCount: 0,
            usableEssayCount: 0,
            tier1Count: 0,
            tier2Count: 0,
            tier3Count: 0,
            difficultyDistribution: {
                easy: 0,
                medium: 0,
                hard: 0,
            },
            bloomCoverage: [],
            readinessScore: 0,
            claimCoverage: 0,
            canImprove: false,
            improvementActions: [],
            examReadyUpdatedAt: questionSetVersion,
            orderIndex: args.orderIndex,
            isLocked: args.isLocked,
        });

        void ctx.scheduler.runAfter(0, (internal as any).search.upsertSearchDocumentsForEntity, {
            kind: "topic",
            entityId: topicId,
        }).catch(() => undefined);

        return topicId;
    },
});

export const refreshTopicExamReadinessInternal = internalMutation({
    args: {
        topicId: v.id("topics"),
        mcqTargetCount: v.optional(v.number()),
        trueFalseTargetCount: v.optional(v.number()),
        fillInTargetCount: v.optional(v.number()),
        totalObjectiveTargetCount: v.optional(v.number()),
        essayTargetCount: v.optional(v.number()),
        readinessScore: v.optional(v.number()),
        claimCoverage: v.optional(v.number()),
        yieldConfidence: v.optional(v.string()),
        yieldReasoning: v.optional(v.string()),
        examIneligibleReason: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const topic = await ctx.db.get(args.topicId);
        if (!topic) {
            return {
                topicId: args.topicId,
                exists: false,
                examReady: false,
                mcqTargetCount: EXAM_READY_MIN_MCQ_COUNT,
                trueFalseTargetCount: 0,
                fillInTargetCount: 0,
                totalObjectiveTargetCount: EXAM_READY_MIN_MCQ_COUNT,
                essayTargetCount: EXAM_READY_MIN_ESSAY_COUNT,
                objectiveReady: false,
                essayReady: false,
                usableObjectiveCount: 0,
                usableObjectiveBreakdown: {
                    multiple_choice: 0,
                    true_false: 0,
                    fill_blank: 0,
                },
                usableMcqCount: 0,
                usableTrueFalseCount: 0,
                usableFillInCount: 0,
                usableEssayCount: 0,
                tier1Count: 0,
                tier2Count: 0,
                tier3Count: 0,
                difficultyDistribution: { easy: 0, medium: 0, hard: 0 },
                bloomCoverage: [],
                readinessScore: 0,
                claimCoverage: 0,
                canImprove: false,
                improvementActions: [],
            };
        }

        const questions = await ctx.db
            .query("questions")
            .withIndex("by_topicId", (q) => q.eq("topicId", args.topicId))
            .collect();
        const subClaims = await ctx.db
            .query("topicSubClaims")
            .withIndex("by_topicId", (q) => q.eq("topicId", args.topicId))
            .collect();
        const readiness = computeTopicExamReadinessFromQuestions(topic, questions, {
            mcqTargetCount: args.mcqTargetCount ?? topic.mcqTargetCount,
            trueFalseTargetCount: args.trueFalseTargetCount ?? topic.trueFalseTargetCount,
            fillInTargetCount: args.fillInTargetCount ?? topic.fillInTargetCount,
            totalObjectiveTargetCount: args.totalObjectiveTargetCount ?? topic.totalObjectiveTargetCount,
            essayTargetCount: args.essayTargetCount ?? topic.essayTargetCount,
            subClaims,
        });

        await ctx.db.patch(args.topicId, buildTopicReadinessPatch(readiness, {
            readinessScore: args.readinessScore ?? readiness.readinessScore,
            claimCoverage: args.claimCoverage ?? readiness.claimCoverage,
            yieldConfidence: args.yieldConfidence ?? topic.yieldConfidence,
            yieldReasoning: args.yieldReasoning ?? topic.yieldReasoning,
            examIneligibleReason: args.examIneligibleReason ?? topic.examIneligibleReason,
            examReadyUpdatedAt: Date.now(),
        }));

        return {
            topicId: args.topicId,
            exists: true,
            ...readiness,
        };
    },
});

export const updateTopicAssessmentMetadataInternal = internalMutation({
    args: {
        topicId: v.id("topics"),
        objectiveTargetCount: v.optional(v.number()),
        trueFalseTargetCount: v.optional(v.number()),
        fillInTargetCount: v.optional(v.number()),
        totalObjectiveTargetCount: v.optional(v.number()),
        readinessScore: v.optional(v.number()),
        claimCoverage: v.optional(v.number()),
        yieldConfidence: v.optional(v.string()),
        yieldReasoning: v.optional(v.string()),
        examIneligibleReason: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const topic = await ctx.db.get(args.topicId);
        if (!topic) {
            throw new Error("Topic not found");
        }

        await ctx.db.patch(args.topicId, {
            objectiveTargetCount: args.objectiveTargetCount ?? topic.objectiveTargetCount,
            trueFalseTargetCount: args.trueFalseTargetCount ?? topic.trueFalseTargetCount,
            fillInTargetCount: args.fillInTargetCount ?? topic.fillInTargetCount,
            totalObjectiveTargetCount: args.totalObjectiveTargetCount ?? topic.totalObjectiveTargetCount,
            readinessScore: args.readinessScore ?? topic.readinessScore,
            claimCoverage: args.claimCoverage ?? topic.claimCoverage,
            yieldConfidence: args.yieldConfidence ?? topic.yieldConfidence,
            yieldReasoning: args.yieldReasoning ?? topic.yieldReasoning,
            examIneligibleReason: args.examIneligibleReason ?? topic.examIneligibleReason,
        });

        return { topicId: args.topicId, updated: true };
    },
});

export const saveAssessmentBlueprintInternal = internalMutation({
    args: {
        topicId: v.id("topics"),
        assessmentBlueprint: v.any(),
    },
    handler: async (ctx, args) => {
        const topic = await ctx.db.get(args.topicId);
        if (!topic) {
            throw new Error("Topic not found");
        }
        const questionSetVersion = Date.now();

        await ctx.db.patch(args.topicId, {
            assessmentBlueprint: args.assessmentBlueprint,
            questionSetVersion,
            examReady: false,
            examReadyUpdatedAt: questionSetVersion,
        });

        return {
            topicId: args.topicId,
            version: String(args.assessmentBlueprint?.version || ASSESSMENT_BLUEPRINT_VERSION),
        };
    },
});

export const replaceSubClaimsForTopicInternal = internalMutation({
    args: {
        topicId: v.id("topics"),
        uploadId: v.optional(v.id("uploads")),
        claims: v.array(v.object({
            claimText: v.string(),
            sourcePassageIds: v.array(v.string()),
            sourceQuotes: v.array(v.string()),
            claimType: v.string(),
            cognitiveOperations: v.array(v.string()),
            bloomLevel: v.string(),
            difficultyEstimate: v.string(),
            questionYieldEstimate: v.number(),
        })),
    },
    handler: async (ctx, args) => {
        const existingClaims = await ctx.db
            .query("topicSubClaims")
            .withIndex("by_topicId", (q) => q.eq("topicId", args.topicId))
            .collect();

        for (const claim of existingClaims) {
            const distractors = await ctx.db
                .query("distractorBank")
                .withIndex("by_subClaimId", (q) => q.eq("subClaimId", claim._id))
                .collect();
            for (const distractor of distractors) {
                await ctx.db.delete(distractor._id);
            }
            await ctx.db.delete(claim._id);
        }

        const createdIds = [];
        for (const claim of args.claims) {
            const claimId = await ctx.db.insert("topicSubClaims", {
                topicId: args.topicId,
                uploadId: args.uploadId,
                claimText: claim.claimText,
                sourcePassageIds: claim.sourcePassageIds,
                sourceQuotes: claim.sourceQuotes,
                claimType: claim.claimType,
                cognitiveOperations: claim.cognitiveOperations,
                bloomLevel: claim.bloomLevel,
                difficultyEstimate: claim.difficultyEstimate,
                questionYieldEstimate: claim.questionYieldEstimate,
                status: "active",
                createdAt: Date.now(),
            });
            createdIds.push(claimId);
        }

        return {
            topicId: args.topicId,
            count: createdIds.length,
        };
    },
});

export const replaceDistractorsForTopicInternal = internalMutation({
    args: {
        topicId: v.id("topics"),
        distractors: v.array(v.object({
            subClaimId: v.id("topicSubClaims"),
            distractorText: v.string(),
            distractorType: v.string(),
            sourceClaimText: v.string(),
            whyPlausible: v.string(),
            whyWrong: v.string(),
            difficulty: v.string(),
        })),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("distractorBank")
            .withIndex("by_topicId", (q) => q.eq("topicId", args.topicId))
            .collect();

        for (const distractor of existing) {
            await ctx.db.delete(distractor._id);
        }

        for (const distractor of args.distractors) {
            await ctx.db.insert("distractorBank", {
                topicId: args.topicId,
                subClaimId: distractor.subClaimId,
                distractorText: distractor.distractorText,
                distractorType: distractor.distractorType,
                sourceClaimText: distractor.sourceClaimText,
                whyPlausible: distractor.whyPlausible,
                whyWrong: distractor.whyWrong,
                difficulty: distractor.difficulty,
                usedInQuestionIds: [],
                status: "available",
            });
        }

        return {
            topicId: args.topicId,
            count: args.distractors.length,
        };
    },
});

// Generation lock TTLs — kept close to actual generation time budgets so
// stale locks don't block new requests for too long.
const MCQ_GENERATION_LOCK_TTL_MS = 4 * 60 * 1000; // 4 minutes (MCQ budget is ~180s)
const ESSAY_GENERATION_LOCK_TTL_MS = 60 * 1000;    // 60 seconds (essay budget is ~30s)

/**
 * Attempt to acquire a generation lock for the given topic + format.
 * Returns { acquired: true } if the lock was set, or { acquired: false }
 * if another generation is already in progress (lock not yet expired).
 */
export const acquireGenerationLockInternal = internalMutation({
    args: {
        topicId: v.id("topics"),
        format: v.string(), // 'mcq' | 'essay'
    },
    handler: async (ctx, args) => {
        const topic = await ctx.db.get(args.topicId);
        if (!topic) {
            return {
                acquired: false,
                now: Date.now(),
                lockWaitMs: 0,
                lockedUntil: 0,
                ttlMs: 0,
            };
        }

        const now = Date.now();
        const lockField = args.format === "essay"
            ? "essayGenerationLockedUntil"
            : "mcqGenerationLockedUntil";
        const currentLock = Number((topic as any)[lockField] || 0);
        const ttlMs = args.format === "essay"
            ? ESSAY_GENERATION_LOCK_TTL_MS
            : MCQ_GENERATION_LOCK_TTL_MS;

        if (currentLock > now) {
            // Lock is still held and not expired
            return {
                acquired: false,
                now,
                lockWaitMs: currentLock - now,
                lockedUntil: currentLock,
                ttlMs,
            };
        }

        const lockedUntil = now + ttlMs;
        await ctx.db.patch(args.topicId, {
            [lockField]: now + ttlMs,
        });

        return {
            acquired: true,
            now,
            lockWaitMs: 0,
            lockedUntil,
            ttlMs,
        };
    },
});

/**
 * Release a generation lock after generation completes (or fails).
 */
export const releaseGenerationLockInternal = internalMutation({
    args: {
        topicId: v.id("topics"),
        format: v.string(), // 'mcq' | 'essay'
    },
    handler: async (ctx, args) => {
        const topic = await ctx.db.get(args.topicId);
        if (!topic) return;

        const lockField = args.format === "essay"
            ? "essayGenerationLockedUntil"
            : "mcqGenerationLockedUntil";

        await ctx.db.patch(args.topicId, {
            [lockField]: 0,
        });
    },
});

export const updateTopicIllustration = mutation({
    args: {
        topicId: v.id("topics"),
        illustrationStorageId: v.optional(v.id("_storage")),
        illustrationUrl: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const topic = await ctx.db.get(args.topicId);
        if (!topic) {
            throw new Error("Topic not found");
        }

        await ctx.db.patch(args.topicId, {
            illustrationStorageId: args.illustrationStorageId,
            illustrationUrl: args.illustrationUrl,
        });

        return { success: true };
    },
});


// Unlock a topic
export const unlockTopic = mutation({
    args: { topicId: v.id("topics") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        await ctx.db.patch(args.topicId, {
            isLocked: false,
        });
    },
});

// Create a question for a topic
export const createQuestionInternal = internalMutation({
    args: {
        topicId: v.id("topics"),
        questionText: v.string(),
        questionType: v.string(),
        options: v.optional(v.any()),
        correctAnswer: v.string(),
        explanation: v.optional(v.string()),
        difficulty: v.optional(v.string()),
        citations: v.optional(v.array(v.any())),
        sourcePassageIds: v.optional(v.array(v.string())),
        groundingScore: v.optional(v.number()),
        factualityStatus: v.optional(v.string()),
        generationVersion: v.optional(v.string()),
        learningObjective: v.optional(v.string()),
        bloomLevel: v.optional(v.string()),
        outcomeKey: v.optional(v.string()),
        tier: v.optional(v.number()),
        subClaimId: v.optional(v.id("topicSubClaims")),
        cognitiveOperation: v.optional(v.string()),
        sourceSubClaimIds: v.optional(v.array(v.id("topicSubClaims"))),
        essayPlanItemKey: v.optional(v.string()),
        groundingEvidence: v.optional(v.string()),
        authenticContext: v.optional(v.string()),
        rubricPoints: v.optional(v.array(v.string())),
        generationRunId: v.optional(v.string()),
        qualityScore: v.optional(v.number()),
        qualityTier: v.optional(v.string()),
        rigorScore: v.optional(v.number()),
        clarityScore: v.optional(v.number()),
        diversityCluster: v.optional(v.string()),
        distractorScore: v.optional(v.number()),
        freshnessBucket: v.optional(v.string()),
        qualityFlags: v.optional(v.array(v.string())),
        templateParts: v.optional(v.array(v.string())),
        tokens: v.optional(v.array(v.string())),
        acceptedAnswers: v.optional(v.array(v.string())),
        fillBlankMode: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const topic = await ctx.db.get(args.topicId);
        if (!topic) {
            throw new Error("Topic not found");
        }

        if (String(args.generationVersion || "").trim() === ASSESSMENT_BLUEPRINT_VERSION) {
            const metadataIssues = getAssessmentQuestionMetadataIssues({
                question: args,
                questionType: args.questionType,
            });
            if (metadataIssues.length > 0) {
                throw new Error(`Assessment metadata invalid: ${metadataIssues.join(", ")}`);
            }
        }

        const existingQuestions = await ctx.db
            .query("questions")
            .withIndex("by_topicId", (q) => q.eq("topicId", args.topicId))
            .collect();
        const normalizedQuestionType = normalizeQuestionType(args.questionType);
        if (normalizedQuestionType === "essay") {
            const candidateSignature = buildQuestionPromptSignature(args.questionText);
            const duplicateExists = existingQuestions
                .filter((question: any) => String(question?.questionType || "").trim().toLowerCase() === "essay")
                .some((question: any) =>
                    areQuestionPromptsNearDuplicate(candidateSignature, buildQuestionPromptSignature(question?.questionText || ""))
                );
            if (duplicateExists) {
                return null;
            }
        } else if (normalizedQuestionType === QUESTION_TYPE_MULTIPLE_CHOICE) {
            const candidateSignature = buildMcqUniquenessSignature({
                questionText: args.questionText,
                options: args.options,
                correctAnswer: args.correctAnswer,
                citations: args.citations,
            });
            const duplicateExists = existingQuestions
                .filter((question: any) => String(question?.questionType || "").trim().toLowerCase() !== "essay")
                .some((question: any) =>
                    areMcqQuestionsNearDuplicate(candidateSignature, buildMcqUniquenessSignature(question))
                );
            if (duplicateExists) {
                return null;
            }
        } else {
            const candidateSignature = buildQuestionPromptSignature(args.questionText);
            const duplicateExists = existingQuestions
                .filter((question: any) => normalizeQuestionType(question?.questionType) === normalizedQuestionType)
                .some((question: any) =>
                    areQuestionPromptsNearDuplicate(candidateSignature, buildQuestionPromptSignature(question?.questionText || ""))
                );
            if (duplicateExists) {
                return null;
            }
        }

        const questionId = await ctx.db.insert("questions", {
            topicId: args.topicId,
            questionText: args.questionText,
            questionType: args.questionType,
            options: args.options,
            correctAnswer: args.correctAnswer,
            explanation: args.explanation,
            difficulty: args.difficulty,
            citations: args.citations,
            sourcePassageIds: args.sourcePassageIds,
            groundingScore: args.groundingScore,
            factualityStatus: args.factualityStatus,
            generationVersion: args.generationVersion,
            generationRunId: args.generationRunId,
            questionSetVersion: Number(topic?.questionSetVersion || topic?.examReadyUpdatedAt || topic?._creationTime || 0) || undefined,
            tier: args.tier,
            subClaimId: args.subClaimId,
            cognitiveOperation: args.cognitiveOperation,
            sourceSubClaimIds: args.sourceSubClaimIds,
            essayPlanItemKey: args.essayPlanItemKey,
            learningObjective: args.learningObjective,
            bloomLevel: args.bloomLevel,
            outcomeKey: args.outcomeKey,
            groundingEvidence: args.groundingEvidence,
            authenticContext: args.authenticContext,
            templateParts: args.templateParts,
            tokens: args.tokens,
            acceptedAnswers: args.acceptedAnswers,
            fillBlankMode: args.fillBlankMode,
            rubricPoints: args.rubricPoints,
            qualityScore: args.qualityScore,
            qualityTier: args.qualityTier,
            rigorScore: args.rigorScore,
            clarityScore: args.clarityScore,
            diversityCluster: args.diversityCluster,
            distractorScore: args.distractorScore,
            freshnessBucket: args.freshnessBucket,
            qualityFlags: args.qualityFlags,
        });

        return questionId;
    },
});

// Delete all questions for a topic (used for regeneration)
export const deleteQuestionsByTopicInternal = internalMutation({
    args: { topicId: v.id("topics") },
    handler: async (ctx, args) => {
        const topic = await ctx.db.get(args.topicId);
        const questions = await ctx.db
            .query("questions")
            .withIndex("by_topicId", (q) => q.eq("topicId", args.topicId))
            .collect();

        for (const question of questions) {
            await ctx.db.delete(question._id);
        }

        if (topic) {
            const subClaims = await ctx.db
                .query("topicSubClaims")
                .withIndex("by_topicId", (q) => q.eq("topicId", args.topicId))
                .collect();
            const readiness = computeTopicExamReadinessFromQuestions(topic, [], {
                mcqTargetCount: topic.mcqTargetCount,
                trueFalseTargetCount: topic.trueFalseTargetCount,
                fillInTargetCount: topic.fillInTargetCount,
                totalObjectiveTargetCount: topic.totalObjectiveTargetCount,
                essayTargetCount: topic.essayTargetCount,
                subClaims,
            });
            await ctx.db.patch(args.topicId, buildTopicReadinessPatch(readiness, {
                examReadyUpdatedAt: Date.now(),
            }));
        }

        return { deleted: questions.length };
    },
});

export const deleteMcqQuestionsByTopicInternal = internalMutation({
    args: { topicId: v.id("topics") },
    handler: async (ctx, args) => {
        const topic = await ctx.db.get(args.topicId);
        if (!topic) {
            return {
                deleted: 0,
                remainingEssayCount: 0,
                examReady: false,
            };
        }
        const questions = await ctx.db
            .query("questions")
            .withIndex("by_topicId", (q) => q.eq("topicId", args.topicId))
            .collect();

        let deleted = 0;
        const remainingQuestions = [];
        for (const question of questions) {
            if (String(question?.questionType || "") === "essay") {
                remainingQuestions.push(question);
                continue;
            }
            await ctx.db.delete(question._id);
            deleted += 1;
        }

        const readiness = computeTopicExamReadinessFromQuestions(topic, remainingQuestions, {
            mcqTargetCount: topic.mcqTargetCount,
            trueFalseTargetCount: topic.trueFalseTargetCount,
            fillInTargetCount: topic.fillInTargetCount,
            totalObjectiveTargetCount: topic.totalObjectiveTargetCount,
            essayTargetCount: topic.essayTargetCount,
            subClaims: await ctx.db
                .query("topicSubClaims")
                .withIndex("by_topicId", (q) => q.eq("topicId", args.topicId))
                .collect(),
        });
        await ctx.db.patch(args.topicId, buildTopicReadinessPatch(readiness, {
            examReadyUpdatedAt: Date.now(),
        }));

        return {
            deleted,
            remainingEssayCount: readiness.usableEssayCount,
            examReady: readiness.examReady,
        };
    },
});


// Batch create questions (for AI-generated content)
export const batchCreateQuestionsInternal = internalMutation({
    args: {
        topicId: v.id("topics"),
        questions: v.array(
            v.object({
                questionText: v.string(),
                questionType: v.string(),
                options: v.optional(v.any()),
                correctAnswer: v.string(),
                explanation: v.optional(v.string()),
                citations: v.optional(v.array(v.any())),
                sourcePassageIds: v.optional(v.array(v.string())),
                groundingScore: v.optional(v.number()),
                factualityStatus: v.optional(v.string()),
                generationVersion: v.optional(v.string()),
                learningObjective: v.optional(v.string()),
                bloomLevel: v.optional(v.string()),
                outcomeKey: v.optional(v.string()),
                tier: v.optional(v.number()),
                subClaimId: v.optional(v.id("topicSubClaims")),
                cognitiveOperation: v.optional(v.string()),
                sourceSubClaimIds: v.optional(v.array(v.id("topicSubClaims"))),
                essayPlanItemKey: v.optional(v.string()),
                groundingEvidence: v.optional(v.string()),
                authenticContext: v.optional(v.string()),
                templateParts: v.optional(v.array(v.string())),
                tokens: v.optional(v.array(v.string())),
                acceptedAnswers: v.optional(v.array(v.string())),
                fillBlankMode: v.optional(v.string()),
                rubricPoints: v.optional(v.array(v.string())),
                qualityTier: v.optional(v.string()),
                rigorScore: v.optional(v.number()),
                clarityScore: v.optional(v.number()),
                diversityCluster: v.optional(v.string()),
                distractorScore: v.optional(v.number()),
                qualityFlags: v.optional(v.array(v.string())),
            })
        ),
    },
    handler: async (ctx, args) => {
        const topic = await ctx.db.get(args.topicId);
        if (!topic) {
            throw new Error("Topic not found");
        }
        const questionIds = [];
        const existingQuestions = await ctx.db
            .query("questions")
            .withIndex("by_topicId", (q) => q.eq("topicId", args.topicId))
            .collect();
        const acceptedMcqSignatures = existingQuestions
            .filter((question: any) => normalizeQuestionType(question?.questionType) === QUESTION_TYPE_MULTIPLE_CHOICE)
            .map((question: any) => buildMcqUniquenessSignature(question));
        for (const q of args.questions) {
            if (String(q.generationVersion || "").trim() === ASSESSMENT_BLUEPRINT_VERSION) {
                const metadataIssues = getAssessmentQuestionMetadataIssues({
                    question: q,
                    questionType: q.questionType,
                });
                if (metadataIssues.length > 0) {
                    continue;
                }
            }
            const normalizedQuestionType = normalizeQuestionType(q.questionType);
            if (normalizedQuestionType === QUESTION_TYPE_MULTIPLE_CHOICE) {
                const candidateSignature = buildMcqUniquenessSignature(q);
                if (acceptedMcqSignatures.some((prior) => areMcqQuestionsNearDuplicate(candidateSignature, prior))) {
                    continue;
                }
                acceptedMcqSignatures.push(candidateSignature);
            } else if (normalizedQuestionType !== "essay") {
                const candidateSignature = buildQuestionPromptSignature(q.questionText);
                const duplicateExists = existingQuestions
                    .filter((question: any) => normalizeQuestionType(question?.questionType) === normalizedQuestionType)
                    .some((question: any) =>
                        areQuestionPromptsNearDuplicate(candidateSignature, buildQuestionPromptSignature(question?.questionText || ""))
                    );
                if (duplicateExists) {
                    continue;
                }
            }
            const id = await ctx.db.insert("questions", {
                topicId: args.topicId,
                questionSetVersion: Number(topic?.questionSetVersion || topic?.examReadyUpdatedAt || topic?._creationTime || 0) || undefined,
                ...q,
            });
            questionIds.push(id);
        }

        const topicQuestions = await ctx.db
            .query("questions")
            .withIndex("by_topicId", (q) => q.eq("topicId", args.topicId))
            .collect();
        const readiness = computeTopicExamReadinessFromQuestions(topic, topicQuestions, {
            mcqTargetCount: topic.mcqTargetCount,
            trueFalseTargetCount: topic.trueFalseTargetCount,
            fillInTargetCount: topic.fillInTargetCount,
            totalObjectiveTargetCount: topic.totalObjectiveTargetCount,
            essayTargetCount: topic.essayTargetCount,
            subClaims: await ctx.db
                .query("topicSubClaims")
                .withIndex("by_topicId", (q) => q.eq("topicId", args.topicId))
                .collect(),
        });
        await ctx.db.patch(args.topicId, buildTopicReadinessPatch(readiness, {
            examReadyUpdatedAt: Date.now(),
        }));

        return questionIds;
    },
});

// ─── User Topic Progress ────────────────────────────────────────────

export const upsertTopicProgress = mutation({
    args: {
        topicId: v.string(),
        lastStudiedAt: v.optional(v.number()),
        completedAt: v.optional(v.number()),
        bestScore: v.optional(v.number()),
        attemptCount: v.optional(v.number()),
        termsStarred: v.optional(v.array(v.string())),
        studyMode: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        const authUserId = resolveAuthUserId(identity);
        if (!authUserId) throw new Error("Unauthenticated");

        const topicId = resolveTopicIdFromRoute(ctx, args.topicId);
        if (!topicId) throw new Error("Invalid topicId");

        const topic = await ctx.db.get(topicId);
        if (!topic) throw new Error("Topic not found");

        const existing = await ctx.db
            .query("userTopicProgress")
            .withIndex("by_userId_topicId", (q) =>
                q.eq("userId", authUserId).eq("topicId", topicId)
            )
            .first();

        const now = Date.now();
        const patch: Record<string, any> = {
            lastStudiedAt: args.lastStudiedAt ?? now,
        };
        if (args.completedAt !== undefined) patch.completedAt = args.completedAt;
        if (args.bestScore !== undefined) patch.bestScore = args.bestScore;
        if (args.attemptCount !== undefined) patch.attemptCount = args.attemptCount;
        if (args.termsStarred !== undefined) patch.termsStarred = args.termsStarred;
        if (args.studyMode !== undefined) patch.studyMode = args.studyMode;

        if (existing) {
            // Only update bestScore if the new score is higher
            if (
                args.bestScore !== undefined &&
                existing.bestScore !== undefined &&
                args.bestScore <= existing.bestScore
            ) {
                delete patch.bestScore;
            }
            await ctx.db.patch(existing._id, patch);
            return existing._id;
        }

        return await ctx.db.insert("userTopicProgress", {
            userId: authUserId,
            topicId,
            courseId: topic.courseId,
            ...patch,
        });
    },
});

export const getUserTopicProgress = query({
    args: { topicId: v.string() },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        const authUserId = resolveAuthUserId(identity);
        if (!authUserId) return null;

        const topicId = resolveTopicIdFromRoute(ctx, args.topicId);
        if (!topicId) return null;

        return await ctx.db
            .query("userTopicProgress")
            .withIndex("by_userId_topicId", (q) =>
                q.eq("userId", authUserId).eq("topicId", topicId)
            )
            .first();
    },
});

export const getUserCourseProgress = query({
    args: { courseId: v.id("courses") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        const authUserId = resolveAuthUserId(identity);
        if (!authUserId) return {};

        const rows = await ctx.db
            .query("userTopicProgress")
            .withIndex("by_userId_courseId", (q) =>
                q.eq("userId", authUserId).eq("courseId", args.courseId)
            )
            .collect();

        const result: Record<string, typeof rows[number]> = {};
        for (const row of rows) {
            result[row.topicId] = row;
        }
        return result;
    },
});

export const getResumeTarget = query({
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        const authUserId = resolveAuthUserId(identity);
        if (!authUserId) return null;

        const row = await ctx.db
            .query("userTopicProgress")
            .withIndex("by_userId_lastStudied", (q) =>
                q.eq("userId", authUserId)
            )
            .order("desc")
            .first();

        if (!row) return null;

        const topic = await ctx.db.get(row.topicId);
        if (!topic) return null;

        return {
            topicId: row.topicId,
            topicTitle: topic.title,
            courseId: row.courseId,
            lastStudiedAt: row.lastStudiedAt,
            bestScore: row.bestScore,
            completedAt: row.completedAt,
        };
    },
});

export const getTopicSourcePassages = query({
    args: { topicId: v.string() },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        const authUserId = resolveAuthUserId(identity);
        if (!authUserId) return [];

        const topicId = resolveTopicIdFromRoute(ctx, args.topicId);
        if (!topicId) return [];

        const topic = await ctx.db.get(topicId);
        if (!topic || !topic.sourceUploadId) return [];

        const passageIds = topic.sourcePassageIds ?? [];
        if (passageIds.length === 0) return [];

        const passages = await Promise.all(
            passageIds.slice(0, 12).map(async (pid: string) => {
                const passage = await ctx.db
                    .query("evidencePassages")
                    .withIndex("by_uploadId_passageId", (q) =>
                        q.eq("uploadId", topic.sourceUploadId!).eq("passageId", pid)
                    )
                    .first();
                return passage;
            })
        );

        return passages
            .filter(Boolean)
            .map((p: any) => ({
                passageId: p.passageId,
                page: p.page,
                sectionHint: p.sectionHint,
                text: p.text?.slice(0, 400) ?? '',
            }));
    },
});
