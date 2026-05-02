import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const profileSource = read('src/pages/Profile.jsx');
const examSource = read('src/pages/ExamMode.jsx');
const searchSource = read('src/pages/DashboardSearch.jsx');
const communitySource = read('src/pages/Community.jsx');
const dashboardPlanSource = read('src/lib/dashboardPlan.js');
const continueLearningSource = read('src/components/dashboard/ContinueLearningCard.jsx');

assert.ok(
    !profileSource.includes('Bypass detection'),
    'Profile quick access must not market the Humanizer as bypassing detection.',
);

assert.ok(
    profileSource.includes("label: 'Past Questions', sub: 'Coming soon'"),
    'Past Questions quick access must disclose that the feature is coming soon.',
);

assert.ok(
    examSource.includes('answeredQuestionCount / questions.length'),
    'Exam progress must be based on answered questions.',
);

assert.ok(
    !examSource.includes('(currentQuestion + 1) / questions.length'),
    'Exam progress must not initialize from the current question index.',
);

assert.ok(
    searchSource.includes('window.setTimeout') && searchSource.includes('setSearchParams({ q: trimmed }, { replace: true })'),
    'Library search should update results as the user types, without requiring Enter.',
);

assert.ok(
    communitySource.includes('normalizeChannelKey') && communitySource.includes('sanitizeGeneratedChannel'),
    'Community channel list should dedupe and sanitize generated document channels.',
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
