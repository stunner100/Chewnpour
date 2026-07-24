import React, { memo, useReducer, useEffect, useRef, useCallback } from 'react';

const SAVE_DEBOUNCE_MS = 1500;
const EXIT_ANIMATION_MS = 250;

const notesInitialState = {
    draft: '',
    saving: false,
    lastSavedAt: null,
    statusNow: Date.now(),
    isClosing: false,
};

const notesReducer = (state, action) => {
    switch (action.type) {
        case 'topicChanged':
            return {
                ...state,
                draft: '',
                saving: false,
                lastSavedAt: null,
                statusNow: Date.now(),
            };
        case 'noteLoaded':
            return {
                ...state,
                draft: action.content,
                lastSavedAt: action.updatedAt,
                statusNow: Date.now(),
            };
        case 'appendText': {
            const separator = state.draft.trim() ? '\n\n---\n\n' : '';
            return {
                ...state,
                draft: state.draft + separator + action.text,
            };
        }
        case 'draftChanged':
            return {
                ...state,
                draft: action.value,
            };
        case 'saveStarted':
            return {
                ...state,
                saving: true,
            };
        case 'saveSucceeded':
            return {
                ...state,
                saving: false,
                lastSavedAt: action.savedAt,
                statusNow: action.savedAt,
            };
        case 'saveFinished':
            return {
                ...state,
                saving: false,
            };
        case 'statusTick':
            return {
                ...state,
                statusNow: action.now,
            };
        case 'startClosing':
            return {
                ...state,
                isClosing: true,
            };
        case 'finishClosing':
        case 'reopen':
            return {
                ...state,
                isClosing: false,
            };
        default:
            return state;
    }
};

const formatTimeSince = (timestamp, now = Date.now()) => {
    if (!timestamp) return '';
    const seconds = Math.round((now - timestamp) / 1000);
    if (seconds < 10) return 'Saved just now';
    if (seconds < 60) return `Saved ${seconds}s ago`;
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `Saved ${minutes}m ago`;
    return `Saved ${Math.round(minutes / 60)}h ago`;
};

const fetchTopicNote = async (topicId) => {
    const response = await fetch(`/api/topics/${encodeURIComponent(topicId)}/notes`, {
        credentials: 'include',
    });
    if (response.status === 404) return null;
    if (!response.ok) {
        throw new Error(`Failed to load notes (${response.status})`);
    }
    const payload = await response.json();
    return payload?.note || null;
};

const saveTopicNote = async (topicId, content) => {
    const response = await fetch(`/api/topics/${encodeURIComponent(topicId)}/notes`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
    });
    if (!response.ok) {
        throw new Error(`Failed to save notes (${response.status})`);
    }
    return response.json();
};

