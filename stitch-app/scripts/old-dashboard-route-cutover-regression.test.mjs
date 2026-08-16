import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const read = async (relativePath) => {
  return await fs.readFile(path.join(root, relativePath), 'utf8');
};

const appSource = await read('src/App.jsx');
const settingsSource = await read('src/pages/AccountStudySettings.jsx');
const progressSource = await read('src/pages/StudyProgressMastery.jsx');
const progressSnapshotSource = await read('src/components/dashboard/ProgressSnapshot.jsx');
const studentDashboardSource = await read('src/pages/StudentDashboard.jsx');
const materialsSource = await read('src/pages/MyMaterialsLibrary.jsx');
const lessonsSource = await read('src/pages/LessonMemoryNeuralBasis.jsx');
const quizSource = await read('src/pages/ActiveQuizSession.jsx');
const commandPaletteSource = await read('src/components/CommandPalette.jsx');

for (const snippet of [
  '<Route path="/dashboard/search" element={<Navigate to="/dashboard/library" replace />} />',
  '<Route path="/dashboard/processing" element={<Navigate to="/dashboard/library" replace />} />',
  '<Route path="/dashboard/processing/:courseId" element={<Navigate to="/dashboard/library" replace />} />',
  '<Route path="/dashboard/course/:courseId" element={<RedirectCourseToLessonsRoute />} />',
  "const TopicDetail = lazyRoute(() => import('./pages/TopicDetail'), { componentName: 'TopicDetail', namedExport: 'TopicDetail' });",
  'const TopicDetailRoute = () => {',
  '<Route path="/dashboard/topic/:topicId" element={withSuspense(<TopicDetailRoute />)} />',
  '<Route path="/dashboard/lessons/:lessonId" element={<RedirectLegacyLessonDetailRoute />} />',
  '<Route path="/dashboard/exam" element={withSuspense(<ProtectedRoute><DashboardLayout><ExamMode /></DashboardLayout></ProtectedRoute>)} />',
  '<Route path="/dashboard/exam/:topicId" element={<RedirectLegacyQuizRoute />} />',
  '<Route path="/dashboard/results" element={<Navigate to="/dashboard/progress" replace />} />',
  '<Route path="/dashboard/results/:attemptId" element={<Navigate to="/dashboard/progress" replace />} />',
  '<Route path="/dashboard/analysis" element={<Navigate to="/dashboard/progress" replace />} />',
  '<Route path="/dashboard/podcasts" element={withSuspense(<ProtectedRoute><DashboardLayout><DashboardPodcasts /></DashboardLayout></ProtectedRoute>)} />',
  '<Route path="/dashboard/assignment-helper" element={<ParkedDashboardFeature title="Assignment helper" />} />',
  '<Route path="/dashboard/humanizer" element={<ParkedDashboardFeature title="AI humanizer" />} />',
  '<Route path="/dashboard/community" element={<ParkedDashboardFeature title="Community" />} />',
  '<Route path="/dashboard/community/:channelId" element={<ParkedDashboardFeature title="Community" />} />',
  '<Route path="/dashboard/concept-intro" element={<ParkedDashboardFeature title="Concept intro" />} />',
  '<Route path="/dashboard/concept-intro/:topicId" element={<RedirectLegacyFlashcardsRoute />} />',
  '<Route path="/dashboard/concept" element={<ParkedDashboardFeature title="Concept builder" />} />',
  '<Route path="/dashboard/concept/:topicId" element={<RedirectLegacyFlashcardsRoute />} />',
  '<Route path="/dashboard/flashcards" element={withSuspense(<ProtectedRoute><DashboardLayout><FlashcardStudySession /></DashboardLayout></ProtectedRoute>)} />',
  '<Route path="/dashboard/flashcards/:deckId" element={withSuspense(<ProtectedRoute><DashboardLayout><FlashcardStudySession /></DashboardLayout></ProtectedRoute>)} />',
  '<Route path="/subscription" element={<Navigate to="/dashboard" replace />} />',
  '<Route path="/subscription/callback" element={<Navigate to="/dashboard" replace />} />',
  '<Route path="/profile" element={<Navigate to="/dashboard/settings#profile" replace />} />',
  '<Route path="/profile/edit" element={<Navigate to="/dashboard/settings#profile" replace />} />',
  '<Route path="/admin" element={<ParkedDashboardFeature title="Admin dashboard" />} />',
]) {
  if (!appSource.includes(snippet)) {
    throw new Error(`Expected old route cutover redirect: ${snippet}`);
  }
}

for (const forbiddenSnippet of [
  "const DashboardAnalysisPage = lazyRoute",
  "const DashboardSearch = lazyRoute",
  "const DashboardFullAnalysis = lazyRoute",
  "const PastQuestionsComingSoon = lazyRoute",
  "const Profile = lazyRoute",
  "const EditProfile = lazyRoute",
  "const AdminDashboard = lazyRoute",
  "const DashboardProcessing = lazyRoute",
  "const DashboardCourse = lazyRoute",
  "const DashboardResults = lazyRoute",
  "const ConceptIntro = lazyRoute",
  "const FillInExercise = lazyRoute",
  "const AssignmentHelper = lazyRoute",
  "const AIHumanizer = lazyRoute",
  "const Community = lazyRoute",
  "const CommunityChannel = lazyRoute",
  "Legacy dashboard routes preserved for backward compatibility",
  'ParkedDashboardFeature title="Exam mode"',
]) {
  if (appSource.includes(forbiddenSnippet)) {
    throw new Error(`Old route/component should not be wired into App.jsx: ${forbiddenSnippet}`);
  }
}

for (const forbiddenLessonsSnippet of [
  'useParams',
  'LessonDetailView',
  'DetailSection',
  'api.topics.getTopicWithQuestions',
]) {
  if (lessonsSource.includes(forbiddenLessonsSnippet)) {
    throw new Error(`LessonMemoryNeuralBasis.jsx should not retain old lesson-detail rendering: ${forbiddenLessonsSnippet}`);
  }
}

for (const [source, label] of [
  [settingsSource, 'AccountStudySettings.jsx'],
  [progressSource, 'StudyProgressMastery.jsx'],
  [progressSnapshotSource, 'ProgressSnapshot.jsx'],
  [studentDashboardSource, 'StudentDashboard.jsx'],
  [materialsSource, 'MyMaterialsLibrary.jsx'],
  [lessonsSource, 'LessonMemoryNeuralBasis.jsx'],
  [quizSource, 'ActiveQuizSession.jsx'],
  [commandPaletteSource, 'CommandPalette.jsx'],
]) {
  const oldDestinations = [
    '/dashboard/analysis',
    '/dashboard/search',
    '/dashboard/processing',
    '/dashboard/course',
    '/dashboard/results',
    '/dashboard/assignment-helper',
    '/dashboard/humanizer',
    '/dashboard/community',
    '/dashboard/concept',
  ];
  const oldDestination = oldDestinations.find((destination) => source.includes(destination));
  if (oldDestination) {
    throw new Error(`${label} should not link users into old dashboard screens: ${oldDestination}`);
  }
}

for (const [source, label] of [
  [lessonsSource, 'LessonMemoryNeuralBasis.jsx'],
  [quizSource, 'ActiveQuizSession.jsx'],
]) {
  if (source.includes('<Navigate')) {
    throw new Error(`${label} should not link users into old dashboard screens.`);
  }
}

console.log('old-dashboard-route-cutover-regression.test.mjs passed');
