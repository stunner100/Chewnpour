import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const read = (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

const resultsSource = await read('src/pages/DashboardResults.jsx');

// DashboardResults uses theme tokens (bg-background-light / bg-surface) that
// are dark-mode aware by design, so it needs no literal light/dark shell — but
// it must not mutate the persisted theme or hardcode a light-only surface.
for (const forbidden of [
    "classList.remove('dark')",
    "classList.add('dark')",
    'const hadDark = root.classList.contains',
    'cp-theme bg-[#FAF8F3] min-h-screen',
]) {
    if (resultsSource.includes(forbidden)) {
        throw new Error(`DashboardResults must not use "${forbidden}".`);
    }
}
if (!resultsSource.includes('bg-background-light') || !resultsSource.includes('bg-surface')) {
    throw new Error('DashboardResults must use theme-token surfaces (bg-background-light / bg-surface).');
}

console.log('quiz-dark-mode-surfaces-regression.test.mjs passed');
