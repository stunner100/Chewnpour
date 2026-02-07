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
        onboardingCompleted: v.optional(v.boolean()),
        streakDays: v.optional(v.number()),
        totalStudyHours: v.optional(v.number()),
    }).index("by_userId", ["userId"]),

    // Uploaded study materials
    uploads: defineTable({
        userId: v.string(),
        fileName: v.string(),
        fileUrl: v.string(),
        fileType: v.optional(v.string()), // 'pdf', 'pptx'
        fileSize: v.optional(v.number()),
        status: v.string(), // 'processing', 'ready', 'error'
        storageId: v.optional(v.id("_storage")),
        // Processing progress tracking
        processingStep: v.optional(v.string()), // 'uploading', 'extracting', 'analyzing', 'generating_topics', 'generating_questions', 'ready'
        processingProgress: v.optional(v.number()), // 0-100
    }).index("by_userId", ["userId"]),

    // AI-generated courses from uploads
    courses: defineTable({
        uploadId: v.optional(v.id("uploads")),
        userId: v.string(),
        title: v.string(),
        description: v.optional(v.string()),
        coverColor: v.optional(v.string()), // gradient colors
        progress: v.optional(v.number()),
        status: v.string(), // 'in_progress', 'completed'
    }).index("by_userId", ["userId"]),

    // Topics within courses
    topics: defineTable({
        courseId: v.id("courses"),
        title: v.string(),
        description: v.optional(v.string()),
        content: v.optional(v.string()), // AI-generated summary content
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
    }).index("by_topicId", ["topicId"]),

    // User exam attempts
    examAttempts: defineTable({
        userId: v.string(),
        topicId: v.id("topics"),
        score: v.number(),
        totalQuestions: v.number(),
        timeTakenSeconds: v.number(),
        answers: v.optional(v.any()), // user's answers (JSON)
    }).index("by_userId", ["userId"]).index("by_topicId", ["topicId"]),

    // Concept practice attempts
    conceptAttempts: defineTable({
        userId: v.string(),
        topicId: v.id("topics"),
        score: v.number(),
        totalQuestions: v.number(),
        timeTakenSeconds: v.optional(v.number()),
        answers: v.optional(v.any()), // user's answers (JSON)
        questionText: v.optional(v.string()),
    }).index("by_userId", ["userId"]).index("by_topicId", ["topicId"]),

    // Subscription info
    subscriptions: defineTable({
        userId: v.string(),
        plan: v.string(), // 'free', 'premium'
        amount: v.optional(v.number()),
        currency: v.optional(v.string()),
        status: v.string(), // 'active', 'cancelled'
        nextBillingDate: v.optional(v.string()),
    }).index("by_userId", ["userId"]),
});
