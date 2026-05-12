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
const assignmentHelper = read('src/pages/AssignmentHelper.jsx');

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
    commandPalette.includes("label: 'Past Questions'") &&
        !commandPalette.includes("label: 'Start Exam'"),
    'Bare /dashboard/exam command palette entry should be labeled Past Questions, not Start Exam.'
);

assert(
    assignmentHelper.includes('watermelonToast(successMessage') &&
        assignmentHelper.includes('watermelonToast(paywallToastMessage'),
    'Assignment helper toast effects must own success and paywall toast emission.'
);

assert(
    !assignmentHelper.includes("watermelonToast('Thread deleted.'") &&
        !assignmentHelper.includes("watermelonToast('Assignment reprocessed successfully.'"),
    'Assignment helper must not emit duplicate direct success toasts for delete or retry flows.'
);

console.log('command-palette-assignment-toast-regression passed');
