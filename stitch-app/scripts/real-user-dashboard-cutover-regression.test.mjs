import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const read = async (relativePath) => {
  return await fs.readFile(path.join(root, relativePath), 'utf8');
};

const requireIncludes = (source, snippet, label) => {
  if (!source.includes(snippet)) {
    throw new Error(`${label} should include "${snippet}".`);
  }
};

const requireExcludes = (source, snippet, label) => {
  if (source.includes(snippet)) {
    throw new Error(`${label} should not include mock-only snippet "${snippet}".`);
  }
};

const [
  dashboardPageSource,
  materialsPageSource,
  tutorPageSource,
  progressPageSource,
  settingsPageSource,
] = await Promise.all([
  read('src/pages/StudentDashboard.jsx'),
  read('src/pages/MyMaterialsLibrary.jsx'),
  read('src/pages/AIStudyTutor.jsx'),
  read('src/pages/StudyProgressMastery.jsx'),
  read('src/pages/AccountStudySettings.jsx'),
]);

for (const snippet of [
  'api.profiles.getUserStats',
  'api.courses.getUserCourses',
  'api.uploads.getUserUploads',
  'api.topics.getResumeTarget',
  'api.concepts.getConceptReviewQueue',
]) {
  requireIncludes(dashboardPageSource, snippet, 'StudentDashboard.jsx');
}

for (const snippet of [
  'Good morning, Alex.',
  'Introduction to Psychology</h3>',
  'Neuroscience Basics',
  'Take a 5-min Quiz on Biology',
]) {
  requireExcludes(dashboardPageSource, snippet, 'StudentDashboard.jsx');
}

for (const snippet of [
  'api.uploads.getUserUploads',
  'api.courses.getUserCourses',
  'filteredMaterials',
  'material.courseId',
]) {
  requireIncludes(materialsPageSource, snippet, 'MyMaterialsLibrary.jsx');
}

requireExcludes(materialsPageSource, 'Introduction to Cellular Biology', 'MyMaterialsLibrary.jsx');

for (const snippet of [
  'api.courses.getUserCourses',
  'api.courses.getCourseWithTopics',
  'api.topicChat.getMessages',
  'api.ai.askTopicTutor',
  'selectedTopicId',
]) {
  requireIncludes(tutorPageSource, snippet, 'AIStudyTutor.jsx');
}

for (const snippet of [
  'const MATERIAL_OPTIONS = [',
  "I'm having trouble understanding the process of cellular respiration.",
]) {
  requireExcludes(tutorPageSource, snippet, 'AIStudyTutor.jsx');
}

for (const snippet of [
  'api.profiles.getUserStats',
  'api.exams.getUserPerformanceInsights',
  'api.concepts.getConceptReviewQueue',
  'api.courses.getUserCourses',
]) {
  requireIncludes(progressPageSource, snippet, 'StudyProgressMastery.jsx');
}

requireExcludes(progressPageSource, "You're making solid progress. Keep up the momentum!", 'StudyProgressMastery.jsx');

for (const snippet of [
  'useAuth()',
  'updateProfile({',
  'api.tutor.getTutorProfile',
  'api.tutor.setTutorPersona',
  'api.subscriptions.getSubscription',
  'buildSubscriptionSummary',
  '<Link to="/subscription"',
]) {
  requireIncludes(settingsPageSource, snippet, 'AccountStudySettings.jsx');
}

requireExcludes(settingsPageSource, 'Oct 15, 2024', 'AccountStudySettings.jsx');

console.log('real-user-dashboard-cutover-regression.test.mjs passed');
