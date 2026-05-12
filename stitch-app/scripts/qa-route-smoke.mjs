#!/usr/bin/env node
/**
 * QA helper — visits every front-end route against the local dev server,
 * captures console errors, page errors and broken-network responses, and
 * prints a summary. Run via:
 *
 *   node scripts/qa-route-smoke.mjs
 *
 * Requires: dev server running on http://localhost:5174 and `playwright`
 * (already a devDependency).
 */

import { chromium } from 'playwright';

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:5174';

// Public routes can be inspected directly. Protected routes will redirect to
// /login; we still want to confirm the SPA shell loads the redirect path
// without errors.
const ROUTES = [
    { path: '/', label: 'Landing', visibility: 'public' },
    { path: '/login', label: 'Login', visibility: 'public' },
    { path: '/signup', label: 'Sign Up', visibility: 'public' },
    { path: '/reset-password', label: 'Reset Password', visibility: 'public' },
    { path: '/research', label: 'Product Research', visibility: 'public' },
    { path: '/unsubscribe', label: 'Unsubscribe', visibility: 'public' },
    { path: '/terms', label: 'Terms', visibility: 'public' },
    { path: '/privacy', label: 'Privacy', visibility: 'public' },
    { path: '/onboarding/name', label: 'Onboarding Name', visibility: 'public' },
    { path: '/onboarding/level', label: 'Onboarding Level', visibility: 'protected' },
    { path: '/onboarding/department', label: 'Onboarding Dept', visibility: 'protected' },
    { path: '/dashboard', label: 'Dashboard', visibility: 'protected' },
    { path: '/dashboard/search', label: 'Search', visibility: 'protected' },
    { path: '/dashboard/processing', label: 'Processing', visibility: 'protected' },
    { path: '/dashboard/processing/abc', label: 'Processing :id', visibility: 'protected' },
    { path: '/dashboard/course/abc', label: 'Course :id', visibility: 'protected' },
    { path: '/dashboard/course/abc?action=quiz', label: 'Course (quiz banner)', visibility: 'protected' },
    { path: '/dashboard/course/abc?action=flashcards', label: 'Course (flashcards banner)', visibility: 'protected' },
    { path: '/dashboard/topic/abc', label: 'Topic :id', visibility: 'protected' },
    { path: '/dashboard/exam', label: 'Past Questions Coming Soon', visibility: 'protected' },
    { path: '/dashboard/exam/abc', label: 'Exam Mode', visibility: 'protected' },
    { path: '/dashboard/results', label: 'Results', visibility: 'protected' },
    { path: '/dashboard/results/abc', label: 'Results :id', visibility: 'protected' },
    { path: '/dashboard/analysis', label: 'Study Plan / Analysis', visibility: 'protected' },
    { path: '/dashboard/podcasts', label: 'Podcasts hub', visibility: 'protected' },
    { path: '/dashboard/podcasts?generate=1', label: 'Podcasts hub (auto-modal)', visibility: 'protected' },
    { path: '/dashboard/assignment-helper', label: 'Assignment Helper', visibility: 'protected' },
    { path: '/dashboard/humanizer', label: 'Humanizer', visibility: 'protected' },
    { path: '/dashboard/community', label: 'Community', visibility: 'protected' },
    { path: '/dashboard/community/abc', label: 'Community Channel', visibility: 'protected' },
    { path: '/dashboard/concept-intro', label: 'Concept Intro', visibility: 'protected' },
    { path: '/dashboard/concept-intro/abc', label: 'Concept Intro :id', visibility: 'protected' },
    { path: '/dashboard/concept', label: 'Concept Fill-in', visibility: 'protected' },
    { path: '/dashboard/concept/abc', label: 'Concept Fill-in :id', visibility: 'protected' },
    { path: '/subscription', label: 'Subscription', visibility: 'protected' },
    { path: '/subscription/callback', label: 'Subscription Callback', visibility: 'protected' },
    { path: '/profile', label: 'Profile', visibility: 'protected' },
    { path: '/profile/edit', label: 'Edit Profile', visibility: 'protected' },
    { path: '/admin', label: 'Admin', visibility: 'protected' },
    { path: '/__intentionally__missing__', label: '404', visibility: 'public' },
];

// Console errors that come from the bundle but are unrelated to UX issues we
// can fix here (e.g. expected Convex auth failures when not signed in, dev
// HMR noise) get filtered out so the report is actionable.
const IGNORED_PATTERNS = [
    /Failed to load resource: the server responded with a status of 401/i,
    /Convex.*not authenticated/i,
    /websocket/i,
    /vite/i,
    /\[HMR\]/i,
    /\bDeprecationWarning\b/i,
    /downloadable font:/i,
    /sourcemap/i,
    /\[PostHog\.js\]/i,
    /Loading of external scripts is disabled/i,
];

const isIgnored = (text) => IGNORED_PATTERNS.some((re) => re.test(text));

const browser = await chromium.launch();
const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
});

const results = [];

for (const route of ROUTES) {
    const page = await context.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    const failedRequests = [];

    page.on('console', (msg) => {
        if (msg.type() === 'error') {
            const text = msg.text();
            if (!isIgnored(text)) consoleErrors.push(text);
        }
    });
    page.on('pageerror', (err) => {
        const text = String(err?.stack || err?.message || err);
        if (!isIgnored(text)) pageErrors.push(text);
    });
    page.on('requestfailed', (req) => {
        const url = req.url();
        if (url.startsWith(BASE) && !url.includes('/@vite/') && !url.includes('hot-update')) {
            failedRequests.push(`${req.failure()?.errorText || 'failed'} ${url}`);
        }
    });

    let title = '';
    let finalUrl = '';
    let httpStatus = null;
    let loadOk = true;
    let error = null;

    try {
        const response = await page.goto(`${BASE}${route.path}`, {
            waitUntil: 'networkidle',
            timeout: 20_000,
        });
        httpStatus = response?.status() ?? null;
        finalUrl = page.url();
        title = await page.title();
    } catch (err) {
        loadOk = false;
        error = err?.message || String(err);
    }

    results.push({
        route,
        title,
        finalUrl,
        httpStatus,
        loadOk,
        error,
        consoleErrors,
        pageErrors,
        failedRequests,
    });

    await page.close();
}

await context.close();
await browser.close();

const fail = (r) =>
    !r.loadOk
    || r.consoleErrors.length > 0
    || r.pageErrors.length > 0
    || r.failedRequests.length > 0;

const failures = results.filter(fail);
const ok = results.length - failures.length;

console.log(`\n=== Route smoke summary: ${ok}/${results.length} clean ===\n`);

for (const r of results) {
    const status = fail(r) ? 'FAIL' : 'ok  ';
    const redirect = r.finalUrl && !r.finalUrl.endsWith(r.route.path)
        ? ` -> ${r.finalUrl.replace(BASE, '')}`
        : '';
    console.log(`${status}  ${r.route.path.padEnd(40)} ${r.route.label}${redirect}`);
    if (!r.loadOk) console.log(`        load error: ${r.error}`);
    for (const e of r.pageErrors) console.log(`        [pageerror] ${e.split('\n')[0]}`);
    for (const e of r.consoleErrors) console.log(`        [console.error] ${e}`);
    for (const e of r.failedRequests) console.log(`        [request] ${e}`);
}

console.log('');
process.exit(failures.length > 0 ? 1 : 0);
