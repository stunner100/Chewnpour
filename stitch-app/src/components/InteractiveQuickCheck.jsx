import React, { useState, useCallback, useMemo } from 'react';

const STATUS = { unseen: 'unseen', revealed: 'revealed', mastered: 'mastered', review: 'review' };

const InteractiveQuickCheck = ({ pairs, topicId }) => {
    const storageKey = topicId ? `quickcheck:${topicId}` : null;

    const [statuses, setStatuses] = useState(() => {
        if (storageKey) {
            try {
                const cached = sessionStorage.getItem(storageKey);
                if (cached) return JSON.parse(cached);
            } catch { /* ignore */ }
        }
        return pairs.map(() => STATUS.unseen);
    });

    const persist = useCallback((next) => {
        setStatuses(next);
        if (storageKey) {
            try { sessionStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* ignore */ }
        }
    }, [storageKey]);

    const setStatus = useCallback((index, status) => {
        persist(prev => {
            const next = [...prev];
            next[index] = status;
            return next;
        });
    }, [persist]);

    const masteredCount = useMemo(
        () => statuses.filter(s => s === STATUS.mastered).length,
        [statuses]
    );

    const resetAll = useCallback(() => {
        persist(pairs.map(() => STATUS.unseen));
    }, [pairs, persist]);

    if (!pairs || pairs.length === 0) return null;

    return (
        <div className="space-y-4 mt-2">
            {/* Progress bar */}
            <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 bg-border-light dark:bg-border-dark rounded-full overflow-hidden">
                    <div
                        className="h-full bg-accent-emerald rounded-full transition-all duration-500"
                        style={{ width: `${(masteredCount / pairs.length) * 100}%` }}
                    />
                </div>
                <span className="text-caption text-text-sub-light dark:text-text-sub-dark whitespace-nowrap">
                    {masteredCount}/{pairs.length} mastered
                </span>
                {masteredCount > 0 && (
                    <button onClick={resetAll} className="text-caption text-text-faint-light dark:text-text-faint-dark hover:text-primary transition-colors">
                        Reset
                    </button>
                )}
            </div>

            {/* Question cards */}
            {pairs.map((pair, i) => {
                const status = statuses[i] || STATUS.unseen;
                return (
                    <QuickCheckCard
                        key={pair.key}
                        pair={pair}
                        status={status}
                        onReveal={() => setStatus(i, STATUS.revealed)}
                        onMastered={() => setStatus(i, STATUS.mastered)}
                        onReview={() => setStatus(i, STATUS.review)}
                    />
                );
            })}
        </div>
    );
};

const QuickCheckCard = ({ pair, status, onReveal, onMastered, onReview }) => {
    const isMastered = status === STATUS.mastered;
    const isReview = status === STATUS.review;
    const isRevealed = status === STATUS.revealed || isReview;

    return (
        <div className={`rounded-2xl border p-5 transition-all duration-200 ${
            isMastered
                ? 'bg-accent-emerald/5 border-accent-emerald/30 dark:bg-accent-emerald/10'
                : isReview
                    ? 'bg-amber-50/60 border-amber-200/60 dark:bg-amber-900/10 dark:border-amber-700/30'
                    : 'bg-surface-light dark:bg-surface-dark border-border-light dark:border-border-dark'
        }`}>
            {/* Status indicator */}
            {isMastered && (
                <div className="flex items-center gap-1.5 mb-3">
                    <span className="material-symbols-outlined text-accent-emerald text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    <span className="text-caption font-medium text-accent-emerald">Mastered</span>
                </div>
            )}
            {isReview && !isMastered && (
                <div className="flex items-center gap-1.5 mb-3">
                    <span className="material-symbols-outlined text-amber-500 text-[14px]">replay</span>
                    <span className="text-caption font-medium text-amber-600 dark:text-amber-400">Review again</span>
                </div>
            )}

            {/* Question */}
            <p className="text-body-base font-medium text-text-main-light dark:text-text-main-dark mb-3">
                {pair.questionText}
            </p>

            {/* Answer / Reveal */}
            {(isRevealed || isMastered) ? (
                <>
                    <div className="p-3 rounded-xl bg-primary/5 dark:bg-primary/10 border border-primary/10 dark:border-primary/20 mb-3">
                        <p className="text-body-sm text-text-main-light dark:text-text-main-dark">
                            {pair.answerText}
                        </p>
                    </div>
                    {!isMastered && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={onMastered}
                                className="btn-primary text-caption px-4 py-2 gap-1.5"
                            >
                                <span className="material-symbols-outlined text-[16px]">check</span>
                                Got it
                            </button>
                            <button
                                onClick={onReview}
                                className="btn-secondary text-caption px-4 py-2 gap-1.5"
                            >
                                <span className="material-symbols-outlined text-[16px]">refresh</span>
                                Review again
                            </button>
                        </div>
                    )}
                </>
            ) : (
                <button
                    onClick={onReveal}
                    className="btn-secondary text-caption px-4 py-2 gap-1.5"
                >
                    <span className="material-symbols-outlined text-[16px]">visibility</span>
                    Reveal Answer
                </button>
            )}
        </div>
    );
};

export default InteractiveQuickCheck;
