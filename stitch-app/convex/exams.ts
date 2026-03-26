import { ConvexError, v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import {
    assertAuthorizedUser,
    computeExamPercentage,
    ensureUniqueAnswerQuestionIds,
    isUsableExamQuestion,
    resolveAuthUserId,
    sanitizeExamQuestionForClient,
} from "./lib/examSecurity";
import { filterQuestionsForActiveAssessment } from "./lib/assessmentBlueprint.js";
import { canReuseExamAttempt, resolveReusableAttemptQuestions } from "./lib/examAttemptReuse";
import { selectQuestionsForAttempt } from "./lib/examQuestionSelection";
import { resolveAssessmentCapacity } from "./lib/questionBankConfig.js";

const EXAM_ATTEMPT_REUSE_LOOKBACK = 50;
const EXAM_ESSAY_MIN_READY_COUNT = 1;

const safeGetQuestionById = async (ctx: any, questionId: any) => {
    if (!questionId) return null;
    try {
        return await ctx.db.get(questionId);
    } catch (error) {
        console.warn("[ExamQuery] safeGetQuestionById failed", { questionId, error: error instanceof Error ? error.message : String(error) });
        return null;
    }
};

const resolveRequestedExamFormat = (value: unknown) =>
    String(value || "").trim().toLowerCase() === "essay" ? "essay" : "mcq";

const resolveTopicQuestionCounts = ({
    topic,
    examFormat,
    usableQuestionCount,
}: {
    topic: any;
    examFormat: string;
    usableQuestionCount?: number;
}) => {
    const normalizedFormat = resolveRequestedExamFormat(examFormat);
    const storedTargetCount = normalizedFormat === "essay"
        ? topic?.essayTargetCount
        : topic?.mcqTargetCount;
    const fallbackUsableCount = normalizedFormat === "essay"
        ? topic?.usableEssayCount
        : topic?.usableMcqCount;

    return resolveAssessmentCapacity({
        examFormat: normalizedFormat,
        topic,
        topicTargetCount: storedTargetCount,
        usableQuestionCount: usableQuestionCount ?? fallbackUsableCount,
    });
};

const createExamAttemptDocument = async ({
    ctx,
    attemptDocument,
}: {
    ctx: any;
    attemptDocument: Record<string, unknown>;
}) => {
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
};


export const requestEssayQuestionTopUp = mutation({
    args: {
        topicId: v.id("topics"),
        minimumCount: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        const authUserId = resolveAuthUserId(identity);
        assertAuthorizedUser({ authUserId });

        const topic = await ctx.db.get(args.topicId);
        if (!topic) {
            throw new ConvexError({
                code: "TOPIC_NOT_FOUND",
                message: "Topic not found.",
            });
        }
        const course = await ctx.db.get(topic.courseId);
        if (!course) {
            throw new ConvexError({
                code: "TOPIC_NOT_FOUND",
                message: "Topic not found.",
            });
        }
        assertAuthorizedUser({
            authUserId,
            resourceOwnerUserId: course.userId,
        });

        const capacity = resolveTopicQuestionCounts({
            topic,
            examFormat: "essay",
        });
        const requestedCount = Math.max(
            EXAM_ESSAY_MIN_READY_COUNT,
            Math.round(
                Number(
                    args.minimumCount
                    || capacity.bankTargetCount
                    || capacity.attemptTargetCount
                    || EXAM_ESSAY_MIN_READY_COUNT
                )
            )
        );

        await ctx.scheduler.runAfter(0, internal.ai.generateEssayQuestionsForTopicInternal, {
            topicId: args.topicId,
            count: requestedCount,
        });

        return {
            success: true,
            scheduled: true,
            requestedCount,
        };
    },
});

export const ensurePreparedExamAttemptInternal = internalMutation({
    args: {
        userId: v.string(),
        topicId: v.id("topics"),
        examFormat: v.optional(v.string()), // 'mcq' | 'essay'
    },
    handler: async (ctx, args) => {
        const effectiveUserId = String(args.userId || "").trim();
        const examFormat = resolveRequestedExamFormat(args.examFormat);
        const isEssay = examFormat === "essay";

        const topic = await ctx.db.get(args.topicId);
        if (!topic) {
            throw new ConvexError({
                code: "TOPIC_NOT_FOUND",
                message: "Topic not found.",
            });
        }

        // Verify topic ownership
        const course = topic.courseId ? await ctx.db.get(topic.courseId) : null;
        if (course && course.userId !== effectiveUserId) {
            throw new ConvexError({ code: "UNAUTHORIZED", message: "Not authorized to access this topic." });
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
                examFormat,
            })
        );

        if (reusableAttempt) {
            const reusableQuestionIds = Array.isArray(reusableAttempt.questionIds)
                ? reusableAttempt.questionIds
                : [];
            const loadedReusableQuestions = await Promise.all(
                reusableQuestionIds.map((questionId) => ctx.db.get(questionId))
            );
            const reusableQuestions = filterQuestionsForActiveAssessment({
                topic,
                questions: resolveReusableAttemptQuestions({
                    questionIds: reusableQuestionIds,
                    loadedQuestions: loadedReusableQuestions,
                    topicId: args.topicId,
                }),
            }).filter((question) => {
                const matchesRequestedFormat = isEssay
                    ? question.questionType === "essay"
                    : question.questionType !== "essay";
                if (!matchesRequestedFormat) return false;
                return isUsableExamQuestion(question, { allowEssay: isEssay });
            });

            if (reusableQuestions.length === reusableQuestionIds.length && reusableQuestions.length > 0) {
                const reusableCapacity = resolveTopicQuestionCounts({
                    topic,
                    examFormat,
                    usableQuestionCount: reusableQuestions.length,
                });
                // Mark attempt as claimed to prevent concurrent reuse from another session
                await ctx.db.patch(reusableAttempt._id, { claimedAt: Date.now() });

                const safeQuestions = reusableQuestions.map((question) =>
                    sanitizeExamQuestionForClient(question)
                );
                return {
                    status: "ready",
                    attemptId: reusableAttempt._id,
                    totalQuestions: reusableQuestions.length,
                    questions: safeQuestions,
                    reusedAttempt: true,
                    attemptTargetCount: reusableQuestions.length,
                    bankTargetCount: reusableCapacity.bankTargetCount,
                    startedAt: (reusableAttempt as any).startedAt || reusableAttempt._creationTime,
                };
            }
        }

        // Get questions for this topic to count them
        const questions = await ctx.db
            .query("questions")
            .withIndex("by_topicId", (q) => q.eq("topicId", args.topicId))
            .collect();

        const activeQuestions = filterQuestionsForActiveAssessment({ topic, questions });
        const filteredQuestions = isEssay
            ? activeQuestions.filter((q) => q.questionType === "essay")
            : activeQuestions.filter((q) => q.questionType !== "essay");
        const usableQuestions = filteredQuestions.filter((question) =>
            isUsableExamQuestion(question, { allowEssay: isEssay })
        );
        const capacity = resolveTopicQuestionCounts({
            topic,
            examFormat,
            usableQuestionCount: usableQuestions.length,
        });
        const requiredQuestionCount = capacity.attemptTargetCount;
        if (usableQuestions.length < requiredQuestionCount) {
            return {
                status: "needs_generation",
                reasonCode: "INSUFFICIENT_READY_QUESTIONS",
                requiredQuestionCount,
                attemptTargetCount: capacity.attemptTargetCount,
                bankTargetCount: capacity.bankTargetCount,
                usableQuestionCount: usableQuestions.length,
                totalQuestions: 0,
                attemptId: null,
                questions: [],
                reusedAttempt: false,
            };
        }

        const selection = selectQuestionsForAttempt({
            questions: usableQuestions,
            recentAttempts,
            subsetSize: requiredQuestionCount,
            isEssay,
            examFormat,
        });
        const selectedQuestions = selection.selectedQuestions;

        if (selectedQuestions.length < requiredQuestionCount || selection.requiresFreshGeneration) {
            return {
                status: "needs_generation",
                reasonCode: selection.requiresFreshGeneration
                    ? "INSUFFICIENT_FRESH_QUESTIONS"
                    : "INSUFFICIENT_READY_QUESTIONS",
                requiredQuestionCount,
                attemptTargetCount: capacity.attemptTargetCount,
                bankTargetCount: capacity.bankTargetCount,
                usableQuestionCount: usableQuestions.length,
                totalQuestions: 0,
                attemptId: null,
                questions: [],
                reusedAttempt: false,
                selection,
            };
        }

        const questionIds = selectedQuestions.map((question) => question._id);
        const safeQuestions = selectedQuestions.map((question) => sanitizeExamQuestionForClient(question));

        // Create a new attempt record
        const attemptDocument = {
            userId: effectiveUserId,
            topicId: args.topicId,
            examFormat,
            score: 0,
            totalQuestions: selectedQuestions.length,
            timeTakenSeconds: 0,
            questionIds,
            answers: [],
            startedAt: Date.now(),
        };

        const attemptId = await createExamAttemptDocument({
            ctx,
            attemptDocument,
        });

        return {
            status: "ready",
            attemptId,
            totalQuestions: selectedQuestions.length,
            questions: safeQuestions,
            reusedAttempt: false,
            attemptTargetCount: capacity.attemptTargetCount,
            bankTargetCount: capacity.bankTargetCount,
            startedAt: attemptDocument.startedAt,
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

        // Idempotency guard — if already submitted, return existing result
        const existingAnswers = Array.isArray(attempt.answers) ? attempt.answers : [];
        if (existingAnswers.length > 0) {
            return {
                score: attempt.score || 0,
                totalQuestions: attempt.totalQuestions || 0,
                percentage: computeExamPercentage({
                    score: attempt.score || 0,
                    totalQuestions: attempt.totalQuestions || 0,
                    fallbackTotal: existingAnswers.length,
                }),
                timeTakenSeconds: attempt.timeTakenSeconds || 0,
            };
        }

        // Validate and clamp timeTakenSeconds
        const safeTimeTaken = Math.max(0, Math.min(86400, Math.round(args.timeTakenSeconds || 0)));

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

            const answered = typeof answer.selectedAnswer === "string" && answer.selectedAnswer.trim() !== "";
            const correctAnswer = String(question?.correctAnswer || "");
            const selectedNorm = answer.selectedAnswer.trim().toLowerCase();
            const correctNorm = correctAnswer.trim().toLowerCase();
            // Exact match for normal MCQ (label like "A"), or case-insensitive
            // match for fill-in-the-blank text answers including accepted variants.
            const acceptedAnswers: string[] = Array.isArray((question as any)?.acceptedAnswers)
                ? (question as any).acceptedAnswers
                : [];
            const isCorrect = answered && (
                correctAnswer === answer.selectedAnswer
                || correctNorm === selectedNorm
                || acceptedAnswers.some((aa: string) => String(aa).trim().toLowerCase() === selectedNorm)
            );
            if (isCorrect) correctCount++;

            gradedAnswers.push({
                questionId: answer.questionId,
                selectedAnswer: answered ? answer.selectedAnswer : "",
                correctAnswer: question?.correctAnswer,
                isCorrect,
                skipped: !answered,
            });
        }

        // Add entries for unanswered questions (skipped by user)
        if (enforceSubset) {
            const answeredIds = new Set(args.answers.map((a: any) => String(a.questionId)));
            for (const qId of attempt.questionIds || []) {
                if (!answeredIds.has(String(qId))) {
                    const question = await safeGetQuestionById(ctx, qId);
                    gradedAnswers.push({
                        questionId: String(qId),
                        selectedAnswer: "",
                        correctAnswer: question?.correctAnswer || "",
                        isCorrect: false,
                        skipped: true,
                    });
                }
            }
        }

        // Update the attempt
        await ctx.db.patch(args.attemptId, {
            score: correctCount,
            timeTakenSeconds: safeTimeTaken,
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
            timeTakenSeconds: safeTimeTaken,
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
            .withIndex("by_userId_topicId", (q) =>
                q.eq("userId", effectiveUserId).eq("topicId", args.topicId)
            )
            .order("desc")
            .collect();
        return attempts;
    },
});

// Get single exam attempt with detailed results
export const getExamAttempt = query({
    args: { attemptId: v.id("examAttempts") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        const authUserId = resolveAuthUserId(identity);
        if (!authUserId) return null;

        const attempt = await ctx.db.get(args.attemptId);
        if (!attempt) return null;
        try {
            assertAuthorizedUser({ authUserId, resourceOwnerUserId: attempt.userId });
        } catch {
            return null;
        }

        const topic = await ctx.db.get(attempt.topicId);

        // Get full question details for each answer
        const enrichedAnswers = await Promise.all(
            (Array.isArray(attempt.answers) ? attempt.answers : []).map(async (answer: any) => {
                const safeAnswer = answer && typeof answer === "object" ? answer : {};
                const question = await safeGetQuestionById(ctx, safeAnswer.questionId);
                return {
                    ...safeAnswer,
                    questionText: question?.questionText || safeAnswer.questionText || "Question unavailable",
                    options: question?.options || safeAnswer.options,
                    explanation: question?.explanation,
                    difficulty: question?.difficulty || safeAnswer.difficulty || "medium",
                    learningObjective: question?.learningObjective || safeAnswer.learningObjective,
                    bloomLevel: question?.bloomLevel || safeAnswer.bloomLevel,
                    outcomeKey: question?.outcomeKey || safeAnswer.outcomeKey,
                    authenticContext: question?.authenticContext || safeAnswer.authenticContext,
                };
            })
        );

        const isEssayAttempt = String((attempt as any).examFormat || "").toLowerCase() === "essay";
        const essayWeightedPct = (attempt as any).essayWeightedPercentage;
        // For essays: prefer weighted quality %, fall back to binary score if not yet graded
        const percentage = isEssayAttempt && typeof essayWeightedPct === "number"
            ? essayWeightedPct
            : computeExamPercentage({
                score: attempt.score,
                totalQuestions: isEssayAttempt ? undefined : attempt.totalQuestions,
                fallbackTotal: enrichedAnswers.length,
            });

        return {
            ...attempt,
            topicTitle: topic?.title || "Unknown Topic",
            answers: enrichedAnswers,
            percentage,
        };
    },
});

// Get full attempt context for essay submission (includes raw question docs)
export const getEssayAttemptSubmissionContext = internalQuery({
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
            const submissionContext: any = await ctx.runQuery(internal.exams.getEssayAttemptSubmissionContext, {
                attemptId: args.attemptId,
            });
            const attempt: any = submissionContext?.attempt;
            if (!attempt) {
                failEssaySubmission("Exam attempt not found.");
            }
            const gradingUserId = String(attempt?.userId || "").trim() || undefined;

            // Idempotency guard — if already submitted, return existing result
            const existingEssayAnswers = Array.isArray(attempt.answers) ? attempt.answers : [];
            if (existingEssayAnswers.length > 0) {
                const essayWeightedPct = typeof attempt.essayWeightedPercentage === "number"
                    ? attempt.essayWeightedPercentage
                    : 0;
                return {
                    score: attempt.score || 0,
                    totalQuestions: attempt.totalQuestions || 0,
                    percentage: essayWeightedPct,
                    timeTakenSeconds: attempt.timeTakenSeconds || 0,
                };
            }

            // Validate and clamp timeTakenSeconds
            const safeTimeTaken = Math.max(0, Math.min(86400, Math.round(args.timeTakenSeconds || 0)));

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

            // Validate essay text length
            const MAX_ESSAY_CHARS = 15000;
            for (const answer of args.answers) {
                if (typeof answer.essayText === "string" && answer.essayText.length > MAX_ESSAY_CHARS) {
                    throw new ConvexError({ code: "INPUT_TOO_LONG", message: `Essay answers must be under ${MAX_ESSAY_CHARS} characters.` });
                }
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

            // Grade each answer via AI (0-5 scale per answer).
            // If individual grading calls fail, record partial results rather than
            // discarding the entire submission. Only fail if zero essays were graded.
            let totalEssayScore = 0;
            let correctCount = 0;
            let ungradedCount = 0;
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

                // Grade via AI — tolerate individual failures to preserve partial work.
                let gradeResult: any;
                try {
                    gradeResult = await ctx.runAction(internal.ai.gradeEssayAnswer, {
                        userId: gradingUserId,
                        questionText: question.questionText || "",
                        modelAnswer: question.correctAnswer || "",
                        studentAnswer: normalizedEssayText,
                        rubricHints: question.explanation || undefined,
                        rubricPoints: Array.isArray(question.rubricPoints) && question.rubricPoints.length > 0
                            ? question.rubricPoints
                            : undefined,
                    });
                } catch (gradingError) {
                    console.warn("[EssaySubmit] individual_grading_failed", {
                        questionId: answer.questionId,
                        message: resolveMessage(gradingError),
                    });
                    gradeResult = { score: null, feedback: "Grading temporarily unavailable for this answer.", ungraded: true };
                }

                if (gradeResult?.ungraded || !Number.isFinite(Number(gradeResult?.score))) {
                    ungradedCount += 1;
                    gradedAnswers.push({
                        questionId: answer.questionId,
                        selectedAnswer: normalizedEssayText,
                        correctAnswer: question.correctAnswer || "",
                        isCorrect: false,
                        essayScore: null,
                        feedback: gradeResult?.feedback || "Grading temporarily unavailable. Your answer has been saved.",
                        ungraded: true,
                    });
                    continue;
                }

                const essayScore = Math.max(0, Math.min(5, Math.round(Number(gradeResult.score))));
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
                    ...(Array.isArray(gradeResult?.criteriaFeedback) && gradeResult.criteriaFeedback.length > 0
                        ? { criteriaFeedback: gradeResult.criteriaFeedback }
                        : {}),
                });
            }

            // If every single essay failed to grade, reject the submission so the
            // user can retry rather than receiving a meaningless 0% score.
            if (ungradedCount === args.answers.length) {
                failEssaySubmission(
                    "We could not grade any of your essays right now. Please try again in a moment.",
                    "ESSAY_GRADING_UNAVAILABLE"
                );
            }

            const totalQuestions = attempt.totalQuestions || requiredQuestionCount || args.answers.length;
            // Compute percentage based only on graded essays so ungraded ones
            // don't deflate the score unfairly.
            const gradedCount = args.answers.length - ungradedCount;
            const maxEssayScore = Math.max(gradedCount, 1) * 5;

            const essayWeightedPercentage = Math.round((totalEssayScore / Math.max(maxEssayScore, 1)) * 100);

            // Update the attempt record
            await ctx.runMutation(internal.exams.updateExamAttemptScore, {
                attemptId: args.attemptId,
                score: correctCount,
                timeTakenSeconds: safeTimeTaken,
                answers: gradedAnswers,
                essayWeightedPercentage,
            });

            return {
                score: correctCount,
                totalQuestions,
                percentage: essayWeightedPercentage,
                timeTakenSeconds: safeTimeTaken,
                gradedAnswers,
                ...(ungradedCount > 0 ? { ungradedCount, partialGrade: true } : {}),
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
                    const question = await safeGetQuestionById(ctx, a?.questionId);
                    return { questionText: question?.questionText || a.questionText || "" };
                })
        );

        const isEssayAttempt = String((attempt as any).examFormat || "").toLowerCase() === "essay";
        const essayWeightedPct = (attempt as any).essayWeightedPercentage;
        const percentage = isEssayAttempt && typeof essayWeightedPct === "number"
            ? essayWeightedPct
            : computeExamPercentage({
                score: attempt.score,
                totalQuestions: attempt.totalQuestions,
                fallbackTotal: (attempt.answers || []).length,
            });

        return {
            score: attempt.score,
            totalQuestions: attempt.totalQuestions,
            percentage,
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
            const isEssayAttempt = String((attempt as any).examFormat || "").toLowerCase() === "essay";
            const essayWeightedPct = (attempt as any).essayWeightedPercentage;
            const pct = isEssayAttempt && typeof essayWeightedPct === "number"
                ? essayWeightedPct
                : computeExamPercentage({
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
export const updateExamAttemptScore = internalMutation({
    args: {
        attemptId: v.id("examAttempts"),
        score: v.number(),
        timeTakenSeconds: v.number(),
        answers: v.array(
            v.object({
                questionId: v.union(v.id("questions"), v.string()),
                selectedAnswer: v.string(),
                correctAnswer: v.string(),
                isCorrect: v.boolean(),
                skipped: v.optional(v.boolean()),
                essayScore: v.optional(v.union(v.number(), v.null())),
                feedback: v.optional(v.string()),
                ungraded: v.optional(v.boolean()),
            })
        ),
        essayWeightedPercentage: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const attempt = await ctx.db.get(args.attemptId);
        if (!attempt) throw new Error("Exam attempt not found");

        const patch: any = {
            score: args.score,
            timeTakenSeconds: args.timeTakenSeconds,
            answers: args.answers,
        };
        if (typeof args.essayWeightedPercentage === "number") {
            patch.essayWeightedPercentage = args.essayWeightedPercentage;
        }
        await ctx.db.patch(args.attemptId, patch);
    },
});
