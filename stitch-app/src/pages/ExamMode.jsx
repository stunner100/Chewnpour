import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';
import { getSession } from '../lib/auth-client';
import { useStudyTimer } from '../hooks/useStudyTimer';
import {
    resolveAutoGenerationError,
    resolveAutoGenerationResult,
} from '../lib/examAutoGenerationState';
import { addSentryBreadcrumb, captureSentryException, captureSentryMessage } from '../lib/sentry';

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
const MCQ_EXAM_QUESTION_CAP = 35;
const ESSAY_EXAM_QUESTION_CAP = 15;
const EXAM_DURATION_SECONDS = 45 * 60;
const MIN_ESSAY_SUBMIT_CHAR_COUNT = 1;

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
    const { topicId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [selectedAnswers, setSelectedAnswers] = useState({});
    const [timeRemaining, setTimeRemaining] = useState(EXAM_DURATION_SECONDS);
    const [examStarted, setExamStarted] = useState(false);
    const [attemptId, setAttemptId] = useState(null);
    const [attemptQuestions, setAttemptQuestions] = useState(null);
    const [startingExamAttempt, setStartingExamAttempt] = useState(false);
    const [startExamError, setStartExamError] = useState('');
    const [generatingQuestions, setGeneratingQuestions] = useState(false);
    const [generateQuestionsError, setGenerateQuestionsError] = useState('');
    const [autoGenerationPaused, setAutoGenerationPaused] = useState(false);

    // Essay exam state
    const [examFormat, setExamFormat] = useState(null); // null = not chosen, 'mcq' | 'essay'
    const [generatingEssayQuestions, setGeneratingEssayQuestions] = useState(false);
    const [gradingEssay, setGradingEssay] = useState(false);
    const [submitError, setSubmitError] = useState('');


    // Get userId from Better Auth session
    const userId = user?.id;
    useStudyTimer(userId);

    // Convex queries and mutations
    const topicData = useQuery(
        api.topics.getTopicWithQuestions,
        topicId ? { topicId } : 'skip'
    );
    const startExam = useMutation(api.exams.startExamAttempt);
    const submitExam = useMutation(api.exams.submitExamAttempt);
    const generateQuestions = useAction(api.ai.generateQuestionsForTopic);
    const generateEssayQuestions = useAction(api.ai.generateEssayQuestionsForTopic);
    const submitEssayExam = useAction(api.exams.submitEssayExam);

    const MIN_EXAM_QUESTIONS = 1;
    const START_EXAM_ATTEMPT_TIMEOUT_MS = 45_000;
    const EXAM_LOADING_STALL_TIMEOUT_MS = 90_000;
    const QUESTION_GENERATION_REQUEST_TIMEOUT_MS = 60_000;
    const AUTO_GENERATION_MAX_ATTEMPTS = 3;

    const topicQuestions = topicData?.questions || [];
    const loadingExamQuestionCap = examFormat === 'essay' ? ESSAY_EXAM_QUESTION_CAP : MCQ_EXAM_QUESTION_CAP;
    const loadingExamTypeLabel = examFormat === 'essay' ? 'essay' : 'multiple-choice';
    const hasAttemptQuestions = Array.isArray(attemptQuestions) && attemptQuestions.length > 0;
    const questions = hasAttemptQuestions ? attemptQuestions : [];
    const topic = topicData;
    const examFlowStartTimeRef = useRef(Date.now());
    const attemptStartTimeRef = useRef(null);
    const loadingStallReportedRef = useRef(false);
    const autoGenerationAttemptsRef = useRef(0);
    const autoGenerationInFlightRef = useRef(false);
    const autoGenerationRequestIdRef = useRef(0);

    useEffect(() => {
        examFlowStartTimeRef.current = Date.now();
        loadingStallReportedRef.current = false;
        autoGenerationAttemptsRef.current = 0;
        autoGenerationInFlightRef.current = false;
        autoGenerationRequestIdRef.current = 0;
        setAutoGenerationPaused(false);
    }, [topicId]);

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
        if (!topicId || topicQuestions.length === 0) return;

        setStartExamError('');
        setSubmitError('');
        setStartingExamAttempt(true);
        attemptStartTimeRef.current = Date.now();
        addSentryBreadcrumb({
            category: 'exam',
            message: 'Starting exam attempt',
            data: {
                topicId,
                topicQuestionCount: topicQuestions.length,
                hasUserId: Boolean(userId),
                examFormat: examFormat || 'mcq',
            },
        });
        let timeoutHandle = null;
        try {
            const startPromise = startExam({ topicId, examFormat: examFormat || 'mcq' });
            const timeoutPromise = new Promise((_, reject) => {
                timeoutHandle = setTimeout(() => {
                    reject(new Error('Exam attempt initialization timed out.'));
                }, START_EXAM_ATTEMPT_TIMEOUT_MS);
            });
            const result = await Promise.race([startPromise, timeoutPromise]);
            const deferredCode = typeof result?.code === 'string' ? result.code.toUpperCase() : '';
            const deferredMessage = typeof result?.message === 'string'
                ? result.message
                : 'Questions are being refreshed for quality. Please try again in a few seconds.';
            const isDeferredPreparingState =
                result?.deferred === true
                && (
                    deferredCode === 'EXAM_QUESTIONS_PREPARING'
                    || deferredCode === 'ESSAY_QUESTIONS_PREPARING'
                );
            if (isDeferredPreparingState) {
                setAttemptId(null);
                setAttemptQuestions(null);
                setExamStarted(false);
                setStartExamError(deferredMessage);
                const elapsedMs = Date.now() - attemptStartTimeRef.current;
                captureSentryMessage('Exam attempt deferred while question bank prepares', {
                    level: 'warning',
                    tags: {
                        area: 'exam',
                        operation: 'start_exam_attempt',
                        deferred: 'yes',
                        errorCode: deferredCode,
                    },
                    extras: {
                        topicId,
                        userId,
                        topicQuestionCount: topicQuestions.length,
                        elapsedMs,
                        timeoutMs: START_EXAM_ATTEMPT_TIMEOUT_MS,
                        message: deferredMessage,
                    },
                });
                return;
            }

            const selectedQuestions = Array.isArray(result?.questions) ? result.questions : [];
            if (selectedQuestions.length === 0) {
                throw new Error('No questions available for this exam attempt.');
            }

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
        } catch (error) {
            const errorCode = getConvexErrorCode(error);
            const isPreparingQuestionsError =
                errorCode === 'EXAM_QUESTIONS_PREPARING' ||
                errorCode === 'ESSAY_QUESTIONS_PREPARING';
            const message = resolveConvexActionError(error, 'Unable to start the exam. Please try again.');
            const authError = isConvexAuthenticationError(error);
            const transientTransportError = isTransientExamTransportError(error, message);
            const timedOut = /timed out/i.test(message);
            const elapsedMs = attemptStartTimeRef.current
                ? Date.now() - attemptStartTimeRef.current
                : null;
            if (isPreparingQuestionsError) {
                setStartExamError(message);
                captureSentryMessage('Exam attempt deferred while question bank prepares', {
                    level: 'warning',
                    tags: {
                        area: 'exam',
                        operation: 'start_exam_attempt',
                        deferred: 'yes',
                        errorCode,
                    },
                    extras: {
                        topicId,
                        userId,
                        topicQuestionCount: topicQuestions.length,
                        elapsedMs,
                        timeoutMs: START_EXAM_ATTEMPT_TIMEOUT_MS,
                        message,
                    },
                });
            } else if (authError) {
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
                // Opaque "Server Error" after a disconnect — likely an auth error.
                // Attempt a session refresh so the next retry has a valid token.
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
            const recoverableError = isPreparingQuestionsError || timedOut || authError || transientTransportError || likelyPostDisconnect;
            if (recoverableError) {
                captureSentryMessage('Exam attempt start requires retry', {
                    level: 'warning',
                    tags: {
                        area: 'exam',
                        operation: 'start_exam_attempt',
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
                        topicQuestionCount: topicQuestions.length,
                        elapsedMs,
                        timeoutMs: START_EXAM_ATTEMPT_TIMEOUT_MS,
                        message,
                    },
                });
            } else {
                console.error('Failed to start exam attempt:', error);
                captureSentryException(error, {
                    level: 'error',
                    tags: {
                        area: 'exam',
                        operation: 'start_exam_attempt',
                        timedOut,
                        errorCode: errorCode || 'unknown',
                    },
                    extras: {
                        topicId,
                        userId,
                        topicQuestionCount: topicQuestions.length,
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
            if (timeoutHandle) {
                clearTimeout(timeoutHandle);
            }
            attemptStartTimeRef.current = null;
            setStartingExamAttempt(false);
        }
    }, [topicId, userId, examFormat, topicQuestions.length, startExam, START_EXAM_ATTEMPT_TIMEOUT_MS]);

    useEffect(() => {
        const waitingForQuestions = topicData !== null && topicData !== undefined && topicQuestions.length < MIN_EXAM_QUESTIONS;
        const waitingForAttemptStart = topicQuestions.length >= MIN_EXAM_QUESTIONS && !examStarted && (!attemptId || questions.length === 0);
        const shouldMonitorStall = !examStarted && (startingExamAttempt || waitingForQuestions || waitingForAttemptStart);

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
                    topicDataState: topicData === undefined ? 'loading' : topicData === null ? 'missing' : 'ready',
                    topicQuestionCount: topicQuestions.length,
                    hasAttemptQuestions,
                    attemptId,
                    startingExamAttempt,
                    startExamError,
                    generateQuestionsError,
                },
            });
        }, EXAM_LOADING_STALL_TIMEOUT_MS);

        return () => clearTimeout(timer);
    }, [
        attemptId,
        examStarted,
        generateQuestionsError,
        hasAttemptQuestions,
        questions.length,
        startExamError,
        startingExamAttempt,
        topicData,
        topicId,
        topicQuestions.length,
        userId,
    ]);

    useEffect(() => {
        if (!generatingQuestions) {
            return;
        }

        const watchdog = setTimeout(() => {
            autoGenerationInFlightRef.current = false;
            autoGenerationAttemptsRef.current = AUTO_GENERATION_MAX_ATTEMPTS;
            setAutoGenerationPaused(true);
            setGeneratingQuestions(false);
            setGenerateQuestionsError('Question generation timed out. Tap Generate Questions to retry.');
            captureSentryMessage('Question generation watchdog timeout reached', {
                level: 'warning',
                tags: {
                    area: 'exam',
                    operation: 'question_generation_watchdog',
                },
                extras: {
                    topicId,
                    topicQuestionCount: topicQuestions.length,
                    timeoutMs: QUESTION_GENERATION_REQUEST_TIMEOUT_MS,
                },
            });
        }, QUESTION_GENERATION_REQUEST_TIMEOUT_MS + 2000);

        return () => clearTimeout(watchdog);
    }, [
        generatingQuestions,
        topicId,
        topicQuestions.length,
        QUESTION_GENERATION_REQUEST_TIMEOUT_MS,
        AUTO_GENERATION_MAX_ATTEMPTS,
    ]);

    // Auto-generate questions if too few exist (safety net for race condition)
    useEffect(() => {
        if (
            topicId &&
            topicData !== undefined &&
            topicData !== null &&
            !autoGenerationPaused &&
            !autoGenerationInFlightRef.current &&
            !generatingQuestions &&
            !examStarted &&
            !hasAttemptQuestions &&
            topicQuestions.length < MIN_EXAM_QUESTIONS
        ) {
            let cancelled = false;
            const previousQuestionCount = topicQuestions.length;
            autoGenerationInFlightRef.current = true;
            const requestId = autoGenerationRequestIdRef.current + 1;
            autoGenerationRequestIdRef.current = requestId;
            setGeneratingQuestions(true);
            setGenerateQuestionsError('');
            withTimeout(
                generateQuestions({ topicId }),
                QUESTION_GENERATION_REQUEST_TIMEOUT_MS,
                'Question generation request timed out.'
            )
                .then((result) => {
                    if (cancelled) return;
                    const outcome = resolveAutoGenerationResult({
                        result,
                        previousQuestionCount,
                        attemptCount: autoGenerationAttemptsRef.current,
                        maxAttempts: AUTO_GENERATION_MAX_ATTEMPTS,
                        minExamQuestions: MIN_EXAM_QUESTIONS,
                    });
                    autoGenerationAttemptsRef.current = outcome.nextAttemptCount;

                    if (outcome.pauseAutoGeneration) {
                        setAutoGenerationPaused(true);
                        setGenerateQuestionsError(outcome.errorMessage);
                        captureSentryMessage('Exam auto-generation paused after retries', {
                            level: 'warning',
                            tags: {
                                area: 'exam',
                                operation: 'auto_generate_questions',
                            },
                            extras: {
                                topicId,
                                previousQuestionCount,
                                latestQuestionCount: outcome.latestQuestionCount,
                                attemptCount: outcome.nextAttemptCount,
                                maxAttempts: AUTO_GENERATION_MAX_ATTEMPTS,
                            },
                        });
                        return;
                    }

                    if (outcome.errorMessage) {
                        setGenerateQuestionsError(outcome.errorMessage);
                    }
                })
                .catch(async (error) => {
                    if (cancelled) return;

                    // Auth errors during auto-generation: refresh session and pause
                    // instead of counting as a generation failure
                    if (isConvexAuthenticationError(error) || isLikelyPostDisconnectAuthError(error)) {
                        const { refreshed, expired } = await refreshAuthSessionQuietly();
                        autoGenerationAttemptsRef.current = AUTO_GENERATION_MAX_ATTEMPTS;
                        setAutoGenerationPaused(true);
                        setGenerateQuestionsError(
                            expired
                                ? getExamSessionExpiredMessage()
                                : refreshed
                                    ? 'Your session has been refreshed. Tap Generate Questions to retry.'
                                    : 'Your session may have expired. Please wait a moment and retry.'
                        );
                        captureSentryMessage('Exam auto-generation paused due to auth error', {
                            level: 'warning',
                            tags: {
                                area: 'exam',
                                operation: 'auto_generate_questions',
                                authError: 'yes',
                                likelyPostDisconnect: isLikelyPostDisconnectAuthError(error) ? 'yes' : 'no',
                                sessionRefreshed: refreshed ? 'yes' : 'no',
                            },
                            extras: { topicId, expired },
                        });
                        return;
                    }

                    console.error('Auto question generation failed:', error);
                    const outcome = resolveAutoGenerationError({
                        error,
                        attemptCount: autoGenerationAttemptsRef.current,
                        maxAttempts: AUTO_GENERATION_MAX_ATTEMPTS,
                    });
                    autoGenerationAttemptsRef.current = outcome.nextAttemptCount;
                    if (outcome.pauseAutoGeneration) {
                        setAutoGenerationPaused(true);
                    }
                    setGenerateQuestionsError(outcome.errorMessage);

                    captureSentryException(error, {
                        level: 'warning',
                        tags: {
                            area: 'exam',
                            operation: 'auto_generate_questions',
                            timedOut: outcome.timedOut,
                        },
                        extras: {
                            topicId,
                            topicQuestionCount: topicQuestions.length,
                            previousQuestionCount,
                            attemptCount: outcome.nextAttemptCount,
                            maxAttempts: AUTO_GENERATION_MAX_ATTEMPTS,
                            timeoutMs: QUESTION_GENERATION_REQUEST_TIMEOUT_MS,
                        },
                    });
                })
                .finally(() => {
                    if (autoGenerationRequestIdRef.current !== requestId) return;
                    autoGenerationInFlightRef.current = false;
                    if (!cancelled) {
                        setGeneratingQuestions(false);
                    }
                });
            return () => {
                cancelled = true;
            };
        }
    }, [
        topicId,
        topicData,
        topicQuestions.length,
        examStarted,
        hasAttemptQuestions,
        generateQuestions,
        generatingQuestions,
        autoGenerationPaused,
        withTimeout,
        MIN_EXAM_QUESTIONS,
        AUTO_GENERATION_MAX_ATTEMPTS,
        QUESTION_GENERATION_REQUEST_TIMEOUT_MS,
    ]);

    // Start exam once enough questions exist AND user has chosen a format. Keep generation in background.
    useEffect(() => {
        if (
            topicId &&
            examFormat &&
            !examStarted &&
            !startingExamAttempt &&
            !hasAttemptQuestions &&
            !startExamError &&
            topicQuestions.length >= MIN_EXAM_QUESTIONS
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
        topicQuestions.length,
        beginExamAttempt,
    ]);

    // Timer
    useEffect(() => {
        if (!examStarted) return;

        const timer = setInterval(() => {
            setTimeRemaining((prev) => {
                if (prev <= 0) {
                    clearInterval(timer);
                    handleSubmit();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [examStarted]);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const handleAnswerSelect = (questionId, answer) => {
        if (submitError) setSubmitError('');
        setSelectedAnswers((prev) => ({
            ...prev,
            [questionId]: answer,
        }));
    };

    const handleNext = () => {
        if (currentQuestion < questions.length - 1) {
            setCurrentQuestion(currentQuestion + 1);
        }
    };

    const handlePrevious = () => {
        if (currentQuestion > 0) {
            setCurrentQuestion(currentQuestion - 1);
        }
    };

    const handleSubmit = async () => {
        if (!attemptId) return;
        setSubmitError('');

        if (examFormat === 'essay') {
            const answeredEssayQuestions = questions.filter((question) => {
                const value = selectedAnswers[question._id];
                return String(value ?? '').trim().length >= MIN_ESSAY_SUBMIT_CHAR_COUNT;
            }).length;
            if (answeredEssayQuestions < questions.length) {
                setSubmitError('Please answer all essay questions before submitting.');
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
            }
            return;
        }

        const answers = Object.entries(selectedAnswers).map(([questionId, selectedAnswer]) => ({
            questionId,
            selectedAnswer,
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
        }
    };

    const handleGenerateQuestions = async () => {
        if (!topicId) return;
        autoGenerationAttemptsRef.current = 0;
        setAutoGenerationPaused(false);
        setGenerateQuestionsError('');
        autoGenerationInFlightRef.current = true;
        setGeneratingQuestions(true);
        addSentryBreadcrumb({
            category: 'exam',
            message: 'Manual question generation requested',
            data: {
                topicId,
                topicQuestionCount: topicQuestions.length,
            },
        });
        try {
            const result = await withTimeout(
                generateQuestions({ topicId }),
                QUESTION_GENERATION_REQUEST_TIMEOUT_MS,
                'Question generation request timed out.'
            );
            const generatedCount = result?.count ?? 0;
            if (!result?.success || generatedCount === 0) {
                setGenerateQuestionsError('Unable to generate questions yet. Please try again.');
            } else if (generatedCount < MIN_EXAM_QUESTIONS) {
                setGenerateQuestionsError(`Generated ${generatedCount} of ${MIN_EXAM_QUESTIONS} required questions. Try again in a few seconds.`);
            }
        } catch (error) {
            const message = String(error?.message || '');
            const timedOut = /timed out/i.test(message);
            setGenerateQuestionsError(
                timedOut
                    ? 'Question generation timed out. Please try again.'
                    : 'Failed to generate questions. Please try again.'
            );
            captureSentryException(error, {
                level: 'warning',
                tags: {
                    area: 'exam',
                    operation: 'manual_generate_questions',
                    timedOut,
                },
                extras: {
                    topicId,
                    topicQuestionCount: topicQuestions.length,
                    timeoutMs: QUESTION_GENERATION_REQUEST_TIMEOUT_MS,
                },
            });
        } finally {
            autoGenerationInFlightRef.current = false;
            setGeneratingQuestions(false);
        }
    };

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

    // Keep hook order stable across loading/error/exam states.
    const finalOptions = useMemo(
        () => resolveQuestionOptions(currentQ?.options),
        [currentQ?.options]
    );

    if (!topicId) {
        return (
            <div className="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center">
                <div className="text-center max-w-md px-6">
                    <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">Select a topic to start an exam</h2>
                    <p className="text-neutral-500 font-medium mb-6">Go back to your dashboard and choose a topic to begin.</p>
                    <Link to="/dashboard" className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/20">
                        Back to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    // Loading state
    if (topicData === undefined) {
        return (
            <div className="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-neutral-500 font-medium">Preparing your exam environment...</p>
                </div>
            </div>
        );
    }

    if (topicData === null) {
        return (
            <div className="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center">
                <div className="text-center max-w-md px-6">
                    <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">Topic not found</h2>
                    <p className="text-neutral-500 font-medium mb-6">We couldn’t find this topic. Please return to your dashboard.</p>
                    <Link to="/dashboard" className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/20">
                        Back to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    if (topicQuestions.length === 0) {
        return (
            <div className="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center">
                <div className="text-center max-w-lg px-6">
                    <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">No questions yet</h2>
                    <p className="text-neutral-500 font-medium mb-6">Generate questions for this topic to start the exam.</p>
                    {generateQuestionsError && (
                        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800">
                            {generateQuestionsError}
                        </div>
                    )}
                    <button
                        onClick={handleGenerateQuestions}
                        disabled={generatingQuestions}
                        className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/25 hover:bg-primary/90 disabled:opacity-60"
                    >
                        {generatingQuestions ? 'Generating...' : 'Generate Questions'}
                    </button>
                </div>
            </div>
        );
    }

    if (
        !examStarted &&
        !startingExamAttempt &&
        !hasAttemptQuestions &&
        topicQuestions.length < MIN_EXAM_QUESTIONS
    ) {
        return (
            <div className="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center">
                <div className="text-center max-w-lg px-6">
                    <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">Preparing question bank</h2>
                    <p className="text-neutral-500 font-medium mb-6">
                        {`We currently have ${topicQuestions.length} of ${MIN_EXAM_QUESTIONS} questions needed to start.`}
                    </p>
                    {generateQuestionsError && (
                        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800">
                            {generateQuestionsError}
                        </div>
                    )}
                    <button
                        onClick={handleGenerateQuestions}
                        disabled={generatingQuestions}
                        className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/25 hover:bg-primary/90 disabled:opacity-60"
                    >
                        {generatingQuestions ? 'Generating...' : 'Generate Questions'}
                    </button>
                </div>
            </div>
        );
    }

    if (!examFormat && !examStarted && topicQuestions.length >= MIN_EXAM_QUESTIONS) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-800 flex items-center justify-center p-4">
                <div className="w-full max-w-md">
                    <div className="bg-white dark:bg-neutral-900 rounded-3xl shadow-xl border border-neutral-200 dark:border-neutral-800 p-8 text-center">
                        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/25">
                            <span className="material-symbols-outlined text-4xl">quiz</span>
                        </div>
                        <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">Choose Exam Format</h2>
                        <p className="text-neutral-500 dark:text-neutral-400 mb-8">How would you like to be tested?</p>

                        <div className="space-y-3">
                            <button
                                onClick={() => setExamFormat('mcq')}
                                className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-neutral-200 dark:border-neutral-700 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-all text-left group"
                            >
                                <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-800/50 transition-colors">
                                    <span className="material-symbols-outlined text-primary dark:text-primary">radio_button_checked</span>
                                </div>
                                <div>
                                    <p className="font-bold text-neutral-900 dark:text-white">Multiple Choice</p>
                                    <p className="text-sm text-neutral-500 dark:text-neutral-400">Pick the best answer from 4 options</p>
                                </div>
                            </button>

                            <button
                                onClick={async () => {
                                    setExamFormat('essay');
                                    // Generate essay questions if needed
                                    setGeneratingEssayQuestions(true);
                                    try {
                                        await generateEssayQuestions({ topicId, count: ESSAY_EXAM_QUESTION_CAP });
                                    } catch (e) {
                                        console.error('Essay question generation failed:', e);
                                    } finally {
                                        setGeneratingEssayQuestions(false);
                                    }
                                }}
                                disabled={generatingEssayQuestions}
                                className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-neutral-200 dark:border-neutral-700 hover:border-purple-400 hover:bg-purple-50/50 dark:hover:bg-purple-900/20 transition-all text-left group disabled:opacity-60"
                            >
                                <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center group-hover:bg-purple-200 dark:group-hover:bg-purple-800/50 transition-colors">
                                    <span className="material-symbols-outlined text-purple-600 dark:text-purple-400">edit_note</span>
                                </div>
                                <div>
                                    <p className="font-bold text-neutral-900 dark:text-white">
                                        {generatingEssayQuestions ? 'Preparing Essay Questions...' : 'Essay / Theory'}
                                    </p>
                                    <p className="text-sm text-neutral-500 dark:text-neutral-400">Write your answers in your own words</p>
                                </div>
                                {generatingEssayQuestions && (
                                    <div className="ml-auto w-5 h-5 rounded-full border-2 border-secondary border-t-transparent animate-spin"></div>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (startingExamAttempt || !examStarted || !attemptId || questions.length === 0) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-800 flex items-center justify-center p-4">
                <div className="w-full max-w-md">
                    {!startExamError ? (
                        <div className="bg-white dark:bg-neutral-900 rounded-3xl shadow-xl border border-neutral-200 dark:border-neutral-800 p-8 text-center">
                            <div className="relative w-24 h-24 mx-auto mb-6">
                                <div className="absolute inset-0 rounded-full border-4 border-neutral-100 dark:border-neutral-800"></div>
                                <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
                                <div className="absolute inset-2 rounded-full bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/25">
                                    <span className="material-symbols-outlined text-3xl">quiz</span>
                                </div>
                            </div>

                            <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
                                Preparing Your Exam
                            </h2>
                            <p className="text-neutral-500 dark:text-neutral-400 mb-6">
                                {`We're building a personalized ${loadingExamTypeLabel} test with up to ${loadingExamQuestionCap} questions based on your topic.`}
                            </p>

                            <div className="space-y-3">
                                <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-400">
                                    <span className="material-symbols-outlined text-accent-emerald">check_circle</span>
                                    <span>Analyzing topic content</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-400">
                                    <span className="material-symbols-outlined text-accent-emerald">check_circle</span>
                                    <span>Generating questions</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-400">
                                    <span className="material-symbols-outlined text-primary animate-pulse">hourglass_empty</span>
                                    <span>Finalizing exam set</span>
                                </div>
                            </div>

                            <div className="mt-6 pt-6 border-t border-neutral-100 dark:border-neutral-800">
                                <p className="text-xs text-neutral-400">
                                    This usually takes 10-20 seconds
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-neutral-900 rounded-3xl shadow-xl border border-neutral-200 dark:border-neutral-800 p-8 text-center">
                            <div className="w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center mx-auto mb-4">
                                <span className="material-symbols-outlined text-3xl text-amber-500">warning</span>
                            </div>

                            <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">
                                Taking Longer Than Expected
                            </h2>
                            <p className="text-neutral-500 dark:text-neutral-400 mb-6">
                                {startExamError}
                            </p>

                            <div className="flex gap-3">
                                {startExamError === getExamSessionExpiredMessage() ? (
                                    <Link
                                        to="/login"
                                        className="flex-1 py-3 bg-primary text-white rounded-xl font-semibold shadow-md shadow-primary/20 hover:shadow-lg transition-all flex items-center justify-center gap-2"
                                    >
                                        <span className="material-symbols-outlined">login</span>
                                        <span>Sign In</span>
                                    </Link>
                                ) : (
                                    <button
                                        onClick={beginExamAttempt}
                                        disabled={startingExamAttempt}
                                        className="flex-1 py-3 bg-primary text-white rounded-xl font-semibold shadow-md shadow-primary/20 hover:shadow-lg transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                                    >
                                        <span className="material-symbols-outlined">refresh</span>
                                        <span>Try Again</span>
                                    </button>
                                )}
                                <Link
                                    to={`/dashboard/topic/${topicId}`}
                                    className="px-4 py-3 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 rounded-xl font-semibold hover:bg-neutral-200 transition-colors flex items-center justify-center"
                                >
                                    <span className="material-symbols-outlined">arrow_back</span>
                                </Link>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-800 flex flex-col md:flex-row">
            {/* Essay grading overlay */}
            {gradingEssay && (
                <div className="fixed inset-0 z-50 bg-neutral-900/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl p-8 text-center max-w-sm w-full">
                        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-secondary flex items-center justify-center text-white shadow-lg shadow-secondary/25 animate-pulse">
                            <span className="material-symbols-outlined text-4xl">psychology</span>
                        </div>
                        <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">Grading Your Answers</h3>
                        <p className="text-neutral-500 dark:text-neutral-400 text-sm">Our AI is reading and evaluating each of your responses. This may take a moment...</p>
                        <div className="mt-6 w-full h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                            <div className="h-full bg-secondary rounded-full animate-[pulse_1.5s_ease-in-out_infinite]" style={{ width: '70%' }}></div>
                        </div>
                    </div>
                </div>
            )}
            {/* Main Content Area */}
            <main className="flex-1 flex flex-col min-h-screen">
                {/* Header */}
                <header className="sticky top-0 z-40 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border-b border-neutral-200 dark:border-neutral-800">
                    <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Link to={`/dashboard/topic/${topicId}`} className="w-9 h-9 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-500 hover:bg-neutral-200 transition-colors">
                                <span className="material-symbols-outlined text-lg">close</span>
                            </Link>
                            <div>
                                <h1 className="text-base font-semibold text-neutral-900 dark:text-white">Exam</h1>
                                <p className="text-xs text-neutral-500 truncate max-w-[120px] sm:max-w-xs">{topic?.title}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                                {currentQuestion + 1} <span className="text-neutral-400">/ {questions.length}</span>
                            </span>
                            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono font-semibold text-sm ${timeRemaining < 300 ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400' : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'}`}>
                                <span className="material-symbols-outlined text-base">timer</span>
                                {formatTime(timeRemaining)}
                            </div>
                        </div>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1 bg-neutral-100 dark:bg-neutral-800">
                        <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }}></div>
                    </div>
                </header>

                {/* Question Content */}
                <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 pb-32">
                    {startExamError && (
                        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                            {startExamError}
                        </div>
                    )}
                    {submitError && (
                        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 px-4 py-3 text-sm text-red-800 dark:text-red-300">
                            {submitError}
                            {submitError === getExamSessionExpiredMessage() && (
                                <Link to="/login" className="ml-2 font-semibold underline">Sign in</Link>
                            )}
                        </div>
                    )}

                    {/* Question Card */}
                    <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-800 p-6 md:p-8 mb-6">
                        <div className="mb-6">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary text-xs font-medium mb-3">
                                <span className="material-symbols-outlined text-sm">quiz</span>
                                <span>Question {currentQuestion + 1}</span>
                            </span>
                            <h2 className="text-lg md:text-xl font-bold text-neutral-900 dark:text-white leading-relaxed">
                                {currentQ?.questionText}
                            </h2>
                        </div>

                        {/* Options / Essay Textarea */}
                        <div className="space-y-2">
                            {examFormat === 'essay' ? (
                                /* Essay textarea */
                                <div>
                                    <textarea
                                        value={selectedAnswers[currentQ._id] || ''}
                                        onChange={(e) => {
                                            const val = e.target.value.slice(0, 1500);
                                            handleAnswerSelect(currentQ._id, val);
                                        }}
                                        placeholder="Write your answer here..."
                                        rows={6}
                                        className="w-full p-4 rounded-xl border-2 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none resize-y transition-all text-sm md:text-base"
                                        style={{ minHeight: '120px', fontSize: '16px' }}
                                    />
                                    <div className="flex justify-end mt-1">
                                        <span className={`text-xs font-medium ${(selectedAnswers[currentQ._id] || '').length >= 1400
                                            ? 'text-red-500'
                                            : 'text-neutral-400'
                                            }`}>
                                            {(selectedAnswers[currentQ._id] || '').length}/1500
                                        </span>
                                    </div>
                                </div>
                            ) : finalOptions.length === 0 ? (
                                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                    No options available for this question.
                                </div>
                            ) : (
                                finalOptions.map((option, index) => {
                                    const { label, value, text } = option;
                                    const isSelected = selectedAnswers[currentQ._id] === value;

                                    return (
                                        <button
                                            key={index}
                                            onClick={() => handleAnswerSelect(currentQ._id, value)}
                                            className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 flex items-center gap-3 ${isSelected
                                                ? 'border-primary bg-primary/5 dark:bg-primary/10'
                                                : 'border-neutral-200 dark:border-neutral-700 hover:border-primary/30 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                                                }`}
                                        >
                                            <span className={`flex-shrink-0 w-8 h-8 rounded-lg font-bold text-sm flex items-center justify-center transition-all ${isSelected
                                                ? 'bg-primary text-white'
                                                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500'
                                                }`}>
                                                {label}
                                            </span>
                                            <span className={`flex-1 text-sm md:text-base ${isSelected ? 'text-neutral-900 dark:text-white font-medium' : 'text-neutral-600 dark:text-neutral-300'}`}>
                                                {text}
                                            </span>
                                            {isSelected && (
                                                <span className="material-symbols-outlined text-primary">check_circle</span>
                                            )}
                                        </button>
                                    );
                                })
                            )}
                        </div>

                        {/* Navigation Buttons - inside question card */}
                        <div className="flex items-center justify-between mt-8 pt-6 border-t border-neutral-100 dark:border-neutral-800">
                            <button
                                onClick={handlePrevious}
                                disabled={currentQuestion === 0}
                                className="px-5 py-2.5 rounded-xl text-neutral-600 dark:text-neutral-400 font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors flex items-center gap-2"
                            >
                                <span className="material-symbols-outlined text-lg">arrow_back</span>
                                <span>Previous</span>
                            </button>

                            {currentQuestion === questions.length - 1 ? (
                                <button
                                    onClick={handleSubmit}
                                    disabled={!attemptId || isEssaySubmitBlocked}
                                    className="px-6 py-2.5 rounded-xl bg-accent-emerald text-white font-semibold shadow-md shadow-accent-emerald/20 hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-60"
                                >
                                    <span>Submit Exam</span>
                                    <span className="material-symbols-outlined text-lg">check</span>
                                </button>
                            ) : (
                                <button
                                    onClick={handleNext}
                                    className={`px-6 py-2.5 rounded-xl font-semibold shadow-md transition-all flex items-center gap-2 ${selectedAnswers[currentQ._id]
                                        ? 'bg-primary text-white shadow-primary/20 hover:shadow-lg animate-[pulse_2s_ease-in-out_1]'
                                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 shadow-none'
                                        }`}
                                >
                                    <span>Next</span>
                                    <span className="material-symbols-outlined text-lg">arrow_forward</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Question Navigator - Mobile Only */}
                    <div className="md:hidden bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-800 p-4">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-medium text-neutral-500">Question Navigator</span>
                            <span className="text-xs text-neutral-400">{answeredQuestionCount} of {questions.length} answered</span>
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
                                        className={`aspect-square rounded-lg font-bold text-xs flex items-center justify-center transition-all ${isCurrent
                                            ? 'bg-primary text-white'
                                            : isAnswered
                                                ? 'bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300'
                                                : 'border border-neutral-200 dark:border-neutral-700 text-neutral-400'
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
                <div className="fixed bottom-0 inset-x-0 z-50 md:hidden bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 p-4 safe-area-bottom">
                    <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
                        <button
                            onClick={handlePrevious}
                            disabled={currentQuestion === 0}
                            className="px-4 py-2.5 rounded-xl text-neutral-600 dark:text-neutral-400 font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors flex items-center gap-1"
                        >
                            <span className="material-symbols-outlined">arrow_back</span>
                            <span className="hidden sm:inline">Prev</span>
                        </button>

                        <div className="flex-1 text-center">
                            <span className="text-sm text-neutral-500">
                                {answeredQuestionCount} <span className="text-neutral-400">/ {questions.length}</span> answered
                            </span>
                        </div>

                        {currentQuestion === questions.length - 1 ? (
                            <button
                                onClick={handleSubmit}
                                disabled={!attemptId || isEssaySubmitBlocked}
                                className="px-6 py-2.5 rounded-xl bg-accent-emerald text-white font-semibold shadow-md hover:bg-accent-emerald/90 transition-all flex items-center gap-1 disabled:opacity-60"
                            >
                                <span>Submit</span>
                                <span className="material-symbols-outlined">check</span>
                            </button>
                        ) : (
                            <button
                                onClick={handleNext}
                                className="px-6 py-2.5 rounded-xl bg-primary text-white font-semibold shadow-md hover:bg-primary-hover transition-all flex items-center gap-1"
                            >
                                <span>Next</span>
                                <span className="material-symbols-outlined">arrow_forward</span>
                            </button>
                        )}
                    </div>
                </div>
            </main>

            {/* Sidebar - Desktop Only */}
            <aside className="hidden md:flex w-80 bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800 flex-col h-screen sticky top-0">
                <div className="p-6 flex-1 overflow-y-auto">
                    {/* Timer */}
                    <div className="bg-neutral-50 dark:bg-neutral-800 rounded-2xl p-6 text-center mb-6">
                        <span className="text-xs font-medium text-neutral-500 uppercase tracking-wide block mb-2">Time Remaining</span>
                        <div className={`text-4xl font-mono font-bold tabular-nums ${timeRemaining < 300 ? 'text-red-500' : 'text-neutral-900 dark:text-white'}`}>
                            {formatTime(timeRemaining)}
                        </div>
                        {timeRemaining < 300 && (
                            <p className="text-xs text-red-500 mt-1">Less than 5 minutes!</p>
                        )}
                    </div>

                    {/* Progress */}
                    <div className="mb-6">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Progress</span>
                            <span className="text-sm font-bold text-primary">{Math.round(progress)}%</span>
                        </div>
                        <div className="w-full bg-neutral-100 dark:bg-neutral-800 rounded-full h-2">
                            <div className="bg-primary h-full rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                        </div>
                    </div>

                    {/* Question Grid */}
                    <div className="mb-6">
                        <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400 block mb-3">Questions</span>
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
                                        className={`aspect-square rounded-lg font-bold text-xs flex items-center justify-center transition-all ${isCurrent
                                            ? 'bg-primary text-white shadow-md'
                                            : isAnswered
                                                ? 'bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300'
                                                : 'border border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:border-neutral-300'
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
                <div className="p-6 border-t border-neutral-200 dark:border-neutral-800">
                    <button
                        onClick={handleSubmit}
                        disabled={!attemptId || isEssaySubmitBlocked}
                        className="w-full py-3 rounded-xl bg-primary text-white font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-60"
                    >
                        Submit Exam
                    </button>
                </div>
            </aside>
        </div>
    );
};

export default ExamMode;
