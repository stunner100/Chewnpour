import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const tabs = [
    {
        label: 'Dashboard',
        icon: 'dashboard',
        path: '/dashboard',
        matchPaths: ['/dashboard'],
    },
    {
        label: 'Assignments',
        icon: 'assignment',
        path: '/dashboard/assignment-helper',
        matchPaths: ['/dashboard/assignment-helper'],
    },
    {
        label: 'Community',
        icon: 'forum',
        path: '/dashboard/community',
        matchPaths: ['/dashboard/community'],
    },
    {
        label: 'Profile',
        icon: 'person',
        path: '/profile',
        matchPaths: ['/profile'],
    },
];

const MobileBottomNav = () => {
    const location = useLocation();

    const isActive = (tab) =>
        tab.matchPaths.some((p) => location.pathname === p) ||
        (tab.path === '/dashboard' && location.pathname === '/dashboard');

    const getTabClassName = (active) => (
        `flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 py-2 rounded-2xl transition-all duration-200 active:scale-95 ${active
            ? 'text-primary'
            : 'text-slate-400 dark:text-neutral-400 hover:text-slate-600 dark:hover:text-slate-300'}`
    );

    const renderTabContent = (tab, active) => (
        <>
            {active && (
                <span className="absolute top-0 w-8 h-[3px] rounded-full bg-primary" />
            )}
            <span
                className={`material-symbols-outlined text-[24px] transition-all ${active ? 'filled' : ''}`}
                style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
                {tab.icon}
            </span>
            <span className={`text-[10px] font-bold tracking-tight ${active ? 'text-primary' : ''}`}>
                {tab.label}
            </span>
        </>
    );

    return (
        <nav
            className="fixed bottom-0 inset-x-0 z-50 md:hidden border-t border-slate-200/60 dark:border-slate-800/60 safe-area-bottom bg-white/82 dark:bg-[#0a0a0a]/85 backdrop-blur-xl"
            role="navigation"
            aria-label="Main navigation"
        >

            <div className="relative flex items-stretch justify-around h-[56px] max-w-md mx-auto px-2">
                {tabs.map((tab) => {
                    const active = isActive(tab);
                    if (active) {
                        return (
                            <span
                                key={tab.path}
                                className={`${getTabClassName(true)} pointer-events-none`}
                                aria-current="page"
                            >
                                {renderTabContent(tab, true)}
                            </span>
                        );
                    }

                    return (
                        <Link
                            key={tab.path}
                            to={tab.path}
                            className={getTabClassName(false)}
                        >
                            {renderTabContent(tab, false)}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
};

export default MobileBottomNav;
