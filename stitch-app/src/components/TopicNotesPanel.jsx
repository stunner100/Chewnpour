import React, { memo, useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';

const SAVE_DEBOUNCE_MS = 1500;

const formatTimeSince = (timestamp) => {
    if (!timestamp) return '';
    const seconds = Math.round((Date.now() - timestamp) / 1000);
    if (seconds < 10) return 'Saved just now';
    if (seconds < 60) return `Saved ${seconds}s ago`;
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `Saved ${minutes}m ago`;
    return `Saved ${Math.round(minutes / 60)}h ago`;
};

const TopicNotesPanel = memo(function TopicNotesPanel({ topicId, open, onClose, appendText }) {
    const note = useQuery(api.topicNotes.getNote, topicId ? { topicId } : 'skip');
    const saveNote = useMutation(api.topicNotes.saveNote);
    const [draft, setDraft] = useState('');
    const [saving, setSaving] = useState(false);
    const [lastSavedAt, setLastSavedAt] = useState(null);
    const [statusText, setStatusText] = useState('');
    const saveTimerRef = useRef(null);
    const textareaRef = useRef(null);
    const initializedRef = useRef(false);

    // Initialize draft from DB on first load
    useEffect(() => {
        if (note && !initializedRef.current) {
            setDraft(note.content || '');
            setLastSavedAt(note.updatedAt || null);
            initializedRef.current = true;
        }
        if (note === null && !initializedRef.current) {
            initializedRef.current = true;
        }
    }, [note]);

    // Reset initialization when topic changes
    useEffect(() => {
        initializedRef.current = false;
        setDraft('');
        setLastSavedAt(null);
        setStatusText('');
    }, [topicId]);

    // Handle appendText from "Copy to notes"
    useEffect(() => {
        if (!appendText || !open) return;
        setDraft((prev) => {
            const separator = prev.trim() ? '\n\n---\n\n' : '';
            return prev + separator + appendText;
        });
    }, [appendText, open]);

    // Auto-save with debounce
    const debouncedSave = useCallback((content) => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(async () => {
            if (!topicId) return;
            setSaving(true);
            try {
                await saveNote({ topicId, content });
                setLastSavedAt(Date.now());
            } catch {
                // Silent — user sees stale "last saved" timestamp
            } finally {
                setSaving(false);
            }
        }, SAVE_DEBOUNCE_MS);
    }, [topicId, saveNote]);

    const handleChange = (e) => {
        const value = e.target.value;
        setDraft(value);
        debouncedSave(value);
    };

    // Update status text periodically
    useEffect(() => {
        if (!open) return;
        const update = () => {
            if (saving) {
                setStatusText('Saving...');
            } else if (lastSavedAt) {
                setStatusText(formatTimeSince(lastSavedAt));
            } else {
                setStatusText('');
            }
        };
        update();
        const interval = setInterval(update, 5000);
        return () => clearInterval(interval);
    }, [open, saving, lastSavedAt]);

    // Focus textarea when panel opens
    useEffect(() => {
        if (open && textareaRef.current) {
            setTimeout(() => textareaRef.current?.focus(), 200);
        }
    }, [open]);

    // Escape to close
    useEffect(() => {
        if (!open) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <>
            {/* Backdrop (mobile) */}
            <div
                className="fixed inset-0 z-40 bg-black/30 md:bg-transparent md:pointer-events-none"
                onClick={onClose}
            />

            {/* Panel */}
            <div className="fixed z-[60] inset-0 md:inset-x-auto md:right-0 md:top-0 md:bottom-0 md:w-80 flex flex-col bg-white dark:bg-slate-900 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-800 shadow-xl animate-slide-up md:animate-slide-left pb-[env(safe-area-inset-bottom)] md:pb-0">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-amber-500 text-xl">edit_note</span>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">My Notes</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-primary flex items-center justify-center"
                    >
                        <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                </div>

                {/* Textarea */}
                <div className="flex-1 overflow-hidden p-4">
                    <textarea
                        ref={textareaRef}
                        value={draft}
                        onChange={handleChange}
                        placeholder="Jot down insights as you study..."
                        className="w-full h-full min-h-[200px] md:min-h-0 resize-none rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-3 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                    />
                </div>

                {/* Footer */}
                <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                        {saving && (
                            <span className="inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                                Saving...
                            </span>
                        )}
                        {!saving && statusText && statusText}
                    </span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                        {draft.length > 0 && `${draft.length} chars`}
                    </span>
                </div>
            </div>

            {/* Animations */}
            <style>{`
                @keyframes slide-up {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
                @keyframes slide-left {
                    from { transform: translateX(100%); }
                    to { transform: translateX(0); }
                }
                .animate-slide-up {
                    animation: slide-up 0.25s ease-out;
                }
                .animate-slide-left {
                    animation: slide-left 0.25s ease-out;
                }
                @media (min-width: 768px) {
                    .animate-slide-up { animation: slide-left 0.25s ease-out; }
                }
            `}</style>
        </>
    );
});

export default TopicNotesPanel;
