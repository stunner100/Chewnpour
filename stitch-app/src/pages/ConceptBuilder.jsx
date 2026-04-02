import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAction, useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';
import { useRouteResolvedTopic } from '../hooks/useRouteResolvedTopic';
import {
    parseConceptReviewKeysFromSearchParams,
} from '../lib/conceptReviewLinks';
import { getConceptSessionLoadingState } from '../lib/conceptLoadingEta';
import { isStaleTopicRouteLookupError } from '../lib/chunkLoadRecovery';

const EXERCISE_TYPE_CLOZE = 'cloze';
const EXERCISE_TYPE_DEFINITION_MATCH = 'definition_match';
const EXERCISE_TYPE_MISCONCEPTION_CHECK = 'misconception_check';

const normalizeConceptAnswer = (text) =>
    String(text || '')
        .toLowerCase()
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201c\u201d]/g, '"')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const resolveExerciseType = (exercise) => {
    const normalized = normalizeConceptAnswer(exercise?.exerciseType).replace(/\s+/g, '_');
    if (
        normalized === EXERCISE_TYPE_DEFINITION_MATCH
        || normalized === 'match'
        || normalized === 'term_match'
    ) {
        return EXERCISE_TYPE_DEFINITION_MATCH;
    }
    if (
        normalized === EXERCISE_TYPE_MISCONCEPTION_CHECK
        || normalized === 'misconception'
        || normalized === 'misconception_fix'
    ) {
        return EXERCISE_TYPE_MISCONCEPTION_CHECK;
    }
    return EXERCISE_TYPE_CLOZE;
};

const createEmptySlots = (exercise) =>
    Array.from({ length: Array.isArray(exercise?.answers) ? exercise.answers.length : 0 }, () => null);

const buildTokenItems = (exercise) => {
    const tokens = Array.isArray(exercise?.tokens) ? exercise.tokens : [];
    const items = tokens.map((text, index) => ({
        id: `${index}-${text}`,
        text,
    }));
    const seed = String(exercise?.questionText || '').length + tokens.length;
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = ((seed * (i + 1) * 2654435761) >>> 0) % (i + 1);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
};

const collectEvidenceQuotes = (citations) => {
    const items = Array.isArray(citations) ? citations : [];
    const seen = new Set();
    const quotes = [];

    for (const citation of items) {
        const quote = String(citation?.quote || '').replace(/\s+/g, ' ').trim();
        if (!quote || seen.has(quote)) continue;
        seen.add(quote);
        quotes.push({
            quote,
            page: Number.isFinite(Number(citation?.page)) ? Number(citation.page) + 1 : null,
        });
        if (quotes.length >= 2) break;
    }

    return quotes;
};

const formatExerciseTypeLabel = (exerciseType) => {
    switch (resolveExerciseType({ exerciseType })) {
        case EXERCISE_TYPE_DEFINITION_MATCH:
            return 'Definition match';
        case EXERCISE_TYPE_MISCONCEPTION_CHECK:
            return 'Misconception check';
        default:
            return 'Grounded cloze practice';
    }
};

const formatExerciseInstructions = (exerciseType) => {
    switch (resolveExerciseType({ exerciseType })) {
        case EXERCISE_TYPE_DEFINITION_MATCH:
            return 'Choose the meaning that stays closest to the source evidence.';
        case EXERCISE_TYPE_MISCONCEPTION_CHECK:
            return 'Choose the correction that is directly supported by the lesson.';
        default:
            return 'Fill every blank before checking this prompt.';
    }
};

const formatCorrectAnswerLabel = (answers = []) => {
    const items = Array.isArray(answers) ? answers.filter(Boolean) : [];
    return items.join(', ');
};

const humanizeConceptKey = (value) => {
    const normalized = String(value || '')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!normalized) return 'Core Concept';
    return normalized.replace(/\b\w/g, (match) => match.toUpperCase());
};

const formatNextReviewLabel = (timestamp) => {
    const value = Number(timestamp);
    if (!Number.isFinite(value) || value <= 0) return 'Not scheduled';
    const deltaMs = value - Date.now();
    if (deltaMs <= 0) return 'Due now';
    const hours = Math.round(deltaMs / (60 * 60 * 1000));
    if (hours < 24) return `In ${Math.max(1, hours)}h`;
    const days = Math.round(hours / 24);
    return `In ${Math.max(1, days)}d`;
};

const buildSessionSummary = (results) => {
    const items = Array.isArray(results) ? results.filter(Boolean) : [];
    const score = items.reduce((sum, item) => sum + (item.score || 0), 0);
    const total = items.reduce((sum, item) => sum + (item.total || 0), 0);
    const weakConceptKeys = new Set();
    const weakItems = items
        .filter((item) => Number(item.score || 0) < Number(item.total || 0))
        .map((item) => ({
            conceptKey: item.conceptKey,
            conceptLabel: humanizeConceptKey(item.conceptKey),
            exerciseType: resolveExerciseType(item),
            questionText: item.questionText,
            correctAnswers: item.correctAnswers,
            explanation: item.explanation,
            evidenceQuotes: collectEvidenceQuotes(item.citations),
        }));

    weakItems.forEach((item) => {
        const conceptKey = String(item.conceptKey || '').trim();
        if (conceptKey) weakConceptKeys.add(conceptKey);
    });

    return {
        score,
        total,
        accuracyPercent: total > 0 ? Math.round((score / total) * 100) : 0,
        weakItems,
        weakConceptKeys: Array.from(weakConceptKeys),
    };
};

