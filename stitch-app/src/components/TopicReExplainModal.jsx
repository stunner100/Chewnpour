import React, { memo } from 'react';
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
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Re-explain this lesson</h3>
                    <button
                        onClick={onClose}
                        className="size-9 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-primary flex items-center justify-center"
                    >
                        <AppIcon name="close" className="text-[20px]" />
                    </button>
                </div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">Choose how you want this explanation to be rewritten.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    {RE_EXPLAIN_STYLES.map((option) => (
                        <button
                            key={option}
                            onClick={() => onStyleChange(option)}
                            className={`px-3 py-2 rounded-xl text-sm font-semibold border transition-colors ${selectedStyle === option
                                ? 'bg-primary text-white border-primary'
                                : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700'
                                }`}
                        >
                            {option}
                        </button>
                    ))}
                </div>
                {error && (
                    <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800">
                        {error}
                    </div>
                )}
                <div className="flex items-center justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl text-sm font-semibold text-zinc-600 hover:text-zinc-900"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onReExplain}
                        disabled={loading}
                        className="px-5 py-2 rounded-xl text-sm font-semibold bg-primary text-white shadow-sm shadow-primary/30 hover:shadow-primary/50 disabled:opacity-60"
                    >
                        {loading ? 'Rewriting...' : 'Re-explain'}
                    </button>
                </div>
            </div>
        </div>
    );
});

export default TopicReExplainModal;
