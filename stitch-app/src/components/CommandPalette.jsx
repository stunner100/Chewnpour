import React, { useReducer, useEffect, useEffectEvent, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { m as Motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { signOut } from '../lib/auth-client';

const NAV_OPTIONS = [
    { label: 'Dashboard', value: '/dashboard', icon: 'space_dashboard', keywords: ['home', 'main'] },
    { label: 'Library', value: '/dashboard/library', icon: 'auto_stories', keywords: ['books', 'materials', 'upload'] },
    { label: 'Upload', value: '/dashboard/upload', icon: 'cloud_upload', keywords: ['file', 'pdf', 'material'] },
    { label: 'Lessons', value: '/dashboard/lessons', icon: 'menu_book', keywords: ['read', 'course', 'topic'] },
    { label: 'Quizzes', value: '/dashboard/quiz', icon: 'quiz', keywords: ['test', 'exam', 'assessment'] },
    { label: 'Flashcards', value: '/dashboard/flashcards', icon: 'style', keywords: ['cards', 'review', 'concept'] },
    { label: 'Podcasts', value: '/dashboard/podcasts', icon: 'podcasts', keywords: ['audio', 'listen', 'revision'] },
    { label: 'AI Tutor', value: '/dashboard/ai-tutor', icon: 'smart_toy', keywords: ['chat', 'help', 'explain'] },
    { label: 'Study Plan', value: '/dashboard/progress', icon: 'event_note', keywords: ['schedule', 'plan', 'analysis'] },
    { label: 'Subscription', value: '/dashboard/settings#subscription', icon: 'workspace_premium', keywords: ['premium', 'pay', 'upgrade'] },
    { label: 'Profile', value: '/dashboard/settings#profile', icon: 'person', keywords: ['account', 'settings'] },
    { label: 'Sign Out', value: '__signout', icon: 'logout', keywords: ['sign out', 'log out', 'exit'] },
];

const isEditableTarget = (target) => {
    if (!(target instanceof HTMLElement)) return false;
    const tagName = target.tagName.toLowerCase();
    return target.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select';
};

const commandPaletteInitialState = {
    open: false,
    query: '',
    activeIndex: 0,
};

const commandPaletteReducer = (state, action) => {
    switch (action.type) {
        case 'toggleShortcut':
            return state.open
                ? { ...state, open: false }
                : { open: true, query: '', activeIndex: 0 };
        case 'close':
            return { ...state, open: false };
        case 'closeAndClear':
            return { open: false, query: '', activeIndex: 0 };
        case 'queryChanged':
            return { ...state, query: action.value, activeIndex: 0 };
        case 'activate':
            return { ...state, activeIndex: action.index };
        case 'activateNext':
            return { ...state, activeIndex: Math.min(state.activeIndex + 1, Math.max(0, action.maxIndex)) };
        case 'activatePrevious':
            return { ...state, activeIndex: Math.max(state.activeIndex - 1, 0) };
        default:
            return state;
    }
};

export const CommandPalette = () => {
    const [{ open, query, activeIndex }, dispatchPalette] = useReducer(
        commandPaletteReducer,
        commandPaletteInitialState,
    );
    const navigate = useNavigate();
    const inputRef = useRef(null);
    const listRef = useRef(null);

    const handleGlobalKeyDown = useEffectEvent((e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            if (isEditableTarget(e.target)) return;
            e.preventDefault();
            dispatchPalette({ type: 'toggleShortcut' });
        }
    });

    useEffect(() => {
        document.addEventListener('keydown', handleGlobalKeyDown);
        return () => document.removeEventListener('keydown', handleGlobalKeyDown);
    }, []);

    useEffect(() => {
        const handleOpenRequest = () => dispatchPalette({ type: 'toggleShortcut' });
        window.addEventListener('cp:open-command-palette', handleOpenRequest);
        return () => window.removeEventListener('cp:open-command-palette', handleOpenRequest);
    }, []);

    useEffect(() => {
        if (!open) return undefined;
        const frameId = requestAnimationFrame(() => inputRef.current?.focus());
        return () => cancelAnimationFrame(frameId);
    }, [open]);

    const filtered = useMemo(() => {
        if (!query.trim()) return NAV_OPTIONS;
        const q = query.toLowerCase();
        return NAV_OPTIONS.filter(
            (o) =>
                o.label.toLowerCase().includes(q) ||
                o.keywords?.some((k) => k.toLowerCase().includes(q)),
        );
    }, [query]);

    const handleSelect = useCallback(
        (value) => {
            dispatchPalette({ type: 'closeAndClear' });
            if (value === '__signout') {
                signOut().finally(() => navigate('/login', { replace: true }));
                return;
            }
            navigate(value);
        },
        [navigate],
    );

    const handleQueryChange = (value) => {
        dispatchPalette({ type: 'queryChanged', value });
    };

    const handleKeyDown = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            dispatchPalette({ type: 'activateNext', maxIndex: filtered.length - 1 });
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            dispatchPalette({ type: 'activatePrevious' });
        } else if (e.key === 'Enter' && filtered[activeIndex]) {
            e.preventDefault();
            handleSelect(filtered[activeIndex].value);
        } else if (e.key === 'Escape') {
            dispatchPalette({ type: 'close' });
        }
    };

    useEffect(() => {
        if (!listRef.current) return;
        const activeEl = listRef.current.children[activeIndex];
        activeEl?.scrollIntoView({ block: 'nearest' });
    }, [activeIndex]);

    return (
        <AnimatePresence>
            {open && (
                <>
                    <Motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm"
                        onClick={() => dispatchPalette({ type: 'close' })}
                    />
                    <Motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="fixed z-[201] top-[20%] left-1/2 -translate-x-1/2 w-[90vw] max-w-lg"
                        role="dialog"
                        aria-label="Command palette"
                    >
                        <div className="rounded-2xl border border-border-subtle dark:border-border-subtle-dark bg-surface-light dark:bg-surface-dark shadow-elevated overflow-hidden">
                            <div className="flex items-center gap-3 px-4 border-b border-border-subtle dark:border-border-subtle-dark">
                                <span className="material-symbols-outlined text-[20px] text-text-faint-light dark:text-text-faint-dark">search</span>
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={query}
                                    onChange={(e) => handleQueryChange(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Search pages, actions..."
                                    className="flex-1 py-4 text-sm bg-transparent text-text-main-light dark:text-text-main-dark placeholder:text-text-faint-light dark:placeholder:text-text-faint-dark focus:outline-none"
                                    role="combobox"
                                    aria-expanded={open}
                                    aria-controls="command-palette-list"
                                    aria-activedescendant={filtered[activeIndex] ? `palette-option-${activeIndex}` : undefined}
                                />
                                <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded-md border border-border-light dark:border-border-dark bg-surface-hover-light dark:bg-surface-hover-dark px-2 py-0.5 text-[10px] font-mono text-text-faint-light dark:text-text-faint-dark" aria-hidden="true">
                                    ESC
                                </kbd>
                            </div>
                            <div ref={listRef} id="command-palette-list" role="listbox" className="max-h-[320px] overflow-y-auto py-1.5">
                                {filtered.length === 0 ? (
                                    <p className="px-4 py-6 text-sm text-text-faint-light dark:text-text-faint-dark text-center">
                                        No results found.
                                    </p>
                                ) : (
                                    filtered.map((option, index) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => handleSelect(option.value)}
                                            onMouseEnter={() => dispatchPalette({ type: 'activate', index })}
                                            id={`palette-option-${index}`}
                                            role="option"
                                            aria-selected={index === activeIndex}
                                            className={cn(
                                                'w-full flex items-center gap-3 px-4 py-3 text-left text-sm transition-colors',
                                                index === activeIndex
                                                    ? 'bg-primary-50 dark:bg-primary-900/20 text-primary font-medium'
                                                    : 'text-text-sub-light dark:text-text-sub-dark hover:bg-surface-hover-light dark:hover:bg-surface-hover-dark',
                                            )}
                                        >
                                            <span className="material-symbols-outlined text-[18px] shrink-0">
                                                {option.icon}
                                            </span>
                                            <span className="flex-1 truncate">{option.label}</span>
                                            {index === activeIndex && (
                                                <kbd className="text-[10px] font-mono text-text-faint-light dark:text-text-faint-dark border border-border-light dark:border-border-dark rounded px-1.5 py-0.5">
                                                    ↵
                                                </kbd>
                                            )}
                                        </button>
                                    ))
                                )}
                            </div>
                            <div className="px-4 py-2.5 border-t border-border-subtle dark:border-border-subtle-dark flex items-center gap-4 text-[11px] text-text-faint-light dark:text-text-faint-dark">
                                <span className="inline-flex items-center gap-1">
                                    <kbd className="font-mono border border-border-light dark:border-border-dark rounded px-1">↑↓</kbd> navigate
                                </span>
                                <span className="inline-flex items-center gap-1">
                                    <kbd className="font-mono border border-border-light dark:border-border-dark rounded px-1">↵</kbd> select
                                </span>
                                <span className="inline-flex items-center gap-1">
                                    <kbd className="font-mono border border-border-light dark:border-border-dark rounded px-1">esc</kbd> close
                                </span>
                            </div>
                        </div>
                    </Motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default CommandPalette;
