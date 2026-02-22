import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api, internal } from "./_generated/api";
import {
    assertAuthorizedUser,
    computeExamPercentage,
    ensureUniqueAnswerQuestionIds,
    isUsableExamQuestion,
    resolveAuthUserId,
    sanitizeExamQuestionForClient,
} from "./lib/examSecurity";
import { canReuseExamAttempt, resolveReusableAttemptQuestions } from "./lib/examAttemptReuse";

const EXAM_QUESTION_SUBSET_SIZE = 25;
const EXAM_ATTEMPT_REUSE_LOOKBACK = 10;

const pickRandomSubset = <T>(items: T[], size: number) => {
    const copied = [...items];
    for (let i = copied.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [copied[i], copied[j]] = [copied[j], copied[i]];
    }
    return copied.slice(0, Math.max(0, size));
};

// Start a new exam attempt
export const startExamAttempt = mutation({
    args: {
        userId: v.optional(v.string()),
        topicId: v.id("topics"),
        examFormat: v.optional(v.string()), // 'mcq' | 'essay'
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        const authUserId = resolveAuthUserId(identity);
        const effectiveUserId = assertAuthorizedUser({
            authUserId,
            requestedUserId: args.userId,
        });

        const topic = await ctx.db.get(args.topicId);
        if (!topic) {
            throw new Error("Topic not found");
        }

        const recentAttempts = await ctx.db
            .query("examAttempts")
            .withIndex("by_userId_topicId", (q) =>
                q.eq("userId", effectiveUserId).eq("topicId", args.topicId)
            )
            .order("desc")
            .take(EXAM_ATTEMPT_REUSE_LOOKBACK);
        const reusableAttempt = recentAttempts.find((attempt) =>
            canReuseExamAttempt({
                attempt,
                topicId: args.topicId,
            })
        );

        if (reusableAttempt) {
            const reusableQuestionIds = Array.isArray(reusableAttempt.questionIds)
                ? reusableAttempt.questionIds
                : [];
            const loadedReusableQuestions = await Promise.all(
                reusableQuestionIds.map((questionId) => ctx.db.get(questionId))
            );
            const reusableQuestions = resolveReusableAttemptQuestions({
                questionIds: reusableQuestionIds,
                loadedQuestions: loadedReusableQuestions,
                topicId: args.topicId,
            }).filter((question) => isUsableExamQuestion(question));

            if (reusableQuestions.length === reusableQuestionIds.length && reusableQuestions.length > 0) {
                const safeQuestions = reusableQuestions.map((question) =>
                    sanitizeExamQuestionForClient(question)
                );
                return {
                    attemptId: reusableAttempt._id,
                    totalQuestions: reusableQuestions.length,
                    questions: safeQuestions,
                    reusedAttempt: true,
                };
            }
        }

        // Get questions for this topic to count them
        const questions = await ctx.db
            .query("questions")
            .withIndex("by_topicId", (q) => q.eq("topicId", args.topicId))
            .collect();

        const isEssay = args.examFormat === "essay";
        const filteredQuestions = isEssay
            ? questions.filter((q) => q.questionType === "essay")
            : questions.filter((q) => q.questionType !== "essay");
        const usableQuestions = filteredQuestions.filter((question) =>
            isUsableExamQuestion(question, { allowEssay: isEssay })
        );

        const subsetSize = isEssay ? Math.min(10, usableQuestions.length) : EXAM_QUESTION_SUBSET_SIZE;
        const selectedQuestions = usableQuestions.length <= subsetSize
            ? usableQuestions
            : pickRandomSubset(usableQuestions, subsetSize);
        if (selectedQuestions.length === 0) {
            await ctx.scheduler.runAfter(0, internal.ai.generateQuestionsForTopicInternal, {
                topicId: args.topicId,
            });
            throw new Error("Questions are being refreshed for quality. Please try again in a few seconds.");
        }
        const questionIds = selectedQuestions.map((question) => question._id);
        const safeQuestions = selectedQuestions.map((question) => sanitizeExamQuestionForClient(question));

        // Create a new attempt record
        const attemptId = await ctx.db.insert("examAttempts", {
            userId: effectiveUserId,
            topicId: args.topicId,
            score: 0,
            totalQuestions: selectedQuestions.length,
            timeTakenSeconds: 0,
            questionIds,
            answers: [],
        });

        return {
            attemptId,
            totalQuestions: selectedQuestions.length,
            questions: safeQuestions,
            reusedAttempt: false,
        };
    },
});

