import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const profileSource = await fs.readFile(path.join(root, 'src/pages/Profile.jsx'), 'utf8');

if (!profileSource.includes('Navigate to="/dashboard/settings#profile"')) {
    throw new Error('Profile.jsx should hard-redirect to settings#profile.');
}

if (profileSource.includes("to: '/dashboard/exam'") || profileSource.includes('/dashboard/exam')) {
    throw new Error('Profile quick access should not link to legacy /dashboard/exam.');
}

try {
    await fs.access(path.join(root, 'src/components/ui/dropdown-menu-14.jsx'));
    throw new Error('dropdown-menu-14.jsx should be removed.');
} catch (error) {
    if (error.code !== 'ENOENT') throw error;
}

console.log('cleanup-quick-wins-regression.test.mjs passed');
