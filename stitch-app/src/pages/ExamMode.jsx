import React, { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useAction } from 'convex/react';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';
import { authBaseUrl, getSession } from '../lib/auth-client';
import { useStudyTimer } from '../hooks/useStudyTimer';
import { useExamTimer } from '../hooks/useExamTimer';
import { useRouteResolvedTopic } from '../hooks/useRouteResolvedTopic';
import { addSentryBreadcrumb, captureSentryException, captureSentryMessage } from '../lib/sentry';
import ExamQuestionCard from '../components/ExamQuestionCard';
import ExamPreparationLoader from '../components/ExamPreparationLoader';
import ExamLoadingShell from '../components/ExamLoadingShell';
import ExamFormatPicker from '../components/ExamFormatPicker';
import { EXAM_STEPS, resolveExamStep } from '../lib/resolveExamStep';
import { WatermelonTabs, WatermelonTabsList, WatermelonTabsTrigger } from '../components/watermelon/WatermelonTabs';
import { convexUrl } from '../lib/convex-config';
import { resolveQuestionOptions } from '../lib/examQuestionOptions';
import {
    getConvexErrorCode,
    isConvexAuthenticationError,
    isLikelyPostDisconnectAuthError,
    isTransientTransportError,
    resolveConvexActionError,
} from '../lib/convexClientErrors';
import AccessibleProgressBar from '../components/AccessibleProgressBar';

const EXAM_DURATION_SECONDS = 45 * 60;
const MIN_ESSAY_SUBMIT_CHAR_COUNT = 20;
const createInitialExamState = (search) => ({
    attemptId: null,
    attemptQualityTier: '',
    attemptQuestions: null,
    currentQuestion: 0,
    examFormat: resolveAutostartExamFormat(search),
    examStarted: false,
    gradingEssay: false,
    routingBootstrapPending: false,
    selectedAnswers: {},
    startExamError: '',
    startingExamAttempt: false,
    submitError: '',
});

const examModeReducer = (state, action) => {
    switch (action.type) {
        case 'answerSelected':
            return {
                ...state,
                selectedAnswers: {
                    ...state.selectedAnswers,
                    [action.questionId]: action.answer,
                },
                submitError: '',
            };
        case 'beginPreparation':
            return {
                ...state,
                attemptId: null,
                attemptQualityTier: '',
                attemptQuestions: null,
                examStarted: false,
                startExamError: '',
                startingExamAttempt: true,
                submitError: '',
            };
        case 'chooseFormat':
            return {
                ...state,
                examFormat: action.examFormat,
                startExamError: '',
            };
        case 'clearStartAndFormat':
            return {
                ...state,
                examFormat: null,
                startExamError: '',
            };
        case 'finishPreparation':
            return {
                ...state,
                startingExamAttempt: false,
            };
        case 'moveQuestion':
            return {
                ...state,
                currentQuestion: Math.min(Math.max(action.index, 0), Math.max(action.maxIndex, 0)),
            };
        case 'patch':
            return {
                ...state,
                ...action.patch,
            };
        case 'preparationFailed':
            return {
                ...state,
                attemptId: null,
                attemptQuestions: null,
                examStarted: false,
                startExamError: action.message,
            };
        case 'preparationSucceeded':
            return {
                ...state,
                attemptId: action.attemptId,
                attemptQualityTier: action.qualityTier,
                attemptQuestions: action.questions,
                currentQuestion: 0,
                examStarted: true,
                selectedAnswers: {},
                startExamError: '',
            };
        case 'resetForRoute':
            return createInitialExamState(action.search);
        default:
            return state;
    }
};

const resolveAutostartExamFormat = (search) => {
    const params = new URLSearchParams(String(search || ''));
    const raw = String(params.get('autostart') || '').trim().toLowerCase();
    if (raw === 'essay') return 'essay';
    if (raw === 'mcq' || raw === 'objective' || raw === 'quiz') return 'mcq';
    return null;
};

const getExamAuthNotReadyMessage = (sessionRefreshed = false) =>
    sessionRefreshed
        ? 'Your session has been refreshed. Tap Retry to start the quiz.'
        : 'Your session is still syncing. Please wait a few seconds and tap Retry.';

const getExamSessionExpiredMessage = () =>
    'Your session has expired. Please go back and sign in again.';

