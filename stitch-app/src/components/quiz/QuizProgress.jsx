import React from 'react';

/**
 * Quiet quiz progress indicator: "Question X of N" label plus a thin
 * segmented-style progress bar. Presentational only.
 */
const QuizProgress = ({ current, total }) => {
    const pct = total > 0 ? Math.round(((current + 1) / total) * 100) : 0;
    return (
        <div className="w-full">
            <div className="mb-2 flex items-center justify-between text-caption font-semibold text-text-secondary">
                <span>
                    Question {current + 1} of {total}
                </span>
                <span aria-hidden="true">{pct}%</span>
            </div>
            <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={total}
                aria-valuenow={current + 1}
                aria-label={`Question ${current + 1} of ${total}`}
                className="h-1.5 overflow-hidden rounded-full bg-surface-soft"
            >
                <div
                    className="h-full rounded-full bg-cta transition-[width] duration-300 ease-out"
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
};

export default QuizProgress;
