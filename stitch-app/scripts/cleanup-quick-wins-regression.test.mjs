import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
try {
    await fs.access(path.join(root, 'src/components/ui/dropdown-menu-14.jsx'));
    throw new Error('dropdown-menu-14.jsx should be removed.');
} catch (error) {
    if (error.code !== 'ENOENT') throw error;
}

console.log('cleanup-quick-wins-regression.test.mjs passed');
