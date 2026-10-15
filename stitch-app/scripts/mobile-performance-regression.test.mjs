import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const rootDir = process.cwd();

const read = (relativePath) =>
    fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

const indexHtml = read('index.html');
assert.ok(
    !indexHtml.includes('/>>'),
    'index.html should not contain malformed self-closing tags',
);

const appJsx = read('src/App.jsx');
assert.ok(
    !appJsx.includes("usePostHog"),
    'App.jsx should not import or use usePostHog directly',
);
assert.match(
    appJsx,
    /const LandingPage = lazyRoute\(\(\) => import\('\.\/pages\/LandingPage'\)/,
    'Landing page should be lazy-loaded in App.jsx',
);

const mainJsx = read('src/main.jsx');
assert.ok(
    mainJsx.includes("import('./bootstrap/AppProviders.jsx')"),
    'main.jsx should lazy-load bootstrap providers',
);
assert.ok(
    !mainJsx.includes('PostHogProvider'),
    'main.jsx should not use PostHogProvider',
);

const landingPage = read('src/pages/LandingPage.jsx');
assert.match(
    landingPage,
    /capturePostHogEvent\(/,
    'LandingPage should use capturePostHogEvent helper',
);
const posthogSource = read('src/lib/posthog.js');
for (const pattern of [
    'MAX_PENDING_ACTIONS',
    'queueingAllowed',
    'disable_session_recording: false',
    'disable_surveys: false',
    'maskAllInputs: true',
    'disable_external_dependency_loading: false',
    'disable_web_experiments: true',
    'autocapture: false',
]) {
    assert.match(
        posthogSource,
        new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
        `PostHog instrumentation should include "${pattern}"`,
    );
}

const useShareSource = read('src/hooks/useShare.js');
for (const pattern of ['dismissTimerRef', 'clearDismissTimer', 'clearTimeout']) {
    assert.match(
        useShareSource,
        new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
        `useShare toast handling should include "${pattern}"`,
    );
}

const vercelConfigRaw = read('vercel.json');
const vercelConfig = JSON.parse(vercelConfigRaw);
assert.ok(Array.isArray(vercelConfig.headers), 'vercel.json should define headers');
assert.ok(
    vercelConfig.headers.some(
        (entry) =>
            entry?.source === '/assets/(.*)\\.(js|css|mjs|png|jpg|jpeg|webp|svg|woff2)'
            && Array.isArray(entry.headers)
            && entry.headers.some(
                (header) =>
                    header.key === 'Cache-Control'
                    && header.value === 'public, max-age=31536000, immutable',
            ),
    ),
    'vercel.json should set immutable cache headers for hashed assets',
);

console.log('mobile-performance-regression.test.mjs passed');
