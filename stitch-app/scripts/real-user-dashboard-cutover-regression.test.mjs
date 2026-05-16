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
  quizPageSource,
  flashcardsPageSource,
  tutorPageSource,
  lessonsPageSource,
  progressPageSource,
  settingsPageSource,
  profilePageSource,
] = await Promise.all([
  read('src/pages/StudentDashboard.jsx'),
  read('src/pages/MyMaterialsLibrary.jsx'),
  read('src/pages/ActiveQuizSession.jsx'),
  read('src/pages/FlashcardStudySession.jsx'),
  read('src/pages/AIStudyTutor.jsx'),
  read('src/pages/LessonMemoryNeuralBasis.jsx'),
  read('src/pages/StudyProgressMastery.jsx'),
  read('src/pages/AccountStudySettings.jsx'),
  read('src/pages/Profile.jsx'),
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
  'api.topics.getResumeTarget',
]) {
  requireIncludes(quizPageSource, snippet, 'ActiveQuizSession.jsx');
  requireIncludes(flashcardsPageSource, snippet, 'FlashcardStudySession.jsx');
  requireIncludes(lessonsPageSource, snippet, 'LessonMemoryNeuralBasis.jsx');
}

for (const snippet of [
  'Neurobiology 101',
  'Module 3 Review',
  'Which part of the brain is most associated with long-term memory formation?',
]) {
  requireExcludes(quizPageSource, snippet, 'ActiveQuizSession.jsx');
}

for (const snippet of [
  'Cognitive Psychology 101',
  '12/40 cards',
  'Neuroplasticity',
]) {
  requireExcludes(flashcardsPageSource, snippet, 'FlashcardStudySession.jsx');
}

for (const snippet of [
  'Psychology 101',
  'The Neural Basis of Memory',
  'Memory is not stored in a single location',
  "Explain the Hippocampus like I'm 5",
]) {
  requireExcludes(lessonsPageSource, snippet, 'LessonMemoryNeuralBasis.jsx');
}

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
  'useConvexAuth',
  'api.profiles.getUserStats',
  'api.exams.getUserPerformanceInsights',
  'api.concepts.getConceptReviewQueue',
  'api.courses.getUserCourses',
  "isAuthenticated ? {} : 'skip'",
  "isAuthenticated ? { limit: 6 } : 'skip'",
]) {
  requireIncludes(progressPageSource, snippet, 'StudyProgressMastery.jsx');
}

requireExcludes(progressPageSource, "You're making solid progress. Keep up the momentum!", 'StudyProgressMastery.jsx');

for (const snippet of [
  'readinessLabel',
  'Exam Readiness',
  'Mastery Level:',
  'Needs Work',
  'Developing',
  'Proficient',
  'Recommended Action',
  'while it is due',
  'Start Review',
  'View Topic Breakdown',
]) {
  requireExcludes(progressPageSource, snippet, 'StudyProgressMastery.jsx');
}

for (const snippet of [
  'Quiz Performance',
  'Your average score across completed practice.',
  'Next up',
  'Review flashcards from',
  'Open Deck',
  'buildCourseProgressItems',
  'aria-label={`${course.title} progress`}',
]) {
  requireIncludes(progressPageSource, snippet, 'StudyProgressMastery.jsx');
}

for (const snippet of [
  'useAuth()',
  'updateProfile({',
  'api.tutor.getTutorProfile',
  'api.tutor.setTutorPersona',
  'api.subscriptions.getSubscription',
  'buildSubscriptionSummary',
  '<Link to="/dashboard/settings#subscription"',
  'id="profile"',
  'id="subscription"',
  'signOut',
  "navigate('/login'",
  'Sign Out',
]) {
  requireIncludes(settingsPageSource, snippet, 'AccountStudySettings.jsx');
}

requireExcludes(settingsPageSource, 'Oct 15, 2024', 'AccountStudySettings.jsx');
requireExcludes(profilePageSource, 'Sign Out', 'Profile.jsx');

console.log('real-user-dashboard-cutover-regression.test.mjs passed');
