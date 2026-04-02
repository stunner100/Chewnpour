import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import MobileBottomNav from './MobileBottomNav';
import { useAuth } from '../contexts/AuthContext';

const navItems = [
    { label: 'Dashboard', icon: 'space_dashboard', path: '/dashboard', exact: true },
    { label: 'Search', icon: 'search', path: '/dashboard/search' },
    { label: 'Assignments', icon: 'edit_note', path: '/dashboard/assignment-helper' },
    { label: 'Humanizer', icon: 'auto_fix_high', path: '/dashboard/humanizer' },
    { label: 'Community', icon: 'forum', path: '/dashboard/community' },
];

const bottomNavItems = [
    { label: 'Subscription', icon: 'workspace_premium', path: '/subscription' },
    { label: 'Profile', icon: 'person', path: '/profile' },
];

const DashboardLayout = ({ children }) => {
    const location = useLocation();
    const { profile } = useAuth();
    const hideMobileBottomNav = location.pathname.startsWith('/dashboard/exam');
    const isTopicPage = location.pathname.startsWith('/dashboard/topic/');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(isTopicPage);

    useEffect(() => {
        if (!isTopicPage) return undefined;

        const frameId = window.requestAnimationFrame(() => {
            setSidebarCollapsed(true);
        });

        return () => {
            window.cancelAnimationFrame(frameId);
        };
    }, [isTopicPage]);

    const isActive = (item) => {
        if (item.exact) return location.pathname === item.path;
        return location.pathname.startsWith(item.path);
    };

    const displayName = profile?.name || profile?.email?.split('@')[0] || 'Student';
    const initials = displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

    return (
        <div className="dashboard-shell flex h-screen bg-background-light dark:bg-background-dark overflow-hidden">
            {/* Desktop Sidebar */}
            <aside
                className={`hidden md:flex flex-col flex-shrink-0 border-r border-border-subtle dark:border-border-subtle-dark bg-surface-light dark:bg-surface-dark transition-all duration-200 ease-spring ${
                    sidebarCollapsed ? 'w-sidebar-collapsed' : 'w-sidebar'
                }`}
            >
                {/* Logo & Collapse */}
                <div className="flex items-center justify-between h-15 px-4 border-b border-border-subtle dark:border-border-subtle-dark">
                    {!sidebarCollapsed && (
                        <Link to="/dashboard" className="flex items-center gap-2.5">
                            <img src="/chewnpourlogo.png" alt="ChewnPour" className="h-16 w-auto" />
                        </Link>
                    )}
                    {sidebarCollapsed && (
                        <Link to="/dashboard" className="mx-auto">
                            <img src="/chewnpourlogo.png" alt="ChewnPour" className="h-16 w-auto" />
                        </Link>
                    )}
                    <button
                        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                        className="btn-icon"
                        title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    >
                        <span className="material-symbols-outlined text-[20px]">
                            {sidebarCollapsed ? 'menu' : 'menu_open'}
                        </span>
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-0.5">
                    {navItems.map((item) => {
                        const active = isActive(item);
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={active ? 'sidebar-link-active' : 'sidebar-link'}
                                title={sidebarCollapsed ? item.label : undefined}
                            >
                                <span
                                    className={`material-symbols-outlined text-[20px] ${active ? 'filled' : ''}`}
                                    style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
                                >
                                    {item.icon}
                                </span>
                                {!sidebarCollapsed && <span>{item.label}</span>}
                            </Link>
                        );
                    })}
                </nav>

                {/* Bottom Section */}
                <div className="border-t border-border-subtle dark:border-border-subtle-dark py-3 px-2.5 space-y-0.5">
                    {bottomNavItems.map((item) => {
                        const active = isActive(item);
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={active ? 'sidebar-link-active' : 'sidebar-link'}
                                title={sidebarCollapsed ? item.label : undefined}
                            >
                                <span
                                    className={`material-symbols-outlined text-[20px] ${active ? 'filled' : ''}`}
                                    style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
                                >
                                    {item.icon}
                                </span>
                                {!sidebarCollapsed && <span>{item.label}</span>}
                            </Link>
                        );
                    })}

                    {/* User Avatar */}
                    {!sidebarCollapsed && (
                        <div className="flex items-center gap-3 px-3 py-2.5 mt-1">
                            <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-xs font-bold text-primary-700 dark:text-primary-300">
                                {initials}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-body-sm font-medium text-text-main-light dark:text-text-main-dark truncate">
                                    {displayName}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </aside>

            {/* Main Content */}
            <main id="dashboard-main" className="flex-1 overflow-y-auto overflow-x-hidden">
                {children}
            </main>

            {/* Mobile Bottom Nav */}
            {!hideMobileBottomNav && <MobileBottomNav />}
        </div>
    );
};

export default DashboardLayout;
