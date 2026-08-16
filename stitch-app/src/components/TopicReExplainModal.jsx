import React, { memo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import AppIcon from './AppIcon';

const RE_EXPLAIN_STYLES = [
    'Simple summary',
    'Step-by-step',
    'Story/analogy',
    'Bullet points',
    'Short & direct',
    'Teach me like I\u2019m 12',
    'Ghanaian Pidgin',
];

const TopicReExplainModal = memo(function TopicReExplainModal({
    open,
    onClose,
    selectedStyle,
    onStyleChange,
    loading,
    error,
    onReExplain,
}) {
    useEffect(() => {
        if (!open) return undefined;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const handleKey = (event) => {
            if (event.key === 'Escape') onClose?.();
        };
        document.addEventListener('keydown', handleKey);
        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', handleKey);
        };
    }, [open, onClose]);

    if (!open || typeof document === 'undefined') return null;

    return createPortal(
        <div
            className="cp-theme fixed inset-0 z-[80] flex items-center justify-center bg-black/60 px-4"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose?.();
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="topic-reexplain-title"
                className="w-full max-w-lg rounded-3xl border border-border-subtle bg-surface-light p-6 text-text-primary shadow-xl dark:border-border-dark dark:bg-surface-dark dark:text-text-main-dark"
            >
                <div className="mb-4 flex items-center justify-between">
                    <h3 id="topic-reexplain-title" className="text-lg font-semibold text-text-primary">
                        Re-explain this lesson
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="btn-icon size-9"
                        aria-label="Close re-explain dialog"
                    >
                        <AppIcon name="close" className="text-[20px]" />
                    </button>
                </div>
                <p className="mb-4 text-sm text-text-secondary">
                    Choose how you want this explanation to be rewritten.
                </p>
                <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {RE_EXPLAIN_STYLES.map((option) => (
                        <button
                            key={option}
                            type="button"
                            onClick={() => onStyleChange(option)}
                            className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                                selectedStyle === option
                                    ? 'border-primary bg-primary text-white'
                                    : 'border-border-subtle bg-surface-soft text-text-secondary'
                            }`}
                        >
                            {option}
                        </button>
                    ))}
                </div>
                {error ? (
                    <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
                        {error}
                    </div>
                ) : null}
                <div className="flex items-center justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl px-4 py-2 text-sm font-semibold text-text-secondary hover:text-text-primary"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onReExplain}
                        disabled={loading}
                        className="btn-primary px-5 py-2 text-sm disabled:opacity-60"
                    >
                        {loading ? 'Rewriting...' : 'Re-explain'}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
});

export default TopicReExplainModal;
