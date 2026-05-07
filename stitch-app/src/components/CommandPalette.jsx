import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion as Motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

const NAV_OPTIONS = [
    { label: 'Dashboard', value: '/dashboard', icon: 'space_dashboard', keywords: ['home', 'main'] },
    { label: 'Library', value: '/dashboard/search', icon: 'auto_stories', keywords: ['books', 'materials', 'upload'] },
    { label: 'Study Plan', value: '/dashboard/analysis', icon: 'event_note', keywords: ['schedule', 'plan', 'analysis'] },
    { label: 'Assignments', value: '/dashboard/assignment-helper', icon: 'edit_note', keywords: ['homework', 'tasks', 'helper'] },
    { label: 'Humanizer', value: '/dashboard/humanizer', icon: 'auto_fix_high', keywords: ['ai', 'rewrite', 'humanize'] },
    { label: 'Community', value: '/dashboard/community', icon: 'forum', keywords: ['chat', 'discuss'] },
    { label: 'Subscription', value: '/subscription', icon: 'workspace_premium', keywords: ['premium', 'pay', 'upgrade'] },
    { label: 'Profile', value: '/profile', icon: 'person', keywords: ['account', 'settings'] },
    { label: 'Start Exam', value: '/dashboard/exam', icon: 'quiz', keywords: ['test', 'exam', 'assessment'] },
    { label: 'Sign Out', value: '__signout', icon: 'logout', keywords: ['sign out', 'log out', 'exit'] },
];

export const CommandPalette = () => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const navigate = useNavigate();
    const inputRef = useRef(null);
    const listRef = useRef(null);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setOpen((prev) => !prev);
                if (!open) {
                    setQuery('');
                    setActiveIndex(0);
                }
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [open]);

    useEffect(() => {
        if (open) {
            requestAnimationFrame(() => inputRef.current?.focus());
        }
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

    useEffect(() => {
        setActiveIndex(0);
    }, [filtered]);

    const handleSelect = useCallback(
        (value) => {
            setOpen(false);
            setQuery('');
            if (value === '__signout') {
                import('../lib/auth-client').then(({ signOut }) => signOut?.());
                return;
            }
            navigate(value);
        },
        [navigate],
    );

    const handleKeyDown = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, 0));
        } else if (e.key === 'Enter' && filtered[activeIndex]) {
            e.preventDefault();
            handleSelect(filtered[activeIndex].value);
        } else if (e.key === 'Escape') {
            setOpen(false);
        }
    };

    useEffect(() => {
        if (!open) return undefined;
        const handleClick = (e) => {
            if (e.target === e.currentTarget) setOpen(false);
        };
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, [open]);

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
                        onClick={() => setOpen(false)}
                    />
                    <Motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="fixed z-[201] top-[20%] left-1/2 -translate-x-1/2 w-[90vw] max-w-lg"
                    >
                        <div className="rounded-2xl border border-border-subtle dark:border-border-subtle-dark bg-surface-light dark:bg-surface-dark shadow-elevated overflow-hidden">
                            <div className="flex items-center gap-3 px-4 border-b border-border-subtle dark:border-border-subtle-dark">
                                <span className="material-symbols-outlined text-[20px] text-text-faint-light dark:text-text-faint-dark">search</span>
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Search pages, actions..."
                                    className="flex-1 py-4 text-sm bg-transparent text-text-main-light dark:text-text-main-dark placeholder:text-text-faint-light dark:placeholder:text-text-faint-dark focus:outline-none"
                                />
                                <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded-md border border-border-light dark:border-border-dark bg-surface-hover-light dark:bg-surface-hover-dark px-2 py-0.5 text-[10px] font-mono text-text-faint-light dark:text-text-faint-dark">
                                    ESC
                                </kbd>
                            </div>
                            <div ref={listRef} className="max-h-[320px] overflow-y-auto py-1.5">
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
                                            onMouseEnter={() => setActiveIndex(index)}
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
