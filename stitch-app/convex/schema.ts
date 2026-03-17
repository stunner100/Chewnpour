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
        processingStep: v.optional(v.string()), // 'uploading', 'extracting', 'analyzing', 'generating_topics', 'generating_first_topic', 'first_topic_ready', 'generating_remaining_topics', 'generating_question_bank', 'ready'
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
        title: v.string(),
        description: v.optional(v.string()),
        content: v.optional(v.string()), // AI-generated summary content
        sourceChunkIds: v.optional(v.array(v.number())),
        sourcePassageIds: v.optional(v.array(v.string())),
        groundingVersion: v.optional(v.string()),
        illustrationStorageId: v.optional(v.id("_storage")),
        illustrationUrl: v.optional(v.string()),
        examReady: v.optional(v.boolean()),
        mcqTargetCount: v.optional(v.number()),
        essayTargetCount: v.optional(v.number()),
        usableMcqCount: v.optional(v.number()),
        usableEssayCount: v.optional(v.number()),
        examReadyUpdatedAt: v.optional(v.number()),
        mcqGenerationLockedUntil: v.optional(v.number()),
        essayGenerationLockedUntil: v.optional(v.number()),
        orderIndex: v.number(),
        isLocked: v.boolean(),
    }).index("by_courseId", ["courseId"]),

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
        questionType: v.string(), // 'mcq', 'concept_build', 'theory'
        options: v.optional(v.any()), // for MCQ
        correctAnswer: v.string(),
        explanation: v.optional(v.string()),
        difficulty: v.optional(v.string()), // 'easy', 'medium', 'hard'
        citations: v.optional(v.array(v.any())),
        sourcePassageIds: v.optional(v.array(v.string())),
        groundingScore: v.optional(v.number()), // 0-1
        factualityStatus: v.optional(v.string()), // 'verified' | 'rejected'
        generationVersion: v.optional(v.string()),
        learningObjective: v.optional(v.string()),
        rubricPoints: v.optional(v.array(v.string())),
        qualityFlags: v.optional(v.array(v.string())),
    }).index("by_topicId", ["topicId"]),

    conceptExercises: defineTable({
        topicId: v.id("topics"),
        questionText: v.string(),
        template: v.array(v.string()),
        answers: v.array(v.string()),
        tokens: v.array(v.string()),
        citations: v.optional(v.array(v.any())),
        groundingScore: v.optional(v.number()),
        version: v.optional(v.string()),
        createdAt: v.number(),
    }).index("by_topicId", ["topicId"]),

    // User exam attempts
    examAttempts: defineTable({
        userId: v.string(),
        topicId: v.id("topics"),
        examFormat: v.optional(v.string()), // 'mcq' | 'essay'
        score: v.number(),
        totalQuestions: v.number(),
        timeTakenSeconds: v.number(),
        questionIds: v.optional(v.array(v.id("questions"))),
        answers: v.optional(v.any()), // user's answers (JSON)
        tutorFeedback: v.optional(v.string()), // AI-generated personal tutor analysis
        essayWeightedPercentage: v.optional(v.number()), // weighted essay quality % (0-100)
        startedAt: v.optional(v.number()), // timestamp when attempt was created
        claimedAt: v.optional(v.number()), // timestamp when reused attempt was claimed by a session
    }).index("by_userId", ["userId"]).index("by_topicId", ["topicId"]).index("by_userId_topicId", ["userId", "topicId"]),

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
    })
        .index("by_reference", ["reference"])
        .index("by_userId", ["userId"])
        .index("by_userId_createdAt", ["userId", "createdAt"]),
});
