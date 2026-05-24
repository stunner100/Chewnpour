import React, { Component, useEffect, useLayoutEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import MobileBottomNav from './MobileBottomNav';
import { WatermelonToaster } from './watermelon/WatermelonSonner';
import { watermelonToast } from './watermelon/watermelonToast';
import { useAuth } from '../contexts/AuthContext';
import { BlurFade } from './magicui/BlurFade';
import CommandPalette from './CommandPalette';
import { captureSentryException } from '../lib/sentry.js';
import { getDashboardDataErrorMessage } from '../lib/dashboardDataErrors.js';
import { LIGHT_THEME, applyTheme } from '../lib/theme.js';
import { HexLogo } from './PublicShell.jsx';

const navItems = [
    { label: 'Dashboard', icon: 'dashboard', path: '/dashboard', exact: true },
    { label: 'Upload', icon: 'cloud_upload', path: '/dashboard/upload' },
    { label: 'My Materials', icon: 'folder', path: '/dashboard/library' },
    { label: 'Lessons', icon: 'menu_book', path: '/dashboard/lessons' },
    { label: 'Quizzes', icon: 'quiz', path: '/dashboard/quiz' },
    { label: 'Flashcards', icon: 'style', path: '/dashboard/flashcards' },
    { label: 'Podcasts', icon: 'podcasts', path: '/dashboard/podcasts' },
    { label: 'AI Tutor', icon: 'smart_toy', path: '/dashboard/ai-tutor' },
    { label: 'Progress', icon: 'bar_chart', path: '/dashboard/progress' },
];

const bottomNavItems = [
    { label: 'Settings', icon: 'settings', path: '/dashboard/settings' },
];

const SUPPORT_EMAIL = 'info@chewnpour.com';
const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}?subject=ChewnPour%20Support`;
const NAV_LINK_CLASS = (active) =>
    `flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-[color,background-color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-soft focus-visible:ring-offset-2 ${
        active
            ? 'text-primary font-bold bg-primary-soft'
            : 'text-text-secondary hover:text-primary hover:bg-surface-variant'
    }`;

const scrollDashboardTargetIntoView = (targetId, options = {}) => {
    if (typeof document === 'undefined') return false;

    const target = document.getElementById(targetId);
    if (!target) return false;

    if ((options.behavior || 'smooth') === 'smooth' && (options.block || 'start') === 'start') {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
        target.scrollIntoView({
            behavior: options.behavior || 'smooth',
            block: options.block || 'start',
        });
    }
    return true;
};

class DashboardContentErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, errorMessage: '' };
    }

    static getDerivedStateFromError(error) {
        return {
            hasError: true,
            errorMessage: getDashboardDataErrorMessage(error),
        };
    }

    componentDidCatch(error, errorInfo) {
        if (import.meta.env.DEV) {
            console.error('[DashboardContentErrorBoundary]', error, errorInfo);
        }

        captureSentryException(error, {
            tags: {
                area: 'dashboard_content_error_boundary',
            },
            extras: {
                componentStack: errorInfo?.componentStack,
            },
        });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-[calc(100vh-4rem)] bg-background-light px-space-6 py-space-10 flex items-center justify-center">
                    <section
                        role="alert"
                        className="max-w-lg rounded-2xl border border-border-subtle bg-surface p-space-8 text-center shadow-sm"
                    >
                        <div className="mx-auto mb-space-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
                            <span aria-hidden="true" className="material-symbols-outlined">cloud_off</span>
                        </div>
                        <h2 className="font-headline-sm text-headline-sm font-bold text-text-primary">
                            Study data unavailable
                        </h2>
                        <p className="mt-space-3 font-body-base text-body-base text-text-secondary">
                            {this.state.errorMessage}
                        </p>
                        <button
                            type="button"
                            onClick={() => window.location.reload()}
                            className="mt-space-6 rounded-xl bg-primary px-space-5 py-space-3 font-label-md text-label-md text-on-primary shadow-sm transition-colors hover:bg-primary-hover"
                        >
                            Retry
                        </button>
                    </section>
                </div>
            );
        }

        return this.props.children;
    }
}

const DashboardLayout = ({ children }) => {
    const routerLocation = useLocation();
    const navigate = useNavigate();
    const { profile } = useAuth();
    const hideMobileBottomNav = /^\/dashboard\/quiz\/(?!results\/)[^/]+/.test(routerLocation.pathname);

    useEffect(() => {
        const incomingToast = routerLocation.state?.watermelonToast;
        if (!incomingToast?.message) return undefined;

        const { watermelonToast: _watermelonToast, ...nextState } = routerLocation.state ?? {};
        const timeoutId = window.setTimeout(() => {
            const options = { type: incomingToast.type || 'info' };
            if (typeof incomingToast.duration === 'number') {
                options.duration = incomingToast.duration;
            }
            watermelonToast(String(incomingToast.message), options);
            navigate(`${routerLocation.pathname}${routerLocation.search}`, { replace: true, state: nextState });
        }, 0);

        return () => window.clearTimeout(timeoutId);
    }, [routerLocation.pathname, routerLocation.search, routerLocation.state, navigate]);

    useLayoutEffect(() => {
        const main = document.getElementById('dashboard-main');
        if (main) main.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }, [routerLocation.pathname, routerLocation.search]);

    useEffect(() => {
        if (!routerLocation.hash) return undefined;

        const targetId = decodeURIComponent(routerLocation.hash.slice(1));
        if (!targetId) return undefined;

        let attempts = 0;
        let timeoutId;

        const scrollToHashTarget = () => {
            if (scrollDashboardTargetIntoView(targetId, { behavior: 'smooth' })) {
                return;
            }

            attempts += 1;
            if (attempts < 8) {
                timeoutId = window.setTimeout(scrollToHashTarget, 50);
            }
        };

        timeoutId = window.setTimeout(scrollToHashTarget, 0);
        return () => window.clearTimeout(timeoutId);
    }, [routerLocation.pathname, routerLocation.hash]);

    const isActive = (item) => {
        if (item.exact) return routerLocation.pathname === item.path;
        return routerLocation.pathname.startsWith(item.path);
    };

    const handleNotificationSettingsClick = (event) => {
        if (routerLocation.pathname === '/dashboard/settings' && routerLocation.hash === '#notifications') {
            event.preventDefault();
            scrollDashboardTargetIntoView('notifications', { behavior: 'smooth' });
        }
    };

    const displayName = profile?.name || profile?.email?.split('@')[0] || 'Student';
    const initials = displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

    useLayoutEffect(() => {
        applyTheme(LIGHT_THEME);
    }, []);

    return (
        <div className="dashboard-shell cp-theme flex h-screen overflow-hidden text-text-primary">
            {/* Desktop Sidebar */}
            <aside className="hidden md:flex fixed left-0 top-0 h-screen w-sidebar-width flex-col border-r border-border-subtle bg-surface-soft p-space-4 gap-space-4 z-20">
                {/* Brand Header */}
                <Link
                    to="/dashboard"
                    aria-label="ChewnPour dashboard"
                    className="flex items-center gap-space-3 px-space-2 mt-space-2 mb-space-2 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-soft focus-visible:ring-offset-2"
                >
                    <HexLogo size={44} className="text-primary" markClassName="text-primary" />
                    <div>
                        <h1 className="font-headline-sm text-headline-sm tracking-tight text-primary font-bold">ChewnPour</h1>
                        <p className="font-label-xs text-label-xs text-text-muted mt-space-1">AI Study Workspace</p>
                    </div>
                </Link>

                {/* Generate Material CTA */}
                <Link
                    to="/dashboard/upload"
                    className="w-full bg-primary text-on-primary font-label-sm text-label-sm py-2.5 rounded-xl flex items-center justify-center gap-space-2 hover:bg-primary-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-soft focus-visible:ring-offset-2 whitespace-nowrap"
                >
                    <span aria-hidden="true" className="material-symbols-outlined text-[18px]">auto_awesome</span>
                    Generate Material
                </Link>

                {/* Navigation */}
                <nav className="flex-1 flex flex-col gap-space-1 mt-space-2">
                    {navItems.map((item) => {
                        const active = isActive(item);
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={NAV_LINK_CLASS(active)}
                            >
                                <span
                                    aria-hidden="true"
                                    className="material-symbols-outlined text-[18px]"
                                    style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
                                >
                                    {item.icon}
                                </span>
                                <span className="font-body-sm text-body-sm">{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>

                {/* Bottom Section */}
                <div className="mt-auto flex flex-col gap-space-1">
                    {bottomNavItems.map((item) => {
                        const active = isActive(item);
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={NAV_LINK_CLASS(active)}
                            >
                                <span
                                    aria-hidden="true"
                                    className="material-symbols-outlined text-[18px]"
                                    style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
                                >
                                    {item.icon}
                                </span>
                                <span className="font-body-sm text-body-sm">{item.label}</span>
                            </Link>
                        );
                    })}
                </div>
            </aside>

            {/* Main Content Wrapper */}
            <div className="flex-1 min-w-0 flex flex-col md:ml-[260px] min-h-screen">
                {/* Top Header */}
                <header className="fixed top-0 flex justify-between items-center gap-2 h-16 px-3 md:px-space-8 w-full md:w-[calc(100%-260px)] bg-surface shadow-sm z-10 border-b border-border-subtle">
                    <button
                        type="button"
                        onClick={() => window.dispatchEvent(new CustomEvent('cp:open-command-palette'))}
                        aria-label="Open command palette to search pages and actions"
                        className="flex-1 min-w-0 md:max-w-md relative flex items-center gap-2 pl-10 pr-3 py-2 bg-surface-soft rounded-lg text-body-sm font-body-sm text-text-muted hover:text-text-primary hover:bg-surface-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-soft transition-[color,background-color] text-left"
                    >
                        <span aria-hidden="true" className="material-symbols-outlined absolute left-3 text-text-muted">search</span>
                        <span className="truncate">Search materials, lessons, or topics...</span>
                        <kbd className="ml-auto hidden sm:inline-flex items-center gap-0.5 rounded-md border border-border-default bg-surface px-2 py-0.5 text-[10px] font-mono text-text-muted">
                            ⌘K
                        </kbd>
                    </button>
                    <div className="shrink-0 flex items-center gap-1.5 md:gap-space-4">
                        <a
                            href={SUPPORT_MAILTO}
                            aria-label={`Email support at ${SUPPORT_EMAIL}`}
                            title={`Email support at ${SUPPORT_EMAIL}`}
                            className="p-1.5 md:p-2 text-text-muted hover:text-text-primary hover:bg-surface-soft rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-soft"
                        >
                            <span aria-hidden="true" className="material-symbols-outlined">help_outline</span>
                        </a>
                        <Link
                            to="/dashboard/settings#notifications"
                            onClick={handleNotificationSettingsClick}
                            aria-label="Open notification settings"
                            title="Open notification settings"
                            className="p-1.5 md:p-2 text-text-muted hover:text-text-primary hover:bg-surface-soft rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-soft"
                        >
                            <span aria-hidden="true" className="material-symbols-outlined">notifications</span>
                        </Link>
                        <Link
                            to="/dashboard/settings"
                            aria-label="Open settings"
                            title="Open settings"
                            className="h-8 w-8 shrink-0 rounded-full overflow-hidden md:ml-space-2 border border-border-subtle cursor-pointer hover:shadow-sm transition-shadow bg-primary-soft flex items-center justify-center text-xs font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-soft focus-visible:ring-offset-2"
                        >
                            {profile?.avatar ? (
                                <img src={profile.avatar} alt="" className="w-full h-full object-cover" />
                            ) : (
                                initials
                            )}
                        </Link>
                    </div>
                </header>

                {/* Main Content */}
                <main id="dashboard-main" className="flex-1 overflow-y-auto overflow-x-clip pt-16">
                    <DashboardContentErrorBoundary key={routerLocation.pathname}>
                        <BlurFade duration={0.35} yOffset={8}>
                            {children}
                        </BlurFade>
                    </DashboardContentErrorBoundary>
                </main>
            </div>

            <WatermelonToaster position="bottom-center" />
            <CommandPalette />
            {/* Mobile Bottom Nav */}
            {!hideMobileBottomNav && <MobileBottomNav />}
        </div>
    );
};

export default DashboardLayout;
