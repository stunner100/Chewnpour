import {
    isPublicLightRoute,
    resolveRouteTheme,
} from '../src/lib/useRouteTheme.js';
import { DARK_THEME, LIGHT_THEME } from '../src/lib/theme.js';
import fs from 'node:fs';

for (const route of ['/', '/login', '/onboarding/name', '/terms']) {
    if (resolveRouteTheme(route) !== LIGHT_THEME) {
        throw new Error(`Expected ${route} to resolve to light theme.`);
    }
}

for (const route of ['/dashboard', '/dashboard/quiz/topic_1', '/admin']) {
    if (resolveRouteTheme(route, DARK_THEME) !== DARK_THEME) {
        throw new Error(`Expected ${route} to honor the persisted dashboard theme.`);
    }
}

if (isPublicLightRoute('/login') !== true || isPublicLightRoute('/dashboard') !== false) {
    throw new Error('Public light route detection failed.');
}

// Radix portals render under <body>, outside page wrappers, so the app theme
// class must be applied to <body> on app routes (not on public light routes).
const routeThemeSource = fs.readFileSync(new URL('../src/lib/useRouteTheme.js', import.meta.url), 'utf8');
if (!/document\.body\.classList\.toggle\(APP_THEME_CLASS,\s*!isPublicLightRoute\(pathname\)\)/.test(routeThemeSource)) {
    throw new Error('Expected useRouteTheme to toggle the cp-theme class on <body> for app routes.');
}

// Filled primary surfaces carry white text; in dark mode they must not use the
// light #5AC8FA text blue (1.9:1 with white).
const css = fs.readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const darkBlock = css.match(/\.dark \.cp-theme \{([^}]*)\}/)?.[1] || '';
const darkFill = darkBlock.match(/--cp-primary-fill:\s*(#[0-9a-fA-F]{6})/)?.[1];
const luminance = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
if (!darkFill || 1.05 / (luminance(darkFill) + 0.05) < 4.5) {
    throw new Error(`Dark --cp-primary-fill (${darkFill}) must keep white text at >= 4.5:1.`);
}
if (!/\.cp-theme \.bg-primary,\s*\.cp-theme \.bg-primary-500 \{\s*background-color: var\(--cp-primary-fill\)/.test(css)) {
    throw new Error('Expected .cp-theme .bg-primary to use --cp-primary-fill.');
}

console.log('route-theme-regression.test.mjs passed');
