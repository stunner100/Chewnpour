import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const profileSource = read('src/pages/Profile.jsx');
const examSource = read('src/pages/ExamMode.jsx');
const dashboardPlanSource = read('src/lib/dashboardPlan.js');
const continueLearningSource = read('src/components/dashboard/ContinueLearningCard.jsx');

assert.ok(
    profileSource.includes('Navigate to="/dashboard/settings#profile"'),
    'Profile.jsx must hard-redirect to settings after Supabase cutover.',
);

assert.ok(
    !profileSource.includes('Bypass detection'),
    'Profile quick access must not market the Humanizer as bypassing detection.',
);

assert.ok(
    examSource.includes('(answeredCount / questions.length) * 100'),
    'Exam progress must be based on answered questions.',
);

assert.ok(
    !examSource.includes('(currentQuestion + 1) / questions.length'),
    'Exam progress must not initialize from the current question index.',
);

assert.ok(
    !dashboardPlanSource.includes("id: 'generate-podcast'"),
    'Today study plan should not add a duplicate generate-podcast CTA.',
);

assert.ok(
    !continueLearningSource.includes('onGeneratePodcast'),
    'Continue learning card should not add another generate-podcast CTA.',
);

console.log('qa-audit-regression tests passed');
