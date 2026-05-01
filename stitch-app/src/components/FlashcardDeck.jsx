import React, { useState, useCallback, useEffect } from 'react';

// Single flipping card
const FlashCard = ({ term, definition, flipped, onFlip }) => (
    <button
        type="button"
        onClick={onFlip}
        className="w-full focus:outline-none"
        aria-label={flipped ? 'Card showing definition, click to flip back' : 'Card showing term, click to reveal definition'}
        style={{ perspective: 1000 }}
    >
        <div
            className="relative w-full transition-transform duration-500"
            style={{
                transformStyle: 'preserve-3d',
                transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                minHeight: 220,
            }}
        >
            {/* Front — term */}
            <div
                className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-border-subtle dark:border-border-subtle-dark bg-surface-light dark:bg-surface-dark p-8"
                style={{ backfaceVisibility: 'hidden' }}
            >
                <span className="text-caption text-text-faint-light dark:text-text-faint-dark mb-4 uppercase tracking-widest font-semibold">Term</span>
                <p className="text-display-sm md:text-display-md text-text-main-light dark:text-text-main-dark font-semibold text-center leading-tight">
                    {term}
                </p>
                <span className="mt-6 text-caption text-text-faint-light dark:text-text-faint-dark flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">touch_app</span>
                    Click to reveal
                </span>
            </div>

            {/* Back — definition */}
            <div
                className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-primary/25 bg-primary/5 dark:bg-primary/10 p-8"
                style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
            >
                <span className="text-caption text-primary/70 mb-4 uppercase tracking-widest font-semibold">Definition</span>
                <p className="text-body-lg md:text-display-sm text-text-main-light dark:text-text-main-dark text-center leading-relaxed">
                    {definition}
                </p>
            </div>
        </div>
    </button>
);

const FlashcardDeck = ({ terms, starredTerms, onTermsStarred }) => {
    const [starred, setStarred] = useState(() => new Set(starredTerms || []));
    const [index, setIndex] = useState(0);
    const [flipped, setFlipped] = useState(false);
    const [starredOnly, setStarredOnly] = useState(false);

    const deck = starredOnly
        ? terms.filter((t) => starred.has(t.term))
        : terms;

    // If starred-only filter empties the deck, fall back to all
    const safeDeck = deck.length > 0 ? deck : terms;
    const safeIndex = Math.min(index, safeDeck.length - 1);
    const current = safeDeck[safeIndex];

    const goTo = useCallback((next) => {
        setIndex(next);
        setFlipped(false);
    }, []);

    const prev = useCallback(() => goTo((safeIndex - 1 + safeDeck.length) % safeDeck.length), [goTo, safeIndex, safeDeck.length]);
    const next = useCallback(() => goTo((safeIndex + 1) % safeDeck.length), [goTo, safeIndex, safeDeck.length]);

    const toggleStar = useCallback(() => {
        setStarred((prev) => {
            const next = new Set(prev);
            if (next.has(current.term)) next.delete(current.term);
            else next.add(current.term);
            if (onTermsStarred) onTermsStarred([...next]);
            return next;
        });
    }, [current, onTermsStarred]);

    // Keyboard: ← → to navigate, Space/Enter to flip
    useEffect(() => {
        const onKey = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
            if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
            if (e.key === ' ') { e.preventDefault(); setFlipped((f) => !f); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [prev, next]);

    if (!terms || terms.length === 0) return null;

    const isStarred = starred.has(current.term);
    const starredCount = starred.size;

    return (
        <div className="space-y-4">
            {/* Header row */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark">
                        {safeIndex + 1} <span className="text-text-faint-light dark:text-text-faint-dark font-normal">/ {safeDeck.length}</span>
                    </span>
                    {starredCount > 0 && (
                        <button
                            type="button"
                            onClick={() => { setStarredOnly((v) => !v); setIndex(0); setFlipped(false); }}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-caption font-semibold transition-colors ${
                                starredOnly
                                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                                    : 'bg-surface-hover dark:bg-surface-hover-dark text-text-sub-light dark:text-text-sub-dark hover:text-text-main-light dark:hover:text-text-main-dark'
                            }`}
                        >
                            <span
                                className="material-symbols-outlined text-[14px]"
                                style={starredOnly ? { fontVariationSettings: "'FILL' 1" } : undefined}
                            >star</span>
                            {starredCount} starred
                        </button>
                    )}
                </div>
                <span className="text-caption text-text-faint-light dark:text-text-faint-dark hidden sm:block">
                    ← → to navigate · Space to flip
                </span>
            </div>

            {/* Progress bar */}
            <div className="h-1 bg-border-subtle dark:bg-border-subtle-dark rounded-full overflow-hidden">
                <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${((safeIndex + 1) / safeDeck.length) * 100}%` }}
                />
            </div>

            {/* Card */}
            <FlashCard
                term={current.term}
                definition={current.definition}
                flipped={flipped}
                onFlip={() => setFlipped((f) => !f)}
            />

            {/* Nav + star row */}
            <div className="flex items-center justify-between">
                <button
                    type="button"
                    onClick={prev}
                    className="btn-icon w-10 h-10"
                    aria-label="Previous card"
                >
                    <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                </button>

                <button
                    type="button"
                    onClick={toggleStar}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-body-sm font-semibold transition-colors ${
                        isStarred
                            ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                            : 'btn-secondary'
                    }`}
                    aria-label={isStarred ? 'Unstar this card' : 'Star this card'}
                >
                    <span
                        className="material-symbols-outlined text-[18px]"
                        style={isStarred ? { fontVariationSettings: "'FILL' 1" } : undefined}
                    >star</span>
                    {isStarred ? 'Starred' : 'Star'}
                </button>

                <button
                    type="button"
                    onClick={next}
                    className="btn-icon w-10 h-10"
                    aria-label="Next card"
                >
                    <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                </button>
            </div>
        </div>
    );
};

export default FlashcardDeck;
