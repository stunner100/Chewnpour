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
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
                <div className="text-center max-w-md">
                    <div className="w-16 h-16 rounded-2xl bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center mx-auto mb-4">
                        <span className="material-symbols-outlined text-3xl text-blue-500">school</span>
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Select a Topic</h2>
                    <p className="text-slate-500 mb-6">Choose a topic from your dashboard to start practicing concepts.</p>
                    <Link to="/dashboard" className="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 transition-colors">
                        <span>Go to Dashboard</span>
                        <span className="material-symbols-outlined">arrow_forward</span>
                    </Link>
                </div>
            </div>
        );
    }

    if (topicData === undefined || (loading && !exercise)) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
                <div className="text-center">
                    <div className="relative w-16 h-16 mx-auto mb-4">
                        <div className="absolute inset-0 rounded-full border-4 border-slate-100 dark:border-slate-800"></div>
                        <div className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin"></div>
                    </div>
                    <p className="text-slate-500 font-medium">Preparing exercise...</p>
                </div>
            </div>
        );
    }

    if (topicData === null) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
                <div className="text-center max-w-md">
                    <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-4">
                        <span className="material-symbols-outlined text-3xl text-red-500">error</span>
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Topic Not Found</h2>
                    <p className="text-slate-500 mb-6">We couldn't find this topic.</p>
                    <Link to="/dashboard" className="inline-flex items-center gap-2 px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl font-semibold hover:bg-slate-200 transition-colors">
                        Back to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
                <div className="text-center max-w-md">
                    <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center mx-auto mb-4">
                        <span className="material-symbols-outlined text-3xl text-amber-500">warning</span>
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Oops!</h2>
                    <p className="text-slate-500 mb-6">{loadError}</p>
                    <button
                        onClick={loadExercise}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 transition-colors"
                    >
                        <span className="material-symbols-outlined">refresh</span>
                        <span>Try Again</span>
                    </button>
                </div>
            </div>
        );
    }

    const templateParts = Array.isArray(exercise?.template) ? exercise.template : [];
    let blankCounter = 0;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800">
                <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link to={`/dashboard/topic/${topicId}`} className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors">
                            <span className="material-symbols-outlined text-lg">arrow_back</span>
                        </Link>
                        <div>
                            <h1 className="text-base font-semibold text-slate-900 dark:text-white">Concept Practice</h1>
                            <p className="text-xs text-slate-500 truncate max-w-[150px] sm:max-w-xs">{topicTitle}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {logicStrength !== null && (
                            <div className="hidden sm:flex items-center gap-2">
                                <div className="w-20 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${logicStrength}%` }}></div>
                                </div>
                                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{logicStrength}%</span>
                            </div>
                        )}
                        <div className="text-xs font-medium px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                            {filledCount}/{blanksCount}
                        </div>
                    </div>
                </div>
                {/* Progress bar */}
                <div className="h-1 bg-slate-100 dark:bg-slate-800">
                    <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                    ></div>
                </div>
            </header>

            {/* Main content */}
            <main className="max-w-4xl mx-auto px-4 py-6 pb-44 md:pb-32">
                {/* Question */}
                <div className="mb-8">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-medium mb-3">
                        <span className="material-symbols-outlined text-sm">psychology</span>
                        <span>Fill in the blanks</span>
                    </div>
                    <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white leading-relaxed">
                        {exercise?.questionText || 'Complete the statement.'}
                    </h2>
                </div>

                {/* Exercise area */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 md:p-8 mb-6">
                    <div className="flex flex-wrap gap-3 items-center justify-center text-lg md:text-xl leading-relaxed">
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
                                                    ? 'bg-green-50 border-green-400 text-green-700 dark:bg-green-900/20 dark:border-green-500 dark:text-green-400'
                                                    : isWrong
                                                        ? 'bg-red-50 border-red-400 text-red-700 dark:bg-red-900/20 dark:border-red-500 dark:text-red-400'
                                                        : 'bg-blue-50 border-blue-400 text-blue-700 dark:bg-blue-900/20 dark:border-blue-500 dark:text-blue-400'
                                                : 'bg-slate-50 border-dashed border-slate-300 text-slate-400 dark:bg-slate-800 dark:border-slate-600'
                                        } ${isInteractionDisabled ? 'cursor-default' : 'hover:border-blue-400'}`}
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
                                    className="text-slate-600 dark:text-slate-400"
                                >
                                    {part}
                                </span>
                            );
                        })}
                    </div>

                    {submitted && result && (
                        <div className="mt-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-800">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Your Score</span>
                                <span className={`text-2xl font-bold ${result.score === result.total ? 'text-green-500' : 'text-blue-500'}`}>
                                    {result.score}/{result.total}
                                </span>
                            </div>
                            <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full rounded-full ${result.score === result.total ? 'bg-green-500' : 'bg-blue-500'}`}
                                    style={{ width: `${(result.score / result.total) * 100}%` }}
                                ></div>
                            </div>
                            {result.score < result.total && (
                                <div className="mt-3 text-sm text-slate-500">
                                    <span className="font-medium">Correct answers:</span> {result.correctAnswers.join(', ')}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Word bank */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Word Bank</h3>
                    <div className="flex flex-wrap gap-2">
                        {availableTokens.length === 0 ? (
                            <div className="w-full text-center py-4 text-slate-400 text-sm">
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
                                    className={`px-4 py-2 rounded-xl font-medium transition-all ${
                                        isInteractionDisabled
                                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                            : 'bg-blue-50 text-blue-700 hover:bg-blue-100 active:scale-95 cursor-pointer dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30'
                                    }`}
                                >
                                    {token.text}
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {saveError && (
                    <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                        {saveError}
                    </div>
                )}
            </main>

            {/* Bottom action bar */}
            <div className="fixed bottom-16 md:bottom-0 inset-x-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 md:safe-area-bottom">
                <div className="max-w-4xl mx-auto flex gap-3">
                    {submitted ? (
                        <>
                            <button
                                onClick={() => loadExercise({ force: true })}
                                className="flex-1 py-3 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined">refresh</span>
                                <span>New Exercise</span>
                            </button>
                            <Link
                                to={`/dashboard/topic/${topicId}`}
                                className="px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl font-semibold hover:bg-slate-200 transition-colors flex items-center justify-center"
                            >
                                <span className="material-symbols-outlined">arrow_back</span>
                            </Link>
                        </>
                    ) : (
                        <button
                            onClick={handleSubmit}
                            disabled={!allFilled || saving}
                            className={`w-full py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                                allFilled && !saving
                                    ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md hover:shadow-lg'
                                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            }`}
                        >
                            <span>{saving ? 'Saving...' : 'Check Answer'}</span>
                            {!saving && <span className="material-symbols-outlined">check</span>}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ConceptBuilder;