const refreshAuthSessionQuietly = async () => {
    try {
        const result = await getSession();
        const hasUser = Boolean(result?.data?.user?.id);
        return { refreshed: hasUser, expired: !hasUser };
    } catch {
        return { refreshed: false, expired: true };
    }
};

const getExamTransientStartRetryMessage = () =>
    'Connection dropped while starting the quiz. Check your internet and tap Retry.';

const getExamTransientSubmitRetryMessage = () =>
    'Connection dropped while submitting your quiz. Please retry once your connection is stable.';

const waitForDuration = (durationMs) =>
    new Promise((resolve) => {
        setTimeout(resolve, durationMs);
    });

const readCachedConvexBrowserToken = () => {
    if (typeof window === 'undefined') return '';
    try {
        const raw = window.localStorage.getItem('better-auth_cookie');
        if (!raw) return '';
        const parsed = JSON.parse(raw);
        const cachedToken = parsed?.['better-auth.convex_jwt'];
        const token = typeof cachedToken?.value === 'string' ? cachedToken.value.trim() : '';
        if (!token) return '';
        const expiresAt = Date.parse(String(cachedToken?.expires || ''));
        if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
            return '';
        }
        return token;
    } catch {
        return '';
    }
};

const fetchConvexBrowserToken = async () => {
    const cachedToken = readCachedConvexBrowserToken();
    if (cachedToken) {
        return cachedToken;
    }

    const requestToken = async (attempt = 0) => {
        try {
            await getSession().catch(() => null);
            const refreshedCachedToken = readCachedConvexBrowserToken();
            if (refreshedCachedToken) {
                return refreshedCachedToken;
            }
            const response = await fetch(`${authBaseUrl}/api/auth/convex/token`, {
                credentials: 'include',
            });
            if (!response.ok) {
                throw new Error(`Failed to fetch Convex auth token (${response.status})`);
            }
            const payload = await response.json().catch(() => null);
            const token = typeof payload?.token === 'string' ? payload.token.trim() : '';
            if (!token) {
                throw new Error('Session is still syncing.');
            }
            return token;
        } catch (error) {
            if (attempt >= 5) {
                throw error instanceof Error
                    ? error
                    : new Error('Session is still syncing.');
            }
            await waitForDuration(500 * (attempt + 1));
            return requestToken(attempt + 1);
        }
    };

    return requestToken();
};

const isRecoverableExamSubmitError = ({ error, message }) => {
    if (isUserCorrectableEssaySubmitError(message)) return true;
    if (isConvexAuthenticationError(error)) return true;
    if (isTransientTransportError(error, message)) return true;
    return false;
};

const isUserCorrectableEssaySubmitError = (message) => {
    const normalized = String(message || '').toLowerCase();
    if (!normalized) return false;
    return (
        normalized.includes('restart the quiz') ||
        normalized.includes('essay mode') ||
        normalized.includes('could not grade your essay right now') ||
        normalized.includes('duplicate questions') ||
        normalized.includes('at least one question') ||
        normalized.includes('answer all essay questions')
    );
};

// ── Component ──

