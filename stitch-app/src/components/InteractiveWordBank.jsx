import React, { useState, useCallback } from 'react';

const InteractiveWordBank = ({ terms, starredTerms, onTermsStarred }) => {
    const [starred, setStarred] = useState(() => new Set(starredTerms || []));
    const [quizMode, setQuizMode] = useState(false);
    const [quizIndex, setQuizIndex] = useState(0);
    const [quizRevealed, setQuizRevealed] = useState(false);
    const [quizScore, setQuizScore] = useState(0);
    const [quizDone, setQuizDone] = useState(false);

    const toggleStar = useCallback((term) => {
        setStarred(prev => {
            const next = new Set(prev);
            if (next.has(term)) next.delete(term);
            else next.add(term);
            if (onTermsStarred) onTermsStarred([...next]);
            return next;
        });
    }, [onTermsStarred]);

    const startQuiz = useCallback(() => {
        setQuizMode(true);
        setQuizIndex(0);
        setQuizRevealed(false);
        setQuizScore(0);
        setQuizDone(false);
    }, []);

    const quizNext = useCallback((gotIt) => {
        const newScore = gotIt ? quizScore + 1 : quizScore;
        setQuizScore(newScore);
        if (quizIndex + 1 >= terms.length) {
            setQuizDone(true);
            setQuizScore(newScore);
        } else {
            setQuizIndex(quizIndex + 1);
            setQuizRevealed(false);
        }
    }, [quizIndex, quizScore, terms.length]);

    const starredCount = starred.size;

    if (!terms || terms.length === 0) return null;

    // Quiz mode UI
    if (quizMode) {
        if (quizDone) {
            return (
                <div className="mt-6 mb-2">
                    <div className="card-base p-6 text-center">
                        <span className="material-symbols-outlined text-[32px] text-accent-emerald mb-2">emoji_events</span>
                        <h4 className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark mb-1">
                            Quiz Complete
                        </h4>
                        <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark mb-4">
                            You got {quizScore} out of {terms.length} correct
                        </p>
                        <div className="flex gap-2 justify-center">
                            <button onClick={startQuiz} className="btn-secondary text-caption px-4 py-2 gap-1.5">
                                <span className="material-symbols-outlined text-[16px]">refresh</span>
                                Try Again
                            </button>
                            <button onClick={() => setQuizMode(false)} className="btn-ghost text-caption px-4 py-2">
                                Back to Word Bank
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        const currentTerm = terms[quizIndex];
        return (
            <div className="mt-6 mb-2">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-caption text-text-sub-light dark:text-text-sub-dark">
                        {quizIndex + 1} / {terms.length}
                    </span>
                    <button onClick={() => setQuizMode(false)} className="btn-ghost text-caption px-3 py-1.5">
                        Exit Quiz
                    </button>
                </div>
                <div className="h-1 bg-border-light dark:bg-border-dark rounded-full overflow-hidden mb-4">
                    <div
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{ width: `${((quizIndex) / terms.length) * 100}%` }}
                    />
                </div>
                <div className="card-base p-6">
                    <p className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark mb-4">
                        {currentTerm.term}
                    </p>
                    {quizRevealed ? (
                        <>
                            <div className="p-3 rounded-xl bg-primary/5 dark:bg-primary/10 border border-primary/10 dark:border-primary/20 mb-4">
                                <p className="text-body-sm text-text-main-light dark:text-text-main-dark">
                                    {currentTerm.definition}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => quizNext(true)} className="btn-primary text-caption px-4 py-2 gap-1.5">
                                    <span className="material-symbols-outlined text-[16px]">check</span>
                                    Got it
                                </button>
                                <button onClick={() => quizNext(false)} className="btn-secondary text-caption px-4 py-2 gap-1.5">
                                    <span className="material-symbols-outlined text-[16px]">close</span>
                                    Didn't know
                                </button>
                            </div>
                        </>
                    ) : (
                        <button onClick={() => setQuizRevealed(true)} className="btn-secondary text-caption px-4 py-2 gap-1.5">
                            <span className="material-symbols-outlined text-[16px]">visibility</span>
                            Reveal Definition
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // Normal grid view
    return (
        <div className="mt-6 mb-2">
            {/* Header with actions */}
            <div className="flex items-center justify-between mb-3">
                <span className="text-caption text-text-sub-light dark:text-text-sub-dark">
                    {starredCount > 0 ? `${starredCount} starred` : `${terms.length} terms`}
                </span>
                <button onClick={startQuiz} className="btn-secondary text-caption px-3.5 py-2 gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">quiz</span>
                    Quiz me
                </button>
            </div>

            {/* Terms grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {terms.map((item) => {
                    const isStarred = starred.has(item.term);
                    return (
                        <div
                            key={item.key}
                            className={`p-4 rounded-xl border transition-all duration-200 ${
                                isStarred
                                    ? 'border-primary/30 bg-primary/5 dark:bg-primary/10'
                                    : 'border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark'
                            }`}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <p className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark">
                                    {item.term}
                                </p>
                                <button
                                    onClick={() => toggleStar(item.term)}
                                    className="shrink-0 text-text-faint-light dark:text-text-faint-dark hover:text-primary transition-colors"
                                    aria-label={isStarred ? 'Unstar term' : 'Star term'}
                                >
                                    <span
                                        className="material-symbols-outlined text-[18px]"
                                        style={isStarred ? { fontVariationSettings: "'FILL' 1", color: 'var(--color-primary, #1a73e8)' } : undefined}
                                    >
                                        star
                                    </span>
                                </button>
                            </div>
                            <p className="text-caption text-text-sub-light dark:text-text-sub-dark mt-1">
                                {item.definition}
                            </p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default InteractiveWordBank;
