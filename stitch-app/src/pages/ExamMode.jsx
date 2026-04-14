import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';
import { getSession } from '../lib/auth-client';
import { useStudyTimer } from '../hooks/useStudyTimer';
import { useExamTimer } from '../hooks/useExamTimer';
import { useRouteResolvedTopic } from '../hooks/useRouteResolvedTopic';
import { addSentryBreadcrumb, captureSentryException, captureSentryMessage } from '../lib/sentry';
import ExamQuestionCard from '../components/ExamQuestionCard';
import ExamPreparationLoader from '../components/ExamPreparationLoader';

// ── Pure option-parsing helpers (hoisted out of the component) ──

const safeJsonParse = (value) => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) {
        return null;
    }
    try {
        return JSON.parse(trimmed);
    } catch {
        return null;
    }
};

const normalizeOptionString = (value) => {
    if (typeof value !== 'string') return value;
    return value
        .replace(/\\"/g, '"')
        .replace(/\\n/g, '\n')
        .replace(/^"+|"+$/g, '')
        .trim();
};

const cleanOptionText = (value) => {
    if (value === null || value === undefined) return '';
    let text = typeof value === 'string' ? normalizeOptionString(value) : String(value);
    if (!text) return '';

    const parsed = safeJsonParse(text);
    if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed)) return '';
        if (typeof parsed.text === 'string') return normalizeOptionString(parsed.text);
        return '';
    }

    const textMatch = text.match(/"text"\s*:\s*"([^"]+)"/);
    if (textMatch) return textMatch[1];

    if (/"label"\s*:\s*"/.test(text) || /"isCorrect"\s*:/.test(text)) return '';

    return text;
};

const extractOptionsFromText = (text) => {
    if (typeof text !== 'string') return null;
    const cleaned = normalizeOptionString(text);
    const labelMatches = [...cleaned.matchAll(/"label"\s*:\s*"([^"]+)"/g)];
    const textMatches = [...cleaned.matchAll(/"text"\s*:\s*"([^"]+)"/g)];
    if (textMatches.length === 0) return null;
    return textMatches.map((match, index) => ({
        label: labelMatches[index]?.[1] ?? String.fromCharCode(65 + index),
        text: match[1],
    }));
};

const tryReconstructOptions = (stringOptions) => {
    if (!Array.isArray(stringOptions) || stringOptions.length === 0) return null;
    const joined = stringOptions.map(normalizeOptionString).join(',');
    const cleanedCandidates = [joined, normalizeOptionString(joined)];

    for (const candidate of cleanedCandidates) {
        const parsed = safeJsonParse(candidate);
        if (Array.isArray(parsed)) return parsed;
        if (parsed && Array.isArray(parsed.options)) return parsed.options;
    }

    for (const candidate of cleanedCandidates) {
        const wrapped = candidate.trim().startsWith('[') ? candidate : `[${candidate}]`;
        const parsed = safeJsonParse(wrapped);
        if (Array.isArray(parsed)) return parsed;
        if (parsed && Array.isArray(parsed.options)) return parsed.options;
    }

    return extractOptionsFromText(joined) || null;
};

const reconstructFromFragments = (stringOptions) => {
    if (!Array.isArray(stringOptions) || stringOptions.length === 0) return null;

    const reconstructed = [];
    let current = null;

    for (const fragment of stringOptions) {
        const cleaned = normalizeOptionString(fragment);
        const labelMatch = cleaned.match(/"label"\s*:\s*"([^"]+)"/);
        const textMatch = cleaned.match(/"text"\s*:\s*"([^"]+)"/);
        const correctMatch = cleaned.match(/"isCorrect"\s*:\s*(true|false)/);

        if (labelMatch) {
            if (current && current.text) reconstructed.push(current);
            current = { label: labelMatch[1] };
        }

        if (textMatch) {
            if (!current) current = { label: String.fromCharCode(65 + reconstructed.length) };
            current.text = textMatch[1];
        }

        if (correctMatch) {
            if (!current) current = { label: String.fromCharCode(65 + reconstructed.length) };
            current.isCorrect = correctMatch[1] === 'true';
        }

        if (current && current.label && current.text && correctMatch) {
            reconstructed.push(current);
            current = null;
        }
    }

    if (current && current.text) reconstructed.push(current);

    return reconstructed.length > 0 ? reconstructed : null;
};

