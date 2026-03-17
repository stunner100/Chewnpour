import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const profilePath = path.join(root, 'src', 'pages', 'Profile.jsx');
const source = await fs.readFile(profilePath, 'utf8');

if (!/\[showAllExamAttempts, setShowAllExamAttempts\] = useState\(false\);/.test(source)) {
    throw new Error('Regression detected: Profile no longer tracks expanded exam attempts state.');
}

if (!/const hasMoreExamAttempts = Array\.isArray\(examAttempts\) && examAttempts\.length > 3;/.test(source)) {
    throw new Error('Regression detected: Profile no longer detects when exam attempts exceed the preview limit.');
}

if (!/const visibleExamAttempts = hasMoreExamAttempts && !showAllExamAttempts\s*\?\s*examAttempts\.slice\(0,\s*3\)\s*: examAttempts \|\| \[\];/.test(source)) {
    throw new Error('Regression detected: Profile no longer computes a bounded visible exam list for collapsed state.');
}

if (!/setShowAllExamAttempts\(\(current\) => !current\)/.test(source)) {
    throw new Error('Regression detected: Profile no longer toggles exam list visibility.');
}

if (!/visibleExamAttempts\.map\(\(attempt/.test(source)) {
    throw new Error('Regression detected: Profile no longer renders exam attempts from the bounded visible list.');
}

if (/<Link\s+to="\/dashboard\/analysis"/.test(source)) {
    throw new Error('Regression detected: Profile still links to dashboard analysis from Recent Exams view-all action.');
}

console.log('profile-exam-view-all-regression.test.mjs passed');
