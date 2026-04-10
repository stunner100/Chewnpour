import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const examModePath = path.join(root, 'src', 'pages', 'ExamMode.jsx');
const nextStepsPath = path.join(root, 'src', 'components', 'NextStepsGuidance.jsx');
const dashboardCoursePath = path.join(root, 'src', 'pages', 'DashboardCourse.jsx');

const examModeSource = await fs.readFile(examModePath, 'utf8');
const nextStepsSource = await fs.readFile(nextStepsPath, 'utf8');
const dashboardCourseSource = await fs.readFile(dashboardCoursePath, 'utf8');

const examModeExpectations = [
  'const resolveAutostartExamFormat = (search) =>',
  "const [examFormat, setExamFormat] = useState(() => resolveAutostartExamFormat(location.search));",
  "setExamFormat(resolveAutostartExamFormat(location.search));",
  'const startExamAttempt = useAction(api.exams.startExamAttempt);',
  "navigate(`/dashboard/exam/${routedFinalAssessmentTopic._id}${location.search || ''}`, { replace: true });",
];

for (const snippet of examModeExpectations) {
  if (!examModeSource.includes(snippet)) {
    throw new Error(`ExamMode is missing autostart routing snippet: ${snippet}`);
  }
}

if (examModeSource.includes('api.examPreparations.')) {
  throw new Error('ExamMode should not depend on the removed examPreparations API.');
}

if (!nextStepsSource.includes('const buildObjectiveExamRoute = (examTopicId) =>')) {
  throw new Error('NextStepsGuidance must build a shared autostart exam route.');
}

if (!nextStepsSource.includes('autostart=mcq')) {
  throw new Error('NextStepsGuidance must deep-link exam CTAs into objective mode.');
}

if (!nextStepsSource.includes('const buildEssayExamRoute = (examTopicId) =>')) {
  throw new Error('NextStepsGuidance must build a separate essay exam route.');
}

if (!nextStepsSource.includes('autostart=essay')) {
  throw new Error('NextStepsGuidance must deep-link essay CTAs into essay mode.');
}

if (!dashboardCourseSource.includes('const buildObjectiveExamRoute = (topicId) =>')) {
  throw new Error('DashboardCourse must build a shared autostart exam route.');
}

if (!dashboardCourseSource.includes('autostart=mcq')) {
  throw new Error('DashboardCourse final exam CTA must deep-link into objective mode.');
}

console.log('exam-mode-autostart-regression.test.mjs passed');
