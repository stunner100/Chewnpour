import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion as Motion } from 'motion/react';
import MobileBottomNav from './MobileBottomNav';
import { WatermelonToaster } from './watermelon/WatermelonSonner';
import { useAuth } from '../contexts/AuthContext';
import { BlurFade } from './magicui/BlurFade';
import { WatermelonCombobox } from './watermelon/WatermelonCombobox';
import CommandPalette from './CommandPalette';

const SidebarLink = ({ item, active, collapsed, indicatorId }) => (
    <Motion.div
        whileHover={{ x: 2 }}
        whileTap={{ scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        className="relative"
    >
        {active && (
            <Motion.span
                layoutId={indicatorId}
                aria-hidden="true"
                className="absolute inset-0 rounded-xl bg-primary-50 dark:bg-primary-900/20 pointer-events-none"
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            />
        )}
        {active && (
            <Motion.span
                layoutId={`${indicatorId}-bar`}
                aria-hidden="true"
                className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full"
                style={{ background: 'rgb(145, 75, 241)' }}
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            />
        )}
        <Link
            to={item.path}
            className={`${active ? 'sidebar-link-active' : 'sidebar-link'} relative z-[1]`}
            title={collapsed ? item.label : undefined}
            style={active ? { background: 'transparent' } : undefined}
        >
            <span
                className={`material-symbols-outlined text-[20px] ${active ? 'filled' : ''}`}
                style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
                {item.icon}
            </span>
            {!collapsed && <span>{item.label}</span>}
        </Link>
    </Motion.div>
);

const navItems = [
    { label: 'Dashboard', icon: 'space_dashboard', path: '/dashboard', exact: true },
    { label: 'Library', icon: 'auto_stories', path: '/dashboard/search' },
    { label: 'Study Plan', icon: 'event_note', path: '/dashboard/analysis' },
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
    const navigate = useNavigate();
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
                <div className={`flex items-center h-15 border-b border-border-subtle dark:border-border-subtle-dark ${sidebarCollapsed ? 'justify-center px-2' : 'justify-between px-4 gap-2'}`}>
                    {!sidebarCollapsed && (
                        <Link to="/dashboard" className="flex items-center gap-2 min-w-0 overflow-hidden" aria-label="ChewnPour home">
                            <span className="relative inline-flex items-center justify-center shrink-0" style={{ width: 40, height: 40 }}>
                                <svg
                                    viewBox="0 0 100 100"
                                    className="absolute inset-0 w-full h-full text-text-main-light/85 dark:text-white/85"
                                    fill="none"
                                    aria-hidden="true"
                                >
                                    <polygon
                                        points="50,6 90,28 90,72 50,94 10,72 10,28"
                                        stroke="currentColor"
                                        strokeWidth="2.5"
                                        strokeLinejoin="round"
                                        fill="none"
                                    />
                                </svg>
                                <img
                                    src="/logonew.jpeg"
                                    alt=""
                                    aria-hidden="true"
                                    className="relative block object-contain rounded-full"
                                    style={{ width: 28, height: 28 }}
                                    decoding="async"
                                />
                            </span>
                            <span className="font-mono font-bold tracking-tight text-text-main-light dark:text-white text-sm leading-none select-none truncate">
                                ChewnPour
                            </span>
                        </Link>
                    )}
                    <button
                        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                        className="btn-icon flex-shrink-0"
                        title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    >
                        <span className="material-symbols-outlined text-[20px]">
                            {sidebarCollapsed ? 'menu' : 'menu_open'}
                        </span>
                    </button>
                </div>

                {/* Quick Navigation */}
                {!sidebarCollapsed && (
                    <div className="px-2.5 pt-2">
                        <WatermelonCombobox
                            placeholder="Quick jump to..."
                            icon="bolt"
                            options={[
                                { label: 'Dashboard', value: '/dashboard', icon: 'space_dashboard', keywords: ['home', 'main'] },
                                { label: 'Library', value: '/dashboard/search', icon: 'auto_stories', keywords: ['books', 'materials'] },
                                { label: 'Study Plan', value: '/dashboard/analysis', icon: 'event_note', keywords: ['schedule', 'plan'] },
                                { label: 'Assignments', value: '/dashboard/assignment-helper', icon: 'edit_note', keywords: ['homework', 'tasks'] },
                                { label: 'Humanizer', value: '/dashboard/humanizer', icon: 'auto_fix_high', keywords: ['ai', 'rewrite'] },
                                { label: 'Community', value: '/dashboard/community', icon: 'forum', keywords: ['chat', 'discuss'] },
                                { label: 'Subscription', value: '/subscription', icon: 'workspace_premium', keywords: ['premium', 'pay'] },
                                { label: 'Profile', value: '/profile', icon: 'person', keywords: ['account', 'settings'] },
                            ]}
                            value=""
                            onChange={(v) => v && navigate(v)}
                        />
                    </div>
                )}

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-0.5">
                    {navItems.map((item) => (
                        <SidebarLink
                            key={item.path}
                            item={item}
                            active={isActive(item)}
                            collapsed={sidebarCollapsed}
                            indicatorId="sidebar-active-primary"
                        />
                    ))}
                </nav>

                {/* Bottom Section */}
                <div className="border-t border-border-subtle dark:border-border-subtle-dark py-3 px-2.5 space-y-0.5">
                    {bottomNavItems.map((item) => (
                        <SidebarLink
                            key={item.path}
                            item={item}
                            active={isActive(item)}
                            collapsed={sidebarCollapsed}
                            indicatorId="sidebar-active-secondary"
                        />
                    ))}

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
                <BlurFade key={location.pathname} duration={0.35} yOffset={8}>
                    {children}
                </BlurFade>
            </main>

            <WatermelonToaster position="bottom-center" />
            <CommandPalette />
            {/* Mobile Bottom Nav */}
            {!hideMobileBottomNav && <MobileBottomNav />}
        </div>
    );
};

export default DashboardLayout;
