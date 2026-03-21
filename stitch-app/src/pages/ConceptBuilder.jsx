import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAction, useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';

const ConceptBuilder = () => {
    const { topicId } = useParams();
    const { user } = useAuth();
    const userId = user?.id;

    const topicData = useQuery(
        api.topics.getTopicWithQuestions,
        topicId ? { topicId } : 'skip'
    );
    const conceptAttempts = useQuery(
        api.concepts.getUserConceptAttempts,
        userId ? {} : 'skip'
    );

    const generateConceptExercise = useAction(api.ai.generateConceptExerciseForTopic);
    const createConceptAttempt = useMutation(api.concepts.createConceptAttempt);

    const [exercise, setExercise] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [selectedTokens, setSelectedTokens] = useState([]);
    const [submitted, setSubmitted] = useState(false);
    const [result, setResult] = useState(null);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [startedAt, setStartedAt] = useState(null);

    const topicTitle = topicData?.title || 'Concept Practice';

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
            { score: 0, total: 0 }
        );
        if (totals.total === 0) return null;
        return Math.round((totals.score / totals.total) * 100);
    }, [topicAttempts]);

    const storageKey = topicId && userId ? `conceptExercise:${userId}:${topicId}` : null;

    const loadExercise = useCallback(async (options = {}) => {
        if (!topicId || !userId) return;
        const { force = false } = options;

        if (!force && storageKey) {
            try {
                const cachedRaw = localStorage.getItem(storageKey);
                if (cachedRaw) {
                    const cached = JSON.parse(cachedRaw);
                    const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
                    const isExpired = cached?.cachedAt && (Date.now() - cached.cachedAt) > CACHE_TTL_MS;
                    if (cached?.exercise?.answers?.length && !isExpired) {
                        setExercise(cached.exercise);
                        setSelectedTokens(cached.selectedTokens || Array(cached.exercise.answers.length).fill(null));
                        setSubmitted(Boolean(cached.submitted));
                        setResult(cached.result || null);
                        setStartedAt(cached.startedAt || Date.now());
                        return;
                    }
                    if (isExpired) {
                        localStorage.removeItem(storageKey);
                    }
                }
            } catch (error) {
                console.warn('Failed to read cached concept exercise', error);
            }
        }

        setLoading(true);
        setLoadError('');
        setSaveError('');
        setSubmitted(false);
        setResult(null);
        try {
            const response = await generateConceptExercise({
                topicId,
            });
            const answers = Array.isArray(response?.answers) ? response.answers : [];
            if (!answers.length) {
                throw new Error('No blanks generated for this topic.');
            }
            setExercise(response);
            setSelectedTokens(Array(answers.length).fill(null));
            setStartedAt(Date.now());
        } catch (error) {
            console.error('Failed to generate concept exercise:', error);
            setLoadError('Failed to generate a concept exercise. Please try again.');
            setExercise(null);
            setSelectedTokens([]);
        } finally {
            setLoading(false);
        }
    }, [generateConceptExercise, storageKey, topicId, userId]);

    useEffect(() => {
        loadExercise();
    }, [loadExercise]);

    useEffect(() => {
        if (!storageKey || !exercise) return;
        const payload = {
            exercise,
            selectedTokens,
            submitted,
            result,
            startedAt,
            cachedAt: Date.now(),
        };
        try {
            localStorage.setItem(storageKey, JSON.stringify(payload));
        } catch (error) {
            console.warn('Failed to cache concept exercise', error);
        }
    }, [storageKey, exercise, selectedTokens, submitted, result, startedAt]);

    const tokenItems = useMemo(() => {
        const tokens = Array.isArray(exercise?.tokens) ? exercise.tokens : [];
        const items = tokens.map((text, index) => ({
            id: `${index}-${text}`,
            text,
        }));
        // Shuffle tokens so correct answers aren't in the same order as blanks
        const seed = (exercise?.questionText || '').length + tokens.length;
        const shuffled = [...items];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = ((seed * (i + 1) * 2654435761) >>> 0) % (i + 1);
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }, [exercise]);

    const selectedTokenIds = useMemo(() => {
        return new Set(selectedTokens.filter(Boolean).map((token) => token.id));
    }, [selectedTokens]);

    const availableTokens = useMemo(() => {
        return tokenItems.filter((token) => !selectedTokenIds.has(token.id));
    }, [tokenItems, selectedTokenIds]);

    const blanksCount = exercise?.answers?.length || 0;
    const filledCount = selectedTokens.filter(Boolean).length;
    const allFilled = blanksCount > 0 && filledCount === blanksCount;
    const isInteractionDisabled = submitted || saving;

    const progressPercent = blanksCount > 0 ? Math.round((filledCount / blanksCount) * 100) : 0;

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

    // Must match backend normalizeConceptTextKey to avoid grading mismatches
    const normalize = (text) =>
        String(text || '')
            .toLowerCase()
            .replace(/[\u2018\u2019]/g, "'")
            .replace(/[\u201c\u201d]/g, '"')
            .replace(/[^a-z0-9]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

    const handleSubmit = async () => {
        if (!exercise || !topicId || !userId || !allFilled) return;
        setSaving(true);
        setSaveError('');
        try {
            const correctAnswers = exercise.answers.map(normalize);
            const userAnswers = selectedTokens.map((token) => token?.text || '');
            const score = userAnswers.reduce((acc, answer, index) => {
                return acc + (normalize(answer) === correctAnswers[index] ? 1 : 0);
            }, 0);
            const timeTakenSeconds = startedAt ? Math.round((Date.now() - startedAt) / 1000) : undefined;

            await createConceptAttempt({
                topicId,
                score,
                totalQuestions: correctAnswers.length,
                timeTakenSeconds,
                answers: {
                    userAnswers,
                    correctAnswers: exercise.answers,
                },
                questionText: exercise.questionText,
            });

            setResult({
                score,
                total: correctAnswers.length,
                userAnswers,
                correctAnswers: exercise.answers,
            });
            setSubmitted(true);
        } catch (error) {
            console.error('Failed to save concept attempt:', error);
            setSaveError('Failed to save your result. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    if (!topicId) {
        return (
            <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center px-4">
                <div className="text-center max-w-md">
                    <div className="w-14 h-14 rounded-2xl bg-primary/8 flex items-center justify-center mx-auto mb-4">
                        <span className="material-symbols-outlined text-primary text-[24px]">school</span>
                    </div>
                    <h2 className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark mb-2">Select a Topic</h2>
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark mb-6">Choose a topic from your dashboard to start practicing concepts.</p>
                    <Link to="/dashboard" className="btn-primary inline-flex items-center gap-2 px-6 py-2.5 text-body-sm">
                        <span>Go to Dashboard</span>
                        <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </Link>
                </div>
            </div>
        );
    }

    if (topicData === undefined || (loading && !exercise)) {
        return (
            <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-2 border-border-light dark:border-border-dark border-t-primary mx-auto mb-4"></div>
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark">Preparing exercise...</p>
                </div>
            </div>
        );
    }

    if (topicData === null) {
        return (
            <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center px-4">
                <div className="text-center max-w-md">
                    <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                        <span className="material-symbols-outlined text-red-500 text-[24px]">error</span>
                    </div>
                    <h2 className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark mb-2">Topic Not Found</h2>
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark mb-6">We couldn't find this topic.</p>
                    <Link to="/dashboard" className="btn-secondary inline-flex items-center gap-2 px-6 py-2.5 text-body-sm">
                        Back to Dashboard
                    </Link>
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
                    <h2 className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark mb-2">Oops!</h2>
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark mb-6">{loadError}</p>
                    <button
                        onClick={loadExercise}
                        className="btn-primary inline-flex items-center gap-2 px-6 py-2.5 text-body-sm"
                    >
                        <span className="material-symbols-outlined text-[18px]">refresh</span>
                        <span>Try Again</span>
                    </button>
                </div>
            </div>
        );
    }

    const templateParts = Array.isArray(exercise?.template) ? exercise.template : [];
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
                        {logicStrength !== null && (
                            <div className="hidden sm:flex items-center gap-2">
                                <div className="w-20 h-1.5 bg-surface-hover-light dark:bg-surface-hover-dark rounded-full overflow-hidden">
                                    <div className="h-full bg-accent-emerald rounded-full" style={{ width: `${logicStrength}%` }}></div>
                                </div>
                                <span className="text-caption font-semibold text-text-sub-light dark:text-text-sub-dark">{logicStrength}%</span>
                            </div>
                        )}
                        <div className="text-caption font-semibold px-2.5 py-1 rounded-full bg-primary/8 text-primary">
                            {filledCount}/{blanksCount}
                        </div>
                    </div>
                </div>
                <div className="h-1 bg-surface-hover-light dark:bg-surface-hover-dark">
                    <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                    ></div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 py-6 pb-44 md:pb-32">
                <div className="mb-8">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/8 text-primary text-caption font-semibold mb-3">
                        <span className="material-symbols-outlined text-[14px]">psychology</span>
                        <span>Fill in the blanks</span>
                    </div>
                    <h2 className="text-body-lg md:text-display-sm text-text-main-light dark:text-text-main-dark leading-relaxed">
                        {exercise?.questionText || 'Complete the statement.'}
                    </h2>
                </div>

                <div className="card-base p-6 md:p-8 mb-4">
                    <div className="flex flex-wrap gap-3 items-center justify-center text-body-lg md:text-display-sm leading-relaxed">
                        {templateParts.map((part, index) => {
                            if (part === '__') {
                                const slotIndex = blankCounter;
                                const token = selectedTokens[slotIndex];
                                const isCorrect = submitted
                                    && result
                                    && normalize(result.userAnswers[slotIndex]) === normalize(result.correctAnswers[slotIndex]);
                                const isWrong = submitted
                                    && result
                                    && normalize(result.userAnswers[slotIndex]) !== normalize(result.correctAnswers[slotIndex]);
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
                                        <span className="font-semibold">
                                            {token ? token.text : '___'}
                                        </span>
                                    </div>
                                );
                            }
                            return (
                                <span
                                    key={`text-${index}`}
                                    className="text-text-sub-light dark:text-text-sub-dark"
                                >
                                    {part}
                                </span>
                            );
                        })}
                    </div>

                    {submitted && result && (
                        <div className="mt-6 p-4 rounded-xl bg-surface-hover-light dark:bg-surface-hover-dark">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-body-sm font-medium text-text-sub-light dark:text-text-sub-dark">Your Score</span>
                                <span className={`text-display-sm font-semibold ${result.score === result.total ? 'text-accent-emerald' : 'text-primary'}`}>
                                    {result.score}/{result.total}
                                </span>
                            </div>
                            <div className="w-full h-2 bg-border-light dark:bg-border-dark rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full ${result.score === result.total ? 'bg-accent-emerald' : 'bg-primary'}`}
                                    style={{ width: `${(result.score / result.total) * 100}%` }}
                                ></div>
                            </div>
                            {result.score < result.total && (
                                <div className="mt-3 text-body-sm text-text-sub-light dark:text-text-sub-dark">
                                    <span className="font-medium">Correct answers:</span> {result.correctAnswers.join(', ')}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="card-base p-6">
                    <h3 className="text-overline text-text-faint-light dark:text-text-faint-dark mb-4">Word Bank</h3>
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
                                onClick={() => loadExercise({ force: true })}
                                className="btn-primary flex-1 py-3 text-body-sm flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined text-[18px]">refresh</span>
                                <span>New Exercise</span>
                            </button>
                            <Link
                                to={`/dashboard/topic/${topicId}`}
                                className="btn-secondary px-4 py-3 flex items-center justify-center"
                            >
                                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                            </Link>
                        </>
                    ) : (
                        <button
                            onClick={handleSubmit}
                            disabled={!allFilled || saving}
                            className="btn-primary w-full py-3 text-body-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <span>{saving ? 'Saving...' : 'Check Answer'}</span>
                            {!saving && <span className="material-symbols-outlined text-[18px]">check</span>}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ConceptBuilder;
