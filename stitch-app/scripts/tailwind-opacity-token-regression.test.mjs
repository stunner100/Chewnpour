// Fails when source uses an opacity-modified colour class (e.g. `bg-surface/95`)
// that Tailwind does not emit. Such classes compile to nothing, so the element
// silently goes transparent — which is how the exam, results and lesson sticky
// bars ended up see-through in both themes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import tailwindConfig from '../tailwind.config.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, 'src');

const SOURCE_EXT = /\.(jsx?|tsx?|css)$/;
const COLOR_UTILITY =
    /(?<![\w-])(?:bg|text|border(?:-[trblxy])?|ring(?:-offset)?|from|via|to|fill|stroke|divide|outline|decoration|placeholder|accent|caret|shadow)-(?:[a-z0-9-]+|\[[^\]\s]+\])\/(?:\d+|\[[^\]\s]+\])(?![\w/-])/g;

const walk = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return walk(full);
        return SOURCE_EXT.test(entry.name) ? [full] : [];
    });

const usages = new Map();
for (const file of walk(srcDir)) {
    const text = fs.readFileSync(file, 'utf8');
    for (const match of text.matchAll(COLOR_UTILITY)) {
        const cls = match[0];
        if (!usages.has(cls)) usages.set(cls, []);
        usages.get(cls).push(path.relative(root, file));
    }
}

if (usages.size === 0) {
    throw new Error('Expected to find opacity-modified colour classes in src/.');
}

const candidates = [...usages.keys()];
const { css } = await postcss([
    tailwindcss({
        ...tailwindConfig,
        content: [{ raw: candidates.join(' '), extension: 'html' }],
        corePlugins: { ...(tailwindConfig.corePlugins || {}), preflight: false },
    }),
]).process('@tailwind utilities;', { from: undefined });

const escapeClass = (cls) => cls.replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`);
const missing = candidates.filter((cls) => !css.includes(`.${escapeClass(cls)}`));

if (missing.length > 0) {
    const details = missing
        .map((cls) => `  ${cls}  (${[...new Set(usages.get(cls))].join(', ')})`)
        .join('\n');
    throw new Error(
        `These opacity-modified classes are not emitted by Tailwind (the colour token has no alpha-capable value):\n${details}`,
    );
}

// The fixed bars must keep a real, theme-aware background.
for (const cls of ['bg-surface/95', 'bg-background/95']) {
    if (!css.includes(`.${escapeClass(cls)}`) || !css.includes('var(--')) {
        throw new Error(`Expected ${cls} to compile to a CSS-variable background.`);
    }
}

console.log(`tailwind-opacity-token-regression.test.mjs passed (${candidates.length} classes checked)`);
