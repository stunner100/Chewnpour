import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const read = async (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

const livePageModules = [
  'src/pages/StudentDashboard.jsx',
  'src/pages/MyMaterialsLibrary.jsx',
  'src/pages/UploadMaterials.jsx',
  'src/pages/ActiveQuizSession.jsx',
  'src/pages/ExamMode.jsx',
  'src/pages/TopicQuizPlayer.jsx',
  'src/pages/DashboardResults.jsx',
  'src/pages/AIStudyTutor.jsx',
  'src/pages/StudyProgressMastery.jsx',
  'src/pages/AccountStudySettings.jsx',
  'src/pages/Subscription.jsx',
  'src/pages/LessonMemoryNeuralBasis.jsx',
  'src/pages/TopicDetail.jsx',
  'src/pages/DashboardPodcasts.jsx',
  'src/pages/LandingPage.jsx',
  'src/pages/Login.jsx',
  'src/pages/ResetPassword.jsx',
  'src/pages/ProductResearch.jsx',
  'src/pages/Unsubscribe.jsx',
  'src/pages/Terms.jsx',
  'src/pages/Privacy.jsx',
  'src/pages/OnboardingName.jsx',
  'src/pages/SubscriptionCallback.jsx',
  'src/hooks/useTopicDetail.js',
  'src/components/topic/TopicLessonViews.jsx',
  'src/components/topic/TopicContentPanel.jsx',
  'src/components/TopicNotesPanel.jsx',
  'src/components/TopicChatPanel.jsx',
  'src/components/HighlightExplainPopover.jsx',
  'src/components/lesson/LessonPodcastCard.jsx',
  'src/components/TopicPodcastPanel.jsx',
  'src/bootstrap/AppProviders.jsx',
];

for (const relativePath of livePageModules) {
  const source = await read(relativePath);
  if (/from ['"]convex\/react['"]|from ['"]convex\/browser['"]|ConvexReactClient|ConvexBetterAuthProvider/.test(source)) {
    throw new Error(`${relativePath} must stay Convex-free on the live Supabase path.`);
  }
}

const appProviders = await read('src/bootstrap/AppProviders.jsx');
if (!appProviders.includes('AuthProvider') || appProviders.includes('ConvexProvider')) {
  throw new Error('Expected AppProviders to mount AuthProvider without ConvexProvider.');
}

console.log('supabase-live-routes-convex-free-regression.test.mjs passed');