const coerceOptions = (rawOptions) => {
    if (!rawOptions) return [];

    let options = rawOptions;
    if (typeof options === 'string') {
        const parsed = safeJsonParse(options);
        options = parsed ?? options;
    }

    if (options && !Array.isArray(options) && typeof options === 'object') {
        if (Array.isArray(options.options)) options = options.options;
    }

    if (!Array.isArray(options)) options = [options];

    const flattened = [];
    for (const option of options) {
        if (typeof option === 'string') {
            const parsed = safeJsonParse(option);
            if (Array.isArray(parsed)) { flattened.push(...parsed); continue; }
            if (parsed) { flattened.push(parsed); continue; }
        }
        flattened.push(option);
    }

    const cleaned = flattened.filter((option) => option !== null && option !== undefined);
    if (cleaned.length > 0 && cleaned.every((option) => typeof option === 'string')) {
        const fromFragments = reconstructFromFragments(cleaned);
        if (fromFragments && fromFragments.length > 0) return fromFragments;
        const reconstructed = tryReconstructOptions(cleaned);
        if (reconstructed && reconstructed.length > 0) return reconstructed;
        const extracted = extractOptionsFromText(cleaned.join(','));
        if (extracted && extracted.length > 0) return extracted;
    }

    return cleaned;
};

const normalizeOption = (option, index) => {
    if (option && typeof option === 'object') {
        const label = option.label ?? String.fromCharCode(65 + index);
        const text = cleanOptionText(option.text ?? option.value ?? '');
        if (!text) return null;
        return { label, value: String(label), text };
    }
    let label = String.fromCharCode(65 + index);
    let text = cleanOptionText(option ?? '');
    const labelMatch = typeof text === 'string' ? text.match(/"label"\s*:\s*"([^"]+)"/) : null;
    const textMatch = typeof text === 'string' ? text.match(/"text"\s*:\s*"([^"]+)"/) : null;
    if (labelMatch) label = labelMatch[1];
    if (textMatch) {
        text = textMatch[1];
    } else if (labelMatch) {
        text = '';
    } else if (typeof text === 'string' && /"isCorrect"\s*:/.test(text)) {
        text = '';
    }
    if (!text) return null;
    return { label, value: label, text };
};

const buildFallbackOptionsFromRaw = (rawOptions) => {
    try {
        const rawString = typeof rawOptions === 'string'
            ? rawOptions
            : JSON.stringify(rawOptions ?? '');
        const cleaned = normalizeOptionString(rawString);
        const matches = [...cleaned.matchAll(/"text"\s*:\s*"([^"]+)"/g)];
        if (matches.length === 0) return [];
        return matches.map((match, index) => ({
            label: String.fromCharCode(65 + index),
            value: String.fromCharCode(65 + index),
            text: match[1],
        }));
    } catch {
        return [];
    }
};

const resolveQuestionOptions = (rawOptions) => {
    const options = coerceOptions(rawOptions);
    const renderOptions = options.map((o, i) => normalizeOption(o, i)).filter(Boolean);
    const hasRawArtifacts = renderOptions.some((o) => {
        if (typeof o.text !== 'string') return false;
        return (
            o.text.includes('"label"')
            || o.text.includes('{"label"')
            || o.text.includes('\\"label\\"')
            || o.text.includes('\\"isCorrect\\"')
        );
    });
    const fallbackOptions = buildFallbackOptionsFromRaw(rawOptions);
    return renderOptions.length === 0 || hasRawArtifacts
        ? (fallbackOptions.length > 0 ? fallbackOptions : renderOptions)
        : renderOptions;
};

const CONVEX_ERROR_WRAPPER_PATTERN = /\[CONVEX [^\]]+\]\s*\[Request ID:[^\]]+\]\s*/i;
const TRANSIENT_TRANSPORT_ERROR_PATTERNS = [
    'load failed',
    'failed to fetch',
    'networkerror',
    'network request failed',
    'connection lost',
    'connection reset',
    'timed out',
    'timeout',
    'fetch failed',
    'inactive server',
];
const EXAM_DURATION_SECONDS = 45 * 60;
const MIN_ESSAY_SUBMIT_CHAR_COUNT = 20;
const resolveAutostartExamFormat = (search) => {
    const params = new URLSearchParams(String(search || ''));
    const raw = String(params.get('autostart') || '').trim().toLowerCase();
    if (raw === 'essay') return 'essay';
    if (raw === 'mcq' || raw === 'objective' || raw === 'quiz') return 'mcq';
    return null;
};

