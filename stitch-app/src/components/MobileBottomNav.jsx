import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const primaryTabs = [
    { label: 'Dashboard', icon: 'dashboard', path: '/dashboard', matchPaths: ['/dashboard'] },
    { label: 'Lessons', icon: 'menu_book', path: '/dashboard/lessons', matchPaths: ['/dashboard/lessons', '/dashboard/topic'] },
    { label: 'Quizzes', icon: 'quiz', path: '/dashboard/quiz', matchPaths: ['/dashboard/quiz'] },
    { label: 'Flashcards', icon: 'style', path: '/dashboard/flashcards', matchPaths: ['/dashboard/flashcards'] },
];

const moreTabPaths = ['/dashboard/upload', '/dashboard/library', '/dashboard/ai-tutor', '/dashboard/progress', '/dashboard/podcasts', '/dashboard/settings'];

const moreItems = [
    { label: 'Upload', icon: 'cloud_upload', path: '/dashboard/upload', description: 'Add PDFs, slides, notes, or audio' },
    { label: 'My Materials', icon: 'folder', path: '/dashboard/library', description: 'All uploaded files and progress' },
    { label: 'AI Tutor', icon: 'smart_toy', path: '/dashboard/ai-tutor', description: 'Ask follow-up questions' },
    { label: 'Progress', icon: 'bar_chart', path: '/dashboard/progress', description: 'Streaks, mastery, weak topics' },
    { label: 'Podcasts', icon: 'podcasts', path: '/dashboard/podcasts', description: 'Audio revision tracks' },
    { label: 'Settings', icon: 'settings', path: '/dashboard/settings', description: 'Account and preferences' },
];

const isPathActive = (pathname, matchPaths) =>
    matchPaths.some((p) => pathname === p || pathname.startsWith(p + '/'));

const MobileBottomNav = () => {
    const location = useLocation();
    const [moreState, setMoreState] = useState({ open: false, pathname: location.pathname });

    if (moreState.pathname !== location.pathname) {
        setMoreState({ open: false, pathname: location.pathname });
    }

    const moreOpen = moreState.open;
    const setMoreOpen = useCallback((value) => {
        setMoreState((prev) => ({
            open: typeof value === 'function' ? value(prev.open) : value,
            pathname: prev.pathname,
        }));
    }, []);

    useEffect(() => {
        if (!moreOpen) return undefined;
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') setMoreOpen(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [moreOpen, setMoreOpen]);

    const closeMore = useCallback(() => setMoreOpen(false), [setMoreOpen]);
    const isActive = (tab) => isPathActive(location.pathname, tab.matchPaths);
    const moreActive = isPathActive(location.pathname, moreTabPaths);

    return (
        <>
            <nav
                className="fixed bottom-0 inset-x-0 z-50 md:hidden safe-area-bottom
                       bg-surface/90 backdrop-blur-xl
                       border-t border-border-subtle"
                aria-label="Main navigation"
            >
                <div className="flex items-stretch h-16 max-w-md mx-auto">
                    {primaryTabs.map((tab) => {
                        const active = isActive(tab);
                        const className = `flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0
                            transition-colors duration-150
                            ${active ? 'text-primary' : 'text-text-muted'}`;

                        const content = (
                            <span
                                className="material-symbols-outlined text-[24px]"
                                style={active ? { fontVariationSettings: "'FILL' 1, 'wght' 500" } : { fontVariationSettings: "'FILL' 0, 'wght' 400" }}
                            >
                                {tab.icon}
                            </span>
                        );

                        if (active) {
                            return (
                                <span key={tab.path} className={className} aria-current="page">
                                    {content}
                                </span>
                            );
                        }

                        return (
                            <Link key={tab.path} to={tab.path} className={`${className} active:scale-95`}>
                                {content}
                            </Link>
                        );
                    })}
                    <button
                        type="button"
                        onClick={() => setMoreOpen((value) => !value)}
                        aria-expanded={moreOpen}
                        aria-haspopup="menu"
                        aria-label="More navigation"
                        className={`flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 transition-colors duration-150 active:scale-95 ${
                            moreOpen || moreActive ? 'text-primary' : 'text-text-muted'
                        }`}
                    >
                        <span
                            className="material-symbols-outlined text-[24px]"
                            style={moreOpen || moreActive ? { fontVariationSettings: "'FILL' 1, 'wght' 500" } : { fontVariationSettings: "'FILL' 0, 'wght' 400" }}
                        >
                            {moreOpen ? 'close' : 'menu'}
                        </span>
                    </button>
                </div>
            </nav>

            {moreOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40 bg-black/40 md:hidden"
                        onClick={closeMore}
                        aria-hidden="true"
                    />
                    <div
                        role="menu"
                        aria-label="More navigation options"
                        className="fixed bottom-16 inset-x-0 z-50 md:hidden bg-surface border-t border-border-subtle shadow-lg rounded-t-2xl pt-space-3 pb-space-4 safe-area-bottom"
                    >
                        <div className="mx-auto h-1 w-10 rounded-full bg-border-default mb-space-3" />
                        <ul className="px-space-3 grid grid-cols-1 divide-y divide-border-subtle">
                            {moreItems.map((item) => {
                                const active = isPathActive(location.pathname, [item.path]);
                                return (
                                    <li key={item.path}>
                                        <Link
                                            to={item.path}
                                            onClick={closeMore}
                                            className={`flex items-center gap-space-3 px-space-3 py-space-3 rounded-xl transition-colors ${
                                                active ? 'text-primary bg-primary-soft' : 'text-text-primary hover:bg-surface-soft'
                                            }`}
                                            role="menuitem"
                                        >
                                            <span
                                                className="material-symbols-outlined text-[22px]"
                                                style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
                                            >
                                                {item.icon}
                                            </span>
                                            <span className="flex flex-col">
                                                <span className="font-label-md text-label-md">{item.label}</span>
                                                <span className="font-label-xs text-label-xs text-text-muted">{item.description}</span>
                                            </span>
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                </>
            )}
        </>
    );
};

export default MobileBottomNav;
