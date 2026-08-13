import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import AppIcon from './AppIcon';

const primaryTabs = [
    { label: 'Dashboard', icon: 'dashboard', path: '/dashboard', matchPaths: ['/dashboard'] },
    { label: 'Lessons', icon: 'menu_book', path: '/dashboard/lessons', matchPaths: ['/dashboard/lessons', '/dashboard/topic'] },
    { label: 'Quizzes', icon: 'quiz', path: '/dashboard/quiz', matchPaths: ['/dashboard/quiz'] },
    { label: 'Progress', icon: 'bar_chart', path: '/dashboard/progress', matchPaths: ['/dashboard/progress'] },
];

const moreTabPaths = ['/dashboard/upload', '/dashboard/library', '/dashboard/ai-tutor', '/dashboard/exam', '/dashboard/podcasts', '/dashboard/settings'];

const moreItems = [
    { label: 'Upload', icon: 'cloud_upload', path: '/dashboard/upload', description: 'Add PDF, DOCX, or PPTX files' },
    { label: 'My Materials', icon: 'folder', path: '/dashboard/library', description: 'All uploaded files and progress' },
    { label: 'Timed exams', icon: 'school', path: '/dashboard/exam', description: 'Countdown multi-topic exams from your courses' },
    { label: 'Podcasts', icon: 'podcasts', path: '/dashboard/podcasts', description: 'Listen to study podcasts from your materials' },
    { label: 'AI Tutor', icon: 'smart_toy', path: '/dashboard/ai-tutor', description: 'Ask follow-up questions' },
    { label: 'Settings', icon: 'settings', path: '/dashboard/settings', description: 'Account and preferences' },
];

const isPathActive = (pathname, matchPaths) =>
    matchPaths.some((p) => {
        if (p === '/dashboard') return pathname === '/dashboard';
        return pathname === p || pathname.startsWith(p + '/');
    });

const tabClassName = (active) =>
    `flex min-h-11 flex-col items-center justify-center gap-0.5 flex-1 min-w-0 px-0.5
    transition-colors duration-150 rounded-lg
    ${active ? 'text-primary bg-primary-soft' : 'text-text-muted'}`;

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
                <div className="flex items-stretch min-h-16 max-w-md mx-auto px-1">
                    {primaryTabs.map((tab) => {
                        const active = isActive(tab);
                        const content = (
                            <>
                                <AppIcon name={tab.icon} className="text-[22px]" aria-hidden="true" />
                                <span className="max-w-full truncate text-[10px] font-semibold leading-tight tracking-tight">
                                    {tab.label}
                                </span>
                            </>
                        );

                        if (active) {
                            return (
                                <span
                                    key={tab.path}
                                    className={tabClassName(true)}
                                    aria-current="page"
                                    aria-label={tab.label}
                                >
                                    {content}
                                </span>
                            );
                        }

                        return (
                            <Link
                                key={tab.path}
                                to={tab.path}
                                aria-label={tab.label}
                                className={`${tabClassName(false)} active:scale-95`}
                            >
                                {content}
                            </Link>
                        );
                    })}
                    <button
                        type="button"
                        onClick={() => setMoreOpen((value) => !value)}
                        aria-expanded={moreOpen}
                        aria-haspopup="menu"
                        aria-label={moreOpen ? 'Close more navigation' : 'More navigation'}
                        className={`${tabClassName(moreOpen || moreActive)} active:scale-95`}
                    >
                        <AppIcon name={moreOpen ? 'close' : 'menu'} className="text-[22px]" aria-hidden="true" />
                        <span className="max-w-full truncate text-[10px] font-semibold leading-tight tracking-tight">
                            More
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
                                            aria-label={item.label}
                                            className={`flex min-h-11 items-center gap-space-3 px-space-3 py-space-3 rounded-xl transition-colors ${
                                                active ? 'text-primary bg-primary-soft' : 'text-text-primary hover:bg-surface-soft'
                                            }`}
                                            role="menuitem"
                                        >
                                            <AppIcon name={item.icon} className="text-[22px]" aria-hidden="true" />
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
