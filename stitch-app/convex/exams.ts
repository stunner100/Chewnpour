import { ConvexError, v } from "convex/values";
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

const EXAM_QUESTION_SUBSET_SIZE = 35;
const EXAM_ESSAY_QUESTION_SUBSET_SIZE = 15;
const EXAM_ATTEMPT_REUSE_LOOKBACK = 10;

const pickRandomSubset = <T>(items: T[], size: number): T[] => {
    const copied = [...items];
    for (let i = copied.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [copied[i], copied[j]] = [copied[j], copied[i]];
    }
    return copied.slice(0, Math.max(0, size));
};

const DIFFICULTY_DISTRIBUTION = { easy: 0.3, medium: 0.5, hard: 0.2 };

const pickDifficultyBalancedSubset = <T extends { difficulty?: string }>(
    items: T[], size: number
): T[] => {
    if (items.length <= size) return [...items];

    const buckets: Record<string, T[]> = { easy: [], medium: [], hard: [] };
    for (const item of items) {
        const d = (item.difficulty || "medium").toLowerCase();
        (buckets[d] || buckets.medium).push(item);
    }

    const easyTarget = Math.round(size * DIFFICULTY_DISTRIBUTION.easy);
    const mediumTarget = Math.round(size * DIFFICULTY_DISTRIBUTION.medium);
    const hardTarget = size - easyTarget - mediumTarget;

    const selected: T[] = [
        ...pickRandomSubset(buckets.easy, easyTarget),
        ...pickRandomSubset(buckets.medium, mediumTarget),
        ...pickRandomSubset(buckets.hard, hardTarget),
    ];

    if (selected.length < size) {
        const selectedSet = new Set(selected);
        const remaining = items.filter(i => !selectedSet.has(i));
        selected.push(...pickRandomSubset(remaining, size - selected.length));
    }

    return selected.slice(0, size);
};

