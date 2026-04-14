import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const examModePath = path.join(root, 'src', 'pages', 'ExamMode.jsx');
const source = await fs.readFile(examModePath, 'utf8');

if (!source.includes('const resolveRecommendedExamFormat = ({ topic, launchState }) => {')) {
  throw new Error('Expected ExamMode to derive a recommended format automatically.');
}

if (!source.includes('setExamFormat(resolveRecommendedExamFormat({ topic, launchState }));')) {
  throw new Error('Expected ExamMode to autostart the recommended exam format.');
}

if (!source.includes('const [formatPickerOpen, setFormatPickerOpen] = useState(false);')) {
  throw new Error('Expected ExamMode to keep the format picker behind an explicit toggle.');
}

if (!source.includes("setFormatPickerOpen(true);")) {
  throw new Error('Expected ExamMode to let users reopen the format picker manually.');
}

if (!source.includes("return 'mcq';")) {
  throw new Error('Expected ExamMode to fall back to objective format when no stronger signal exists.');
}

console.log('exam-mode-direct-autostart-regression.test.mjs passed');
