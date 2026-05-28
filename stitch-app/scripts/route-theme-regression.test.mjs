import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
    EXAM_STEPS,
    resolveExamStep,
} from '../src/lib/resolveExamStep.js';
import {
    isPublicLightRoute,
    resolveRouteTheme,
} from '../src/lib/useRouteTheme.js';
import { DARK_THEME, LIGHT_THEME } from '../src/lib/theme.js';

const root = process.cwd();
const read = (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

const [examModeSource, examLoadingShellSource] = await Promise.all([
    read('src/pages/ExamMode.jsx'),
    read('src/components/ExamLoadingShell.jsx'),
]);

for (const route of ['/', '/login', '/onboarding/name', '/terms']) {
    if (resolveRouteTheme(route) !== LIGHT_THEME) {
        throw new Error(`Expected ${route} to resolve to light theme.`);
    }
}

for (const route of ['/dashboard', '/dashboard/quiz/topic_1', '/admin']) {
    if (resolveRouteTheme(route, DARK_THEME) !== DARK_THEME) {
        throw new Error(`Expected ${route} to honor the persisted dashboard theme.`);
    }
}

if (isPublicLightRoute('/login') !== true || isPublicLightRoute('/dashboard') !== false) {
    throw new Error('Public light route detection failed.');
}

for (const snippet of [
    'resolveExamStep',
    'EXAM_STEPS',
    'ExamLoadingShell',
    'ExamFormatPicker',
]) {
    if (!examModeSource.includes(snippet)) {
        throw new Error(`Expected ExamMode to use "${snippet}".`);
    }
}

if (!examLoadingShellSource.includes('cp-theme bg-[#FAF8F3] dark:!bg-[#0c0d10] min-h-screen flex items-center justify-center')) {
    throw new Error('Expected ExamLoadingShell to preserve the quiz shell background.');
}

const activeStep = resolveExamStep({
    routeTopicId: 'topic_123',
    isLoadingRouteTopic: false,
    isMissingRouteTopic: false,
    shouldRedirectToFinalExam: false,
    routedFinalAssessmentTopic: null,
    topicId: 'topic_123',
    routingBootstrapPending: false,
    examFormat: 'mcq',
    examStarted: true,
    startingExamAttempt: false,
    hasAttemptQuestions: true,
    attemptId: 'attempt_1',
    questionCount: 3,
});
if (activeStep !== EXAM_STEPS.ACTIVE) {
    throw new Error(`Expected active exam step, got ${activeStep}.`);
}

console.log('route-theme-regression.test.mjs passed');
