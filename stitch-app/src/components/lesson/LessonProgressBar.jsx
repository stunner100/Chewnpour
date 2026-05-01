import React from 'react';

const LessonProgressBar = ({ progress = 0, activeSection, quizReady }) => (
    <div className="sticky top-[68px] lg:top-[72px] z-20 bg-background-light/85 dark:bg-background-dark/85 backdrop-blur-md border-b border-border-subtle dark:border-border-subtle-dark">
        <div className="h-1 w-full bg-border-subtle dark:bg-border-subtle-dark">
            <div
                className="h-full bg-gradient-to-r from-primary to-accent-purple transition-[width] duration-150"
                style={{ width: `${progress}%` }}
            />
        </div>
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 h-7 flex items-center gap-3 text-[11px] text-text-faint-light dark:text-text-faint-dark">
            <span className="inline-flex items-center gap-1.5 min-w-0 flex-1">
                <span className="font-semibold text-text-sub-light dark:text-text-sub-dark shrink-0">{progress}%</span>
                {activeSection && (
                    <>
                        <span aria-hidden="true" className="shrink-0">·</span>
                        <span className="truncate">{activeSection}</span>
                    </>
                )}
            </span>
            {quizReady !== undefined && (
                <span className={`hidden sm:inline-flex items-center gap-1 font-semibold shrink-0 ${quizReady ? 'text-emerald-600 dark:text-emerald-400' : 'text-text-faint-light dark:text-text-faint-dark'}`}>
                    <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>{quizReady ? 'check_circle' : 'hourglass_top'}</span>
                    {quizReady ? 'Quiz ready' : 'Quiz preparing'}
                </span>
            )}
        </div>
    </div>
);

export default LessonProgressBar;
