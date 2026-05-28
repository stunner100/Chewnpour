import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const source = await fs.readFile(path.join(root, 'src/components/topic/TopicLessonViews.jsx'), 'utf8');

for (const forbidden of [
    "classList.remove('dark')",
    "classList.add('dark')",
    'const hadDark = root.classList.contains',
]) {
    if (source.includes(forbidden)) {
        throw new Error(`Topic lesson route must not mutate the persisted dark theme with "${forbidden}".`);
    }
}

for (const required of [
    'cp-theme min-h-screen bg-[#FAF8F3]',
    'dark:bg-[#0c0d10]',
    'dark:text-text-primary',
]) {
    if (!source.includes(required)) {
        throw new Error(`Expected topic lesson shell to include "${required}".`);
    }
}

console.log('topic-lesson-dark-mode-regression.test.mjs passed');
