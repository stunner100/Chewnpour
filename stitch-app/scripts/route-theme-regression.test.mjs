import {
    isPublicLightRoute,
    resolveRouteTheme,
} from '../src/lib/useRouteTheme.js';
import { DARK_THEME, LIGHT_THEME } from '../src/lib/theme.js';

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

console.log('route-theme-regression.test.mjs passed');
