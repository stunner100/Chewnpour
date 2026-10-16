import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
    LIGHT_THEME,
    applyTheme,
    getStoredTheme,
    resolveInitialTheme,
} from './theme.js';

export const APP_THEME_CLASS = 'cp-theme';

const PUBLIC_LIGHT_ROUTE_PREFIXES = [
    '/login',
    '/signup',
    '/reset-password',
    '/research',
    '/unsubscribe',
    '/terms',
    '/privacy',
    '/onboarding',
    '/subscription/callback',
];

export const isPublicLightRoute = (pathname) => {
    if (pathname === '/') return true;
    return PUBLIC_LIGHT_ROUTE_PREFIXES.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
};

export const resolveRouteTheme = (pathname, preferredTheme = getStoredTheme() || resolveInitialTheme()) => {
    if (isPublicLightRoute(pathname)) {
        return LIGHT_THEME;
    }
    return preferredTheme;
};

export const useRouteTheme = () => {
    const { pathname } = useLocation();

    useLayoutEffect(() => {
        applyTheme(resolveRouteTheme(pathname));
        // Radix dialogs, menus and sheets portal to <body>, outside any page's
        // `.cp-theme` wrapper, so the app theme has to live on <body> itself.
        // Public pages stay light-only and keep their own styling.
        document.body.classList.toggle(APP_THEME_CLASS, !isPublicLightRoute(pathname));
    }, [pathname]);
};