const isStaleConceptRouteError = (error) => {
    if (isStaleTopicRouteLookupError(error)) return true;
    const dataMessage = typeof error?.data === 'string'
        ? error.data
        : typeof error?.data?.message === 'string'
            ? error.data.message
            : '';
    const message = String(dataMessage || error?.message || '')
        .replace(/\s+/g, ' ')
        .trim();
    return /topic not found/i.test(message);
};

const ConceptBuilder = () => {
    const { topicId: topicIdParam } = useParams();
    const [searchParams] = useSearchParams();
    const routeTopicId = typeof topicIdParam === 'string' ? topicIdParam.trim() : '';
    const requestedReviewParam = String(searchParams.get('review') || '');
    const navigate = useNavigate();
    const { user } = useAuth();
    const userId = user?.id;
    const reloadDashboard = useCallback(() => {
        if (typeof window !== 'undefined') {
            window.location.assign('/dashboard');
            return;
        }
        navigate('/dashboard', { replace: true });
    }, [navigate]);

    const topicQueryResult = useQuery(
        api.topics.getTopicWithQuestions,
        routeTopicId ? { topicId: routeTopicId } : 'skip',
    );
    const {
        topic,
        topicId,
        isLoadingRouteTopic,
        isMissingRouteTopic,
    } = useRouteResolvedTopic(routeTopicId, topicQueryResult);
    const conceptAttempts = useQuery(
        api.concepts.getUserConceptAttempts,
        userId ? {} : 'skip',
    );
    const conceptMastery = useQuery(
        api.concepts.getConceptMasteryForTopic,
        topicId ? { topicId } : 'skip',
    );
    const requestedReviewConceptKeys = useMemo(
        () => parseConceptReviewKeysFromSearchParams({
            get: (key) => (key === 'review' ? requestedReviewParam : null),
        }),
        [requestedReviewParam],
    );

    const getConceptSessionForTopic = useAction(api.concepts.getConceptSessionForTopic);
    const createConceptSessionAttempt = useMutation(api.concepts.createConceptSessionAttempt);

    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedTokens, setSelectedTokens] = useState([]);
    const [selectedOptionId, setSelectedOptionId] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [currentResult, setCurrentResult] = useState(null);
    const [responses, setResponses] = useState([]);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [startedAt, setStartedAt] = useState(null);
    const [sessionSummary, setSessionSummary] = useState(null);
    const [loadingStartedAt, setLoadingStartedAt] = useState(null);
    const [loadingElapsedMs, setLoadingElapsedMs] = useState(0);
    const [hasStaleSessionRouteError, setHasStaleSessionRouteError] = useState(false);

    const topicTitle = topic?.title || session?.topicTitle || 'Concept Practice';

    const topicAttempts = useMemo(() => {
        if (!conceptAttempts || !topicId) return [];
        return conceptAttempts.filter((attempt) => String(attempt.topicId) === topicId);
    }, [conceptAttempts, topicId]);

    const logicStrength = useMemo(() => {
        if (!topicAttempts.length) return null;
        const totals = topicAttempts.reduce(
            (acc, attempt) => {
                acc.score += attempt.score || 0;
                acc.total += attempt.totalQuestions || 0;
                return acc;
            },
            { score: 0, total: 0 },
        );
        if (totals.total === 0) return null;
        return Math.round((totals.score / totals.total) * 100);
    }, [topicAttempts]);

    const loadSession = useCallback(async (overrideFocusConceptKeys = requestedReviewConceptKeys) => {
        if (!topicId || !userId) return;

        setLoading(true);
        const requestStartedAt = Date.now();
        setLoadingStartedAt(requestStartedAt);
        setLoadingElapsedMs(0);
        setHasStaleSessionRouteError(false);
        setLoadError('');
        setSaveError('');

        try {
            const focusConceptKeys = Array.isArray(overrideFocusConceptKeys)
                ? overrideFocusConceptKeys.filter(Boolean)
                : [];
            const response = await getConceptSessionForTopic({
                topicId,
                ...(focusConceptKeys.length > 0 ? { focusConceptKeys } : {}),
            });
            const items = Array.isArray(response?.items) ? response.items : [];
            if (items.length === 0) {
                throw new Error('No concept practice items are ready for this topic yet.');
            }

            setSession(response);
            setCurrentIndex(0);
            setSelectedTokens(createEmptySlots(items[0]));
            setSelectedOptionId('');
            setSubmitted(false);
            setCurrentResult(null);
            setResponses([]);
            setSessionSummary(null);
            setStartedAt(Date.now());
        } catch (error) {
            console.error('Failed to prepare concept session:', error);
            setSession(null);
            setSelectedTokens([]);
            setSelectedOptionId('');
            if (isStaleConceptRouteError(error)) {
                setHasStaleSessionRouteError(true);
                setLoadError('');
                return;
            }
            setLoadError('Failed to prepare a concept practice session. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [getConceptSessionForTopic, requestedReviewConceptKeys, topicId, userId]);

    useEffect(() => {
        void loadSession();
    }, [loadSession]);

    useEffect(() => {
        if (!loading || session || !loadingStartedAt) return undefined;

        const updateElapsed = () => {
            setLoadingElapsedMs(Math.max(0, Date.now() - loadingStartedAt));
        };

        updateElapsed();
        const intervalId = window.setInterval(updateElapsed, 250);
        return () => window.clearInterval(intervalId);
    }, [loading, loadingStartedAt, session]);

    const currentExercise = session?.items?.[currentIndex] || null;
    const currentExerciseType = resolveExerciseType(currentExercise);
    const isChoiceExercise = currentExerciseType !== EXERCISE_TYPE_CLOZE;
    const isClozeExercise = !isChoiceExercise;

    useEffect(() => {
        if (!currentExercise || submitted || sessionSummary) return;
        if (resolveExerciseType(currentExercise) === EXERCISE_TYPE_CLOZE) {
            setSelectedTokens(createEmptySlots(currentExercise));
            setSelectedOptionId('');
            return;
        }
        setSelectedTokens([]);
        setSelectedOptionId('');
    }, [currentExercise, submitted, sessionSummary]);

    const tokenItems = useMemo(() => buildTokenItems(currentExercise), [currentExercise]);
    const currentOptions = useMemo(
        () => (Array.isArray(currentExercise?.options) ? currentExercise.options : []),
        [currentExercise],
    );

    const selectedTokenIds = useMemo(
        () => new Set(selectedTokens.filter(Boolean).map((token) => token.id)),
        [selectedTokens],
    );

    const availableTokens = useMemo(
        () => tokenItems.filter((token) => !selectedTokenIds.has(token.id)),
        [tokenItems, selectedTokenIds],
    );

    const blanksCount = currentExercise?.answers?.length || 0;
    const filledCount = selectedTokens.filter(Boolean).length;
    const allFilled = blanksCount > 0 && filledCount === blanksCount;
    const canSubmit = isChoiceExercise ? Boolean(selectedOptionId) : allFilled;
    const isInteractionDisabled = submitted || saving || Boolean(sessionSummary);
    const sessionLength = Array.isArray(session?.items) ? session.items.length : 0;
    const sessionFocusConceptKeys = Array.isArray(session?.focusConceptKeys)
        ? session.focusConceptKeys.filter(Boolean)
        : requestedReviewConceptKeys;
    const completedCount = sessionSummary
        ? sessionLength
        : responses.filter(Boolean).length + (submitted ? 1 : 0);
    const progressPercent = sessionLength > 0
        ? Math.round((completedCount / sessionLength) * 100)
        : 0;
    const evidenceQuotes = collectEvidenceQuotes(currentResult?.citations || currentExercise?.citations);
    const reviewFocusCount = requestedReviewConceptKeys.length;
    const loadingState = useMemo(
        () => getConceptSessionLoadingState({
            elapsedMs: loadingElapsedMs,
            focusedReview: reviewFocusCount > 0,
        }),
        [loadingElapsedMs, reviewFocusCount],
    );

    const placeTokenInSlot = (slotIndex, token) => {
        if (isInteractionDisabled) return;
        setSelectedTokens((prev) => {
            const next = [...prev];
            const existingIndex = next.findIndex((item) => item?.id === token.id);
            if (existingIndex !== -1) {
                next[existingIndex] = null;
            }
            next[slotIndex] = token;
            return next;
        });
    };

    const handleTokenClick = (token) => {
        if (isInteractionDisabled) return;
        const firstEmpty = selectedTokens.findIndex((slot) => !slot);
        if (firstEmpty === -1) return;
        placeTokenInSlot(firstEmpty, token);
    };

    const handleSlotClick = (slotIndex) => {
        if (isInteractionDisabled) return;
        setSelectedTokens((prev) => {
            const next = [...prev];
            next[slotIndex] = null;
            return next;
        });
    };

    const handleDragStart = (event, token) => {
        if (isInteractionDisabled) return;
        try {
            event.dataTransfer.setData('text/plain', token.id);
            event.dataTransfer.effectAllowed = 'move';
        } catch (error) {
            console.warn('Drag start failed', error);
        }
    };

    const handleDrop = (event, slotIndex) => {
        event.preventDefault();
        if (isInteractionDisabled) return;
        let tokenId = '';
        try {
            tokenId = event.dataTransfer.getData('text/plain');
        } catch {
            tokenId = '';
        }
        const token = tokenItems.find((item) => item.id === tokenId);
        if (token) {
            placeTokenInSlot(slotIndex, token);
        }
    };

    const handleDragOver = (event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    };

    const handleOptionSelect = (optionId) => {
        if (isInteractionDisabled) return;
        setSelectedOptionId(optionId);
    };

    const handleSubmit = () => {
        if (!currentExercise || !canSubmit) return;

        if (isChoiceExercise) {
            const selectedOption = currentOptions.find((option) => option.id === selectedOptionId);
            const correctOption = currentOptions.find((option) => option.id === currentExercise.correctOptionId);
            const userAnswer = selectedOption?.text || '';
            const correctAnswer = correctOption?.text || '';
            const score = selectedOptionId === currentExercise.correctOptionId ? 1 : 0;

            setCurrentResult({
                exerciseKey: currentExercise.exerciseKey,
                exerciseType: currentExerciseType,
                conceptKey: currentExercise.conceptKey,
                difficulty: currentExercise.difficulty,
                questionText: currentExercise.questionText,
                explanation: currentExercise.explanation,
                userAnswers: [userAnswer],
                correctAnswers: [correctAnswer],
                options: currentOptions,
                selectedOptionId,
                correctOptionId: currentExercise.correctOptionId,
                score,
                total: 1,
                citations: currentExercise.citations || [],
            });
            setSubmitted(true);
            setSaveError('');
            return;
        }

        const correctAnswers = Array.isArray(currentExercise.answers) ? currentExercise.answers : [];
        const normalizedCorrectAnswers = correctAnswers.map(normalizeConceptAnswer);
        const userAnswers = selectedTokens.map((token) => token?.text || '');
        const score = userAnswers.reduce((sum, answer, index) => (
            sum + (normalizeConceptAnswer(answer) === normalizedCorrectAnswers[index] ? 1 : 0)
        ), 0);

        setCurrentResult({
            exerciseKey: currentExercise.exerciseKey,
            exerciseType: currentExerciseType,
            conceptKey: currentExercise.conceptKey,
            difficulty: currentExercise.difficulty,
            questionText: currentExercise.questionText,
            explanation: currentExercise.explanation,
            template: currentExercise.template,
            userAnswers,
            correctAnswers,
            score,
            total: normalizedCorrectAnswers.length,
            citations: currentExercise.citations || [],
        });
        setSubmitted(true);
        setSaveError('');
    };

    const finalizeSession = async (nextResponses) => {
        if (!topicId || !userId || !session) return;

        setSaving(true);
        setSaveError('');

        try {
            const summary = buildSessionSummary(nextResponses);
            const timeTakenSeconds = startedAt ? Math.round((Date.now() - startedAt) / 1000) : undefined;

            await createConceptSessionAttempt({
                topicId,
                score: summary.score,
                totalQuestions: summary.total,
                timeTakenSeconds,
                answers: {
                    kind: 'concept_session_v2',
                    topicTitle: session.topicTitle,
                    sessionSize: session.items.length,
                    targetSize: session.targetSize,
                    generationCount: session.generationCount,
                    items: nextResponses.map((item) => ({
                        exerciseKey: item.exerciseKey,
                        exerciseType: item.exerciseType,
                        conceptKey: item.conceptKey,
                        difficulty: item.difficulty,
                        questionText: item.questionText,
                        explanation: item.explanation,
                        template: item.template,
                        userAnswers: item.userAnswers,
                        correctAnswers: item.correctAnswers,
                        options: item.options,
                        selectedOptionId: item.selectedOptionId,
                        correctOptionId: item.correctOptionId,
                        score: item.score,
                        total: item.total,
                        citations: item.citations,
                    })),
                },
                questionText: `${session.items.length}-item concept practice session`,
            });

            setResponses(nextResponses);
            setSubmitted(false);
            setCurrentResult(null);
            setSessionSummary(summary);
        } catch (error) {
            console.error('Failed to save concept session:', error);
            setSaveError('Failed to save your session. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleAdvance = async () => {
        if (!currentResult || !sessionLength) return;
        const nextResponses = [...responses];
        nextResponses[currentIndex] = currentResult;

        if (currentIndex >= sessionLength - 1) {
            await finalizeSession(nextResponses);
            return;
        }

        setResponses(nextResponses);
        setCurrentIndex((index) => index + 1);
        setSubmitted(false);
        setCurrentResult(null);
        setSaveError('');
    };

    if (!routeTopicId) {
        return (
            <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center px-4">
                <div className="text-center max-w-md">
                    <div className="w-14 h-14 rounded-2xl bg-primary/8 flex items-center justify-center mx-auto mb-4">
                        <span className="material-symbols-outlined text-primary text-[24px]">school</span>
                    </div>
                    <h2 className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark mb-2">Select a Topic</h2>
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark mb-6">Choose a topic from your dashboard to start concept practice.</p>
                    <Link to="/dashboard" className="btn-primary inline-flex items-center gap-2 px-6 py-2.5 text-body-sm">
                        <span>Go to Dashboard</span>
                        <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </Link>
                </div>
            </div>
        );
    }

    if (isLoadingRouteTopic) {
        return (
            <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-2 border-border-light dark:border-border-dark border-t-primary mx-auto mb-4"></div>
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark">Loading topic...</p>
                </div>
            </div>
        );
    }

    if (loading && !session) {
        return (
            <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center px-4">
                <div className="card-base w-full max-w-xl p-6 md:p-8">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/8 text-primary text-caption font-semibold mb-4">
                        <span className="material-symbols-outlined text-[14px]">hourglass_top</span>
                        <span>Preparing concept practice</span>
                    </div>
                    <div className="flex items-start justify-between gap-4 mb-4">
                        <div>
                            <h2 className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark mb-2">
                                {loadingState.stageLabel}
                            </h2>
                            <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark">
                                {loadingState.detailLabel}
                            </p>
                        </div>
                        <div className="text-right shrink-0">
                            <div className="text-caption uppercase tracking-[0.12em] text-text-faint-light dark:text-text-faint-dark mb-1">
                                ETA
                            </div>
                            <div className="text-body-base font-semibold text-text-main-light dark:text-text-main-dark">
                                {loadingState.etaLabel}
                            </div>
                        </div>
                    </div>

                    <div className="w-full h-2 bg-border-light dark:bg-border-dark rounded-full overflow-hidden mb-2">
                        <div
                            className="h-full bg-primary transition-all duration-500"
                            style={{ width: `${loadingState.progressPercent}%` }}
                        ></div>
                    </div>
                    <div className="flex items-center justify-between text-caption text-text-faint-light dark:text-text-faint-dark mb-5">
                        <span>{loadingState.progressPercent}% complete</span>
                        <span>{loadingState.helperLabel}</span>
                    </div>

                    <div className="grid gap-2">
                        {loadingState.steps.map((step) => {
                            const isComplete = step.status === 'complete';
                            const isActive = step.status === 'active';
                            return (
                                <div
                                    key={step.label}
                                    className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors ${
                                        isActive
                                            ? 'border-primary/40 bg-primary/6'
                                            : 'border-border-light dark:border-border-dark bg-surface-hover-light dark:bg-surface-hover-dark'
                                    }`}
                                >
                                    <div
                                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                            isComplete
                                                ? 'bg-accent-emerald/12 text-accent-emerald'
                                                : isActive
                                                    ? 'bg-primary/12 text-primary'
                                                    : 'bg-surface-light dark:bg-surface-dark text-text-faint-light dark:text-text-faint-dark'
                                        }`}
                                    >
                                        <span className="material-symbols-outlined text-[18px]">
                                            {isComplete ? 'check' : isActive ? 'autorenew' : 'more_horiz'}
                                        </span>
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-body-sm font-medium text-text-main-light dark:text-text-main-dark">
                                            {step.label}
                                        </div>
                                    </div>
                                    <div className="text-caption text-text-faint-light dark:text-text-faint-dark capitalize">
                                        {step.status}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <p className="text-caption text-text-faint-light dark:text-text-faint-dark mt-5">
                        {reviewFocusCount > 0
                            ? 'We are rebuilding a focused review set from your weak concepts.'
                            : 'We are grounding the session in your source material before it opens.'}
                    </p>
                </div>
            </div>
        );
    }

    if (isMissingRouteTopic || hasStaleSessionRouteError) {
        return (
            <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center px-4">
                <div className="text-center max-w-md">
                    <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                        <span className="material-symbols-outlined text-red-500 text-[24px]">error</span>
                    </div>
                    <h2 className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark mb-2">This concept link is stale</h2>
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark mb-6">Reload the dashboard, reopen the topic, and restart concept practice from there.</p>
                    <button type="button" onClick={reloadDashboard} className="btn-secondary inline-flex items-center gap-2 px-6 py-2.5 text-body-sm">
                        Reload Dashboard
                    </button>
                </div>
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center px-4">
                <div className="text-center max-w-md">
                    <div className="w-14 h-14 rounded-2xl bg-accent-amber/10 flex items-center justify-center mx-auto mb-4">
                        <span className="material-symbols-outlined text-accent-amber text-[24px]">warning</span>
                    </div>
                    <h2 className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark mb-2">Session Not Ready</h2>
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark mb-6">{loadError}</p>
                    <button
                        onClick={() => void loadSession()}
                        className="btn-primary inline-flex items-center gap-2 px-6 py-2.5 text-body-sm"
                    >
                        <span className="material-symbols-outlined text-[18px]">refresh</span>
                        <span>Try Again</span>
                    </button>
                </div>
            </div>
        );
    }

    if (sessionSummary) {
        return (
            <div className="min-h-screen bg-background-light dark:bg-background-dark">
                <header className="sticky top-0 z-40 bg-surface-light/90 dark:bg-surface-dark/90 backdrop-blur-md border-b border-border-light dark:border-border-dark">
                    <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Link to={`/dashboard/topic/${topicId}`} className="btn-icon w-10 h-10">
                                <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                            </Link>
                            <div>
                                <h1 className="text-body-base font-semibold text-text-main-light dark:text-text-main-dark">Concept Practice</h1>
                                <p className="text-caption text-text-faint-light dark:text-text-faint-dark truncate max-w-[150px] sm:max-w-xs">{topicTitle}</p>
                            </div>
                        </div>
                        <div className="text-caption font-semibold px-2.5 py-1 rounded-full bg-accent-emerald/10 text-accent-emerald">
                            Session Complete
                        </div>
                    </div>
                </header>

                <main className="max-w-4xl mx-auto px-4 py-6 pb-20">
                    <div className="card-base p-6 md:p-8 mb-4">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/8 text-primary text-caption font-semibold mb-4">
                            <span className="material-symbols-outlined text-[14px]">bolt</span>
                            <span>{sessionLength}-item session complete</span>
                        </div>
                        <h2 className="text-body-lg md:text-display-sm text-text-main-light dark:text-text-main-dark mb-3">
                            You answered {sessionSummary.score} of {sessionSummary.total} concept checks correctly.
                        </h2>
                        <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark mb-5">
                            Accuracy: <span className="font-semibold text-text-main-light dark:text-text-main-dark">{sessionSummary.accuracyPercent}%</span>
                        </p>
                        <div className="w-full h-2 bg-border-light dark:bg-border-dark rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${sessionSummary.accuracyPercent}%` }}></div>
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3 mb-6">
                        <div className="card-base p-5">
                            <div className="text-caption text-text-faint-light dark:text-text-faint-dark mb-1">Mastery snapshot</div>
                            <div className="text-display-sm font-semibold text-text-main-light dark:text-text-main-dark">
                                {conceptMastery?.averageStrength !== null && conceptMastery?.averageStrength !== undefined
                                    ? `${conceptMastery.averageStrength}%`
                                    : logicStrength !== null ? `${logicStrength}%` : 'New'}
                            </div>
                            <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark mt-2">
                                {conceptMastery
                                    ? `${conceptMastery.strongCount} strong · ${conceptMastery.shakyCount} shaky · ${conceptMastery.weakCount} weak`
                                    : 'Based on your saved concept practice for this topic.'}
                            </p>
                        </div>
                        <div className="card-base p-5">
                            <div className="text-caption text-text-faint-light dark:text-text-faint-dark mb-1">Review queue</div>
                            <div className="text-display-sm font-semibold text-text-main-light dark:text-text-main-dark">
                                {conceptMastery?.dueCount ? `${conceptMastery.dueCount} due` : formatNextReviewLabel(conceptMastery?.nextReviewAt)}
                            </div>
                            <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark mt-2">
                                {conceptMastery?.dueCount
                                    ? 'Review weak concepts before they fade.'
                                    : 'Your next concept review is already scheduled.'}
                            </p>
                        </div>
                        <div className="card-base p-5">
                            <div className="text-caption text-text-faint-light dark:text-text-faint-dark mb-1">Session coverage</div>
                            <div className="text-display-sm font-semibold text-text-main-light dark:text-text-main-dark">
                                {sessionLength}/{session?.targetSize || sessionLength}
                            </div>
                            <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark mt-2">
                                Mixed concept prompts reused from your bank first, with fresh generation only when needed.
                            </p>
                        </div>
                    </div>

                    <div className="card-base p-6 md:p-8 mb-6">
                        <h3 className="text-body-base font-semibold text-text-main-light dark:text-text-main-dark mb-3">Review Focus</h3>
                        {sessionSummary.weakItems.length === 0 ? (
                            <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark">
                                You cleared every item in this session. Move on to the objective quiz while the topic is fresh.
                            </p>
                        ) : (
                            <div className="space-y-4">
                                {sessionSummary.weakItems.map((item, index) => (
                                    <div key={`${item.questionText}-${index}`} className="rounded-2xl border border-border-light dark:border-border-dark bg-surface-hover-light dark:bg-surface-hover-dark p-4">
                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/8 text-primary text-caption font-semibold mb-3">
                                            <span className="material-symbols-outlined text-[14px]">neurology</span>
                                            <span>{formatExerciseTypeLabel(item.exerciseType)}</span>
                                        </div>
                                        <div className="text-overline text-text-faint-light dark:text-text-faint-dark mb-2">
                                            {item.conceptLabel}
                                        </div>
                                        <p className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark mb-2">
                                            {item.questionText}
                                        </p>
                                        <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark">
                                            Correct answer: <span className="font-medium text-text-main-light dark:text-text-main-dark">{formatCorrectAnswerLabel(item.correctAnswers)}</span>
                                        </p>
                                        {item.explanation ? (
                                            <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark mt-3">
                                                {item.explanation}
                                            </p>
                                        ) : null}
                                        {item.evidenceQuotes.length > 0 && (
                                            <div className="mt-3 space-y-2">
                                                {item.evidenceQuotes.map((quote, quoteIndex) => (
                                                    <div key={`${quote.quote}-${quoteIndex}`} className="rounded-xl bg-surface-light dark:bg-surface-dark px-3 py-2">
                                                        <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark">"{quote.quote}"</p>
                                                        {quote.page ? (
                                                            <p className="text-caption text-text-faint-light dark:text-text-faint-dark mt-1">Source page {quote.page}</p>
                                                        ) : null}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                        <button
                            type="button"
                            onClick={() => void loadSession(
                                sessionSummary.weakConceptKeys.length > 0
                                    ? sessionSummary.weakConceptKeys
                                    : sessionFocusConceptKeys
                            )}
                            className="btn-primary flex-1 py-3 text-body-sm flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-outlined text-[18px]">refresh</span>
                            <span>
                                {sessionSummary.weakConceptKeys.length > 0
                                    ? 'Review Weak Concepts'
                                    : sessionFocusConceptKeys.length > 0
                                        ? 'Retry Review Session'
                                        : 'Retry Session'}
                            </span>
                        </button>
                        <Link
                            to={`/dashboard/exam/${topicId}`}
                            className="btn-secondary flex-1 py-3 text-body-sm flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-outlined text-[18px]">quiz</span>
                            <span>Start Objective Quiz</span>
                        </Link>
                        <Link
                            to={`/dashboard/topic/${topicId}`}
                            className="btn-secondary px-4 py-3 flex items-center justify-center"
                        >
                            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                        </Link>
                    </div>
                </main>
            </div>
        );
    }

    if (!currentExercise) {
        return (
            <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-2 border-border-light dark:border-border-dark border-t-primary mx-auto mb-4"></div>
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark">Loading your session...</p>
                </div>
            </div>
        );
    }

    const templateParts = Array.isArray(currentExercise?.template) ? currentExercise.template : [];
    let blankCounter = 0;

    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark">
            <header className="sticky top-0 z-40 bg-surface-light/90 dark:bg-surface-dark/90 backdrop-blur-md border-b border-border-light dark:border-border-dark">
                <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link to={`/dashboard/topic/${topicId}`} className="btn-icon w-10 h-10">
                            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                        </Link>
                        <div>
                            <h1 className="text-body-base font-semibold text-text-main-light dark:text-text-main-dark">Concept Practice</h1>
                            <p className="text-caption text-text-faint-light dark:text-text-faint-dark truncate max-w-[150px] sm:max-w-xs">{topicTitle}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {sessionFocusConceptKeys.length > 0 && (
                            <div className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-accent-amber/10 px-2.5 py-1 text-caption font-semibold text-accent-amber">
                                <span className="material-symbols-outlined text-[14px]">cycle</span>
                                <span>Review mode</span>
                            </div>
                        )}
                        {logicStrength !== null && (
                            <div className="hidden sm:flex items-center gap-2">
                                <div className="w-20 h-1.5 bg-surface-hover-light dark:bg-surface-hover-dark rounded-full overflow-hidden">
                                    <div className="h-full bg-accent-emerald rounded-full" style={{ width: `${logicStrength}%` }}></div>
                                </div>
                                <span className="text-caption font-semibold text-text-sub-light dark:text-text-sub-dark">{logicStrength}%</span>
                            </div>
                        )}
                        <div className="text-caption font-semibold px-2.5 py-1 rounded-full bg-primary/8 text-primary">
                            {Math.min(currentIndex + 1, sessionLength)}/{sessionLength}
                        </div>
                    </div>
                </div>
                <div className="h-1 bg-surface-hover-light dark:bg-surface-hover-dark">
                    <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progressPercent}%` }}></div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 py-6 pb-44 md:pb-32">
                <div className="mb-8">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/8 text-primary text-caption font-semibold mb-3">
                        <span className="material-symbols-outlined text-[14px]">neurology</span>
                        <span>{formatExerciseTypeLabel(currentExerciseType)}</span>
                    </div>
                    <h2 className="text-body-lg md:text-display-sm text-text-main-light dark:text-text-main-dark leading-relaxed">
                        {currentExercise.questionText || 'Complete the concept statement.'}
                    </h2>
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark mt-3">
                        Item {currentIndex + 1} of {sessionLength}. {formatExerciseInstructions(currentExerciseType)}
                    </p>
                </div>

                <div className="card-base p-6 md:p-8 mb-4">
                    {isClozeExercise ? (
                        <div className="flex flex-wrap gap-3 items-center justify-center text-body-lg md:text-display-sm leading-relaxed">
                            {templateParts.map((part, index) => {
                                if (part === '__') {
                                    const slotIndex = blankCounter;
                                    const token = selectedTokens[slotIndex];
                                    const isCorrect = submitted
                                        && currentResult
                                        && normalizeConceptAnswer(currentResult.userAnswers[slotIndex]) === normalizeConceptAnswer(currentResult.correctAnswers[slotIndex]);
                                    const isWrong = submitted
                                        && currentResult
                                        && normalizeConceptAnswer(currentResult.userAnswers[slotIndex]) !== normalizeConceptAnswer(currentResult.correctAnswers[slotIndex]);
                                    blankCounter += 1;
                                    return (
                                        <div
                                            key={`blank-${index}`}
                                            onClick={() => handleSlotClick(slotIndex)}
                                            onDragOver={handleDragOver}
                                            onDrop={(event) => handleDrop(event, slotIndex)}
                                            className={`min-h-[44px] min-w-[100px] px-4 py-2 rounded-xl flex items-center justify-center border-2 transition-all cursor-pointer ${
                                                token
                                                    ? isCorrect
                                                        ? 'bg-accent-emerald/10 border-accent-emerald text-accent-emerald'
                                                        : isWrong
                                                            ? 'bg-red-50 dark:bg-red-900/10 border-red-400 dark:border-red-500 text-red-700 dark:text-red-400'
                                                            : 'bg-primary/5 dark:bg-primary/10 border-primary text-primary'
                                                    : 'bg-surface-hover-light dark:bg-surface-hover-dark border-dashed border-border-light dark:border-border-dark text-text-faint-light dark:text-text-faint-dark'
                                            } ${isInteractionDisabled ? 'cursor-default' : 'hover:border-primary'}`}
                                        >
                                            <span className="font-semibold">{token ? token.text : '___'}</span>
                                        </div>
                                    );
                                }

                                return (
                                    <span key={`text-${index}`} className="text-text-sub-light dark:text-text-sub-dark">
                                        {part}
                                    </span>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {currentOptions.map((option, index) => {
                                const isSelected = selectedOptionId === option.id;
                                const isCorrect = submitted && option.id === currentExercise.correctOptionId;
                                const isWrong = submitted && isSelected && option.id !== currentExercise.correctOptionId;
                                const optionLabel = String.fromCharCode(65 + index);

                                return (
                                    <button
                                        key={option.id}
                                        type="button"
                                        onClick={() => handleOptionSelect(option.id)}
                                        disabled={isInteractionDisabled}
                                        className={`w-full rounded-2xl border px-4 py-4 text-left transition-all ${
                                            isCorrect
                                                ? 'border-accent-emerald bg-accent-emerald/10 text-accent-emerald'
                                                : isWrong
                                                    ? 'border-red-400 dark:border-red-500 bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-400'
                                                    : isSelected
                                                        ? 'border-primary bg-primary/8 text-primary'
                                                        : 'border-border-light dark:border-border-dark bg-surface-hover-light dark:bg-surface-hover-dark text-text-main-light dark:text-text-main-dark'
                                        } ${isInteractionDisabled ? 'cursor-default' : 'hover:border-primary active:scale-[0.99]'}`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-caption font-semibold ${
                                                isCorrect
                                                    ? 'border-accent-emerald text-accent-emerald'
                                                    : isWrong
                                                        ? 'border-red-400 dark:border-red-500 text-red-700 dark:text-red-400'
                                                        : isSelected
                                                            ? 'border-primary text-primary'
                                                            : 'border-border-light dark:border-border-dark text-text-faint-light dark:text-text-faint-dark'
                                            }`}>
                                                {optionLabel}
                                            </div>
                                            <span className="text-body-sm">{option.text}</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {submitted && currentResult && (
                        <div className="mt-6 p-4 rounded-xl bg-surface-hover-light dark:bg-surface-hover-dark">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-body-sm font-medium text-text-sub-light dark:text-text-sub-dark">Item Score</span>
                                <span className={`text-display-sm font-semibold ${currentResult.score === currentResult.total ? 'text-accent-emerald' : 'text-primary'}`}>
                                    {currentResult.score}/{currentResult.total}
                                </span>
                            </div>
                            <div className="w-full h-2 bg-border-light dark:bg-border-dark rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full ${currentResult.score === currentResult.total ? 'bg-accent-emerald' : 'bg-primary'}`}
                                    style={{ width: `${(currentResult.score / currentResult.total) * 100}%` }}
                                ></div>
                            </div>
                            {currentResult.score < currentResult.total && (
                                <div className="mt-3 text-body-sm text-text-sub-light dark:text-text-sub-dark">
                                    <span className="font-medium">Correct answer:</span> {formatCorrectAnswerLabel(currentResult.correctAnswers)}
                                </div>
                            )}
                            {currentResult.explanation ? (
                                <div className="mt-3 text-body-sm text-text-sub-light dark:text-text-sub-dark">
                                    {currentResult.explanation}
                                </div>
                            ) : null}
                            {evidenceQuotes.length > 0 && (
                                <div className="mt-4">
                                    <div className="text-overline text-text-faint-light dark:text-text-faint-dark mb-2">Evidence from your source</div>
                                    <div className="space-y-2">
                                        {evidenceQuotes.map((quote, index) => (
                                            <div key={`${quote.quote}-${index}`} className="rounded-xl bg-surface-light dark:bg-surface-dark px-3 py-2">
                                                <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark">"{quote.quote}"</p>
                                                {quote.page ? (
                                                    <p className="text-caption text-text-faint-light dark:text-text-faint-dark mt-1">Source page {quote.page}</p>
                                                ) : null}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {isClozeExercise ? (
                    <div className="card-base p-6">
                        <div className="flex items-center justify-between gap-3 mb-4">
                            <h3 className="text-overline text-text-faint-light dark:text-text-faint-dark">Word Bank</h3>
                            <span className="text-caption text-text-faint-light dark:text-text-faint-dark">
                                {filledCount}/{blanksCount} placed
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {availableTokens.length === 0 ? (
                                <div className="w-full text-center py-4 text-text-faint-light dark:text-text-faint-dark text-body-sm">
                                    All words placed!
                                </div>
                            ) : (
                                availableTokens.map((token) => (
                                    <button
                                        key={token.id}
                                        draggable={!isInteractionDisabled}
                                        onDragStart={(event) => handleDragStart(event, token)}
                                        onClick={() => handleTokenClick(token)}
                                        disabled={isInteractionDisabled}
                                        className={`px-4 py-2 rounded-xl font-medium text-body-sm transition-all ${
                                            isInteractionDisabled
                                                ? 'bg-surface-hover-light dark:bg-surface-hover-dark text-text-faint-light dark:text-text-faint-dark cursor-not-allowed'
                                                : 'bg-primary/8 text-primary hover:bg-primary/15 active:scale-95 cursor-pointer'
                                        }`}
                                    >
                                        {token.text}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                ) : null}

                {saveError && (
                    <div className="mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 text-body-sm text-red-700 dark:text-red-300">
                        {saveError}
                    </div>
                )}
            </main>

            <div className="fixed bottom-16 md:bottom-0 inset-x-0 bg-surface-light dark:bg-surface-dark border-t border-border-light dark:border-border-dark p-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))' }}>
                <div className="max-w-4xl mx-auto flex gap-3">
                    {submitted ? (
                        <>
                            <button
                                type="button"
                                onClick={() => void handleAdvance()}
                                disabled={saving}
                                className="btn-primary flex-1 py-3 text-body-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <span>{saving ? 'Saving...' : currentIndex >= sessionLength - 1 ? 'Finish Session' : 'Next Item'}</span>
                                {!saving && (
                                    <span className="material-symbols-outlined text-[18px]">
                                        {currentIndex >= sessionLength - 1 ? 'done_all' : 'arrow_forward'}
                                    </span>
                                )}
                            </button>
                            <Link to={`/dashboard/topic/${topicId}`} className="btn-secondary px-4 py-3 flex items-center justify-center">
                                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                            </Link>
                        </>
                    ) : (
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={!canSubmit || saving}
                            className="btn-primary w-full py-3 text-body-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <span>Check Answer</span>
                            <span className="material-symbols-outlined text-[18px]">check</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ConceptBuilder;