const resolveConvexActionError = (error, fallbackMessage) => {
    const dataMessage = typeof error?.data === 'string'
        ? error.data
        : typeof error?.data?.message === 'string'
            ? error.data.message
            : '';
    const resolved = String(dataMessage || error?.message || fallbackMessage || '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!resolved) return fallbackMessage;

    const unwrapped = resolved
        .replace(CONVEX_ERROR_WRAPPER_PATTERN, '')
        .replace(/^Uncaught (ConvexError|Error):\s*/i, '')
        .replace(/^ConvexError:\s*/i, '')
        .replace(/^Server Error\s*/i, '')
        .replace(/Called by client$/i, '')
        .trim();

    return unwrapped || fallbackMessage;
};

const getConvexErrorCode = (error) => {
    if (typeof error?.data?.code === 'string' && error.data.code.trim()) {
        return error.data.code.trim().toUpperCase();
    }
    const normalizedMessage = resolveConvexActionError(error, '').toLowerCase();
    if (!normalizedMessage) return '';
    if (normalizedMessage.includes('exam_questions_preparing')) return 'EXAM_QUESTIONS_PREPARING';
    if (normalizedMessage.includes('essay_questions_preparing')) return 'ESSAY_QUESTIONS_PREPARING';
    if (
        normalizedMessage.includes('must be signed in')
        || normalizedMessage.includes('not authenticated')
        || normalizedMessage.includes('invalid token')
        || normalizedMessage.includes('session is still syncing')
    ) {
        return 'UNAUTHENTICATED';
    }
    if (normalizedMessage.includes('do not have permission') || normalizedMessage.includes('permission')) {
        return 'UNAUTHORIZED';
    }
    return '';
};

const isConvexAuthenticationError = (error) => {
    const code = getConvexErrorCode(error);
    if (code === 'UNAUTHENTICATED' || code === 'UNAUTHORIZED') return true;
    const normalizedMessage = resolveConvexActionError(error, '').toLowerCase();
    return (
        normalizedMessage.includes('must be signed in')
        || normalizedMessage.includes('not authenticated')
        || normalizedMessage.includes('invalid token')
        || normalizedMessage.includes('session is still syncing')
        || normalizedMessage.includes('permission')
    );
};

// After a prolonged WebSocket disconnect, Convex actions may wrap auth errors
// as a generic "Server Error" with filtered data fields. Detect this pattern
// so the exam flow can attempt a session refresh rather than showing a generic error.
const isLikelyPostDisconnectAuthError = (error) => {
    const message = String(error?.message || '').trim();
    if (!message) return false;
    // Convex wraps action errors as "Server Error" when the inner ConvexError is filtered
    if (/^server error$/i.test(message) || /^uncaught convexerror: server error/i.test(message)) {
        // If there's a structured code, it's not an opaque wrapping
        const code = getConvexErrorCode(error);
        return !code;
    }
    return false;
};

const isTransientExamTransportError = (error, resolvedMessage = '') => {
    const normalizedMessage = `${String(error?.message || '').toLowerCase()} ${String(resolvedMessage || '').toLowerCase()}`;
    return TRANSIENT_TRANSPORT_ERROR_PATTERNS.some((pattern) => normalizedMessage.includes(pattern));
};

const getExamAuthNotReadyMessage = (sessionRefreshed = false) =>
    sessionRefreshed
        ? 'Your session has been refreshed. Tap Retry to start the exam.'
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
    'Connection dropped while starting the exam. Check your internet and tap Retry.';

const getExamTransientSubmitRetryMessage = () =>
    'Connection dropped while submitting your exam. Please retry once your connection is stable.';

const isRecoverableExamSubmitError = ({ error, message }) => {
    if (isUserCorrectableEssaySubmitError(message)) return true;
    if (isConvexAuthenticationError(error)) return true;
    if (isTransientExamTransportError(error, message)) return true;
    return false;
};

const isUserCorrectableEssaySubmitError = (message) => {
    const normalized = String(message || '').toLowerCase();
    if (!normalized) return false;
    return (
        normalized.includes('restart the exam') ||
        normalized.includes('essay mode') ||
        normalized.includes('could not grade your essay right now') ||
        normalized.includes('duplicate questions') ||
        normalized.includes('at least one question') ||
        normalized.includes('answer all essay questions')
    );
};

// ── Component ──

const ExamMode = () => {
    const { topicId: topicIdParam } = useParams();
    const routeTopicId = typeof topicIdParam === 'string' ? topicIdParam.trim() : '';
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [selectedAnswers, setSelectedAnswers] = useState({});
    const [examStarted, setExamStarted] = useState(false);
    const [attemptId, setAttemptId] = useState(null);
    const [attemptQuestions, setAttemptQuestions] = useState(null);
    const [startingExamAttempt, setStartingExamAttempt] = useState(false);
    const [startExamError, setStartExamError] = useState('');

    // Essay exam state
    const [examFormat, setExamFormat] = useState(() => resolveAutostartExamFormat(location.search)); // null = not chosen, 'mcq' | 'essay'
    const [gradingEssay, setGradingEssay] = useState(false);
    const [submitError, setSubmitError] = useState('');
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
    const startExamAttempt = useAction(api.exams.startExamAttempt);
    const ensureAssessmentRoutingForTopic = useAction(api.ai.ensureAssessmentRoutingForTopic);
    const submitExam = useMutation(api.exams.submitExamAttempt);
    const submitEssayExam = useAction(api.exams.submitEssayExam);

    const START_EXAM_ATTEMPT_TIMEOUT_MS = 120_000;
    const EXAM_LOADING_STALL_TIMEOUT_MS = 150_000;

    const loadingExamTypeLabel = examFormat === 'essay' ? 'essay' : 'objective';
    const activePreparationMessage = `Generating your ${loadingExamTypeLabel} exam from this topic.`;
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
    const [routingBootstrapPending, setRoutingBootstrapPending] = useState(false);
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
        setCurrentQuestion(0);
        setSelectedAnswers({});
        setExamStarted(false);
        setAttemptId(null);
        setAttemptQuestions(null);
        setStartingExamAttempt(false);
        setStartExamError('');
        setExamFormat(resolveAutostartExamFormat(location.search));
        setGradingEssay(false);
        setSubmitError('');
        routingBootstrapKeyRef.current = '';
        setRoutingBootstrapPending(false);
    }, [
        routeTopicId,
        location.search,
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
        setRoutingBootstrapPending(true);

        ensureAssessmentRoutingForTopic({ topicId })
            .catch((error) => {
                console.warn('Failed to bootstrap assessment routing for exam topic', error);
            })
            .finally(() => {
                setRoutingBootstrapPending(false);
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
                pathname: location.pathname,
                referrer: typeof document !== 'undefined' ? document.referrer || '' : '',
            },
        });
    }, [hasMismatchedCachedTopic, isMissingRouteTopic, location.pathname, rawTopicId, routeTopicId]);

    const shouldRedirectToFinalExam = (
        topic?.topicKind !== 'document_final_exam'
        && topic?.assessmentRoute
        && topic.assessmentRoute !== 'topic_quiz'
    );

    useEffect(() => {
        if (!shouldRedirectToFinalExam) return;
        if (!routedFinalAssessmentTopic?._id) return;
        if (routedFinalAssessmentTopic._id === topicId) return;
        navigate(`/dashboard/exam/${routedFinalAssessmentTopic._id}${location.search || ''}`, { replace: true });
    }, [location.search, navigate, routedFinalAssessmentTopic?._id, shouldRedirectToFinalExam, topicId]);

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

        setStartExamError('');
        setSubmitError('');
        setStartingExamAttempt(true);
        setAttemptId(null);
        setAttemptQuestions(null);
        setExamStarted(false);
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
                startExamAttempt({ topicId, examFormat }),
                START_EXAM_ATTEMPT_TIMEOUT_MS,
                'Exam preparation initialization timed out.'
            );
            const selectedQuestions = Array.isArray(result?.questions) ? result.questions : [];
            if (result?.attemptId && selectedQuestions.length > 0) {
                setStartExamError('');
                setAttemptId(result.attemptId);
                setAttemptQuestions(selectedQuestions);
                setCurrentQuestion(0);
                setSelectedAnswers({});
                setTimeRemaining(EXAM_DURATION_SECONDS);
                setExamStarted(true);
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

            setStartExamError(
                typeof result?.message === 'string' && result.message.trim()
                    ? result.message.trim()
                    : 'We could not finish preparing your exam. Please try again.'
            );
        } catch (error) {
            const errorCode = getConvexErrorCode(error);
            const message = resolveConvexActionError(error, 'Unable to start the exam. Please try again.');
            const authError = isConvexAuthenticationError(error);
            const transientTransportError = isTransientExamTransportError(error, message);
            const timedOut = /timed out/i.test(message);
            const elapsedMs = attemptStartTimeRef.current
                ? Date.now() - attemptStartTimeRef.current
                : null;
            if (authError) {
                const { refreshed, expired } = await refreshAuthSessionQuietly();
                if (expired) {
                    setStartExamError(getExamSessionExpiredMessage());
                } else {
                    setStartExamError(getExamAuthNotReadyMessage(refreshed));
                }
            } else if (transientTransportError) {
                setStartExamError(getExamTransientStartRetryMessage());
            } else if (timedOut) {
                setStartExamError('Exam setup is taking longer than expected. Tap Retry.');
            } else if (isLikelyPostDisconnectAuthError(error)) {
                const { refreshed, expired } = await refreshAuthSessionQuietly();
                if (expired) {
                    setStartExamError(getExamSessionExpiredMessage());
                } else if (refreshed) {
                    setStartExamError(getExamAuthNotReadyMessage(true));
                } else {
                    setStartExamError('Something went wrong. Please wait a moment and tap Retry.');
                }
            } else {
                setStartExamError('Unable to start the exam. Please try again.');
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
            setAttemptId(null);
            setAttemptQuestions(null);
            setExamStarted(false);
        } finally {
            attemptStartTimeRef.current = null;
            setStartingExamAttempt(false);
        }
    }, [examFormat, startExamAttempt, topicId, userId, withTimeout, START_EXAM_ATTEMPT_TIMEOUT_MS, setTimeRemaining]);

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

    // Start exam only after the user chooses a format.
    useEffect(() => {
        if (
            topicId &&
            examFormat &&
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
        examStarted,
        startingExamAttempt,
        hasAttemptQuestions,
        startExamError,
        beginExamAttempt,
    ]);

    // Timer managed by useExamTimer hook above

    const handleAnswerSelect = useCallback((questionId, answer) => {
        setSubmitError((prev) => (prev ? '' : prev));
        setSelectedAnswers((prev) => ({
            ...prev,
            [questionId]: answer,
        }));
    }, []);

    const handleNext = useCallback(() => {
        setCurrentQuestion((prev) => Math.min(prev + 1, questions.length - 1));
    }, [questions.length]);

    const handlePrevious = useCallback(() => {
        setCurrentQuestion((prev) => Math.max(prev - 1, 0));
    }, []);

    const handleSubmit = useCallback(async () => {
        if (submittingRef.current) return;
        if (!attemptId) return;
        submittingRef.current = true;
        setSubmitError('');

        if (examFormat === 'essay') {
            const answeredEssayQuestions = questions.filter((question) => {
                const value = selectedAnswers[question._id];
                return String(value ?? '').trim().length >= MIN_ESSAY_SUBMIT_CHAR_COUNT;
            }).length;
            if (answeredEssayQuestions < questions.length) {
                setSubmitError('Please answer all essay questions before submitting.');
                submittingRef.current = false;
                return;
            }

            setGradingEssay(true);
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
                navigate(`/dashboard/results/${attemptId}`);
            } catch (error) {
                const message = resolveConvexActionError(
                    error,
                    'Could not submit essay exam. Please try again.'
                );
                const authError = isConvexAuthenticationError(error) || isLikelyPostDisconnectAuthError(error);
                const transientTransportError = isTransientExamTransportError(error, message);
                if (authError) {
                    const { refreshed, expired } = await refreshAuthSessionQuietly();
                    setSubmitError(
                        expired
                            ? getExamSessionExpiredMessage()
                            : getExamAuthNotReadyMessage(refreshed)
                    );
                } else if (transientTransportError) {
                    setSubmitError(getExamTransientSubmitRetryMessage());
                } else {
                    setSubmitError(message);
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
                setGradingEssay(false);
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
            navigate(`/dashboard/results/${attemptId}`);
        } catch (error) {
            const message = resolveConvexActionError(error, 'Failed to submit exam. Please try again.');
            const authError = isConvexAuthenticationError(error) || isLikelyPostDisconnectAuthError(error);
            const transientTransportError = isTransientExamTransportError(error, message);
            if (authError) {
                const { refreshed, expired } = await refreshAuthSessionQuietly();
                setSubmitError(
                    expired
                        ? getExamSessionExpiredMessage()
                        : getExamAuthNotReadyMessage(refreshed)
                );
            } else if (transientTransportError) {
                setSubmitError(getExamTransientSubmitRetryMessage());
            } else {
                setSubmitError(message);
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
    const progress = questions.length > 0
        ? ((currentQuestion + 1) / questions.length) * 100
        : 0;
    const answeredQuestionCount = examFormat === 'essay'
        ? questions.filter((question) => {
            const value = selectedAnswers[question._id];
            return String(value ?? '').trim().length >= MIN_ESSAY_SUBMIT_CHAR_COUNT;
        }).length
        : questions.filter((question) => Boolean(selectedAnswers[question._id])).length;
    const isEssaySubmitBlocked = examFormat === 'essay' && answeredQuestionCount < questions.length;
    const examQualityTier = '';

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


    if (!routeTopicId) {
        return (
            <div className="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center">
                <div className="text-center max-w-md px-6">
                    <div className="w-14 h-14 rounded-2xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark flex items-center justify-center mx-auto mb-4">
                        <span className="material-symbols-outlined text-2xl text-text-faint-light dark:text-text-faint-dark">quiz</span>
                    </div>
                    <h2 className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark mb-2">Select a topic to start an exam</h2>
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark mb-6">Go back to your dashboard and choose a topic to begin.</p>
                    <Link to="/dashboard" className="btn-primary text-body-sm px-5 py-2.5 inline-flex items-center gap-2">
                        Back to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    // Loading state
    if (isLoadingRouteTopic) {
        return (
            <div className="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-2 border-border-light dark:border-border-dark border-t-primary mx-auto mb-4"></div>
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark">Preparing your exam environment...</p>
                </div>
            </div>
        );
    }

    if (isMissingRouteTopic) {
        return (
            <div className="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center">
                <div className="text-center max-w-md px-6">
                    <div className="w-14 h-14 rounded-2xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark flex items-center justify-center mx-auto mb-4">
                        <span className="material-symbols-outlined text-2xl text-text-faint-light dark:text-text-faint-dark">search_off</span>
                    </div>
                    <h2 className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark mb-2">This exam link is stale</h2>
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark mb-6">Reload the dashboard, reopen the topic, and start the exam from there.</p>
                    <button type="button" onClick={reloadDashboard} className="btn-primary text-body-sm px-5 py-2.5 inline-flex items-center gap-2">
                        Reload Dashboard
                    </button>
                </div>
            </div>
        );
    }

    if (shouldRedirectToFinalExam && routedFinalAssessmentTopic === undefined) {
        return (
            <div className="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-2 border-border-light dark:border-border-dark border-t-primary mx-auto mb-4"></div>
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark">Preparing your final exam...</p>
                </div>
            </div>
        );
    }

    if (routingBootstrapPending) {
        return (
            <div className="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-2 border-border-light dark:border-border-dark border-t-primary mx-auto mb-4"></div>
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark">Preparing the best assessment route for this topic...</p>
                </div>
            </div>
        );
    }

    if (shouldRedirectToFinalExam && routedFinalAssessmentTopic?._id && routedFinalAssessmentTopic._id !== topicId) {
        return (
            <div className="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-2 border-border-light dark:border-border-dark border-t-primary mx-auto mb-4"></div>
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark">Redirecting to your final exam...</p>
                </div>
            </div>
        );
    }

    if (shouldRedirectToFinalExam && !routedFinalAssessmentTopic?._id) {
        return (
            <div className="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center">
                <div className="text-center max-w-md px-6">
                    <div className="w-14 h-14 rounded-2xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark flex items-center justify-center mx-auto mb-4">
                        <span className="material-symbols-outlined text-2xl text-text-faint-light dark:text-text-faint-dark">hourglass_top</span>
                    </div>
                    <h2 className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark mb-2">This topic is covered in the final exam</h2>
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark mb-6">The final exam is still being prepared. Return to the course and try again in a moment.</p>
                    <Link to={`/dashboard/topic/${topicId}`} className="btn-primary text-body-sm px-5 py-2.5 inline-flex items-center gap-2">
                        Back to Topic
                    </Link>
                </div>
            </div>
        );
    }

    if (!examFormat && !examStarted && !startingExamAttempt && !hasAttemptQuestions) {
        return (
            <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center p-4">
                <div className="w-full max-w-md">
                    <div className="card-base p-8 text-center">
                        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
                            <span className="material-symbols-outlined text-3xl text-primary">quiz</span>
                        </div>
                        <h2 className="text-display-sm text-text-main-light dark:text-text-main-dark mb-2">Choose Exam Format</h2>
                        <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark mb-8">How would you like to be tested?</p>

                        <div className="space-y-3">
                            <button
                                onClick={() => {
                                    setStartExamError('');
                                    setExamFormat('mcq');
                                }}
                                className="w-full flex items-center gap-4 p-4 rounded-xl border border-border-light dark:border-border-dark hover:border-primary hover:bg-primary/5 transition-all text-left group"
                            >
                                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                                    <span className="material-symbols-outlined text-primary">radio_button_checked</span>
                                </div>
                                <div>
                                    <p className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark">Objective Quiz</p>
                                    <p className="text-caption text-text-sub-light dark:text-text-sub-dark">Multiple choice, true/false, and fill in the blank</p>
                                </div>
                            </button>

                            <button
                                onClick={() => {
                                    setStartExamError('');
                                    setExamFormat('essay');
                                }}
                                className="w-full flex items-center gap-4 p-4 rounded-xl border border-border-light dark:border-border-dark hover:border-accent-emerald hover:bg-accent-emerald/5 transition-all text-left group"
                            >
                                <div className="w-11 h-11 rounded-xl bg-accent-emerald/10 flex items-center justify-center group-hover:bg-accent-emerald/15 transition-colors">
                                    <span className="material-symbols-outlined text-accent-emerald">edit_note</span>
                                </div>
                                <div>
                                    <p className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark">Essay / Theory</p>
                                    <p className="text-caption text-text-sub-light dark:text-text-sub-dark">Write your answers in your own words</p>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (startingExamAttempt || !examStarted || !attemptId || questions.length === 0) {
        return (
            <ExamPreparationLoader
                examFormat={examFormat}
                subtitle={activePreparationMessage}
                failed={Boolean(startExamError)}
                errorMsg={startExamError}
                onRetry={handleRetryStart}
                onBack={() => { setStartExamError(''); setExamFormat(null); }}
                isSessionExpired={startExamError === getExamSessionExpiredMessage()}
            />
        );
    }

    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark flex flex-col md:flex-row">
            {/* Essay grading overlay */}
            {gradingEssay && (
                <div className="fixed inset-0 z-50 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="card-base p-8 text-center max-w-sm w-full">
                        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center animate-pulse">
                            <span className="material-symbols-outlined text-3xl text-primary">psychology</span>
                        </div>
                        <h3 className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark mb-2">Grading Your Answers</h3>
                        <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark">Our AI is reading and evaluating each of your responses. This may take a moment...</p>
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
                            <Link to={topicId ? `/dashboard/topic/${topicId}` : '/dashboard'} className="btn-icon w-9 h-9">
                                <span className="material-symbols-outlined text-lg">close</span>
                            </Link>
                            <div>
                                <h1 className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark">Exam</h1>
                                <p className="text-caption text-text-faint-light dark:text-text-faint-dark truncate max-w-[120px] sm:max-w-xs">{topic?.title}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-body-sm text-text-sub-light dark:text-text-sub-dark">
                                {currentQuestion + 1} <span className="text-text-faint-light dark:text-text-faint-dark">/ {questions.length}</span>
                            </span>
                            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono font-semibold text-body-sm ${isLowTime ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-surface-hover-light dark:bg-surface-hover-dark text-text-main-light dark:text-text-main-dark'}`}>
                                <span className="material-symbols-outlined text-[16px]">timer</span>
                                {formattedTime}
                            </div>
                        </div>
                    </div>
                    {/* Progress bar */}
                    <div className="h-0.5 bg-border-light dark:bg-border-dark">
                        <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }}></div>
                    </div>
                </header>

                {/* Question Content */}
                <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 pb-32">
                    {startExamError && (
                        <div className="mb-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30">
                            <p className="text-body-sm text-amber-800 dark:text-amber-300">{startExamError}</p>
                        </div>
                    )}
                    {submitError && (
                        <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30">
                            <p className="text-body-sm text-red-800 dark:text-red-300">
                                {submitError}
                                {submitError === getExamSessionExpiredMessage() && (
                                    <Link to="/login" className="ml-2 font-semibold underline">Sign in</Link>
                                )}
                            </p>
                        </div>
                    )}
                    {examQualityTier === 'premium' && (
                        <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-900/30">
                            <p className="text-body-sm text-emerald-800 dark:text-emerald-300">Premium exam ready. This set met the higher university-level quality targets.</p>
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
                        <div className="grid grid-cols-8 gap-1.5">
                            {questions.map((q, index) => {
                                const isAnswered = examFormat === 'essay'
                                    ? String(selectedAnswers[q._id] ?? '').trim().length >= MIN_ESSAY_SUBMIT_CHAR_COUNT
                                    : Boolean(selectedAnswers[q._id]);
                                const isCurrent = index === currentQuestion;
                                return (
                                    <button
                                        key={q._id}
                                        onClick={() => setCurrentQuestion(index)}
                                        className={`aspect-square rounded-lg font-semibold text-caption flex items-center justify-center transition-all ${isCurrent
                                            ? 'bg-primary text-white'
                                            : isAnswered
                                                ? 'bg-surface-hover-light dark:bg-surface-hover-dark text-text-sub-light dark:text-text-sub-dark'
                                                : 'border border-border-light dark:border-border-dark text-text-faint-light dark:text-text-faint-dark'
                                            }`}
                                    >
                                        {index + 1}
                                    </button>
                                );
                            })}
                        </div>
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
                                className="px-6 py-2.5 rounded-xl bg-accent-emerald text-white text-body-sm font-semibold hover:brightness-110 transition-all flex items-center gap-1 disabled:opacity-60"
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
                        <div className={`text-display-lg font-mono tabular-nums ${isLowTime ? 'text-red-500' : 'text-text-main-light dark:text-text-main-dark'}`}>
                            {formattedTime}
                        </div>
                        {isLowTime && (
                            <p className="text-caption text-red-500 mt-1">Less than 5 minutes!</p>
                        )}
                    </div>

                    {/* Progress */}
                    <div className="mb-5">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-body-sm text-text-sub-light dark:text-text-sub-dark">Progress</span>
                            <span className="text-body-sm font-semibold text-primary">{Math.round(progress)}%</span>
                        </div>
                        <div className="w-full bg-border-light dark:bg-border-dark rounded-full h-1.5">
                            <div className="bg-primary h-full rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                        </div>
                    </div>

                    {/* Question Grid */}
                    <div className="mb-5">
                        <span className="text-overline text-text-faint-light dark:text-text-faint-dark block mb-3">Questions</span>
                        <div className="grid grid-cols-5 gap-1.5">
                            {questions.map((q, index) => {
                                const isAnswered = examFormat === 'essay'
                                    ? String(selectedAnswers[q._id] ?? '').trim().length >= MIN_ESSAY_SUBMIT_CHAR_COUNT
                                    : Boolean(selectedAnswers[q._id]);
                                const isCurrent = index === currentQuestion;
                                return (
                                    <button
                                        key={q._id}
                                        onClick={() => setCurrentQuestion(index)}
                                        className={`aspect-square rounded-lg font-semibold text-caption flex items-center justify-center transition-all ${isCurrent
                                            ? 'bg-primary text-white'
                                            : isAnswered
                                                ? 'bg-surface-hover-light dark:bg-surface-hover-dark text-text-sub-light dark:text-text-sub-dark'
                                                : 'border border-border-light dark:border-border-dark text-text-faint-light dark:text-text-faint-dark hover:border-text-faint-light'
                                            }`}
                                    >
                                        {index + 1}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Submit Button */}
                <div className="p-5 border-t border-border-light dark:border-border-dark">
                    <button
                        onClick={handleSubmit}
                        disabled={!attemptId || isEssaySubmitBlocked}
                        className="w-full btn-primary py-3 disabled:opacity-60"
                    >
                        Submit Exam
                    </button>
                </div>
            </aside>
        </div>
    );
};

export default ExamMode;
