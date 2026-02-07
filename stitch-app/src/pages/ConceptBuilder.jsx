import React, { useEffect, useMemo, useState } from 'react';
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
        userId ? { userId } : 'skip'
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

    const storageKey = topicId ? `conceptExercise:${topicId}` : null;

    const loadExercise = async (options = {}) => {
        if (!topicId) return;
        const { force = false } = options;

        if (!force && storageKey) {
            try {
                const cachedRaw = localStorage.getItem(storageKey);
                if (cachedRaw) {
                    const cached = JSON.parse(cachedRaw);
                    if (cached?.exercise?.answers?.length) {
                        setExercise(cached.exercise);
                        setSelectedTokens(cached.selectedTokens || Array(cached.exercise.answers.length).fill(null));
                        setSubmitted(Boolean(cached.submitted));
                        setResult(cached.result || null);
                        setStartedAt(cached.startedAt || Date.now());
                        return;
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
            const response = await generateConceptExercise({ topicId });
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
    };

    useEffect(() => {
        if (topicId) {
            loadExercise();
        }
    }, [topicId]);

    useEffect(() => {
        if (!storageKey || !exercise) return;
        const payload = {
            exercise,
            selectedTokens,
            submitted,
            result,
            startedAt,
        };
        try {
            localStorage.setItem(storageKey, JSON.stringify(payload));
        } catch (error) {
            console.warn('Failed to cache concept exercise', error);
        }
    }, [storageKey, exercise, selectedTokens, submitted, result, startedAt]);

    const tokenItems = useMemo(() => {
        const tokens = Array.isArray(exercise?.tokens) ? exercise.tokens : [];
        return tokens.map((text, index) => ({
            id: `${index}-${text}`,
            text,
        }));
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
        event.preventDefault();
        event.stopPropagation();
        try {
            event.dataTransfer.setData('text/plain', token.id);
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.dropEffect = 'move';
        } catch (error) {
            console.warn('Drag start failed', error);
        }
    };

    const handleDrop = (event, slotIndex) => {
        event.preventDefault();
        event.stopPropagation();
        if (isInteractionDisabled) return;
        let tokenId = '';
        try {
            tokenId = event.dataTransfer.getData('text/plain');
        } catch (error) {
            tokenId = '';
        }
        if (!tokenId && event.dataTransfer?.items?.length) {
            const item = event.dataTransfer.items[0];
            if (item.kind === 'string') {
                item.getAsString((value) => {
                    const token = tokenItems.find((itemToken) => itemToken.id === value);
                    if (token) {
                        placeTokenInSlot(slotIndex, token);
                    }
                });
                return;
            }
        }
        const token = tokenItems.find((item) => item.id === tokenId);
        if (token) {
            placeTokenInSlot(slotIndex, token);
        }
    };

    const handleDragOver = (event) => {
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'move';
    };

    const normalize = (text) => String(text || '').trim().toLowerCase();

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
                userId,
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
            <div className="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center">
                <div className="text-center max-w-md px-6">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Select a topic to practice concepts</h2>
                    <p className="text-slate-500 font-medium mb-6">Go back to your dashboard and choose a topic to begin.</p>
                    <Link to="/dashboard" className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/20">
                        Back to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    if (topicData === undefined || (loading && !exercise)) {
        return (
            <div className="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-slate-500 font-medium">Preparing your concept practice...</p>
                </div>
            </div>
        );
    }

    if (topicData === null) {
        return (
            <div className="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center">
                <div className="text-center max-w-md px-6">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Topic not found</h2>
                    <p className="text-slate-500 font-medium mb-6">We couldn’t find this topic. Please return to your dashboard.</p>
                    <Link to="/dashboard" className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/20">
                        Back to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center">
                <div className="text-center max-w-md px-6">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">We hit a snag</h2>
                    <p className="text-slate-500 font-medium mb-6">{loadError}</p>
                    <button
                        type="button"
                        onClick={loadExercise}
                        className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/20"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    const templateParts = Array.isArray(exercise?.template) ? exercise.template : [];
    let blankCounter = 0;

    return (
        <div className="bg-background-light dark:bg-background-dark font-display antialiased text-[#0d161c] dark:text-white flex flex-col items-center justify-center p-6 md:p-12 min-h-screen">
            <div className="relative flex min-h-[85vh] w-full max-w-6xl flex-col bg-surface-light dark:bg-background-dark shadow-2xl rounded-3xl overflow-hidden">
                <header className="flex flex-col md:flex-row items-start md:items-center justify-between px-8 py-8 md:px-12 md:py-10 bg-surface-light dark:bg-background-dark z-20 border-b border-gray-100 dark:border-gray-800">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-4">
                            <Link to={`/dashboard/topic/${topicId}`} className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-500 dark:text-gray-400">
                                <span className="material-symbols-outlined text-[20px]">close</span>
                            </Link>
                            <div className="flex items-center gap-3">
                                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white leading-tight tracking-tight">Build the Concept</h1>
                                <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-sm font-semibold text-gray-500 dark:text-gray-400">1 of 1</span>
                            </div>
                        </div>
                        <p className="text-base text-gray-500 dark:text-gray-400 font-medium pl-14">Drag words to complete the theory statement.</p>
                    </div>
                    <div className="flex flex-col items-end gap-2 mt-4 md:mt-0">
                        <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                            <span className="material-symbols-outlined text-[20px]">psychology</span>
                            Logic Strength
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-primary">{logicStrength !== null ? `${logicStrength}%` : '—'}</span>
                            <div className="w-32 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                <div className="h-full bg-primary rounded-full" style={{ width: `${logicStrength ?? 0}%` }}></div>
                            </div>
                        </div>
                    </div>
                </header>
                <main className="flex-1 flex flex-col px-8 md:px-16 py-8 md:py-12 relative z-10 w-full overflow-y-auto items-center">
                    <div className="mb-10 w-full max-w-4xl text-center">
                        <p className="text-sm uppercase tracking-widest text-primary font-bold mb-2">{topicTitle}</p>
                        <h2 className="text-3xl md:text-4xl font-semibold leading-tight text-gray-900 dark:text-gray-100">
                            {exercise?.questionText || 'Complete the concept statement.'}
                        </h2>
                    </div>
                    <div className="w-full max-w-5xl bg-gray-50 dark:bg-[#151f28] rounded-[2rem] p-8 md:p-12 mb-10 relative border border-gray-100 dark:border-gray-800/50 shadow-inner">
                        <div className="absolute top-6 left-8 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                            <span className="text-xs font-bold text-gray-400 tracking-wider uppercase">Workspace</span>
                        </div>
                        <div className="mt-10 flex flex-wrap gap-4 md:gap-6 leading-loose justify-center items-center min-h-[120px]">
                            {templateParts.map((part, index) => {
                                if (part === '__') {
                                    const slotIndex = blankCounter;
                                    const token = selectedTokens[slotIndex];
                                    blankCounter += 1;
                                    return (
                                        <div
                                            key={`blank-${index}`}
                                            onClick={() => handleSlotClick(slotIndex)}
                                            onDragOver={handleDragOver}
                                            onDrop={(event) => handleDrop(event, slotIndex)}
                                            className={`h-14 min-w-[140px] px-4 dashed-slot rounded-2xl bg-white/60 dark:bg-white/5 flex items-center justify-center border-2 border-dashed transition-colors ${
                                                token
                                                    ? 'border-primary/70 text-gray-900 dark:text-white bg-white dark:bg-slate-900'
                                                    : 'border-gray-300 dark:border-gray-700 text-gray-400'
                                            } ${isInteractionDisabled ? 'cursor-default' : 'cursor-pointer hover:border-primary/40'}`}
                                        >
                                            <span className="text-lg md:text-xl font-semibold">
                                                {token ? token.text : 'Drop here'}
                                            </span>
                                        </div>
                                    );
                                }
                                return (
                                    <span
                                        key={`text-${index}`}
                                        className="inline-flex items-center px-2 text-gray-500 dark:text-gray-400 text-xl md:text-2xl font-medium"
                                    >
                                        {part}
                                    </span>
                                );
                            })}
                        </div>
                        <div className="mt-8 text-center text-gray-400 dark:text-gray-600 text-sm font-medium">
                            Drag tokens into the empty slots above
                        </div>
                    </div>
                    <div className="w-full max-w-5xl bg-surface-light dark:bg-background-dark pt-4 pb-8">
                        <div className="flex items-center justify-center mb-6">
                            <span className="text-sm font-bold text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800 px-4 py-1.5 rounded-full">Word Bank</span>
                        </div>
                        <div className="flex flex-wrap gap-4 md:gap-5 justify-center">
                            {availableTokens.length === 0 && (
                                <div className="text-sm text-gray-400">All tokens are placed.</div>
                            )}
                            {availableTokens.map((token) => (
                                <div
                                    key={token.id}
                                    draggable={!isInteractionDisabled}
                                    onDragStart={(event) => handleDragStart(event, token)}
                                    onClick={() => handleTokenClick(token)}
                                    className={`cursor-pointer select-none bg-white dark:bg-surface-dark px-6 py-3.5 rounded-2xl border-2 border-primary/40 token-shadow text-gray-900 dark:text-gray-100 font-semibold text-lg transition-all ${
                                        isInteractionDisabled ? 'opacity-60 cursor-default' : 'hover:scale-105 active:scale-95 hover:shadow-md hover:border-primary'
                                    }`}
                                >
                                    {token.text}
                                </div>
                            ))}
                        </div>
                    </div>
                    {result && (
                        <div className="w-full max-w-5xl bg-white dark:bg-slate-900/40 border border-green-200 dark:border-green-900 rounded-2xl p-6 md:p-8 mb-8">
                            <div className="flex flex-wrap items-center justify-between gap-4">
                                <div>
                                    <p className="text-sm font-semibold text-green-500 uppercase tracking-wider">Result Saved</p>
                                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                                        {result.score} / {result.total} correct
                                    </h3>
                                </div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                    Your score updates your knowledge progress automatically.
                                </div>
                            </div>
                        </div>
                    )}
                    {saveError && (
                        <div className="w-full max-w-5xl bg-red-50 border border-red-200 text-red-600 rounded-2xl px-4 py-3 mb-6 text-sm font-semibold">
                            {saveError}
                        </div>
                    )}
                </main>
                <div className="w-full px-8 md:px-12 py-8 bg-surface-light dark:bg-background-dark border-t border-gray-100 dark:border-gray-800 flex flex-col md:flex-row items-center justify-center gap-4">
                    {submitted ? (
                        <>
                            <button
                                type="button"
                                onClick={() => loadExercise({ force: true })}
                                className="w-full md:w-auto max-w-sm bg-primary hover:bg-blue-600 active:bg-blue-700 text-white py-4 md:py-5 px-8 rounded-2xl text-lg font-bold shadow-xl transition-all transform active:scale-[0.98] flex items-center justify-center gap-3 group"
                            >
                                <span>Try Another</span>
                                <span className="material-symbols-outlined text-[22px] group-hover:translate-x-1 transition-transform">autorenew</span>
                            </button>
                            <Link
                                to={`/dashboard/topic/${topicId}`}
                                className="w-full md:w-auto max-w-sm bg-black hover:bg-gray-800 active:bg-gray-900 text-white py-4 md:py-5 px-8 rounded-2xl text-lg font-bold shadow-xl transition-all transform active:scale-[0.98] flex items-center justify-center gap-3 group"
                            >
                                <span>Back to Topic</span>
                                <span className="material-symbols-outlined text-[22px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
                            </Link>
                        </>
                    ) : (
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={!allFilled || saving}
                            className={`w-full max-w-sm py-4 md:py-5 rounded-2xl text-lg font-bold shadow-xl transition-all transform active:scale-[0.98] flex items-center justify-center gap-3 group ${
                                allFilled && !saving
                                    ? 'bg-black hover:bg-gray-800 active:bg-gray-900 text-white'
                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            }`}
                        >
                            <span>{saving ? 'Saving...' : 'Submit Construction'}</span>
                            <span className="material-symbols-outlined text-[22px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ConceptBuilder;