// Submit exam answers and calculate score
export const submitExamAttempt = mutation({
    args: {
        attemptId: v.id("examAttempts"),
        answers: v.array(
            v.object({
                questionId: v.id("questions"),
                selectedAnswer: v.string(),
            })
        ),
        timeTakenSeconds: v.number(),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        const authUserId = resolveAuthUserId(identity);
        assertAuthorizedUser({ authUserId });

        const attempt = await ctx.db.get(args.attemptId);
        if (!attempt) {
            throw new Error("Exam attempt not found");
        }
        assertAuthorizedUser({ authUserId, resourceOwnerUserId: attempt.userId });

        // Calculate score
        let correctCount = 0;
        const gradedAnswers = [];
        ensureUniqueAnswerQuestionIds(args.answers);
        const attemptQuestionIds = new Set((attempt.questionIds || []).map((id) => String(id)));
        const enforceSubset = attemptQuestionIds.size > 0;

        for (const answer of args.answers) {
            if (enforceSubset && !attemptQuestionIds.has(String(answer.questionId))) {
                throw new Error("Submitted answers include questions outside this exam attempt.");
            }
            const question = await ctx.db.get(answer.questionId);
            if (!question) {
                throw new Error("One or more submitted questions could not be found.");
            }
            if (question.topicId !== attempt.topicId) {
                throw new Error("Submitted answers include questions outside this topic.");
            }

            const isCorrect = question?.correctAnswer === answer.selectedAnswer;
            if (isCorrect) correctCount++;

            gradedAnswers.push({
                questionId: answer.questionId,
                selectedAnswer: answer.selectedAnswer,
                correctAnswer: question?.correctAnswer,
                isCorrect,
            });
        }

        // Update the attempt
        await ctx.db.patch(args.attemptId, {
            score: correctCount,
            timeTakenSeconds: args.timeTakenSeconds,
            answers: gradedAnswers,
        });

        // Get the attempt to return
        const totalQuestions = attempt.totalQuestions || (attempt.questionIds?.length ?? args.answers.length);

        return {
            score: correctCount,
            totalQuestions,
            percentage: computeExamPercentage({
                score: correctCount,
                totalQuestions,
                fallbackTotal: args.answers.length,
            }),
            timeTakenSeconds: args.timeTakenSeconds,
            gradedAnswers,
        };
    },
});

// Get all exam attempts for a user
export const getUserExamAttempts = query({
    args: { userId: v.optional(v.string()) },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        const authUserId = resolveAuthUserId(identity);
        const effectiveUserId = assertAuthorizedUser({
            authUserId,
            requestedUserId: args.userId,
        });

        const attempts = await ctx.db
            .query("examAttempts")
            .withIndex("by_userId", (q) => q.eq("userId", effectiveUserId))
            .order("desc")
            .collect();

        // Enrich with topic info
        const enrichedAttempts = await Promise.all(
            attempts.map(async (attempt) => {
                const topic = await ctx.db.get(attempt.topicId);
                return {
                    ...attempt,
                    topicTitle: topic?.title || "Unknown Topic",
                };
            })
        );

        return enrichedAttempts;
    },
});

// Get exam attempts for a specific topic
export const getExamAttemptsByTopic = query({
    args: {
        userId: v.optional(v.string()),
        topicId: v.id("topics")
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        const authUserId = resolveAuthUserId(identity);
        const effectiveUserId = assertAuthorizedUser({
            authUserId,
            requestedUserId: args.userId,
        });

        const attempts = await ctx.db
            .query("examAttempts")
            .withIndex("by_topicId", (q) => q.eq("topicId", args.topicId))
            .order("desc")
            .collect();

        // Filter to only user's attempts
        return attempts.filter((a) => a.userId === effectiveUserId);
    },
});

