import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const tabs = [
    { label: 'Home', icon: 'space_dashboard', path: '/dashboard', matchPaths: ['/dashboard'] },
    { label: 'Assignments', icon: 'edit_note', path: '/dashboard/assignment-helper', matchPaths: ['/dashboard/assignment-helper'] },
    { label: 'Community', icon: 'forum', path: '/dashboard/community', matchPaths: ['/dashboard/community'] },
    { label: 'Profile', icon: 'person', path: '/profile', matchPaths: ['/profile'] },
];

const MobileBottomNav = () => {
    const location = useLocation();

    const isActive = (tab) =>
        tab.matchPaths.some((p) => location.pathname === p) ||
        (tab.path === '/dashboard' && location.pathname === '/dashboard');

    return (
        <nav
            className="fixed bottom-0 inset-x-0 z-50 md:hidden safe-area-bottom
                       bg-surface-light/90 dark:bg-surface-dark/90 backdrop-blur-xl
                       border-t border-border-subtle dark:border-border-subtle-dark"
            role="navigation"
            aria-label="Main navigation"
        >
            <div className="flex items-stretch h-14 max-w-md mx-auto">
                {tabs.map((tab) => {
                    const active = isActive(tab);
                    const className = `flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0
                        transition-colors duration-150
                        ${active
                            ? 'text-primary'
                            : 'text-text-faint-light dark:text-text-faint-dark'
                        }`;

                    const content = (
                        <>
                            <span
                                className={`material-symbols-outlined text-[22px] ${active ? '' : ''}`}
                                style={active ? { fontVariationSettings: "'FILL' 1, 'wght' 500" } : { fontVariationSettings: "'FILL' 0, 'wght' 300" }}
                            >
                                {tab.icon}
                            </span>
                            <span className="text-[10px] font-semibold tracking-tight leading-none">
                                {tab.label}
                            </span>
                        </>
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
            </div>
        </nav>
    );
};

export default MobileBottomNav;
