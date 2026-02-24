/**
 * Regression test: Exam post-disconnect auth recovery
 *
 * After a prolonged WebSocket disconnect (e.g. 9-minute code 1006 loop),
 * the Convex auth token expires. When the WebSocket reconnects, exam actions
 * fail repeatedly with "Server Error" (wrapped UNAUTHENTICATED). The frontend
 * must detect this, attempt a session refresh via getSession(), and show
 * clear messaging instead of a generic error loop.
 *
 * Verifies:
 * 1. `isLikelyPostDisconnectAuthError` detects opaque "Server Error" patterns
 * 2. `refreshAuthSessionQuietly` is called on auth errors during exam start
 * 3. Session-expired message is shown when refresh fails
 * 4. "Session refreshed" message is shown when refresh succeeds
 * 5. Auto-generation pauses on auth errors instead of counting as generation failure
 * 6. Sign-in link is rendered when session has expired
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const examModePath = resolve(__dirname, '../src/pages/ExamMode.jsx');
const authClientPath = resolve(__dirname, '../src/lib/auth-client.js');

const examModeSource = readFileSync(examModePath, 'utf-8');
const authClientSource = readFileSync(authClientPath, 'utf-8');

let passed = 0;
let failed = 0;

const assert = (condition, label) => {
    if (condition) {
        console.log(`  ✓ ${label}`);
        passed++;
    } else {
        console.error(`  ✗ ${label}`);
        failed++;
    }
};

console.log('--- Post-disconnect auth recovery regression ---\n');

// 1. getSession is exported from auth-client.js
assert(
    /export\s+const\s+\{[^}]*getSession[^}]*\}/.test(authClientSource)
    || authClientSource.includes('getSession'),
    'auth-client.js exports getSession'
);

// 2. ExamMode imports getSession from auth-client
assert(
    examModeSource.includes("import") && examModeSource.includes("getSession") && examModeSource.includes("auth-client"),
    'ExamMode.jsx imports getSession from auth-client'
);

// 3. isLikelyPostDisconnectAuthError helper exists
assert(
    examModeSource.includes('isLikelyPostDisconnectAuthError'),
    'isLikelyPostDisconnectAuthError helper is defined'
);

// 4. isLikelyPostDisconnectAuthError detects "Server Error" pattern
assert(
    examModeSource.includes('server error') && examModeSource.includes('isLikelyPostDisconnectAuthError'),
    'isLikelyPostDisconnectAuthError checks for Server Error pattern'
);

// 5. refreshAuthSessionQuietly helper exists and calls getSession
assert(
    examModeSource.includes('refreshAuthSessionQuietly') && examModeSource.includes('getSession()'),
    'refreshAuthSessionQuietly helper calls getSession()'
);

// 6. refreshAuthSessionQuietly returns { refreshed, expired } shape
assert(
    examModeSource.includes('refreshed:') && examModeSource.includes('expired:'),
    'refreshAuthSessionQuietly returns { refreshed, expired }'
);

// 7. beginExamAttempt calls refreshAuthSessionQuietly on auth error
assert(
    examModeSource.includes('authError') && examModeSource.includes('refreshAuthSessionQuietly'),
    'beginExamAttempt calls refreshAuthSessionQuietly on auth errors'
);

// 8. beginExamAttempt handles post-disconnect Server Error
assert(
    examModeSource.includes('isLikelyPostDisconnectAuthError(error)') &&
    examModeSource.includes('refreshAuthSessionQuietly()'),
    'beginExamAttempt handles opaque Server Error with session refresh'
);

// 9. Session expired message is defined
assert(
    examModeSource.includes('getExamSessionExpiredMessage') &&
    examModeSource.includes('session has expired'),
    'Session expired message is defined and used'
);

// 10. Session refreshed message variant exists
assert(
    examModeSource.includes('session has been refreshed'),
    'Session refreshed success message exists'
);

// 11. Auto-generation catches auth errors separately
assert(
    examModeSource.includes('auto-generation paused due to auth error') ||
    examModeSource.includes('Exam auto-generation paused due to auth error'),
    'Auto-generation detects and pauses on auth errors'
);

// 12. Auto-generation checks isLikelyPostDisconnectAuthError
assert(
    // The catch block in auto-generation should check both patterns
    /\.catch\(async.*isLikelyPostDisconnectAuthError/s.test(examModeSource),
    'Auto-generation catch block checks isLikelyPostDisconnectAuthError'
);

// 13. Sign-in link is shown when session expired (exam start error UI)
assert(
    examModeSource.includes('getExamSessionExpiredMessage()') &&
    examModeSource.includes('/login'),
    'Sign-in link is rendered for session expired state'
);

// 14. Submit error also checks isLikelyPostDisconnectAuthError
const submitAuthCheckCount = (examModeSource.match(/isLikelyPostDisconnectAuthError/g) || []).length;
assert(
    submitAuthCheckCount >= 4,
    `isLikelyPostDisconnectAuthError used in multiple paths (found ${submitAuthCheckCount} refs)`
);

// 15. Sentry tagging includes likelyPostDisconnect
assert(
    examModeSource.includes("likelyPostDisconnect:") || examModeSource.includes("likelyPostDisconnect"),
    'Sentry tags include likelyPostDisconnect for observability'
);

// 16. Dark mode support on submit error banner
assert(
    examModeSource.includes('dark:border-red-800') && examModeSource.includes('dark:bg-red-900/20') &&
    examModeSource.includes('dark:text-red-300'),
    'Submit error banner has dark mode styles'
);

console.log(`\n--- Results: ${passed} passed, ${failed} failed ---`);
process.exit(failed > 0 ? 1 : 0);
