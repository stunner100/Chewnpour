import React, { Component, useEffect, useLayoutEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import MobileBottomNav from './MobileBottomNav';
import { WatermelonToaster } from './watermelon/WatermelonSonner';
import { watermelonToast } from './watermelon/watermelonToast';
import { useAuth } from '../contexts/AuthContext';
import { BlurFade } from './magicui/BlurFade';
import CommandPalette from './CommandPalette';
import { AppSidebar } from './app-sidebar';
import { captureSentryException } from '../lib/sentry.js';
import { getDashboardDataErrorMessage } from '../lib/dashboardDataErrors.js';
import { DARK_THEME } from '../lib/theme.js';
import useThemeMode from '../lib/useThemeMode.js';
import { Separator } from '@/components/ui/separator';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import AppIcon from './AppIcon';

const SUPPORT_EMAIL = 'info@chewnpour.com';
const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}?subject=ChewnPour%20Support`;

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
                            <AppIcon name="cloud_off" aria-hidden="true" />
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
    const { profile, user } = useAuth();
    const { mode: themeMode, toggle: toggleTheme } = useThemeMode();
    const isDarkMode = themeMode === DARK_THEME;
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

    const handleNotificationSettingsClick = (event) => {
        if (routerLocation.pathname === '/dashboard/settings' && routerLocation.hash === '#notifications') {
            event.preventDefault();
            scrollDashboardTargetIntoView('notifications', { behavior: 'smooth' });
        }
    };

    const displayName =
        profile?.fullName || user?.name || user?.email?.split('@')[0] || 'Student';
    const initials = displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

    return (
        <SidebarProvider className="dashboard-shell cp-theme text-text-primary">
            <AppSidebar />
            <SidebarInset>
                <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border-subtle bg-surface transition-[width,height] ease-linear">
                    <div className="flex min-w-0 flex-1 items-center gap-2 px-3 md:px-4">
                        <SidebarTrigger className="-ml-1 min-h-11 min-w-11" />
                        <Separator
                            orientation="vertical"
                            className="mr-1 data-[orientation=vertical]:h-4"
                        />
                        <button
                            type="button"
                            onClick={() => window.dispatchEvent(new CustomEvent('cp:open-command-palette'))}
                            aria-label="Open command palette to search pages and actions"
                            className="relative flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg bg-surface-soft py-2.5 pl-10 pr-3 text-left font-body-sm text-body-sm text-text-muted transition-[color,background-color] hover:bg-surface-variant hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-soft md:max-w-md"
                        >
                            <AppIcon name="search" className="absolute left-3 text-text-muted" aria-hidden="true" />
                            <span className="truncate">Search materials, lessons, or topics...</span>
                            <kbd className="ml-auto hidden items-center gap-0.5 rounded-md border border-border-default bg-surface px-2 py-0.5 font-mono text-[10px] text-text-muted sm:inline-flex">
                                ⌘K
                            </kbd>
                        </button>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 pr-2 md:gap-2 md:pr-4">
                        <button
                            type="button"
                            onClick={toggleTheme}
                            aria-label={isDarkMode ? 'Switch dashboard to light mode' : 'Switch dashboard to dark mode'}
                            aria-pressed={isDarkMode}
                            title={isDarkMode ? 'Light mode' : 'Dark mode'}
                            className="relative inline-flex h-11 w-16 shrink-0 items-center rounded-full border border-border-subtle bg-surface-soft p-1 text-text-secondary transition-colors hover:bg-surface-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-soft focus-visible:ring-offset-2"
                        >
                            <span
                                aria-hidden="true"
                                className={`inline-flex size-8 items-center justify-center rounded-full bg-surface text-[16px] text-primary shadow-sm transition-transform ${isDarkMode ? 'translate-x-7' : 'translate-x-0'}`}
                            >
                                <AppIcon name={isDarkMode ? 'light_mode' : 'dark_mode'} className="text-[16px]" />
                            </span>
                        </button>
                        <a
                            href={SUPPORT_MAILTO}
                            aria-label={`Email support at ${SUPPORT_EMAIL}`}
                            title={`Email support at ${SUPPORT_EMAIL}`}
                            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface-soft hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-soft"
                        >
                            <AppIcon name="help_outline" aria-hidden="true" />
                        </a>
                        <Link
                            to="/dashboard/settings#notifications"
                            onClick={handleNotificationSettingsClick}
                            aria-label="Open notification settings"
                            title="Open notification settings"
                            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface-soft hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-soft"
                        >
                            <AppIcon name="notifications" aria-hidden="true" />
                        </Link>
                        <Link
                            to="/dashboard/settings"
                            aria-label="Open settings"
                            title="Open settings"
                            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-border-subtle bg-primary-soft text-xs font-bold text-primary transition-shadow hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-soft focus-visible:ring-offset-2 md:ml-1"
                        >
                            {profile?.avatarUrl ? (
                                <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                                initials
                            )}
                        </Link>
                    </div>
                </header>

                <main id="dashboard-main" className="flex flex-1 flex-col overflow-y-auto overflow-x-clip">
                    <DashboardContentErrorBoundary key={routerLocation.pathname}>
                        <BlurFade duration={0.35} yOffset={8}>
                            {children}
                        </BlurFade>
                    </DashboardContentErrorBoundary>
                </main>
            </SidebarInset>

            <WatermelonToaster position="bottom-center" />
            <CommandPalette />
            {!hideMobileBottomNav && <MobileBottomNav />}
        </SidebarProvider>
    );
};

export default DashboardLayout;