// Start a new exam attempt
export const startExamAttempt = mutation({
    args: {
        userId: v.optional(v.string()),
        topicId: v.id("topics"),
        examFormat: v.optional(v.string()), // 'mcq' | 'essay'
    },
    handler: async (ctx, args) => {
        const scheduleQuestionTopUp = (options: { essay: boolean; minimumCount: number }) => {
            if (options.essay) {
                void ctx.scheduler.runAfter(0, internal.ai.generateEssayQuestionsForTopicInternal, {
                    topicId: args.topicId,
                    count: options.minimumCount,
                }).catch(() => {
                    // Scheduling is best effort and should not block exam start.
                });
                return;
            }

            void ctx.scheduler.runAfter(0, internal.ai.generateQuestionsForTopicInternal, {
                topicId: args.topicId,
            }).catch(() => {
                // Scheduling is best effort and should not block exam start.
            });
        };

        const identity = await ctx.auth.getUserIdentity();
        const authUserId = resolveAuthUserId(identity);
        const effectiveUserId = assertAuthorizedUser({
            authUserId,
            requestedUserId: args.userId,
        });

        const topic = await ctx.db.get(args.topicId);
        if (!topic) {
            throw new ConvexError({
                code: "TOPIC_NOT_FOUND",
                message: "Topic not found.",
            });
        }

        const isEssay = args.examFormat === "essay";
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
                examFormat: isEssay ? "essay" : "mcq",
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
            }).filter((question) => {
                const matchesRequestedFormat = isEssay
                    ? question.questionType === "essay"
                    : question.questionType !== "essay";
                if (!matchesRequestedFormat) return false;
                return isUsableExamQuestion(question, { allowEssay: isEssay });
            });

            if (reusableQuestions.length === reusableQuestionIds.length && reusableQuestions.length > 0) {
                if (isEssay && reusableQuestions.length < EXAM_ESSAY_QUESTION_SUBSET_SIZE) {
                    scheduleQuestionTopUp({
                        essay: true,
                        minimumCount: EXAM_ESSAY_QUESTION_SUBSET_SIZE,
                    });
                }
                if (!isEssay && reusableQuestions.length < EXAM_QUESTION_SUBSET_SIZE) {
                    scheduleQuestionTopUp({
                        essay: false,
                        minimumCount: EXAM_QUESTION_SUBSET_SIZE,
                    });
                }

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

        const filteredQuestions = isEssay
            ? questions.filter((q) => q.questionType === "essay")
            : questions.filter((q) => q.questionType !== "essay");
        const usableQuestions = filteredQuestions.filter((question) =>
            isUsableExamQuestion(question, { allowEssay: isEssay })
        );

        const subsetSize = isEssay
            ? Math.min(EXAM_ESSAY_QUESTION_SUBSET_SIZE, usableQuestions.length)
            : EXAM_QUESTION_SUBSET_SIZE;

        // Question rotation: prioritize unseen questions from recent attempts
        // Reuse recentAttempts already fetched above for attempt reuse logic
        const seenQuestionIds = new Set(
            recentAttempts.flatMap((a) => (a.questionIds || []).map(String))
        );

        const unseenQuestions = usableQuestions.filter((q) => !seenQuestionIds.has(String(q._id)));
        const seenQuestions = usableQuestions.filter((q) => seenQuestionIds.has(String(q._id)));

        let selectedQuestions: typeof usableQuestions;
        if (usableQuestions.length <= subsetSize) {
            selectedQuestions = usableQuestions;
        } else if (isEssay) {
            // Essay: prioritize unseen, random fill
            selectedQuestions = unseenQuestions.length >= subsetSize
                ? pickRandomSubset(unseenQuestions, subsetSize)
                : [...pickRandomSubset(unseenQuestions, unseenQuestions.length), ...pickRandomSubset(seenQuestions, subsetSize - unseenQuestions.length)];
        } else {
            // MCQ: prioritize unseen + difficulty-balanced
            selectedQuestions = unseenQuestions.length >= subsetSize
                ? pickDifficultyBalancedSubset(unseenQuestions, subsetSize)
                : [...pickDifficultyBalancedSubset(unseenQuestions, unseenQuestions.length), ...pickRandomSubset(seenQuestions, subsetSize - unseenQuestions.length)];
        }
        if (selectedQuestions.length === 0) {
            const preparingCode = isEssay ? "ESSAY_QUESTIONS_PREPARING" : "EXAM_QUESTIONS_PREPARING";
            const preparingMessage = isEssay
                ? "Essay questions are being prepared. Please try again in a few seconds."
                : "Questions are being refreshed for quality. Please try again in a few seconds.";

            if (isEssay) {
                try {
                    await ctx.scheduler.runAfter(0, internal.ai.generateEssayQuestionsForTopicInternal, {
                        topicId: args.topicId,
                        count: EXAM_ESSAY_QUESTION_SUBSET_SIZE,
                    });
                } catch {
                    // Scheduling is a best-effort background refresh and should not block the user-facing response.
                }
            } else {
                try {
                    await ctx.scheduler.runAfter(0, internal.ai.generateQuestionsForTopicInternal, {
                        topicId: args.topicId,
                    });
                } catch {
                    // Scheduling is a best-effort background refresh and should not block the user-facing response.
                }
            }

            return {
                attemptId: null,
                totalQuestions: 0,
                questions: [],
                reusedAttempt: false,
                deferred: true,
                code: preparingCode,
                message: preparingMessage,
            };
        }

        if (isEssay && selectedQuestions.length < EXAM_ESSAY_QUESTION_SUBSET_SIZE) {
            scheduleQuestionTopUp({
                essay: true,
                minimumCount: EXAM_ESSAY_QUESTION_SUBSET_SIZE,
            });
        }
        if (!isEssay && selectedQuestions.length < EXAM_QUESTION_SUBSET_SIZE) {
            scheduleQuestionTopUp({
                essay: false,
                minimumCount: EXAM_QUESTION_SUBSET_SIZE,
            });
        }

        const questionIds = selectedQuestions.map((question) => question._id);
        const safeQuestions = selectedQuestions.map((question) => sanitizeExamQuestionForClient(question));

        // Create a new attempt record
        const attemptDocument = {
            userId: effectiveUserId,
            topicId: args.topicId,
            examFormat: isEssay ? "essay" : "mcq",
            score: 0,
            totalQuestions: selectedQuestions.length,
            timeTakenSeconds: 0,
            questionIds,
            answers: [],
        };

        const attemptId = await (async () => {
            try {
                return await ctx.db.insert("examAttempts", attemptDocument);
            } catch (insertError) {
                const insertMessage = String((insertError as { message?: unknown })?.message || "");
                const legacySchemaMismatch =
                    /table "examAttempts"/i.test(insertMessage)
                    && /extra field `examFormat`/i.test(insertMessage);
                if (!legacySchemaMismatch) {
                    throw insertError;
                }

                const { examFormat: _FORMAT_FIELD, ...legacyAttemptDocument } = attemptDocument;
                return await ctx.db.insert("examAttempts", legacyAttemptDocument);
            }
        })();

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
        if (!authUserId) return [];

        const requestedUserId = typeof args.userId === "string" ? args.userId.trim() : "";
        // Use authenticated identity as source of truth to avoid session-race mismatches.
        const effectiveUserId = requestedUserId && requestedUserId === authUserId
            ? requestedUserId
            : authUserId;

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

// Get full attempt context for essay submission (includes raw question docs)
export const getEssayAttemptSubmissionContext = query({
    args: { attemptId: v.id("examAttempts") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        const authUserId = resolveAuthUserId(identity);
        assertAuthorizedUser({ authUserId });

        const attempt = await ctx.db.get(args.attemptId);
        if (!attempt) return null;
        assertAuthorizedUser({ authUserId, resourceOwnerUserId: attempt.userId });

        const attemptQuestionIds = Array.isArray(attempt.questionIds) ? attempt.questionIds : [];
        let questions: any[] = [];

        if (attemptQuestionIds.length > 0) {
            const loadedQuestions = await Promise.all(
                attemptQuestionIds.map((questionId: any) => ctx.db.get(questionId))
            );
            questions = loadedQuestions.filter(
                (question: any) => question && question.topicId === attempt.topicId
            );
        } else {
            // Legacy fallback for old attempts with missing questionIds.
            questions = await ctx.db
                .query("questions")
                .withIndex("by_topicId", (q) => q.eq("topicId", attempt.topicId))
                .collect();
        }

        return {
            attempt,
            questions,
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
        const failEssaySubmission = (message: string, code = "ESSAY_SUBMISSION_INVALID"): never => {
            throw new ConvexError({ code, message });
        };

        const resolveMessage = (error: unknown, fallback = "Failed to submit essay exam. Please try again.") => {
            const value = String((error as any)?.message || fallback);
            return value.replace(/\s+/g, " ").trim() || fallback;
        };

        try {
            // Load the attempt with its raw question docs (including essay answers/rubrics).
            const submissionContext: any = await ctx.runQuery(api.exams.getEssayAttemptSubmissionContext, {
                attemptId: args.attemptId,
            });
            const attempt: any = submissionContext?.attempt;
            if (!attempt) {
                failEssaySubmission("Exam attempt not found.");
            }
            const allQuestions: any[] = Array.isArray(submissionContext?.questions)
                ? submissionContext.questions
                : [];

            if (!Array.isArray(args.answers) || args.answers.length === 0) {
                failEssaySubmission("Please answer at least one question before submitting.");
            }

            try {
                ensureUniqueAnswerQuestionIds(args.answers);
            } catch {
                failEssaySubmission("Please submit at most one answer per question.");
            }

            const attemptQuestionIds = new Set(
                (attempt.questionIds || []).map((id: any) => String(id))
            );

            if (allQuestions.length === 0) {
                failEssaySubmission("We could not load this exam's questions. Please restart the exam.");
            }

            const submittedQuestionIds = new Set(
                args.answers.map((answer) => String(answer.questionId))
            );
            const requiredQuestionCount = Number(attempt.totalQuestions || 0) > 0
                ? Number(attempt.totalQuestions || 0)
                : attemptQuestionIds.size;
            if (requiredQuestionCount > 0 && args.answers.length !== requiredQuestionCount) {
                failEssaySubmission("Please answer all essay questions before submitting.");
            }
            if (attemptQuestionIds.size > 0) {
                const unansweredCount = Array.from(attemptQuestionIds).filter(
                    (questionId) => !submittedQuestionIds.has(questionId)
                ).length;
                if (unansweredCount > 0) {
                    failEssaySubmission("Please answer all essay questions before submitting.");
                }
            }

            // Grade each answer via AI (0-5 scale per answer)
            let totalEssayScore = 0;
            let correctCount = 0;
            const gradedAnswers: any[] = [];

            for (const answer of args.answers) {
                if (attemptQuestionIds.size > 0 && !attemptQuestionIds.has(String(answer.questionId))) {
                    failEssaySubmission(
                        "This exam session is out of sync. Please restart the exam and try again."
                    );
                }

                const question = allQuestions.find(
                    (q: any) => String(q._id) === String(answer.questionId)
                );

                if (!question) {
                    failEssaySubmission(
                        "One or more questions from this exam could not be found. Please restart the exam."
                    );
                }
                if (question.questionType !== "essay") {
                    failEssaySubmission(
                        "This exam session is out of sync. Please restart the exam in Essay mode."
                    );
                }

                const normalizedEssayText = String(answer.essayText || "").trim();
                if (!normalizedEssayText) {
                    failEssaySubmission("Please answer all essay questions before submitting.");
                }

                // Grade via AI
                let gradeResult: any;
                try {
                    gradeResult = await ctx.runAction(api.ai.gradeEssayAnswer, {
                        questionText: question.questionText || "",
                        modelAnswer: question.correctAnswer || "",
                        studentAnswer: normalizedEssayText,
                        rubricHints: question.explanation || undefined,
                    });
                } catch (gradingError) {
                    const gradingMessage = resolveMessage(gradingError);
                    if (/timeout|timed out|rate limit|unavailable|temporarily/i.test(gradingMessage)) {
                        failEssaySubmission(
                            "We could not grade your essay right now. Please try again in a moment.",
                            "ESSAY_GRADING_UNAVAILABLE"
                        );
                    }
                    throw gradingError;
                }

                if (gradeResult?.ungraded) {
                    failEssaySubmission(
                        "We could not grade your essay right now. Please try again in a moment.",
                        "ESSAY_GRADING_UNAVAILABLE"
                    );
                }

                const rawEssayScore = Number(gradeResult?.score);
                if (!Number.isFinite(rawEssayScore)) {
                    failEssaySubmission(
                        "We could not grade your essay right now. Please try again in a moment.",
                        "ESSAY_GRADING_UNAVAILABLE"
                    );
                }
                const essayScore = Math.max(0, Math.min(5, Math.round(rawEssayScore)));
                totalEssayScore += essayScore;
                const isCorrect = essayScore >= 3;
                if (isCorrect) correctCount++;

                gradedAnswers.push({
                    questionId: answer.questionId,
                    selectedAnswer: normalizedEssayText,
                    correctAnswer: question.correctAnswer || "",
                    isCorrect,
                    essayScore,
                    feedback: gradeResult?.feedback || "",
                });
            }

            const totalQuestions = attempt.totalQuestions || requiredQuestionCount || args.answers.length;
            const maxEssayScore = totalQuestions * 5;

            // Update the attempt record
            await ctx.runMutation(api.exams.updateExamAttemptScore, {
                attemptId: args.attemptId,
                score: correctCount,
                timeTakenSeconds: args.timeTakenSeconds,
                answers: gradedAnswers,
            });

            return {
                score: correctCount,
                totalQuestions,
                percentage: Math.round((totalEssayScore / Math.max(maxEssayScore, 1)) * 100),
                timeTakenSeconds: args.timeTakenSeconds,
                gradedAnswers,
            };
        } catch (error) {
            if (error instanceof ConvexError) {
                throw error;
            }
            throw new ConvexError({
                code: "ESSAY_SUBMISSION_FAILED",
                message: resolveMessage(error),
            });
        }
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
    args: { userId: v.optional(v.string()) },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        const authUserId = resolveAuthUserId(identity);
        if (!authUserId) return null;

        const requestedUserId = typeof args.userId === "string" ? args.userId.trim() : "";
        // Use authenticated identity as source of truth to avoid client/session race mismatches.
        const effectiveUserId = requestedUserId && requestedUserId === authUserId
            ? requestedUserId
            : authUserId;

        const allAttempts = await ctx.db
            .query("examAttempts")
            .withIndex("by_userId", (q) => q.eq("userId", effectiveUserId))
            .collect();

        const completedAttempts = allAttempts.filter((attempt) =>
            Array.isArray(attempt.answers) && attempt.answers.length > 0
        );

        if (completedAttempts.length === 0) return null;

        // Best score per topic
        const topicMap = new Map<string, { best: number; topicId: any }>();
        for (const attempt of completedAttempts) {
            const total = attempt.totalQuestions || (attempt.answers || []).length;
            if (total === 0) continue;
            const pct = computeExamPercentage({
                score: attempt.score,
                totalQuestions: total,
                fallbackTotal: (attempt.answers || []).length,
            });
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
