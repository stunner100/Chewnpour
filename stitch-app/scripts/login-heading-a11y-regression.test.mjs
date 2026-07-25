/**
 * Regression: QA finding — login/signup H1 must keep spaces across visual line breaks.
 * Run: node scripts/login-heading-a11y-regression.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const login = readFileSync(join(root, 'src/pages/Login.jsx'), 'utf8');
const signup = readFileSync(join(root, 'src/pages/SignUp.jsx'), 'utf8');
const app = readFileSync(join(root, 'src/App.jsx'), 'utf8');

assert.match(login, /Your AI\{\s*' '\s*\}/, 'login H1 must keep a space after "Your AI"');
assert.match(login, /<\/span>\{\s*' '\s*\}/, 'login H1 must keep a space after "study"');
assert.doesNotMatch(login, /Your AI\s*\n\s*<br \/>\s*\n\s*<span[^>]*>study<\/span>\s*\n\s*<br \/>/, 'login must not stack AI/study/br without spaces');

assert.match(signup, /Study\{\s*' '\s*\}/, 'signup H1 must keep a space after "Study"');
assert.match(signup, /<\/span>\{\s*' '\s*\}/, 'signup H1 must keep a space after "smarter,"');

assert.match(app, /import AppIcon from ['"].*AppIcon['"]/, 'App.jsx must import AppIcon for NotFound');
assert.match(app, /ParkedDashboardFeature title="Kids mode"/, 'dashboard kids route must stay parked (QA C-1)');

console.log('login-heading-a11y-regression: ok');
