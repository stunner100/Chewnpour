import React, { memo } from 'react';

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
            <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Re-explain this lesson</h3>
                    <button
                        onClick={onClose}
                        className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-primary flex items-center justify-center"
                    >
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Choose how you want this explanation to be rewritten.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    {RE_EXPLAIN_STYLES.map((option) => (
                        <button
                            key={option}
                            onClick={() => onStyleChange(option)}
                            className={`px-3 py-2 rounded-xl text-sm font-semibold border transition-colors ${selectedStyle === option
                                ? 'bg-primary text-white border-primary'
                                : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
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
                        className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:text-slate-900"
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
