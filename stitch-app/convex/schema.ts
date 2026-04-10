import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    // User profiles (extends auth users)
    profiles: defineTable({
        userId: v.string(), // Better Auth user ID
        fullName: v.optional(v.string()),
        educationLevel: v.optional(v.string()), // 'high_school', 'undergrad', 'postgrad', 'professional'
        department: v.optional(v.string()),
        avatarUrl: v.optional(v.string()),
        avatarGradient: v.optional(v.number()),
        voiceModeEnabled: v.optional(v.boolean()),
        onboardingCompleted: v.optional(v.boolean()),
        streakDays: v.optional(v.number()),
        totalStudyHours: v.optional(v.number()),
        // Email notification preferences (all default to true / opted-in)
        emailPreferences: v.optional(v.object({
            streakReminders: v.boolean(),
            streakBroken: v.boolean(),
            weeklySummary: v.boolean(),
            productResearch: v.boolean(),
            winbackOffers: v.boolean(),
        })),
        // Token for one-click email unsubscribe
        emailUnsubscribeToken: v.optional(v.string()),
        // Token used by product research email links
        productResearchToken: v.optional(v.string()),
        // Referral program
        referralCode: v.optional(v.string()), // unique 6-char alphanumeric code
        referredBy: v.optional(v.string()), // referral code of the user who referred this user
        referralCreditApplied: v.optional(v.boolean()), // true once first-upload referral credit was granted
    }).index("by_userId", ["userId"])
      .index("by_referralCode", ["referralCode"]),

    // Tracks sent emails to avoid duplicate sends within a window
    emailLog: defineTable({
        userId: v.string(),
        emailType: v.string(), // 'streak_at_risk' | 'streak_broken' | 'weekly_summary' | 'product_research'
        sentAt: v.number(),
    }).index("by_userId_emailType", ["userId", "emailType"]),

    // Uploaded study materials
    uploads: defineTable({
        userId: v.string(),
        fileName: v.string(),
        fileUrl: v.string(),
        fileType: v.optional(v.string()), // 'pdf', 'pptx', 'docx'
        fileSize: v.optional(v.number()),
        status: v.string(), // 'processing', 'ready', 'error'
        storageId: v.optional(v.id("_storage")),
        // Processing progress tracking
        processingStep: v.optional(v.string()), // 'uploading', 'extracting', 'analyzing', 'generating_topics', 'generating_first_topic', 'first_topic_ready', 'generating_remaining_topics', 'ready'
        processingProgress: v.optional(v.number()), // 0-100
        plannedTopicCount: v.optional(v.number()),
        generatedTopicCount: v.optional(v.number()),
        plannedTopicTitles: v.optional(v.array(v.string())),
        extractionWarnings: v.optional(v.array(v.string())),
        extractionStatus: v.optional(v.string()), // 'pending' | 'running' | 'provisional' | 'complete' | 'failed'
        extractionQualityScore: v.optional(v.number()), // 0-1
        extractionCoverage: v.optional(v.number()), // 0-1
        extractionVersion: v.optional(v.string()),
        provisionalExtraction: v.optional(v.boolean()),
        extractionBackend: v.optional(v.string()),
        extractionParser: v.optional(v.string()),
        extractionFallbackUsed: v.optional(v.boolean()),
        extractionReplacementReason: v.optional(v.string()),
        extractionArtifactStorageId: v.optional(v.id("_storage")),
        evidenceIndexStorageId: v.optional(v.id("_storage")),
        evidenceIndexVersion: v.optional(v.string()),
        evidencePassageCount: v.optional(v.number()),
        embeddingsStatus: v.optional(v.string()), // 'pending' | 'running' | 'ready' | 'failed'
        embeddingsVersion: v.optional(v.string()),
        embeddedPassageCount: v.optional(v.number()),
    }).index("by_userId", ["userId"]),

    documentExtractions: defineTable({
        uploadId: v.id("uploads"),
        version: v.string(),
        status: v.string(), // 'running' | 'provisional' | 'complete' | 'failed'
        qualityScore: v.number(), // 0-1
        coverage: v.number(), // 0-1
        providerTrace: v.array(v.object({
            pass: v.string(),
            status: v.string(),
            latencyMs: v.number(),
            chars: v.number(),
            pageCount: v.number(),
            error: v.optional(v.string()),
        })),
        backend: v.optional(v.string()),
        parser: v.optional(v.string()),
        winner: v.optional(v.boolean()),
        baselineBackend: v.optional(v.string()),
        baselineQualityScore: v.optional(v.number()),
        baselineCoverage: v.optional(v.number()),
        comparisonReason: v.optional(v.string()),
        artifactStorageId: v.optional(v.id("_storage")),
        startedAt: v.number(),
        finishedAt: v.number(),
        errorSummary: v.optional(v.string()),
    })
        .index("by_uploadId", ["uploadId"])
        .index("by_uploadId_startedAt", ["uploadId", "startedAt"]),

    uploadEvidenceIndexes: defineTable({
        uploadId: v.id("uploads"),
        version: v.string(),
        storageId: v.id("_storage"),
        passageCount: v.number(),
        status: v.string(), // 'ready' | 'failed'
        createdAt: v.number(),
        errorSummary: v.optional(v.string()),
    })
        .index("by_uploadId", ["uploadId"])
        .index("by_uploadId_createdAt", ["uploadId", "createdAt"]),

    evidencePassages: defineTable({
        userId: v.string(),
        uploadId: v.id("uploads"),
        courseId: v.id("courses"),
        topicId: v.optional(v.id("topics")),
        passageId: v.string(),
        page: v.number(),
        startChar: v.number(),
        endChar: v.number(),
        sectionHint: v.string(),
        flags: v.array(v.string()),
        text: v.string(),
        embedding: v.optional(v.array(v.float64())),
        embeddingModel: v.optional(v.string()),
        createdAt: v.number(),
    })
        .index("by_uploadId", ["uploadId"])
        .index("by_courseId", ["courseId"])
        .index("by_uploadId_passageId", ["uploadId", "passageId"])
        .vectorIndex("by_embedding", {
            vectorField: "embedding",
            dimensions: 1536,
            filterFields: ["userId", "uploadId", "courseId"],
        }),

    questionTargetAuditRuns: defineTable({
        dryRun: v.boolean(),
        startedAt: v.number(),
        finishedAt: v.number(),
        staleHours: v.number(),
        maxTopicsPerFormat: v.number(),
        mcqSummary: v.object({
            scannedTopicCount: v.number(),
            candidateTopicCount: v.number(),
            rebasedTopicCount: v.number(),
            scheduledTopicCount: v.number(),
            totalTargetReduction: v.number(),
        }),
        essaySummary: v.object({
            scannedTopicCount: v.number(),
            candidateTopicCount: v.number(),
            rebasedTopicCount: v.number(),
            scheduledTopicCount: v.number(),
            totalTargetReduction: v.number(),
        }),
        rebasedTopics: v.array(v.object({
            format: v.string(), // 'mcq' | 'essay'
            topicId: v.id("topics"),
            topicTitle: v.string(),
            currentTarget: v.number(),
            recalculatedTarget: v.number(),
            usableMcqCount: v.number(),
            usableEssayCount: v.number(),
            fillRatio: v.number(),
            scheduled: v.boolean(),
            wordCountTarget: v.optional(v.number()),
            evidenceRichnessCap: v.optional(v.number()),
            evidenceCapBroadTopicPenaltyApplied: v.optional(v.boolean()),
            retrievedEvidencePassageCount: v.optional(v.number()),
        })),
    }).index("by_finishedAt", ["finishedAt"]),

    // Assignment helper threads
    assignmentThreads: defineTable({
        userId: v.string(),
        title: v.string(),
        status: v.string(), // 'processing', 'ready', 'error'
        fileName: v.string(),
        fileType: v.string(), // 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/*'
        fileSize: v.number(),
        storageId: v.id("_storage"),
        fileUrl: v.optional(v.string()),
        extractedText: v.optional(v.string()),
        errorMessage: v.optional(v.string()),
        updatedAt: v.number(),
    }).index("by_userId", ["userId"]).index("by_userId_updatedAt", ["userId", "updatedAt"]),

    // Assignment helper messages
    assignmentMessages: defineTable({
        threadId: v.id("assignmentThreads"),
        userId: v.string(),
        role: v.string(), // 'user', 'assistant'
        content: v.string(),
        createdAt: v.number(),
    }).index("by_threadId", ["threadId"]).index("by_threadId_createdAt", ["threadId", "createdAt"]),

    // Join table: many uploads can belong to one course
    courseUploads: defineTable({
        courseId: v.id("courses"),
        uploadId: v.id("uploads"),
        addedAt: v.number(),
        status: v.string(), // 'processing' | 'ready' | 'error'
        topicCount: v.optional(v.number()),
    })
        .index("by_courseId", ["courseId"])
        .index("by_uploadId", ["uploadId"])
        .index("by_courseId_uploadId", ["courseId", "uploadId"]),

    // AI-generated courses from uploads
    courses: defineTable({
        uploadId: v.optional(v.id("uploads")),
        userId: v.string(),
        title: v.string(),
        description: v.optional(v.string()),
        coverColor: v.optional(v.string()), // gradient colors
        progress: v.optional(v.number()),
        status: v.string(), // 'in_progress', 'completed'
    }).index("by_userId", ["userId"])
      .index("by_uploadId", ["uploadId"]),

    // Topics within courses
    topics: defineTable({
        courseId: v.id("courses"),
        sourceUploadId: v.optional(v.id("uploads")), // which upload generated this topic
        title: v.string(),
        description: v.optional(v.string()),
        content: v.optional(v.string()), // AI-generated summary content
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
        questionSetVersion: v.optional(v.number()),
        examReady: v.optional(v.boolean()),
        objectiveTargetCount: v.optional(v.number()),
        mcqTargetCount: v.optional(v.number()),
        trueFalseTargetCount: v.optional(v.number()),
        fillInTargetCount: v.optional(v.number()),
        totalObjectiveTargetCount: v.optional(v.number()),
        essayTargetCount: v.optional(v.number()),
        objectiveReady: v.optional(v.boolean()),
        essayReady: v.optional(v.boolean()),
        usableObjectiveCount: v.optional(v.number()),
        usableObjectiveBreakdown: v.optional(v.object({
            multiple_choice: v.number(),
            true_false: v.number(),
            fill_blank: v.number(),
        })),
        usableMcqCount: v.optional(v.number()),
        usableTrueFalseCount: v.optional(v.number()),
        usableFillInCount: v.optional(v.number()),
        usableEssayCount: v.optional(v.number()),
        tier1Count: v.optional(v.number()),
        tier2Count: v.optional(v.number()),
        tier3Count: v.optional(v.number()),
        difficultyDistribution: v.optional(v.object({
            easy: v.number(),
            medium: v.number(),
            hard: v.number(),
        })),
        bloomCoverage: v.optional(v.array(v.string())),
        readinessScore: v.optional(v.number()),
        claimCoverage: v.optional(v.number()),
        canImprove: v.optional(v.boolean()),
        improvementActions: v.optional(v.array(v.string())),
        yieldConfidence: v.optional(v.string()),
        yieldReasoning: v.optional(v.string()),
        examIneligibleReason: v.optional(v.string()),
        diagnosticReport: v.optional(v.any()),
        examReadyUpdatedAt: v.optional(v.number()),
        objectiveGenerationLockedUntil: v.optional(v.number()),
        mcqGenerationLockedUntil: v.optional(v.number()),
        essayGenerationLockedUntil: v.optional(v.number()),
        assessmentBlueprint: v.optional(v.any()),
        orderIndex: v.number(),
        isLocked: v.boolean(),
    }).index("by_courseId", ["courseId"]),

    topicSubClaims: defineTable({
        topicId: v.id("topics"),
        uploadId: v.optional(v.id("uploads")),
        claimText: v.string(),
        sourcePassageIds: v.array(v.string()),
        sourceQuotes: v.array(v.string()),
        claimType: v.string(),
        cognitiveOperations: v.array(v.string()),
        bloomLevel: v.string(),
        difficultyEstimate: v.string(),
        questionYieldEstimate: v.number(),
        status: v.string(),
        createdAt: v.number(),
    })
        .index("by_topicId", ["topicId"])
        .index("by_topicId_status", ["topicId", "status"])
        .index("by_uploadId", ["uploadId"]),

    distractorBank: defineTable({
        topicId: v.id("topics"),
        subClaimId: v.id("topicSubClaims"),
        distractorText: v.string(),
        distractorType: v.string(),
        sourceClaimText: v.string(),
        whyPlausible: v.string(),
        whyWrong: v.string(),
        difficulty: v.string(),
        usedInQuestionIds: v.array(v.id("questions")),
        status: v.string(),
    })
        .index("by_topicId", ["topicId"])
        .index("by_subClaimId", ["subClaimId"]),

    // Lessons within topics
    lessons: defineTable({
        topicId: v.id("topics"),
        title: v.string(),
        content: v.optional(v.any()), // AI-generated content (JSON)
        durationMinutes: v.optional(v.number()),
        orderIndex: v.number(),
    }).index("by_topicId", ["topicId"]),

    // Exam questions
    questions: defineTable({
        topicId: v.id("topics"),
        questionText: v.string(),
        questionType: v.string(), // 'multiple_choice' | 'true_false' | 'fill_blank' | 'essay'
        options: v.optional(v.any()), // for multiple_choice / true_false
        correctAnswer: v.string(),
        explanation: v.optional(v.string()),
        difficulty: v.optional(v.string()), // 'easy', 'medium', 'hard'
        citations: v.optional(v.array(v.any())),
        sourcePassageIds: v.optional(v.array(v.string())),
        groundingScore: v.optional(v.number()), // 0-1
        factualityStatus: v.optional(v.string()), // 'verified' | 'rejected'
        generationVersion: v.optional(v.string()),
        generationRunId: v.optional(v.string()),
        questionSetVersion: v.optional(v.number()),
        tier: v.optional(v.number()),
        subClaimId: v.optional(v.id("topicSubClaims")),
        cognitiveOperation: v.optional(v.string()),
        sourceSubClaimIds: v.optional(v.array(v.id("topicSubClaims"))),
        essayPlanItemKey: v.optional(v.string()),
        learningObjective: v.optional(v.string()),
        bloomLevel: v.optional(v.string()),
        outcomeKey: v.optional(v.string()),
        authenticContext: v.optional(v.string()),
        templateParts: v.optional(v.array(v.string())),
        tokens: v.optional(v.array(v.string())),
        acceptedAnswers: v.optional(v.array(v.string())),
        fillBlankMode: v.optional(v.string()),
        rubricPoints: v.optional(v.array(v.string())),
        qualityScore: v.optional(v.number()),
        qualityTier: v.optional(v.string()),
        rigorScore: v.optional(v.number()),
        clarityScore: v.optional(v.number()),
        groundingEvidence: v.optional(v.string()),
        diversityCluster: v.optional(v.string()),
        distractorScore: v.optional(v.number()),
        freshnessBucket: v.optional(v.string()),
        qualityFlags: v.optional(v.array(v.string())),
    }).index("by_topicId", ["topicId"]),

    conceptExercises: defineTable({
        topicId: v.id("topics"),
        exerciseType: v.optional(v.string()),
        conceptKey: v.optional(v.string()),
        difficulty: v.optional(v.string()),
        questionText: v.string(),
        explanation: v.optional(v.string()),
        template: v.optional(v.array(v.string())),
        answers: v.optional(v.array(v.string())),
        tokens: v.optional(v.array(v.string())),
        options: v.optional(v.array(v.object({
            id: v.string(),
            text: v.string(),
        }))),
        correctOptionId: v.optional(v.string()),
        citations: v.optional(v.array(v.any())),
        sourcePassageIds: v.optional(v.array(v.string())),
        groundingScore: v.optional(v.number()),
        qualityScore: v.optional(v.number()),
        active: v.optional(v.boolean()),
        version: v.optional(v.string()),
        createdAt: v.number(),
    }).index("by_topicId", ["topicId"]),

    // User exam attempts
    examAttempts: defineTable({
        userId: v.string(),
        topicId: v.id("topics"),
        examFormat: v.optional(v.string()), // 'objective' | 'essay'
        score: v.number(),
        totalQuestions: v.number(),
        timeTakenSeconds: v.number(),
        questionIds: v.optional(v.array(v.id("questions"))),
        answers: v.optional(v.any()), // user's answers (JSON)
        tutorFeedback: v.optional(v.string()), // AI-generated personal tutor analysis
        essayWeightedPercentage: v.optional(v.number()), // weighted essay quality % (0-100)
        startedAt: v.optional(v.number()), // timestamp when attempt was created
        claimedAt: v.optional(v.number()), // timestamp when reused attempt was claimed by a session
        questionSetVersion: v.optional(v.number()),
        assessmentVersion: v.optional(v.string()),
        qualityTier: v.optional(v.string()),
        premiumTargetMet: v.optional(v.boolean()),
        qualityWarnings: v.optional(v.array(v.string())),
        qualitySignals: v.optional(v.any()),
    }).index("by_userId", ["userId"]).index("by_topicId", ["topicId"]).index("by_userId_topicId", ["userId", "topicId"]),

    examPreparations: defineTable({
        userId: v.string(),
        topicId: v.id("topics"),
        examFormat: v.string(), // 'mcq' | 'essay'
        assessmentVersion: v.optional(v.string()),
        questionSetVersion: v.optional(v.number()),
        status: v.string(), // 'queued' | 'preparing' | 'ready' | 'unavailable' | 'failed'
        stage: v.string(),
        attemptTargetCount: v.number(),
        bankTargetCount: v.number(),
        usableCount: v.number(),
        generatedCount: v.number(),
        reasonCode: v.optional(v.string()),
        errorSummary: v.optional(v.string()),
        message: v.optional(v.string()),
        attemptId: v.optional(v.id("examAttempts")),
        qualityTier: v.optional(v.string()),
        premiumTargetMet: v.optional(v.boolean()),
        qualityWarnings: v.optional(v.array(v.string())),
        qualitySignals: v.optional(v.any()),
        startedAt: v.number(),
        finishedAt: v.optional(v.number()),
    })
        .index("by_userId_topicId", ["userId", "topicId"])
        .index("by_topicId", ["topicId"])
        .index("by_userId_topicId_examFormat", ["userId", "topicId", "examFormat"])
        .index("by_status", ["status"]),

    // Concept practice attempts
    conceptAttempts: defineTable({
        userId: v.string(),
        topicId: v.id("topics"),
        score: v.number(),
        totalQuestions: v.number(),
        timeTakenSeconds: v.optional(v.number()),
        answers: v.optional(v.any()), // user's answers (JSON)
        questionText: v.optional(v.string()),
    }).index("by_userId", ["userId"]).index("by_topicId", ["topicId"]).index("by_userId_topicId", ["userId", "topicId"]),

    conceptMastery: defineTable({
        userId: v.string(),
        topicId: v.id("topics"),
        conceptKey: v.string(),
        conceptLabel: v.optional(v.string()),
        strength: v.number(),
        status: v.string(), // 'weak' | 'shaky' | 'strong'
        correctStreak: v.number(),
        attemptsCount: v.number(),
        correctCount: v.number(),
        questionCount: v.number(),
        lastAccuracy: v.number(),
        lastExerciseType: v.optional(v.string()),
        lastQuestionText: v.optional(v.string()),
        lastPracticedAt: v.number(),
        nextReviewAt: v.number(),
        updatedAt: v.number(),
    })
        .index("by_userId_topicId", ["userId", "topicId"])
        .index("by_userId_nextReviewAt", ["userId", "nextReviewAt"])
        .index("by_userId_topicId_conceptKey", ["userId", "topicId", "conceptKey"]),

     // Per-user topic progress tracking
     userTopicProgress: defineTable({
         userId: v.string(),
         topicId: v.id("topics"),
         courseId: v.id("courses"),
        completedAt: v.optional(v.number()),
        lastStudiedAt: v.number(),
        bestScore: v.optional(v.number()),       // 0–100
        attemptCount: v.optional(v.number()),
        termsStarred: v.optional(v.array(v.string())),
        studyMode: v.optional(v.string()),
     })
     .index("by_userId_topicId", ["userId", "topicId"])
     .index("by_userId_courseId", ["userId", "courseId"])
     .index("by_userId_lastStudied", ["userId", "lastStudiedAt"]),

    userTutorProfiles: defineTable({
        userId: v.string(),
        preferredPersona: v.string(),
        updatedAt: v.number(),
    }).index("by_userId", ["userId"]),

    userTutorMemory: defineTable({
        userId: v.string(),
        topicId: v.id("topics"),
        courseId: v.id("courses"),
        memorySummary: v.string(),
        strengths: v.optional(v.array(v.string())),
        weakAreas: v.optional(v.array(v.string())),
        lastQuestion: v.optional(v.string()),
        lastAnswer: v.optional(v.string()),
        lastScore: v.optional(v.number()),
        completedAt: v.optional(v.number()),
        lastStudiedAt: v.optional(v.number()),
        updatedAt: v.number(),
    })
        .index("by_userId_topicId", ["userId", "topicId"])
        .index("by_userId_updatedAt", ["userId", "updatedAt"]),

    // Subscription info
    subscriptions: defineTable({
        userId: v.string(),
        plan: v.string(), // 'free', 'premium'
        amount: v.optional(v.number()),
        currency: v.optional(v.string()),
        status: v.string(), // 'active', 'cancelled'
        nextBillingDate: v.optional(v.string()),
        purchasedUploadCredits: v.optional(v.number()),
        consumedUploadCredits: v.optional(v.number()),
        consumedVoiceGenerations: v.optional(v.number()),
        consumedReExplanations: v.optional(v.number()),
        lastPaymentReference: v.optional(v.string()),
        lastPaymentAt: v.optional(v.number()),
        planExpiresAt: v.optional(v.number()), // Timestamp (ms) when semester pass expires
        lastTopUpPlanId: v.optional(v.string()), // ID of the last purchased top-up plan
    }).index("by_userId", ["userId"]),

    humanizerUsage: defineTable({
        userId: v.string(),
        date: v.string(),
        count: v.number(),
    }).index("by_userId_date", ["userId", "date"]),

    aiMessageUsage: defineTable({
        userId: v.string(),
        date: v.string(),
        count: v.number(),
    }).index("by_userId_date", ["userId", "date"]),

    llmUsageDaily: defineTable({
        userId: v.string(),
        date: v.string(),
        requestCount: v.number(),
        promptTokens: v.number(),
        completionTokens: v.number(),
        totalTokens: v.number(),
        updatedAt: v.number(),
    })
        .index("by_userId_date", ["userId", "date"])
        .index("by_date", ["date"]),

    userPresence: defineTable({
        userId: v.string(),
        lastSeenAt: v.number(),
    })
        .index("by_userId", ["userId"])
        .index("by_lastSeenAt", ["lastSeenAt"]),

    topicNotes: defineTable({
        userId: v.string(),
        topicId: v.id("topics"),
        content: v.string(),
        updatedAt: v.number(),
    }).index("by_userId_topicId", ["userId", "topicId"])
      .index("by_topicId", ["topicId"]),

    searchDocuments: defineTable({
        userId: v.string(),
        kind: v.string(), // 'course' | 'topic' | 'note'
        entityId: v.string(),
        courseId: v.optional(v.id("courses")),
        topicId: v.optional(v.id("topics")),
        title: v.string(),
        body: v.string(),
        updatedAt: v.number(),
    })
        .index("by_userId_kind_entityId", ["userId", "kind", "entityId"])
        .searchIndex("search_body", {
            searchField: "body",
            filterFields: ["userId", "kind"],
        }),

    // AI tutor chat messages per topic
    topicChatMessages: defineTable({
        userId: v.string(),
        topicId: v.id("topics"),
        role: v.string(), // 'user' | 'assistant'
        content: v.string(),
        createdAt: v.number(),
    }).index("by_userId_topicId", ["userId", "topicId"]),

    // User feedback submissions
    feedback: defineTable({
        userId: v.string(),
        rating: v.number(), // 1-5 stars
        message: v.optional(v.string()),
        createdAt: v.number(),
    }).index("by_userId", ["userId"]),

    // Product research responses submitted from tokenized email links.
    productResearchResponses: defineTable({
        userId: v.string(),
        email: v.optional(v.string()),
        campaign: v.string(),
        cohort: v.optional(v.string()),
        howUsingApp: v.string(),
        wantedFeatures: v.string(),
        additionalNotes: v.optional(v.string()),
        source: v.optional(v.string()),
        createdAt: v.number(),
    })
        .index("by_userId", ["userId"])
        .index("by_createdAt", ["createdAt"])
        .index("by_campaign_createdAt", ["campaign", "createdAt"]),

    // One-off or scheduled promotional credit grants used by retention campaigns.
    campaignCreditGrants: defineTable({
        campaignId: v.string(),
        userId: v.string(),
        email: v.optional(v.string()),
        creditType: v.string(), // 'upload_credits'
        grantedCredits: v.number(),
        grantedAt: v.number(),
        lastActivityAt: v.number(),
        daysInactive: v.number(),
        emailType: v.optional(v.string()),
        emailSentAt: v.optional(v.number()),
        source: v.optional(v.string()),
    })
        .index("by_userId_campaignId", ["userId", "campaignId"])
        .index("by_campaignId_grantedAt", ["campaignId", "grantedAt"]),

    // Records attributed campaign landings after users click a campaign CTA.
    campaignLandingEvents: defineTable({
        campaignId: v.string(),
        userId: v.string(),
        source: v.optional(v.string()),
        medium: v.optional(v.string()),
        content: v.optional(v.string()),
        landingPath: v.optional(v.string()),
        landingSearch: v.optional(v.string()),
        firstLandedAt: v.number(),
        lastLandedAt: v.number(),
        landingCount: v.number(),
    })
        .index("by_userId_campaignId", ["userId", "campaignId"])
        .index("by_campaignId_firstLandedAt", ["campaignId", "firstLandedAt"]),

    appSettings: defineTable({
        key: v.string(),
        value: v.string(),
        updatedAt: v.number(),
        updatedByUserId: v.optional(v.string()),
    })
        .index("by_key", ["key"]),

    adminAccess: defineTable({
        email: v.string(),
        addedByUserId: v.string(),
        createdAt: v.number(),
    }).index("by_email", ["email"]),

    paymentTransactions: defineTable({
        userId: v.string(),
        provider: v.string(),
        reference: v.string(),
        amountMinor: v.number(),
        currency: v.string(),
        status: v.string(), // 'initialized', 'success', 'failed'
        source: v.string(), // 'checkout_init', 'callback_verify', 'webhook'
        createdAt: v.number(),
        paidAt: v.optional(v.number()),
        customerEmail: v.optional(v.string()),
        eventType: v.optional(v.string()),
        lastVerifiedAt: v.optional(v.number()),
        verificationAttempts: v.optional(v.number()),
        verificationStatus: v.optional(v.string()),
        verificationMessage: v.optional(v.string()),
        alertedAt: v.optional(v.number()),
    })
        .index("by_reference", ["reference"])
        .index("by_userId", ["userId"])
        .index("by_userId_createdAt", ["userId", "createdAt"]),

    // ────────────────────────────────────────────────────────────────
    // Community discussion threads
    // ────────────────────────────────────────────────────────────────

    // One channel per course, auto-created
    communityChannels: defineTable({
        courseId: v.optional(v.id("courses")),
        createdBy: v.string(),
        title: v.string(),
        description: v.string(),
        icon: v.optional(v.string()),
        memberCount: v.number(),
        postCount: v.number(),
        lastActivityAt: v.number(),
        createdAt: v.number(),
        isSeeded: v.optional(v.boolean()),
    }).index("by_courseId", ["courseId"])
      .index("by_lastActivity", ["lastActivityAt"]),

    // Tracks who joined which channel
    communityMembers: defineTable({
        channelId: v.id("communityChannels"),
        userId: v.string(),
        joinedAt: v.number(),
        role: v.string(), // "member" | "creator"
    }).index("by_channelId", ["channelId"])
      .index("by_userId", ["userId"])
      .index("by_channelId_userId", ["channelId", "userId"]),

    // Threaded posts in channels
    communityPosts: defineTable({
        channelId: v.id("communityChannels"),
        userId: v.string(),
        parentPostId: v.optional(v.id("communityPosts")),
        content: v.string(),
        tag: v.optional(v.string()), // "question" | "resource" | "discussion"
        replyCount: v.number(),
        flagCount: v.number(),
        isHidden: v.boolean(),
        createdAt: v.number(),
    }).index("by_channelId", ["channelId"])
      .index("by_channelId_createdAt", ["channelId", "createdAt"])
      .index("by_parentPostId", ["parentPostId"]),

    // Report/flag system
    communityFlags: defineTable({
        postId: v.id("communityPosts"),
        userId: v.string(),
        reason: v.string(), // "spam" | "offensive" | "off_topic"
        createdAt: v.number(),
    }).index("by_postId", ["postId"])
      .index("by_userId_postId", ["userId", "postId"]),
});
