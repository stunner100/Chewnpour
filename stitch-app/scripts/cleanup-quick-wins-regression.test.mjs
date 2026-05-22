import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const [profileSource, lessonRendererSource, definitionBlockSource] = await Promise.all([
    fs.readFile(path.join(root, 'src/pages/Profile.jsx'), 'utf8'),
    fs.readFile(path.join(root, 'src/components/LessonContentRenderer.jsx'), 'utf8'),
    fs.readFile(path.join(root, 'src/components/LessonDefinitionBlock.jsx'), 'utf8'),
]);

if (profileSource.includes("to: '/dashboard/exam'")) {
    throw new Error('Profile quick access should not link to legacy /dashboard/exam.');
}

if (!profileSource.includes("to: '/dashboard/progress'")) {
    throw new Error('Profile quick access should link past questions to /dashboard/progress.');
}

for (const snippet of [
    "import LessonDefinitionBlock from './LessonDefinitionBlock'",
    "block.alertType === 'definition'",
    "block.type === 'definition'",
    'LessonDefinitionBlock',
]) {
    if (!lessonRendererSource.includes(snippet)) {
        throw new Error(`Expected LessonContentRenderer to include "${snippet}".`);
    }
}

if (!definitionBlockSource.includes('variant = \'card\'') || !definitionBlockSource.includes("variant === 'alert'")) {
    throw new Error('LessonDefinitionBlock should support card and alert variants.');
}

try {
    await fs.access(path.join(root, 'src/components/ui/dropdown-menu-14.jsx'));
    throw new Error('dropdown-menu-14.jsx should be removed.');
} catch (error) {
    if (error.code !== 'ENOENT') throw error;
}

console.log('cleanup-quick-wins-regression.test.mjs passed');
