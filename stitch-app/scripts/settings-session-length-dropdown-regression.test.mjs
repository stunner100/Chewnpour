import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const read = async (relativePath) => {
  return await fs.readFile(path.join(root, relativePath), 'utf8');
};

const settingsSource = await read('src/pages/AccountStudySettings.jsx');
const dropdownSource = await read('src/components/ui/dropdown-menu.jsx');
const registryDropdownSource = await read('src/components/ui/dropdown-menu-14.jsx');

for (const expectedSnippet of [
  "import {",
  "DropdownMenuRadioGroup",
  "DropdownMenuRadioItem",
  "from '@/components/ui/dropdown-menu';",
  "const SESSION_LENGTH_OPTIONS = [",
  'aria-label="Preferred session length"',
  '<DropdownMenuTrigger asChild>',
  '<DropdownMenuRadioGroup value={sessionLength} onValueChange={setSessionLength}>',
]) {
  if (!settingsSource.includes(expectedSnippet)) {
    throw new Error(`Expected AccountStudySettings.jsx to include "${expectedSnippet}".`);
  }
}

if (settingsSource.includes('<select value={sessionLength}')) {
  throw new Error('Regression detected: session length should use the Watermelon dropdown, not a native select.');
}

for (const option of ['Pomodoro', 'Standard', 'Deep Work', 'Extended']) {
  if (!settingsSource.includes(`title: '${option}'`)) {
    throw new Error(`Expected session length option "${option}".`);
  }
}

for (const incompatibleClass of [
  'max-h-(--radix-dropdown-menu-content-available-height)',
  'w-(--radix-dropdown-menu-trigger-width)',
  'outline-hidden',
  'not-data-',
  'data-open:',
  'data-closed:',
]) {
  if (dropdownSource.includes(incompatibleClass)) {
    throw new Error(`Dropdown menu keeps Tailwind v4-only class "${incompatibleClass}".`);
  }
}

if (registryDropdownSource.includes('react-icons')) {
  throw new Error('Registry dropdown should use the project lucide icon library, not react-icons.');
}

console.log('settings-session-length-dropdown-regression.test.mjs passed');
