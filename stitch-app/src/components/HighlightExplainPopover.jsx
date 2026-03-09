import React, { memo, useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';

const STYLES = [
    { key: 'explain', label: 'Explain', icon: 'lightbulb' },
    { key: 'breakdown', label: 'Break down', icon: 'account_tree' },
    { key: 'simplify', label: 'Simplify', icon: 'child_care' },
];

const HighlightExplainPopover = memo(function HighlightExplainPopover({
    selection,
    topicId,
    onClose,
    onCopyToNotes,
}) {
    const explainSelection = useAction(api.ai.explainSelection);
    const [loading, setLoading] = useState(false);
    const [explanation, setExplanation] = useState('');
    const [error, setError] = useState('');
    const [activeStyle, setActiveStyle] = useState('');
    const popoverRef = useRef(null);
    const prevSelectionTextRef = useRef('');

    // Reset state when selection changes
    useEffect(() => {
        if (!selection) return;
        if (selection.text !== prevSelectionTextRef.current) {
            setExplanation('');
            setError('');
            setLoading(false);
            setActiveStyle('');
            prevSelectionTextRef.current = selection.text;
        }
    }, [selection]);

    const handleExplain = useCallback(async (style) => {
        if (!topicId || !selection?.text) return;
        setActiveStyle(style);
        setError('');
        setLoading(true);
        setExplanation('');
        try {
            const result = await explainSelection({
                topicId,
                selectedText: selection.text.slice(0, 1000),
                style,
            });
            setExplanation(result?.explanation || 'No explanation generated.');
        } catch {
            setError('Failed to generate explanation. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [topicId, selection, explainSelection]);

    // Click outside to dismiss
    useEffect(() => {
        if (!selection) return;
        const handleClick = (e) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target)) {
                onClose();
            }
        };
        const handleEscape = (e) => {
            if (e.key === 'Escape') onClose();
        };
        // Delay listener attachment so the triggering click doesn't immediately dismiss
        const timer = setTimeout(() => {
            document.addEventListener('mousedown', handleClick);
            document.addEventListener('keydown', handleEscape);
        }, 100);
        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handleClick);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [selection, onClose]);

    // Position: centered above selection, flip below if off-screen
    const style = useMemo(() => {
        if (!selection?.rect) return { display: 'none' };
        const { top, left, width, bottom } = selection.rect;
        const popoverHeight = explanation ? 280 : 52;
        const gap = 10;
        const centerX = left + width / 2;

        // Flip below if not enough room above
        const above = top - gap - popoverHeight > 0;
        return {
            position: 'fixed',
            top: above ? `${top - gap}px` : `${bottom + gap}px`,
            left: `${Math.max(16, Math.min(centerX, window.innerWidth - 16))}px`,
            transform: above ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
            zIndex: 50,
            maxWidth: `${Math.min(380, window.innerWidth - 32)}px`,
        };
    }, [selection, explanation]);

    if (!selection) return null;

    const truncatedText = selection.text.length > 80
        ? selection.text.slice(0, 77) + '...'
        : selection.text;

    return (
        <div ref={popoverRef} style={style} className="w-full">
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
                {/* Selected text preview */}
                <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                    <p className="text-xs text-slate-400 dark:text-slate-500 italic truncate">
                        &ldquo;{truncatedText}&rdquo;
                    </p>
                </div>

                {/* Action buttons */}
                {!loading && !explanation && !error && (
                    <div className="flex items-center gap-1 p-2">
                        {STYLES.map(({ key, label, icon }) => (
                            <button
                                key={key}
                                onClick={() => handleExplain(key)}
                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 hover:bg-primary/10 hover:text-primary dark:hover:bg-primary/20 transition-colors"
                            >
                                <span className="material-symbols-outlined text-[16px]">{icon}</span>
                                {label}
                            </button>
                        ))}
                    </div>
                )}

                {/* Loading state */}
                {loading && (
                    <div className="flex items-center gap-2 px-4 py-3">
                        <span className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                        <span className="text-sm text-slate-500 dark:text-slate-400">
                            {activeStyle === 'breakdown' ? 'Breaking down...' : activeStyle === 'simplify' ? 'Simplifying...' : 'Explaining...'}
                        </span>
                    </div>
                )}

                {/* Error state */}
                {error && !loading && (
                    <div className="px-4 py-3">
                        <p className="text-xs text-amber-700 dark:text-amber-400 mb-2">{error}</p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => handleExplain(activeStyle || 'explain')}
                                className="text-xs font-semibold text-primary hover:text-primary/80"
                            >
                                Retry
                            </button>
                            <button
                                onClick={onClose}
                                className="text-xs font-semibold text-slate-400 hover:text-slate-600"
                            >
                                Dismiss
                            </button>
                        </div>
                    </div>
                )}

                {/* Explanation result */}
                {explanation && !loading && (
                    <div className="px-4 py-3">
                        <div className="max-h-48 overflow-y-auto text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                            {explanation}
                        </div>
                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-2">
                                {onCopyToNotes && (
                                    <button
                                        onClick={() => onCopyToNotes(explanation)}
                                        className="flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-700"
                                    >
                                        <span className="material-symbols-outlined text-[14px]">note_add</span>
                                        Copy to notes
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        setExplanation('');
                                        setError('');
                                        setActiveStyle('');
                                    }}
                                    className="flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-600"
                                >
                                    <span className="material-symbols-outlined text-[14px]">refresh</span>
                                    Try another
                                </button>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-primary flex items-center justify-center"
                            >
                                <span className="material-symbols-outlined text-[16px]">close</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});

export default HighlightExplainPopover;
