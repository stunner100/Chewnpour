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
        label: 'Humanizer',
        icon: 'auto_fix_high',
        path: '/dashboard/humanizer',
        matchPaths: ['/dashboard/humanizer'],
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

    return (
        <nav
            className="fixed bottom-0 inset-x-0 z-50 md:hidden border-t border-slate-200/60 dark:border-slate-800/60"
            style={{
                background: 'rgba(255,255,255,0.82)',
                backdropFilter: 'blur(20px) saturate(1.8)',
                WebkitBackdropFilter: 'blur(20px) saturate(1.8)',
            }}
            role="navigation"
            aria-label="Main navigation"
        >
            {/* Dark mode background override */}
            <div className="absolute inset-0 bg-[#0a0a0a]/85 dark:block hidden pointer-events-none" style={{ backdropFilter: 'blur(20px)' }} />

            <div className="relative flex items-stretch justify-around h-[56px] max-w-md mx-auto px-2 safe-area-bottom">
                {tabs.map((tab) => {
                    const active = isActive(tab);
                    return (
                        <Link
                            key={tab.path}
                            to={tab.path}
                            className={`flex flex-col items-center justify-center gap-0.5 flex-1 min-w-[64px] py-2 rounded-2xl transition-all duration-200 active:scale-95 ${active
                                ? 'text-primary'
                                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                                }`}
                            aria-current={active ? 'page' : undefined}
                        >
                            {active && (
                                <span className="absolute top-0 w-8 h-[3px] rounded-full bg-primary" />
                            )}
                            <span
                                className={`material-symbols-outlined text-[24px] transition-all ${active ? 'filled' : ''
                                    }`}
                                style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
                            >
                                {tab.icon}
                            </span>
                            <span className={`text-[10px] font-bold tracking-tight ${active ? 'text-primary' : ''}`}>
                                {tab.label}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
};

export default MobileBottomNav;