// Get single exam attempt with detailed results
export const getExamAttempt = query({
    args: { attemptId: v.id("examAttempts") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        const authUserId = resolveAuthUserId(identity);
        assertAuthorizedUser({ authUserId });

        const attempt = await ctx.db.get(args.attemptId);
        if (!attempt) return null;
        assertAuthorizedUser({ authUserId, resourceOwnerUserId: attempt.userId });

        const topic = await ctx.db.get(attempt.topicId);

        // Get full question details for each answer
        const enrichedAnswers = await Promise.all(
            (attempt.answers || []).map(async (answer: any) => {
                const question = await ctx.db.get(answer.questionId);
                return {
                    ...answer,
                    questionText: question?.questionText,
                    options: question?.options,
                    explanation: question?.explanation,
                    difficulty: question?.difficulty,
                };
            })
        );

        return {
            ...attempt,
            topicTitle: topic?.title || "Unknown Topic",
            answers: enrichedAnswers,
            percentage: computeExamPercentage({
                score: attempt.score,
                totalQuestions: attempt.totalQuestions,
                fallbackTotal: enrichedAnswers.length,
            }),
        };
    },
});

// Submit essay exam — grades each answer via AI
export const submitEssayExam = action({
    args: {
        attemptId: v.id("examAttempts"),
        answers: v.array(
            v.object({
                questionId: v.id("questions"),
                essayText: v.string(),
            })
        ),
        timeTakenSeconds: v.number(),
    },
    handler: async (ctx, args) => {
        // Load the attempt
        const attempt: any = await ctx.runQuery(api.exams.getExamAttempt, {
            attemptId: args.attemptId,
        });
        if (!attempt) throw new Error("Exam attempt not found");

        const attemptQuestionIds = new Set(
            (attempt.questionIds || []).map((id: any) => String(id))
        );

        // Load questions for this topic
        const topicData = await ctx.runQuery(api.topics.getTopicWithQuestions, {
            topicId: attempt.topicId,
        });
        const allQuestions: any[] = topicData?.questions || [];

        // Grade each answer via AI
        let correctCount = 0;
        const gradedAnswers: any[] = [];

        for (const answer of args.answers) {
            if (attemptQuestionIds.size > 0 && !attemptQuestionIds.has(String(answer.questionId))) {
                throw new Error("Submitted answers include questions outside this exam attempt.");
            }

            const question = allQuestions.find(
                (q: any) => String(q._id) === String(answer.questionId)
            );

            if (!question) {
                gradedAnswers.push({
                    questionId: answer.questionId,
                    selectedAnswer: answer.essayText,
                    correctAnswer: "",
                    isCorrect: false,
                    feedback: "Question not found.",
                });
                continue;
            }

            // Grade via AI
            const gradeResult: any = await ctx.runAction(api.ai.gradeEssayAnswer, {
                questionText: question.questionText || "",
                modelAnswer: question.correctAnswer || "",
                studentAnswer: answer.essayText,
                rubricHints: question.explanation || undefined,
            });

            const isCorrect = gradeResult.score === 1;
            if (isCorrect) correctCount++;

            gradedAnswers.push({
                questionId: answer.questionId,
                selectedAnswer: answer.essayText,
                correctAnswer: question.correctAnswer || "",
                isCorrect,
                feedback: gradeResult.feedback || "",
            });
        }

        // Update the attempt record
        await ctx.runMutation(api.exams.updateExamAttemptScore, {
            attemptId: args.attemptId,
            score: correctCount,
            timeTakenSeconds: args.timeTakenSeconds,
            answers: gradedAnswers,
        });

        const totalQuestions = attempt.totalQuestions || args.answers.length;

        return {
            score: correctCount,
            totalQuestions,
            percentage: Math.round((correctCount / Math.max(totalQuestions, 1)) * 100),
            timeTakenSeconds: args.timeTakenSeconds,
            gradedAnswers,
        };
    },
});

