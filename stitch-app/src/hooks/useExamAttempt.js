import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useMutation, useAction } from 'convex/react';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../convex/_generated/api';
import { useExamTimer } from './useExamTimer';
import { addSentryBreadcrumb, captureSentryException, captureSentryMessage } from '../lib/sentry';
import { convexUrl } from '../lib/convex-config';
import {
    EXAM_DURATION_SECONDS,
    EXAM_LOADING_STALL_TIMEOUT_MS,
    START_EXAM_ATTEMPT_TIMEOUT_MS,
    countAnsweredQuestions,
    fetchConvexBrowserToken,
    resolveExamStartError,
    resolveExamSubmitError,
    withTimeout,
} from '../lib/examAttemptSupport';

export const useExamAttempt = ({
    routeSearch,
    routeTopicId,
    topicId,
    userId,
    authLoading,
    examState,
    dispatchExamState,
    navigate,
    isLoadingRouteTopic,
    isMissingRouteTopic,
}) => {
    const {
        attemptId,
        attemptQualityTier,
        attemptQuestions,
        currentQuestion,
        examFormat,
        examStarted,
        selectedAnswers,
        startExamError,
        startingExamAttempt,
    } = examState;

    const submitExam = useMutation(api.exams.submitExamAttempt);
    const submitEssayExam = useAction(api.exams.submitEssayExam);

    const startExamAttemptHttp = useCallback(async ({ topicId: nextTopicId, examFormat: nextExamFormat }) => {
        if (!convexUrl) {
            throw new Error('Convex is not configured for this deployment.');
        }
        const token = await fetchConvexBrowserToken();
        const client = new ConvexHttpClient(convexUrl);
        client.setAuth(token);
        return await client.action(api.exams.startExamAttempt, {
            topicId: nextTopicId,
            examFormat: nextExamFormat,
        });
    }, []);

    const questions = useMemo(
        () => (Array.isArray(attemptQuestions) ? attemptQuestions : []),
        [attemptQuestions],
    );
    const hasAttemptQuestions = questions.length > 0;

    const examFlowStartTimeRef = useRef(Date.now());
    const attemptStartTimeRef = useRef(null);
    const loadingStallReportedRef = useRef(false);
    const handleSubmitRef = useRef(() => { });
    const submittingRef = useRef(false);

    const {
        timeRemaining,
        formattedTime,
        isLowTime,
        setTimeRemaining: setExamTimeRemaining,
    } = useExamTimer(
        EXAM_DURATION_SECONDS,
        examStarted,
        () => handleSubmitRef.current(),
    );

    const setTimeRemaining = useCallback(
        (nextSeconds) => {
            if (typeof setExamTimeRemaining === 'function') {
                setExamTimeRemaining(nextSeconds);
            }
        },
        [setExamTimeRemaining],
    );

    const loadingExamTypeLabel = examFormat === 'essay' ? 'essay' : 'objective';
    const activePreparationMessage = `Generating your ${loadingExamTypeLabel} quiz from this topic.`;
    const preparationStatus = startExamError ? 'failed' : startingExamAttempt ? 'preparing' : '';
    const preparationStage = startingExamAttempt ? 'generating_candidates' : 'queued';
    const isPreparationRunning = startingExamAttempt;

    useEffect(() => {
        examFlowStartTimeRef.current = Date.now();
        attemptStartTimeRef.current = null;
        loadingStallReportedRef.current = false;
        dispatchExamState({ type: 'resetForRoute', search: routeSearch });
    }, [dispatchExamState, routeSearch, routeTopicId]);

    const beginExamAttempt = useCallback(async () => {
        if (!topicId || !examFormat || attemptStartTimeRef.current) return;

        dispatchExamState({ type: 'beginPreparation' });
        attemptStartTimeRef.current = Date.now();
        examFlowStartTimeRef.current = Date.now();
        loadingStallReportedRef.current = false;
        addSentryBreadcrumb({
            category: 'exam',
            message: 'Starting exam preparation',
            data: {
                topicId,
                hasUserId: Boolean(userId),
                examFormat,
            },
        });
        try {
            const result = await withTimeout(
                startExamAttemptHttp({ topicId, examFormat }),
                START_EXAM_ATTEMPT_TIMEOUT_MS,
                'Quiz preparation initialization timed out.',
            );
            const selectedQuestions = Array.isArray(result?.questions) ? result.questions : [];
            if (result?.attemptId && selectedQuestions.length > 0) {
                dispatchExamState({
                    type: 'preparationSucceeded',
                    attemptId: result.attemptId,
                    questions: selectedQuestions,
                    qualityTier: typeof result?.qualityTier === 'string' ? result.qualityTier : '',
                });
                setTimeRemaining(EXAM_DURATION_SECONDS);
                const elapsedMs = Date.now() - attemptStartTimeRef.current;
                addSentryBreadcrumb({
                    category: 'exam',
                    message: 'Exam attempt started successfully',
                    data: {
                        topicId,
                        attemptId: result?.attemptId,
                        selectedQuestionCount: selectedQuestions.length,
                        elapsedMs,
                    },
                });
                return;
            }

            dispatchExamState({
                type: 'preparationFailed',
                message: typeof result?.message === 'string' && result.message.trim()
                    ? result.message.trim()
                    : 'We could not finish preparing your quiz. Please try again.',
            });
        } catch (error) {
            const {
                message,
                nextStartExamError,
                errorCode,
                authError,
                transientTransportError,
                timedOut,
                likelyPostDisconnect,
                recoverableError,
            } = await resolveExamStartError(error);
            const elapsedMs = attemptStartTimeRef.current
                ? Date.now() - attemptStartTimeRef.current
                : null;

            if (recoverableError) {
                captureSentryMessage('Exam preparation start requires retry', {
                    level: 'warning',
                    tags: {
                        area: 'exam',
                        operation: 'start_exam_preparation',
                        recoverable: 'yes',
                        timedOut,
                        authError: authError ? 'yes' : 'no',
                        transientTransportError: transientTransportError ? 'yes' : 'no',
                        likelyPostDisconnect: likelyPostDisconnect ? 'yes' : 'no',
                        errorCode: errorCode || 'unknown',
                    },
                    extras: {
                        topicId,
                        userId,
                        elapsedMs,
                        timeoutMs: START_EXAM_ATTEMPT_TIMEOUT_MS,
                        message,
                    },
                });
            } else {
                console.error('Failed to start exam preparation:', error);
                captureSentryException(error, {
                    level: 'error',
                    tags: {
                        area: 'exam',
                        operation: 'start_exam_preparation',
                        timedOut,
                        errorCode: errorCode || 'unknown',
                    },
                    extras: {
                        topicId,
                        userId,
                        elapsedMs,
                        timeoutMs: START_EXAM_ATTEMPT_TIMEOUT_MS,
                        message,
                    },
                });
            }
            dispatchExamState({ type: 'preparationFailed', message: nextStartExamError });
        } finally {
            attemptStartTimeRef.current = null;
            dispatchExamState({ type: 'finishPreparation' });
        }
    }, [dispatchExamState, examFormat, setTimeRemaining, startExamAttemptHttp, topicId, userId]);

    const handleRetryStart = useCallback(async () => {
        await beginExamAttempt();
    }, [beginExamAttempt]);

    useEffect(() => {
        const shouldMonitorStall =
            Boolean(examFormat)
            && !examStarted
            && !startExamError
            && !hasAttemptQuestions
            && (startingExamAttempt || isPreparationRunning);

        if (!shouldMonitorStall || loadingStallReportedRef.current) {
            return;
        }

        const timer = setTimeout(() => {
            if (loadingStallReportedRef.current || examStarted) {
                return;
            }
            loadingStallReportedRef.current = true;
            const elapsedMs = Date.now() - examFlowStartTimeRef.current;
            captureSentryMessage('Exam flow stalled in loading state', {
                level: 'warning',
                tags: {
                    area: 'exam',
                    operation: 'loading_stall',
                },
                extras: {
                    topicId,
                    userId,
                    elapsedMs,
                    topicDataState: isLoadingRouteTopic ? 'loading' : isMissingRouteTopic ? 'missing' : 'ready',
                    hasAttemptQuestions,
                    attemptId,
                    startingExamAttempt,
                    preparationStatus,
                    preparationStage,
                    startExamError,
                },
            });
        }, EXAM_LOADING_STALL_TIMEOUT_MS);

        return () => clearTimeout(timer);
    }, [
        attemptId,
        examFormat,
        examStarted,
        hasAttemptQuestions,
        isLoadingRouteTopic,
        isMissingRouteTopic,
        isPreparationRunning,
        preparationStage,
        preparationStatus,
        startExamError,
        startingExamAttempt,
        topicId,
        userId,
    ]);

    useEffect(() => {
        if (!examStarted || !attemptId || Object.keys(selectedAnswers).length === 0) return;
        const handler = (event) => {
            event.preventDefault();
            event.returnValue = '';
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [attemptId, examStarted, selectedAnswers]);

    useEffect(() => {
        if (
            topicId
            && examFormat
            && userId
            && !authLoading
            && !examStarted
            && !startingExamAttempt
            && !hasAttemptQuestions
            && !startExamError
        ) {
            beginExamAttempt();
        }
    }, [
        authLoading,
        beginExamAttempt,
        examFormat,
        examStarted,
        hasAttemptQuestions,
        startExamError,
        startingExamAttempt,
        topicId,
        userId,
    ]);

    const handleAnswerSelect = useCallback((questionId, answer) => {
        dispatchExamState({ type: 'answerSelected', questionId, answer });
    }, [dispatchExamState]);

    const handleNext = useCallback(() => {
        dispatchExamState({ type: 'moveQuestion', index: currentQuestion + 1, maxIndex: questions.length - 1 });
    }, [currentQuestion, dispatchExamState, questions.length]);

    const handlePrevious = useCallback(() => {
        dispatchExamState({ type: 'moveQuestion', index: currentQuestion - 1, maxIndex: questions.length - 1 });
    }, [currentQuestion, dispatchExamState, questions.length]);

    const handleNavigateToQuestion = useCallback((index) => {
        dispatchExamState({ type: 'moveQuestion', index, maxIndex: questions.length - 1 });
    }, [dispatchExamState, questions.length]);

    const handleSubmit = useCallback(async () => {
        if (submittingRef.current) return;
        if (!attemptId) return;
        submittingRef.current = true;
        dispatchExamState({ type: 'patch', patch: { submitError: '' } });

        if (examFormat === 'essay') {
            const answeredEssayQuestions = countAnsweredQuestions(questions, selectedAnswers, examFormat);
            if (answeredEssayQuestions < questions.length) {
                dispatchExamState({
                    type: 'patch',
                    patch: { submitError: 'Please answer all essay questions before submitting.' },
                });
                submittingRef.current = false;
                return;
            }

            dispatchExamState({ type: 'patch', patch: { gradingEssay: true } });
            try {
                const answers = questions.map((question) => ({
                    questionId: question._id,
                    essayText: String(selectedAnswers[question._id] ?? ''),
                }));
                const timeTaken = EXAM_DURATION_SECONDS - timeRemaining;

                await submitEssayExam({
                    attemptId,
                    answers,
                    timeTakenSeconds: timeTaken,
                });
                navigate(`/dashboard/quiz/results/${attemptId}`);
            } catch (error) {
                const {
                    message,
                    submitError,
                    authError,
                    transientTransportError,
                    recoverableError,
                } = await resolveExamSubmitError(error, 'Could not submit essay quiz. Please try again.');
                dispatchExamState({ type: 'patch', patch: { submitError } });
                if (recoverableError) {
                    captureSentryMessage('Essay submission rejected by validation', {
                        level: 'warning',
                        tags: { area: 'exam', operation: 'submit_essay_exam' },
                        extras: {
                            topicId,
                            attemptId,
                            message,
                            authError: authError ? 'yes' : 'no',
                            transientTransportError: transientTransportError ? 'yes' : 'no',
                        },
                    });
                } else {
                    console.error('Failed to submit essay exam:', error);
                    captureSentryException(error, {
                        tags: { area: 'exam', operation: 'submit_essay_exam' },
                        extras: { topicId, attemptId, message },
                    });
                }
            } finally {
                dispatchExamState({ type: 'patch', patch: { gradingEssay: false } });
                submittingRef.current = false;
            }
            return;
        }

        const answers = attemptQuestions.map((question) => ({
            questionId: question._id,
            selectedAnswer: selectedAnswers[question._id] || '',
        }));
        const timeTaken = EXAM_DURATION_SECONDS - timeRemaining;

        try {
            await submitExam({
                attemptId,
                answers,
                timeTakenSeconds: timeTaken,
            });
            navigate(`/dashboard/quiz/results/${attemptId}`);
        } catch (error) {
            const {
                message,
                submitError,
                authError,
                transientTransportError,
            } = await resolveExamSubmitError(error, 'Failed to submit quiz. Please try again.');
            dispatchExamState({ type: 'patch', patch: { submitError } });
            if (authError || transientTransportError) {
                captureSentryMessage('Exam submission requires retry', {
                    level: 'warning',
                    tags: {
                        area: 'exam',
                        operation: 'submit_exam_attempt',
                        authError: authError ? 'yes' : 'no',
                        transientTransportError: transientTransportError ? 'yes' : 'no',
                    },
                    extras: {
                        topicId,
                        attemptId,
                        message,
                        answerCount: answers.length,
                        timeTakenSeconds: timeTaken,
                    },
                });
            } else {
                console.error('Failed to submit exam:', error);
                captureSentryException(error, {
                    tags: {
                        area: 'exam',
                        operation: 'submit_exam_attempt',
                    },
                    extras: {
                        topicId,
                        attemptId,
                        message,
                        answerCount: answers.length,
                        timeTakenSeconds: timeTaken,
                    },
                });
            }
            submittingRef.current = false;
        }
    }, [
        attemptId,
        attemptQuestions,
        dispatchExamState,
        examFormat,
        navigate,
        questions,
        selectedAnswers,
        submitEssayExam,
        submitExam,
        timeRemaining,
        topicId,
    ]);

    handleSubmitRef.current = handleSubmit;

    const answeredQuestionCount = countAnsweredQuestions(questions, selectedAnswers, examFormat);
    const progress = questions.length > 0
        ? (answeredQuestionCount / questions.length) * 100
        : 0;
    const isEssaySubmitBlocked = examFormat === 'essay' && answeredQuestionCount < questions.length;

    return {
        questions,
        hasAttemptQuestions,
        currentQuestion,
        attemptId,
        attemptQualityTier,
        activePreparationMessage,
        formattedTime,
        isLowTime,
        progress,
        answeredQuestionCount,
        isEssaySubmitBlocked,
        handleAnswerSelect,
        handleNext,
        handlePrevious,
        handleNavigateToQuestion,
        handleSubmit,
        handleRetryStart,
    };
};