const TopicNotesPanel = memo(function TopicNotesPanel({ topicId, open, onClose, appendText }) {
    const [{ draft, saving, lastSavedAt, statusNow, isClosing }, dispatchNotes] = useReducer(
        notesReducer,
        notesInitialState,
    );
    const saveTimerRef = useRef(null);
    const textareaRef = useRef(null);
    const initializedRef = useRef(false);
    const closingTimerRef = useRef(null);

    useEffect(() => {
        if (!topicId) return undefined;
        let cancelled = false;
        initializedRef.current = false;
        dispatchNotes({ type: 'topicChanged' });

        fetchTopicNote(topicId)
            .then((note) => {
                if (cancelled || initializedRef.current) return;
                if (note) {
                    dispatchNotes({
                        type: 'noteLoaded',
                        content: note.content || '',
                        updatedAt: note.updatedAt || null,
                    });
                }
                initializedRef.current = true;
            })
            .catch(() => {
                if (!cancelled) initializedRef.current = true;
            });

        return () => {
            cancelled = true;
        };
    }, [topicId]);

    useEffect(() => {
        if (!appendText || !open) return;
        dispatchNotes({ type: 'appendText', text: appendText });
    }, [appendText, open]);

    const debouncedSave = useCallback((content) => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(async () => {
            if (!topicId) return;
            dispatchNotes({ type: 'saveStarted' });
            try {
                await saveTopicNote(topicId, content);
                dispatchNotes({ type: 'saveSucceeded', savedAt: Date.now() });
            } catch {
                // Silent — user sees stale "last saved" timestamp
            } finally {
                dispatchNotes({ type: 'saveFinished' });
            }
        }, SAVE_DEBOUNCE_MS);
    }, [topicId]);

    const handleDraftChange = (e) => {
        const value = e.target.value;
        dispatchNotes({ type: 'draftChanged', value });
        debouncedSave(value);
    };

    useEffect(() => {
        if (!open || saving || !lastSavedAt) return undefined;
        dispatchNotes({ type: 'statusTick', now: Date.now() });
        const interval = setInterval(() => {
            dispatchNotes({ type: 'statusTick', now: Date.now() });
        }, 5000);
        return () => clearInterval(interval);
    }, [open, saving, lastSavedAt]);

    useEffect(() => {
        if (!open || !textareaRef.current) return undefined;
        const timer = setTimeout(() => textareaRef.current?.focus(), 200);
        return () => clearTimeout(timer);
    }, [open]);

    const handleClose = useCallback(() => {
        if (isClosing) return;
        dispatchNotes({ type: 'startClosing' });
        closingTimerRef.current = setTimeout(() => {
            dispatchNotes({ type: 'finishClosing' });
            onClose();
        }, EXIT_ANIMATION_MS);
    }, [isClosing, onClose]);

    useEffect(() => {
        return () => {
            if (closingTimerRef.current) clearTimeout(closingTimerRef.current);
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        };
    }, []);

    useEffect(() => {
        if (!open) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') handleClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [open, handleClose]);

    if (!open && !isClosing) return null;

    const panelAnimClass = isClosing
        ? 'animate-panel-slide-down md:animate-panel-slide-right'
        : 'animate-panel-slide-up md:animate-panel-slide-left';
    const statusText = saving ? 'Saving…' : formatTimeSince(lastSavedAt, statusNow);

    return (
        <>
            <button
                type="button"
                aria-label="Close notes panel"
                className={`fixed inset-0 z-[55] border-0 bg-black/30 p-0 md:bg-transparent md:pointer-events-none lg:hidden transition-opacity ${isClosing ? 'opacity-0' : 'opacity-100'}`}
                onClick={handleClose}
            />

            <div className={`fixed inset-0 z-[60] md:inset-x-auto md:right-0 md:top-0 md:bottom-0 md:w-[420px] flex flex-col bg-white dark:bg-zinc-900 border-t md:border-t-0 md:border-l border-zinc-200 dark:border-zinc-800 shadow-xl ${panelAnimClass} pb-[env(safe-area-inset-bottom)] md:pb-0`}>
                <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-amber-500 text-xl">edit_note</span>
                        <h3 className="text-base font-semibold text-zinc-900 dark:text-white">My Notes</h3>
                    </div>
                    <button
                        onClick={handleClose}
                        className="size-10 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-primary flex items-center justify-center"
                        aria-label="Close notes panel"
                    >
                        <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                </div>

                <div className="flex-1 overflow-hidden p-4">
                    <textarea
                        ref={textareaRef}
                        value={draft}
                        onChange={handleDraftChange}
                        placeholder="Jot down insights as you study..."
                        className="size-full min-h-[200px] md:min-h-0 resize-none rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-3 text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                    />
                </div>

                <div className="px-4 py-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                    <span className="text-xs text-zinc-400 dark:text-neutral-400">
                        {saving && (
                            <span className="inline-flex items-center gap-1">
                                <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
                                Saving…
                            </span>
                        )}
                        {!saving && statusText && statusText}
                    </span>
                    <span className="text-xs text-zinc-400 dark:text-neutral-400">
                        {draft.length > 0 && `${draft.length} chars`}
                    </span>
                </div>
            </div>
        </>
    );
});

export default TopicNotesPanel;
