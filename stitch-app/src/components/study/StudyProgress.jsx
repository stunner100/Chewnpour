import React from 'react';

/**
 * Slim study-mode progress indicator: "Section 2 of 5" + a thin bar with an
 * advancing knob. Purely presentational.
 */
const StudyProgress = ({ index, total, label, percent, className = '' }) => {
    const safeTotal = Math.max(0, Number(total) || 0);
    const safeIndex = Math.min(Math.max(0, Number(index) || 0), Math.max(safeTotal - 1, 0));
    const resolvedPercent = Number.isFinite(percent)
        ? Math.max(0, Math.min(100, Math.round(percent)))
        : (safeTotal > 0 ? Math.round(((safeIndex + 1) / safeTotal) * 100) : 0);
    const text = label || (safeTotal > 0 ? `Section ${safeIndex + 1} of ${safeTotal}` : '');

    return (
        <div className={`flex items-center gap-3 ${className}`}>
            {text ? (
                <p className="whitespace-nowrap text-caption font-semibold text-text-secondary">
                    {text}
                </p>
            ) : null}
            <div
                className="relative h-1 w-full overflow-hidden rounded-full bg-surface-soft"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={resolvedPercent}
                aria-label={text ? `${text} — ${resolvedPercent}%` : `${resolvedPercent}%`}
            >
                <div
                    className="relative h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
                    style={{ width: `${resolvedPercent}%` }}
                >
                    <span
                        aria-hidden="true"
                        className="absolute right-0 top-1/2 size-2 -translate-y-1/2 translate-x-1/2 rounded-full bg-primary"
                    />
                </div>
            </div>
            <p className="w-9 shrink-0 text-right text-caption font-semibold tabular-nums text-text-muted">
                {resolvedPercent}%
            </p>
        </div>
    );
};

export default StudyProgress;
