import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const read = async (relativePath) => {
  return await fs.readFile(path.join(root, relativePath), 'utf8');
};

const tutorSource = await read('src/pages/AIStudyTutor.jsx');

for (const expectedSnippet of [
  "from '@/components/ui/dropdown-menu';",
  'const MATERIAL_OPTIONS = [',
  'aria-label="AI tutor material"',
  '<DropdownMenuTrigger asChild>',
  '<DropdownMenuRadioGroup value={selectedMaterial} onValueChange={setSelectedMaterial}>',
  'placeholder={`Ask a question about ${selectedMaterial}...`}',
]) {
  if (!tutorSource.includes(expectedSnippet)) {
    throw new Error(`Expected AIStudyTutor.jsx to include "${expectedSnippet}".`);
  }
}

if (tutorSource.includes('<select')) {
  throw new Error('Regression detected: AI Tutor material picker should use the shared dropdown, not a native select.');
}

for (const material of [
  'Biology 101',
  'World History',
  'Introduction to Psychology',
  'Calculus I',
]) {
  if (!tutorSource.includes(`value: '${material}'`)) {
    throw new Error(`Expected AI Tutor material option "${material}".`);
  }
}

console.log('ai-tutor-material-dropdown-regression.test.mjs passed');