// Persist AI tutor feedback onto an exam attempt (called by generateExamFeedback action)
export const saveTutorFeedback = mutation({
    args: {
        attemptId: v.id("examAttempts"),
        tutorFeedback: v.string(),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        const authUserId = resolveAuthUserId(identity);
        assertAuthorizedUser({ authUserId });

        const attempt = await ctx.db.get(args.attemptId);
        if (!attempt) throw new Error("Exam attempt not found");
        assertAuthorizedUser({ authUserId, resourceOwnerUserId: attempt.userId });

        await ctx.db.patch(args.attemptId, { tutorFeedback: args.tutorFeedback });
    },
});

// Get the most recent exam attempt for a topic (used for performance-aware re-explain)
export const getLatestAttemptForTopic = query({
    args: {
        userId: v.string(),
        topicId: v.id("topics"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        const authUserId = resolveAuthUserId(identity);
        assertAuthorizedUser({ authUserId, requestedUserId: args.userId });

        const attempt = await ctx.db
            .query("examAttempts")
            .withIndex("by_userId_topicId", (q) =>
                q.eq("userId", args.userId).eq("topicId", args.topicId)
            )
            .order("desc")
            .first();

        if (!attempt) return null;

        const incorrectAnswers = await Promise.all(
            (attempt.answers || [])
                .filter((a: any) => !a.isCorrect)
                .slice(0, 5)
                .map(async (a: any) => {
                    const question = await ctx.db.get(a.questionId);
                    return { questionText: question?.questionText || a.questionText || "" };
                })
        );

        return {
            score: attempt.score,
            totalQuestions: attempt.totalQuestions,
            percentage: computeExamPercentage({
                score: attempt.score,
                totalQuestions: attempt.totalQuestions,
                fallbackTotal: (attempt.answers || []).length,
            }),
            incorrectAnswers,
        };
    },
});

// Aggregate cross-topic performance for the dashboard insights panel
export const getUserPerformanceInsights = query({
    args: { userId: v.string() },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        const authUserId = resolveAuthUserId(identity);
        assertAuthorizedUser({ authUserId, requestedUserId: args.userId });

        const allAttempts = await ctx.db
            .query("examAttempts")
            .withIndex("by_userId", (q) => q.eq("userId", args.userId))
            .collect();

        if (allAttempts.length === 0) return null;

        // Best score per topic
        const topicMap = new Map<string, { best: number; topicId: any }>();
        for (const attempt of allAttempts) {
            const total = attempt.totalQuestions || (attempt.answers || []).length;
            if (total === 0) continue;
            const pct = Math.round((attempt.score / total) * 100);
            const key = String(attempt.topicId);
            const existing = topicMap.get(key);
            if (!existing || pct > existing.best) {
                topicMap.set(key, { best: pct, topicId: attempt.topicId });
            }
        }

        const entries = await Promise.all(
            Array.from(topicMap.values()).map(async ({ best, topicId }) => {
                const topic = await ctx.db.get(topicId);
                return { topicId: String(topicId), title: topic?.title || "Unknown Topic", best };
            })
        );

        const mastered = entries.filter((e) => e.best >= 80).sort((a, b) => b.best - a.best);
        const progressing = entries.filter((e) => e.best >= 50 && e.best < 80).sort((a, b) => b.best - a.best);
        const needsWork = entries.filter((e) => e.best < 50).sort((a, b) => a.best - b.best);
        const overallPreparedness = entries.length > 0
            ? Math.round(entries.reduce((sum, e) => sum + e.best, 0) / entries.length)
            : 0;

        return { mastered, progressing, needsWork, overallPreparedness };
    },
});

// Helper mutation to update exam attempt score (used by submitEssayExam action)
export const updateExamAttemptScore = mutation({
    args: {
        attemptId: v.id("examAttempts"),
        score: v.number(),
        timeTakenSeconds: v.number(),
        answers: v.any(),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        const authUserId = resolveAuthUserId(identity);
        assertAuthorizedUser({ authUserId });

        const attempt = await ctx.db.get(args.attemptId);
        if (!attempt) throw new Error("Exam attempt not found");
        assertAuthorizedUser({ authUserId, resourceOwnerUserId: attempt.userId });

        await ctx.db.patch(args.attemptId, {
            score: args.score,
            timeTakenSeconds: args.timeTakenSeconds,
            answers: args.answers,
        });
    },
});
