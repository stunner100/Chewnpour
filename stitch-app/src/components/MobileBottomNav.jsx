import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const tabs = [
    { label: 'Dashboard', icon: 'dashboard', path: '/dashboard', matchPaths: ['/dashboard'] },
    { label: 'Upload', icon: 'cloud_upload', path: '/dashboard/upload', matchPaths: ['/dashboard/upload'] },
    { label: 'Materials', icon: 'folder', path: '/dashboard/library', matchPaths: ['/dashboard/library'] },
    { label: 'Lessons', icon: 'menu_book', path: '/dashboard/lessons', matchPaths: ['/dashboard/lessons'] },
    { label: 'Podcasts', icon: 'podcasts', path: '/dashboard/podcasts', matchPaths: ['/dashboard/podcasts'] },
];

const MobileBottomNav = () => {
    const location = useLocation();

    const isActive = (tab) =>
        tab.matchPaths.some((p) => location.pathname === p || location.pathname.startsWith(p + '/')) ||
        (tab.path === '/dashboard' && location.pathname === '/dashboard');

    return (
        <nav
            className="fixed bottom-0 inset-x-0 z-50 md:hidden safe-area-bottom
                       bg-surface/90 backdrop-blur-xl
                       border-t border-border-subtle"
            aria-label="Main navigation"
        >
            <div className="flex items-stretch h-16 max-w-md mx-auto">
                {tabs.map((tab) => {
                    const active = isActive(tab);
                    const className = `flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0
                        transition-colors duration-150
                        ${active
                            ? 'text-primary'
                            : 'text-text-muted'
                        }`;

                    const content = (
                        <>
                            <span
                                className="material-symbols-outlined text-[24px]"
                                style={active ? { fontVariationSettings: "'FILL' 1, 'wght' 500" } : { fontVariationSettings: "'FILL' 0, 'wght' 400" }}
                            >
                                {tab.icon}
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
