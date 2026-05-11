import React, { useState } from 'react';

const FlashcardStudySession = () => {
    const [flipped, setFlipped] = useState(false);

    return (
        <div className="flex-1 flex flex-col md:ml-0 h-[calc(100vh-64px)] overflow-hidden">
            <main className="flex-1 min-h-0 flex flex-col items-center justify-start px-space-8 pt-space-8 pb-space-8 w-full max-w-4xl mx-auto">
                {/* Progress Context */}
                <div className="w-full flex justify-between items-center mb-space-8 px-space-4">
                    <h2 className="font-headline-sm text-headline-sm text-text-primary flex items-center gap-2">
                        <span className="material-symbols-outlined text-text-muted">folder</span>
                        Cognitive Psychology 101
                    </h2>
                    <div className="flex items-center gap-3 bg-surface-soft px-4 py-2 rounded-full border border-border-subtle">
                        <div className="w-32 h-1.5 bg-border-subtle rounded-full overflow-hidden">
                            <div className="h-full bg-primary w-[30%] rounded-full"></div>
                        </div>
                        <span className="font-label-md text-label-md text-text-secondary">12/40 cards</span>
                    </div>
                </div>

                {/* Flashcard */}
                <button
                    onClick={() => setFlipped(!flipped)}
                    className="w-full aspect-[3/2] max-w-3xl bg-surface rounded-[24px] shadow-sm hover:shadow-md transition-shadow border border-border-subtle flex flex-col items-center justify-center relative cursor-pointer group mb-space-10"
                >
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-surface-soft/30 rounded-[24px] pointer-events-none"></div>
                    <div className="px-space-12 text-center relative z-10">
                        <h3 className="font-display-xl text-display-xl text-text-primary leading-tight tracking-tight">
                            {flipped ? (
                                <span className="font-body-lg text-body-lg text-text-secondary leading-relaxed">
                                    Neuroplasticity is the brain's ability to reorganize itself by forming new neural connections throughout life. It allows the neurons (nerve cells) in the brain to compensate for injury and disease and to adjust their activities in response to new situations or to changes in their environment.
                                </span>
                            ) : (
                                'Neuroplasticity'
                            )}
                        </h3>
                    </div>
                    <div className="absolute bottom-space-6 flex items-center gap-2 text-text-muted font-label-xs text-label-xs opacity-70 group-hover:opacity-100 transition-opacity bg-surface-soft px-4 py-1.5 rounded-full">
                        <span className="material-symbols-outlined text-[16px]">flip</span>
                        <span>Click or press Space to flip</span>
                    </div>
                </button>

                {/* Mastery Actions */}
                <div className="flex gap-space-4 justify-center w-full max-w-2xl">
                    <button className="flex-1 flex flex-col items-center justify-center gap-1 bg-surface hover:bg-error-soft border border-border-subtle hover:border-error-soft py-space-3 rounded-xl transition-all shadow-sm group">
                        <span className="font-label-md text-label-md text-text-primary group-hover:text-error transition-colors">Again</span>
                        <span className="font-label-xs text-label-xs text-text-muted">&lt; 1m</span>
                    </button>
                    <button className="flex-1 flex flex-col items-center justify-center gap-1 bg-surface hover:bg-warning-soft border border-border-subtle hover:border-warning-soft py-space-3 rounded-xl transition-all shadow-sm group">
                        <span className="font-label-md text-label-md text-text-primary group-hover:text-warning transition-colors">Hard</span>
                        <span className="font-label-xs text-label-xs text-text-muted">6m</span>
                    </button>
                    <button className="flex-1 flex flex-col items-center justify-center gap-1 bg-surface hover:bg-primary-soft border border-border-subtle hover:border-primary-soft py-space-3 rounded-xl transition-all shadow-sm group">
                        <span className="font-label-md text-label-md text-text-primary group-hover:text-primary-hover transition-colors">Good</span>
                        <span className="font-label-xs text-label-xs text-text-muted">10m</span>
                    </button>
                    <button className="flex-1 flex flex-col items-center justify-center gap-1 bg-surface hover:bg-success-soft border border-border-subtle hover:border-success-soft py-space-3 rounded-xl transition-all shadow-sm group">
                        <span className="font-label-md text-label-md text-text-primary group-hover:text-success transition-colors">Easy</span>
                        <span className="font-label-xs text-label-xs text-text-muted">4d</span>
                    </button>
                </div>
            </main>
        </div>
    );
};

export default FlashcardStudySession;
