import React, { useState, useCallback } from 'react';
import FlashcardDeck from './FlashcardDeck';

const TABS = [
    { id: 'flashcards', label: 'Flashcards', icon: 'style' },
    { id: 'browse', label: 'Browse', icon: 'grid_view' },
    { id: 'quiz', label: 'Quiz', icon: 'quiz' },
];

// ── Browse tab ────────────────────────────────────────────────────────────────

const BrowseTab = ({ terms, starred, onToggleStar }) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {terms.map((item) => {
            const isStarred = starred.has(item.term);
            return (
                <div
                    key={item.key ?? item.term}
                    className={`p-4 rounded-xl border transition-all duration-200 ${
                        isStarred
                            ? 'border-primary/30 bg-primary/5 dark:bg-primary/10'
                            : 'border-border-subtle dark:border-border-subtle-dark bg-surface-light dark:bg-surface-dark'
                    }`}
                >
                    <div className="flex items-start justify-between gap-2">
                        <p className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark">
                            {item.term}
                        </p>
                        <button
                            type="button"
                            onClick={() => onToggleStar(item.term)}
                            className="shrink-0 text-text-faint-light dark:text-text-faint-dark hover:text-amber-500 transition-colors"
                            aria-label={isStarred ? 'Unstar term' : 'Star term'}
                        >
                            <span
                                className="material-symbols-outlined text-[18px]"
                                style={isStarred ? { fontVariationSettings: "'FILL' 1", color: 'rgb(245 158 11)' } : undefined}
                            >
                                star
                            </span>
                        </button>
                    </div>
                    <p className="text-caption text-text-sub-light dark:text-text-sub-dark mt-1 leading-relaxed">
                        {item.definition}
                    </p>
                </div>
            );
        })}
    </div>
);

// ── Quiz tab ──────────────────────────────────────────────────────────────────

const QuizTab = ({ terms }) => {
    const [index, setIndex] = useState(0);
    const [revealed, setRevealed] = useState(false);
    const [score, setScore] = useState(0);
    const [done, setDone] = useState(false);

    const restart = useCallback(() => {
        setIndex(0);
        setRevealed(false);
        setScore(0);
        setDone(false);
    }, []);

    const advance = useCallback((gotIt) => {
        const newScore = gotIt ? score + 1 : score;
        if (index + 1 >= terms.length) {
            setScore(newScore);
            setDone(true);
        } else {
            setScore(newScore);
            setIndex(index + 1);
            setRevealed(false);
        }
    }, [index, score, terms.length]);

    if (done) {
        const pct = Math.round((score / terms.length) * 100);
        return (
            <div className="rounded-2xl border border-border-subtle dark:border-border-subtle-dark bg-surface-light dark:bg-surface-dark p-8 text-center">
                <span className="material-symbols-outlined text-[40px] text-amber-500 mb-3" style={{ fontVariationSettings: "'FILL' 1" }}>
                    emoji_events
                </span>
                <h4 className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark mb-1">
                    Quiz complete
                </h4>
                <p className="text-display-sm font-bold text-primary mb-1">{pct}%</p>
                <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark mb-6">
                    {score} of {terms.length} correct
                </p>
                <div className="flex gap-2 justify-center">
                    <button type="button" onClick={restart} className="btn-primary text-body-sm gap-1.5">
                        <span className="material-symbols-outlined text-[16px]">refresh</span>
                        Try again
                    </button>
                </div>
            </div>
        );
    }

    const current = terms[index];
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <span className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark">
                    {index + 1} <span className="text-text-faint-light dark:text-text-faint-dark font-normal">/ {terms.length}</span>
                </span>
                <button type="button" onClick={restart} className="btn-ghost text-caption px-3 py-1.5 gap-1">
                    <span className="material-symbols-outlined text-[14px]">refresh</span>
                    Restart
                </button>
            </div>
            <div className="h-1 bg-border-subtle dark:bg-border-subtle-dark rounded-full overflow-hidden">
                <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${((index + 1) / terms.length) * 100}%` }}
                />
            </div>
            <div className="rounded-2xl border border-border-subtle dark:border-border-subtle-dark bg-surface-light dark:bg-surface-dark p-6">
                <p className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark mb-5">
                    {current.term}
                </p>
                {revealed ? (
                    <>
                        <div className="p-4 rounded-xl bg-primary/5 dark:bg-primary/10 border border-primary/15 dark:border-primary/20 mb-5">
                            <p className="text-body-sm text-text-main-light dark:text-text-main-dark leading-relaxed">
                                {current.definition}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <button type="button" onClick={() => advance(true)} className="btn-primary text-body-sm gap-1.5">
                                <span className="material-symbols-outlined text-[16px]">check</span>
                                Got it
                            </button>
                            <button type="button" onClick={() => advance(false)} className="btn-secondary text-body-sm gap-1.5">
                                <span className="material-symbols-outlined text-[16px]">close</span>
                                Didn't know
                            </button>
                        </div>
                    </>
                ) : (
                    <button type="button" onClick={() => setRevealed(true)} className="btn-secondary text-body-sm gap-1.5">
                        <span className="material-symbols-outlined text-[16px]">visibility</span>
                        Reveal definition
                    </button>
                )}
            </div>
        </div>
    );
};

// ── Root component ────────────────────────────────────────────────────────────

const InteractiveWordBank = ({ terms, starredTerms, onTermsStarred }) => {
    const [activeTab, setActiveTab] = useState('flashcards');
    const [starred, setStarred] = useState(() => new Set(starredTerms || []));

    const toggleStar = useCallback((term) => {
        setStarred((prev) => {
            const next = new Set(prev);
            if (next.has(term)) next.delete(term);
            else next.add(term);
            if (onTermsStarred) onTermsStarred([...next]);
            return next;
        });
    }, [onTermsStarred]);

    if (!terms || terms.length === 0) return null;

    return (
        <div className="space-y-4">
            {/* Section header */}
            <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-primary text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>style</span>
                </span>
                <div>
                    <p className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark leading-tight">Word Bank</p>
                    <p className="text-caption text-text-faint-light dark:text-text-faint-dark">{terms.length} key terms from this lesson</p>
                </div>
            </div>

            {/* Tab bar */}
            <div className="flex gap-1 p-1 rounded-xl bg-surface-hover dark:bg-surface-hover-dark">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-caption font-semibold transition-all duration-150 ${
                            activeTab === tab.id
                                ? 'bg-surface-light dark:bg-surface-dark text-text-main-light dark:text-text-main-dark shadow-sm'
                                : 'text-text-sub-light dark:text-text-sub-dark hover:text-text-main-light dark:hover:text-text-main-dark'
                        }`}
                    >
                        <span className="material-symbols-outlined text-[15px]">{tab.icon}</span>
                        <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Tab content */}
            {activeTab === 'flashcards' && (
                <FlashcardDeck
                    terms={terms}
                    starredTerms={[...starred]}
                    onTermsStarred={onTermsStarred}
                />
            )}
            {activeTab === 'browse' && (
                <BrowseTab terms={terms} starred={starred} onToggleStar={toggleStar} />
            )}
            {activeTab === 'quiz' && (
                <QuizTab terms={terms} />
            )}
        </div>
    );
};

export default InteractiveWordBank;
