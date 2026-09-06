/**
 * Regression: /dashboard/progress keeps readable dark-mode contrast.
 *
 * The redesigned progress page (journey-first layout) relies on the shared
 * .cp-theme dark overrides in index.css: it uses only semantic token classes
 * (bg-surface, bg-surface-soft, bg-surface-variant, bg-background-light,
 * text-text-primary/secondary/muted, border-border-subtle, *-soft tones),
 * which .dark .cp-theme remaps to high-contrast dark values. Hardcoded light
 * hex colors in the progress components would break that contract.
 *
 * Run: node scripts/progress-dark-mode-contrast-regression.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const page = readFileSync(join(root, 'src/pages/StudyProgressMastery.jsx'), 'utf8');
const cssSource = readFileSync(join(root, 'src/index.css'), 'utf8');
const componentsDir = join(root, 'src/components/progress');
const componentSources = readdirSync(componentsDir)
    .filter((file) => file.endsWith('.jsx'))
    .map((file) => readFileSync(join(componentsDir, file), 'utf8'));

const allSources = [page, ...componentSources];

// ── Dark surfaces come from the shared .cp-theme override system ──
for (const selector of [
    '.dark .cp-theme .bg-surface',
    '.dark .cp-theme .bg-surface-soft',
    '.dark .cp-theme .bg-surface-variant',
    '.dark .cp-theme .text-text-primary',
    '.dark .cp-theme .text-text-secondary',
    '.dark .cp-theme .text-text-muted',
    '.dark .cp-theme .border-border-subtle',
]) {
    assert.ok(
        cssSource.includes(selector),
        `index.css must include the ${selector} dark override used by the progress page`,
    );
}

// ── The page and its components use the semantic surface/text tokens ──
for (const token of ['bg-surface', 'border-border-subtle', 'text-text-primary', 'text-text-secondary']) {
    assert.ok(
        allSources.some((source) => source.includes(token)),
        `progress UI must use the semantic token ${token}`,
    );
}

// ── No hardcoded light-theme hex colors that would break dark contrast ──
for (const [index, source] of allSources.entries()) {
    assert.doesNotMatch(
        source,
        /(?:text|bg|border)-\[#[0-9A-Fa-f]{3,8}\]/,
        `progress source #${index} must not hardcode hex colors (breaks .cp-theme dark remapping)`,
    );
}

console.log('progress-dark-mode-contrast-regression.test.mjs passed');
