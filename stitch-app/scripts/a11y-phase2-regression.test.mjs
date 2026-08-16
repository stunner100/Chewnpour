/**
 * Regression: Phase 2 a11y basics (zoom, contrast tokens, labeled mobile nav, 44px targets).
 * Run: node scripts/a11y-phase2-regression.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const indexHtml = readFileSync(join(root, 'index.html'), 'utf8');
const tailwind = readFileSync(join(root, 'tailwind.config.js'), 'utf8');
const indexCss = readFileSync(join(root, 'src/index.css'), 'utf8');
const mobileNav = readFileSync(join(root, 'src/components/MobileBottomNav.jsx'), 'utf8');
const dashboardLayout = readFileSync(join(root, 'src/components/DashboardLayout.jsx'), 'utf8');
const sidebar = readFileSync(join(root, 'src/components/ui/sidebar.jsx'), 'utf8');
const button = readFileSync(join(root, 'src/components/ui/button.jsx'), 'utf8');

assert.doesNotMatch(indexHtml, /user-scalable\s*=\s*no/i, 'viewport must allow zoom');
assert.doesNotMatch(indexHtml, /maximum-scale\s*=\s*1/i, 'viewport must not lock maximum-scale to 1');
assert.match(indexHtml, /width=device-width/, 'viewport must keep device-width');

assert.doesNotMatch(tailwind, /"text-muted":\s*"#7B8794"/, 'text-muted must not use low-contrast #7B8794');
assert.doesNotMatch(tailwind, /"text-muted":\s*"#8E8E93"/, 'text-muted must not use low-contrast #8E8E93');
assert.match(tailwind, /"text-muted":\s*"#6B6B70"/, 'text-muted must use AA-friendly #6B6B70');
assert.match(indexCss, /--muted-foreground:\s*107 107 112/, 'CSS muted-foreground must be AA-friendly');

assert.match(mobileNav, /aria-label=\{tab\.label\}/, 'mobile tabs must expose aria-label');
assert.match(mobileNav, /\{tab\.label\}/, 'mobile tabs must show visible labels');
assert.match(mobileNav, />\s*More\s*</, 'More tab must show a visible label');
assert.match(mobileNav, /min-h-11/, 'mobile nav items must target ≥44px');

assert.match(dashboardLayout, /min-h-11 min-w-11/, 'header icon controls must be ≥44px');
assert.match(dashboardLayout, /h-11 w-16/, 'theme toggle track must be ≥44px tall');
assert.match(sidebar, /min-h-11 min-w-11/, 'SidebarTrigger must be ≥44px');
assert.match(button, /icon:\s*"size-11 min-h-11 min-w-11"/, 'icon button size must be ≥44px');
assert.match(indexCss, /btn-icon[\s\S]*min-h-11 min-w-11/, 'btn-icon must be ≥44px');

console.log('a11y-phase2-regression: ok');
