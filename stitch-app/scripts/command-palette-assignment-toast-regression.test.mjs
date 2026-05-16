import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const read = (filePath) => fs.readFileSync(path.join(repoRoot, filePath), 'utf8');
const assert = (condition, message) => {
    if (!condition) {
        throw new Error(message);
    }
};

const commandPalette = read('src/components/CommandPalette.jsx');

assert(
    commandPalette.includes('const isEditableTarget = (target)'),
    'Command palette must define an editable-target guard.'
);

assert(
    commandPalette.includes('if (isEditableTarget(e.target)) return;'),
    'Command palette shortcut must not hijack typing inside inputs, textareas, selects, or contenteditable elements.'
);

assert(
    commandPalette.includes('const handleQueryChange = (value)') &&
        !commandPalette.includes('useEffect(() => {\n        setActiveIndex(0);'),
    'Command palette active result reset should happen from query input changes, not a synchronous setState effect.'
);

assert(
    commandPalette.includes("navigate('/login', { replace: true })"),
    'Command palette sign-out must route users back to login after ending the session.'
);

assert(
    commandPalette.includes("value: '/dashboard/lessons'") &&
        commandPalette.includes("value: '/dashboard/flashcards'") &&
        commandPalette.includes("value: '/dashboard/ai-tutor'"),
    'Command palette should expose the new study screens.'
);

for (const oldRoute of [
    '/dashboard/exam',
    '/dashboard/assignment-helper',
    '/dashboard/humanizer',
    '/dashboard/community',
]) {
    assert(
        !commandPalette.includes(oldRoute),
        `Command palette should not route users into the old screen ${oldRoute}.`
    );
}

console.log('command-palette-assignment-toast-regression passed');