// react-doctor-disable-next-line react-doctor/no-giant-component
const ExamMode = () => {
    const { topicId: topicIdParam } = useParams();
    const routeTopicId = typeof topicIdParam === 'string' ? topicIdParam.trim() : '';
    const routerLocation = useLocation();
    const navigate = useNavigate();
    const { user, loading: authLoading } = useAuth();

    const [examState, dispatchExamState] = useReducer(
        examModeReducer,
        routerLocation.search,
        createInitialExamState,
    );
    const {
        attemptId,
        attemptQualityTier,
        attemptQuestions,
        currentQuestion,
        examFormat,
        examStarted,
        gradingEssay,
        routingBootstrapPending,
        selectedAnswers,
        startExamError,
        startingExamAttempt,
        submitError,
    } = examState;
    const invalidRouteReportedRef = useRef('');


    // Get userId from Better Auth session
    const userId = user?.id;
    useStudyTimer(userId);

    // Convex queries and mutations
    const reloadDashboard = useCallback(() => {
        if (typeof window !== 'undefined') {
            window.location.assign('/dashboard');
            return;
        }
        navigate('/dashboard', { replace: true });
    }, [navigate]);
    const topicQueryResult = useQuery(
        api.topics.getTopicWithQuestions,
        routeTopicId ? { topicId: routeTopicId } : 'skip'
    );
    const {
        topic,
        topicId,
        rawTopicId,
        hasMismatchedCachedTopic,
        isLoadingRouteTopic,
        isMissingRouteTopic,
    } = useRouteResolvedTopic(routeTopicId, topicQueryResult);
    const hasFinalAssessmentRoutingContext = Boolean(topic?.courseId && topic?.sourceUploadId);
    const routedFinalAssessmentTopic = useQuery(
        api.topics.getFinalAssessmentTopicByCourseAndUpload,
        hasFinalAssessmentRoutingContext
            ? { courseId: topic.courseId, sourceUploadId: topic.sourceUploadId }
            : 'skip'
    );
    const ensureAssessmentRoutingForTopic = useAction(api.ai.ensureAssessmentRoutingForTopic);
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

    const START_EXAM_ATTEMPT_TIMEOUT_MS = 240_000;
    const EXAM_LOADING_STALL_TIMEOUT_MS = 270_000;

    const loadingExamTypeLabel = examFormat === 'essay' ? 'essay' : 'objective';
    const activePreparationMessage = `Generating your ${loadingExamTypeLabel} quiz from this topic.`;
    const preparationStatus = startExamError ? 'failed' : startingExamAttempt ? 'preparing' : '';
    const preparationStage = startingExamAttempt ? 'generating_candidates' : 'queued';
    const isPreparationRunning = startingExamAttempt;
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
    const routingBootstrapKeyRef = useRef('');
    // Optimized timer: only re-renders when the displayed second changes
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

    useEffect(() => {
        examFlowStartTimeRef.current = Date.now();
        attemptStartTimeRef.current = null;
        loadingStallReportedRef.current = false;
        routingBootstrapKeyRef.current = '';
        dispatchExamState({ type: 'resetForRoute', search: routerLocation.search });
    }, [
        routeTopicId,
        routerLocation.search,
    ]);

    useEffect(() => {
        if (!topicId || !topic?.courseId || !topic?.sourceUploadId) {
            return;
        }

        const needsRoutingBootstrap = (
            !topic?.assessmentRoute
            || !topic?.assessmentClassification
            || (
                topic?.topicKind !== 'document_final_exam'
                && routedFinalAssessmentTopic === null
            )
        );

        if (!needsRoutingBootstrap) {
            return;
        }

        const bootstrapKey = `${topicId}:${topic.sourceUploadId}`;
        if (routingBootstrapKeyRef.current === bootstrapKey) {
            return;
        }

        routingBootstrapKeyRef.current = bootstrapKey;
        dispatchExamState({ type: 'patch', patch: { routingBootstrapPending: true } });

        ensureAssessmentRoutingForTopic({ topicId })
            .catch((error) => {
                console.warn('Failed to bootstrap assessment routing for exam topic', error);
            })
            .finally(() => {
                dispatchExamState({ type: 'patch', patch: { routingBootstrapPending: false } });
            });
    }, [
        hasFinalAssessmentRoutingContext,
        ensureAssessmentRoutingForTopic,
        routedFinalAssessmentTopic,
        topic?.assessmentClassification,
        topic?.assessmentRoute,
        topic?.courseId,
        topic?.sourceUploadId,
        topic?.topicKind,
        topicId,
    ]);

    useEffect(() => {
        if (!routeTopicId || !isMissingRouteTopic) return;
        if (invalidRouteReportedRef.current === routeTopicId) return;
        invalidRouteReportedRef.current = routeTopicId;
        captureSentryMessage('Stale exam topic route encountered', {
            level: 'warning',
            tags: {
                area: 'exam_route',
                page: 'exam_mode',
            },
            extras: {
                routeTopicId,
                rawTopicId,
                hasMismatchedCachedTopic,
                pathname: routerLocation.pathname,
                referrer: typeof document !== 'undefined' ? document.referrer || '' : '',
            },
        });
    }, [hasMismatchedCachedTopic, isMissingRouteTopic, routerLocation.pathname, rawTopicId, routeTopicId]);

    const shouldRedirectToFinalExam = (
        topic?.topicKind !== 'document_final_exam'
        && topic?.assessmentRoute
        && topic.assessmentRoute !== 'topic_quiz'
    );

    useEffect(() => {
        if (!shouldRedirectToFinalExam) return;
        if (!routedFinalAssessmentTopic?._id) return;
        if (routedFinalAssessmentTopic._id === topicId) return;
        navigate(`/dashboard/quiz/${routedFinalAssessmentTopic._id}${routerLocation.search || ''}`, { replace: true });
    }, [routerLocation.search, navigate, routedFinalAssessmentTopic?._id, shouldRedirectToFinalExam, topicId]);

    const withTimeout = useCallback((promise, timeoutMs, timeoutMessage) => {
        let timeoutHandle;
        const timeoutPromise = new Promise((_, reject) => {
            timeoutHandle = setTimeout(() => {
                reject(new Error(timeoutMessage));
            }, timeoutMs);
        });

        return Promise.race([promise, timeoutPromise]).finally(() => {
            if (timeoutHandle) {
                clearTimeout(timeoutHandle);
            }
        });
    }, []);

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
                'Quiz preparation initialization timed out.'
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
            const errorCode = getConvexErrorCode(error);
            const message = resolveConvexActionError(error, 'Unable to start the quiz. Please try again.');
            const authError = isConvexAuthenticationError(error);
            const transientTransportError = isTransientTransportError(error, message);
            const timedOut = /timed out/i.test(message);
            const elapsedMs = attemptStartTimeRef.current
                ? Date.now() - attemptStartTimeRef.current
                : null;
            let nextStartExamError = 'Unable to start the quiz. Please try again.';
            if (authError) {
                const { refreshed, expired } = await refreshAuthSessionQuietly();
                if (expired) {
                    nextStartExamError = getExamSessionExpiredMessage();
                } else {
                    nextStartExamError = getExamAuthNotReadyMessage(refreshed);
                }
            } else if (transientTransportError) {
                nextStartExamError = getExamTransientStartRetryMessage();
            } else if (timedOut) {
                nextStartExamError = 'Quiz setup is taking longer than expected. Tap Retry.';
            } else if (isLikelyPostDisconnectAuthError(error)) {
                const { refreshed, expired } = await refreshAuthSessionQuietly();
                if (expired) {
                    nextStartExamError = getExamSessionExpiredMessage();
                } else if (refreshed) {
                    nextStartExamError = getExamAuthNotReadyMessage(true);
                } else {
                    nextStartExamError = 'Something went wrong. Please wait a moment and tap Retry.';
                }
            }
            const likelyPostDisconnect = isLikelyPostDisconnectAuthError(error);
            const recoverableError = timedOut || authError || transientTransportError || likelyPostDisconnect;
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
    }, [examFormat, startExamAttemptHttp, topicId, userId, withTimeout, START_EXAM_ATTEMPT_TIMEOUT_MS, setTimeRemaining]);

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
        isPreparationRunning,
        startExamError,
        startingExamAttempt,
        preparationStage,
        preparationStatus,
        isLoadingRouteTopic,
        isMissingRouteTopic,
        topicId,
        userId,
    ]);

    // Warn before leaving mid-quiz
    useEffect(() => {
        if (!examStarted || !attemptId || Object.keys(selectedAnswers).length === 0) return;
        const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [examStarted, attemptId, selectedAnswers]);

    // Start exam only after the user chooses a format.
    useEffect(() => {
        if (
            topicId &&
            examFormat &&
            userId &&
            !authLoading &&
            !examStarted &&
            !startingExamAttempt &&
            !hasAttemptQuestions &&
            !startExamError
        ) {
            beginExamAttempt();
        }
    }, [
        topicId,
        examFormat,
        userId,
        authLoading,
        examStarted,
        startingExamAttempt,
        hasAttemptQuestions,
        startExamError,
        beginExamAttempt,
    ]);

    // Timer managed by useExamTimer hook above

    const handleAnswerSelect = useCallback((questionId, answer) => {
        dispatchExamState({ type: 'answerSelected', questionId, answer });
    }, []);

    const handleNext = useCallback(() => {
        dispatchExamState({ type: 'moveQuestion', index: currentQuestion + 1, maxIndex: questions.length - 1 });
    }, [currentQuestion, questions.length]);

    const handlePrevious = useCallback(() => {
        dispatchExamState({ type: 'moveQuestion', index: currentQuestion - 1, maxIndex: questions.length - 1 });
    }, [currentQuestion, questions.length]);

    const handleSubmit = useCallback(async () => {
        if (submittingRef.current) return;
        if (!attemptId) return;
        submittingRef.current = true;
        dispatchExamState({ type: 'patch', patch: { submitError: '' } });

        if (examFormat === 'essay') {
            const answeredEssayQuestions = questions.filter((question) => {
                const value = selectedAnswers[question._id];
                return String(value ?? '').trim().length >= MIN_ESSAY_SUBMIT_CHAR_COUNT;
            }).length;
            if (answeredEssayQuestions < questions.length) {
                dispatchExamState({ type: 'patch', patch: { submitError: 'Please answer all essay questions before submitting.' } });
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
                const message = resolveConvexActionError(
                    error,
                    'Could not submit essay quiz. Please try again.'
                );
                const authError = isConvexAuthenticationError(error) || isLikelyPostDisconnectAuthError(error);
                const transientTransportError = isTransientTransportError(error, message);
                if (authError) {
                    const { refreshed, expired } = await refreshAuthSessionQuietly();
                    dispatchExamState({
                        type: 'patch',
                        patch: {
                            submitError: expired
                                ? getExamSessionExpiredMessage()
                                : getExamAuthNotReadyMessage(refreshed),
                        },
                    });
                } else if (transientTransportError) {
                    dispatchExamState({ type: 'patch', patch: { submitError: getExamTransientSubmitRetryMessage() } });
                } else {
                    dispatchExamState({ type: 'patch', patch: { submitError: message } });
                }
                const recoverableError = isRecoverableExamSubmitError({ error, message });
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

        const answers = attemptQuestions.map((q) => ({
            questionId: q._id,
            selectedAnswer: selectedAnswers[q._id] || '',
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
            const message = resolveConvexActionError(error, 'Failed to submit quiz. Please try again.');
            const authError = isConvexAuthenticationError(error) || isLikelyPostDisconnectAuthError(error);
            const transientTransportError = isTransientTransportError(error, message);
            if (authError) {
                const { refreshed, expired } = await refreshAuthSessionQuietly();
                dispatchExamState({
                    type: 'patch',
                    patch: {
                        submitError: expired
                            ? getExamSessionExpiredMessage()
                            : getExamAuthNotReadyMessage(refreshed),
                    },
                });
            } else if (transientTransportError) {
                dispatchExamState({ type: 'patch', patch: { submitError: getExamTransientSubmitRetryMessage() } });
            } else {
                dispatchExamState({ type: 'patch', patch: { submitError: message } });
            }
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
    }, [attemptId, attemptQuestions, questions, selectedAnswers, examFormat, timeRemaining, topicId, navigate, submitExam, submitEssayExam]);
    handleSubmitRef.current = handleSubmit;

    const currentQ = questions[currentQuestion];
    const answeredQuestionCount = examFormat === 'essay'
        ? questions.filter((question) => {
            const value = selectedAnswers[question._id];
            return String(value ?? '').trim().length >= MIN_ESSAY_SUBMIT_CHAR_COUNT;
        }).length
        : questions.filter((question) => Boolean(selectedAnswers[question._id])).length;
    const progress = questions.length > 0
        ? (answeredQuestionCount / questions.length) * 100
        : 0;
    const isEssaySubmitBlocked = examFormat === 'essay' && answeredQuestionCount < questions.length;
    const examQualityTier = attemptQualityTier;

    // Keep hook order stable across loading/error/exam states.
    // For fill_blank questions, build options from the tokens word bank.
    const finalOptions = useMemo(() => {
        const fromOptions = resolveQuestionOptions(currentQ?.options);
        if (fromOptions.length > 0) return fromOptions;
        // Fill-in-the-blank: convert tokens array into selectable options
        if (Array.isArray(currentQ?.tokens) && currentQ.tokens.length > 0) {
            return currentQ.tokens.map((token, i) => ({
                label: String.fromCharCode(65 + i),
                value: token,
                text: token,
            }));
        }
        return fromOptions;
    }, [currentQ?.options, currentQ?.tokens]);


    const examStep = resolveExamStep({
        routeTopicId,
        isLoadingRouteTopic,
        isMissingRouteTopic,
        shouldRedirectToFinalExam,
        routedFinalAssessmentTopic,
        topicId,
        routingBootstrapPending,
        examFormat,
        examStarted,
        startingExamAttempt,
        hasAttemptQuestions,
        attemptId,
        questionCount: questions.length,
    });

    if (examStep === EXAM_STEPS.MISSING_TOPIC) {
        return (
            <ExamLoadingShell
                variant="status"
                icon="quiz"
                title="Select a topic to start a quiz"
                message="Go back to your dashboard and choose a topic to begin."
                action={{ type: 'link', to: '/dashboard', label: 'Back to Dashboard' }}
            />
        );
    }

    if (examStep === EXAM_STEPS.LOADING_TOPIC) {
        return (
            <ExamLoadingShell
                variant="loading"
                message="Preparing your quiz environment…"
            />
        );
    }

    if (examStep === EXAM_STEPS.STALE_LINK) {
        return (
            <ExamLoadingShell
                variant="status"
                icon="search_off"
                title="This quiz link is stale"
                message="Reload the dashboard, reopen the topic, and start the quiz from there."
                action={{ type: 'button', onClick: reloadDashboard, label: 'Reload Dashboard' }}
            />
        );
    }

    if (examStep === EXAM_STEPS.FINAL_EXAM_LOADING) {
        return (
            <ExamLoadingShell
                variant="loading"
                message="Preparing your final quiz…"
            />
        );
    }

    if (examStep === EXAM_STEPS.ROUTING_BOOTSTRAP) {
        return (
            <ExamLoadingShell
                variant="loading"
                message="Preparing the best assessment route for this topic…"
            />
        );
    }

    if (examStep === EXAM_STEPS.FINAL_EXAM_REDIRECT) {
        return (
            <ExamLoadingShell
                variant="loading"
                message="Redirecting to your final quiz…"
            />
        );
    }

    if (examStep === EXAM_STEPS.FINAL_EXAM_UNAVAILABLE) {
        return (
            <ExamLoadingShell
                variant="status"
                icon="hourglass_top"
                title="This topic is covered in the final quiz"
                message="The final quiz is still being prepared. Return to the course and try again in a moment."
                action={{ type: 'link', to: `/dashboard/topic/${topicId}`, label: 'Back to Topic' }}
            />
        );
    }

    if (examStep === EXAM_STEPS.CHOOSE_FORMAT) {
        return (
            <ExamFormatPicker
                onChooseFormat={(nextExamFormat) => {
                    dispatchExamState({ type: 'chooseFormat', examFormat: nextExamFormat });
                }}
            />
        );
    }

    if (examStep === EXAM_STEPS.PREPARATION) {
        return (
            <ExamPreparationLoader
                examFormat={examFormat}
                subtitle={activePreparationMessage}
                failed={Boolean(startExamError)}
                errorMsg={startExamError}
                onRetry={handleRetryStart}
                onBack={() => dispatchExamState({ type: 'clearStartAndFormat' })}
                isSessionExpired={startExamError === getExamSessionExpiredMessage()}
            />
        );
    }

    return (
        <div className="min-h-screen cp-theme bg-[#FAF8F3] flex flex-col md:flex-row">
            {/* Essay grading overlay */}
            {gradingEssay && (
                <div className="fixed inset-0 z-50 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="card-base p-8 text-center max-w-sm w-full">
                        <div className="size-16 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center animate-pulse">
                            <span className="material-symbols-outlined text-3xl text-primary">psychology</span>
                        </div>
                        <h3 className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark mb-2">Grading Your Answers</h3>
                        <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark">Our AI is reading and evaluating each of your responses. This may take a moment…</p>
                        <div className="mt-6 w-full h-1 bg-border-light dark:bg-border-dark rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full animate-[pulse_1.5s_ease-in-out_infinite]" style={{ width: '70%' }}></div>
                        </div>
                    </div>
                </div>
            )}
            {/* Main Content Area */}
            <main className="flex-1 flex flex-col min-h-screen">
                {/* Header */}
                <header className="sticky top-0 z-40 bg-surface-light/90 dark:bg-surface-dark/90 backdrop-blur-md border-b border-border-light dark:border-border-dark">
                    <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Link
                                to={topicId ? `/dashboard/topic/${topicId}` : '/dashboard'}
                                className="btn-icon size-9"
                                aria-label="Close quiz and return to topic"
                            >
                                <span className="material-symbols-outlined text-lg">close</span>
                            </Link>
                            <div>
                                <h1 className="text-body-base font-semibold text-text-main-light dark:text-text-main-dark">Exam</h1>
                                <p className="text-caption text-text-faint-light dark:text-text-faint-dark truncate max-w-[120px] sm:max-w-xs">{topic?.title}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-body-sm text-text-sub-light dark:text-text-sub-dark">
                                {currentQuestion + 1} <span className="text-text-faint-light dark:text-text-faint-dark">/ {questions.length}</span>
                            </span>
                            <div
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono font-semibold text-body-sm ${isLowTime ? 'bg-error-soft dark:bg-red-950/30 text-error dark:text-red-400' : 'bg-surface-hover-light dark:bg-surface-hover-dark text-text-main-light dark:text-text-main-dark'}`}
                                role="status"
                                aria-live="polite"
                                aria-label={`Time remaining, ${formattedTime}`}
                            >
                                <span className="material-symbols-outlined text-[16px]">timer</span>
                                {formattedTime}
                            </div>
                        </div>
                    </div>
                    {/* Progress bar */}
                    <AccessibleProgressBar
                        value={progress}
                        label="Quiz progress"
                        valueText={`${answeredQuestionCount} of ${questions.length} questions answered`}
                        trackClassName="h-1.5 bg-border-light dark:bg-border-dark"
                        barClassName="h-full bg-primary transition-all duration-300"
                    />
                </header>

                {/* Question Content */}
                <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 pb-32">
                    {startExamError && (
                        <div className="mb-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30">
                            <p className="text-body-sm text-amber-800 dark:text-amber-300">{startExamError}</p>
                        </div>
                    )}
                    {submitError && (
                        <div className="mb-4 p-3 rounded-xl bg-error-soft dark:bg-red-950/25 border border-error/20 dark:border-red-900/35">
                            <p className="text-body-sm text-error dark:text-red-300">
                                {submitError}
                                {submitError === getExamSessionExpiredMessage() && (
                                    <Link to="/login" className="ml-2 font-semibold underline">Sign in</Link>
                                )}
                            </p>
                        </div>
                    )}
                    {examQualityTier === 'premium' && (
                        <div className="mb-4 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30">
                            <p className="text-body-sm text-blue-800 dark:text-blue-300">Premium quiz ready. This set met the higher university-level quality targets.</p>
                        </div>
                    )}
                    <ExamQuestionCard
                        question={currentQ}
                        questionIndex={currentQuestion}
                        totalQuestions={questions.length}
                        examFormat={examFormat}
                        selectedAnswer={selectedAnswers[currentQ?._id]}
                        finalOptions={finalOptions}
                        onAnswerSelect={handleAnswerSelect}
                        onPrevious={handlePrevious}
                        onNext={handleNext}
                        onSubmit={handleSubmit}
                        attemptId={attemptId}
                        isEssaySubmitBlocked={isEssaySubmitBlocked}
                        submitError={submitError}
                        startExamError={startExamError}
                        sessionExpiredMessage={getExamSessionExpiredMessage()}
                    />

                    {/* Question Navigator - Mobile Only */}
                    <div className="md:hidden card-base p-4">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-body-sm text-text-sub-light dark:text-text-sub-dark">Question Navigator</span>
                            <span className="text-caption text-text-faint-light dark:text-text-faint-dark">{answeredQuestionCount} of {questions.length} answered</span>
                        </div>
                        <WatermelonTabs
                            defaultValue={String(currentQuestion)}
                            value={String(currentQuestion)}
                            onValueChange={(v) => dispatchExamState({ type: 'moveQuestion', index: Number(v), maxIndex: questions.length - 1 })}
                        >
                            <WatermelonTabsList className="flex-wrap gap-1">
                                {questions.map((q, index) => {
                                    const isAnswered = examFormat === 'essay'
                                        ? String(selectedAnswers[q._id] ?? '').trim().length >= MIN_ESSAY_SUBMIT_CHAR_COUNT
                                        : Boolean(selectedAnswers[q._id]);
                                    return (
                                        <WatermelonTabsTrigger
                                            key={q._id}
                                            value={String(index)}
                                            className={`size-9 !flex-none !px-0 !py-0 text-center ${isAnswered ? '!text-success dark:!text-emerald-400' : ''}`}
                                        >
                                            {index + 1}
                                        </WatermelonTabsTrigger>
                                    );
                                })}
                            </WatermelonTabsList>
                        </WatermelonTabs>
                    </div>
                </div>

                {/* Bottom Navigation */}
                <div className="fixed bottom-0 inset-x-0 z-50 md:hidden bg-surface-light dark:bg-surface-dark border-t border-border-light dark:border-border-dark p-4 safe-area-bottom">
                    <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
                        <button
                            onClick={handlePrevious}
                            disabled={currentQuestion === 0}
                            className="btn-ghost px-4 py-2.5 flex items-center gap-1 disabled:opacity-30"
                        >
                            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                            <span className="hidden sm:inline text-body-sm">Prev</span>
                        </button>

                        <div className="flex-1 text-center">
                            <span className="text-body-sm text-text-sub-light dark:text-text-sub-dark">
                                {answeredQuestionCount} <span className="text-text-faint-light dark:text-text-faint-dark">/ {questions.length}</span> answered
                            </span>
                        </div>

                        {currentQuestion === questions.length - 1 ? (
                            <button
                                onClick={handleSubmit}
                                disabled={!attemptId || isEssaySubmitBlocked}
                                className="btn-primary px-6 py-2.5 flex items-center gap-1 disabled:opacity-60"
                            >
                                <span>Submit</span>
                                <span className="material-symbols-outlined text-[18px]">check</span>
                            </button>
                        ) : (
                            <button
                                onClick={handleNext}
                                className="btn-primary px-6 py-2.5 flex items-center gap-1"
                            >
                                <span>Next</span>
                                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                            </button>
                        )}
                    </div>
                </div>
            </main>

            {/* Sidebar - Desktop Only */}
            <aside className="hidden md:flex w-72 bg-surface-light dark:bg-surface-dark border-l border-border-light dark:border-border-dark flex-col h-screen sticky top-0">
                <div className="p-5 flex-1 overflow-y-auto">
                    {/* Timer */}
                    <div className="card-base p-5 text-center mb-5">
                        <span className="text-overline text-text-faint-light dark:text-text-faint-dark block mb-2">Time Remaining</span>
                        <div
                            className={`text-display-lg font-mono tabular-nums ${isLowTime ? 'text-error' : 'text-text-main-light dark:text-text-main-dark'}`}
                            role="status"
                            aria-live="polite"
                            aria-label={`Time remaining, ${formattedTime}`}
                        >
                            {formattedTime}
                        </div>
                        {isLowTime && (
                            <p className="text-caption text-error mt-1">Less than 5 minutes!</p>
                        )}
                    </div>

                    {/* Progress */}
                    <div className="mb-5">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-body-sm text-text-sub-light dark:text-text-sub-dark">Answered</span>
                            <span className="text-body-sm font-semibold text-primary">{Math.round(progress)}%</span>
                        </div>
                        <AccessibleProgressBar
                            value={progress}
                            label="Answered progress"
                            valueText={`${answeredQuestionCount} of ${questions.length} questions answered`}
                            trackClassName="w-full bg-border-light dark:bg-border-dark rounded-full h-1.5"
                            barClassName="bg-primary h-full rounded-full transition-all duration-300"
                        />
                    </div>

                    {/* Question Navigation Tabs */}
                    <div className="mb-5">
                        <span className="text-overline text-text-faint-light dark:text-text-faint-dark block mb-3">Questions</span>
                        <WatermelonTabs
                            defaultValue={String(currentQuestion)}
                            value={String(currentQuestion)}
                            onValueChange={(v) => dispatchExamState({ type: 'moveQuestion', index: Number(v), maxIndex: questions.length - 1 })}
                        >
                            <WatermelonTabsList className="flex-wrap gap-1">
                                {questions.map((q, index) => {
                                    const isAnswered = examFormat === 'essay'
                                        ? String(selectedAnswers[q._id] ?? '').trim().length >= MIN_ESSAY_SUBMIT_CHAR_COUNT
                                        : Boolean(selectedAnswers[q._id]);
                                    return (
                                        <WatermelonTabsTrigger
                                            key={q._id}
                                            value={String(index)}
                                            className={`size-9 !flex-none !px-0 !py-0 text-center ${isAnswered ? '!text-success dark:!text-emerald-400' : ''}`}
                                        >
                                            {index + 1}
                                        </WatermelonTabsTrigger>
                                    );
                                })}
                            </WatermelonTabsList>
                        </WatermelonTabs>
                    </div>
                </div>

                {/* Submit Button */}
                <div className="p-5 border-t border-border-light dark:border-border-dark">
                    <button
                        onClick={handleSubmit}
                        disabled={!attemptId || isEssaySubmitBlocked}
                        className="w-full btn-primary py-3 disabled:opacity-60"
                    >
                        Submit Quiz
                    </button>
                </div>
            </aside>
        </div>
    );
};

export default ExamMode;
