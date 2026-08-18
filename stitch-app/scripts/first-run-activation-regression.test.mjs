import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const read = (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

const [
  dashboard,
  signUp,
  app,
  auth,
  upload,
  nav,
  library,
] = await Promise.all([
  read('src/pages/StudentDashboard.jsx'),
  read('src/pages/SignUp.jsx'),
  read('src/App.jsx'),
  read('src/contexts/AuthContext.jsx'),
  read('src/pages/UploadMaterials.jsx'),
  read('src/components/MobileBottomNav.jsx'),
  read('src/pages/MyMaterialsLibrary.jsx'),
]);

const requireIncludes = (source, snippet, label) => {
  if (!source.includes(snippet)) {
    throw new Error(`${label} should include "${snippet}".`);
  }
};

const requireExcludes = (source, snippet, label) => {
  if (source.includes(snippet)) {
    throw new Error(`${label} should not include "${snippet}".`);
  }
};

requireIncludes(dashboard, 'const FirstRunHome', 'StudentDashboard.jsx');
requireIncludes(dashboard, 'const isFirstRun', 'StudentDashboard.jsx');
requireIncludes(dashboard, 'Drop a lecture PDF, slide deck, or recording', 'StudentDashboard.jsx');
requireIncludes(dashboard, 'Screenshots and camera photos are not supported.', 'StudentDashboard.jsx');
requireExcludes(dashboard, 'Finish setting up your profile', 'StudentDashboard.jsx');
requireExcludes(dashboard, 'Complete profile', 'StudentDashboard.jsx');
requireExcludes(dashboard, 'onboardingCompleted === true', 'StudentDashboard.jsx');

requireIncludes(signUp, 'Continue with Google', 'SignUp.jsx');
requireIncludes(signUp, 'id="signup-name"', 'SignUp.jsx');
requireIncludes(signUp, '{ name: trimmedName }', 'SignUp.jsx');
requireIncludes(signUp, 'Upload slides, get lessons', 'SignUp.jsx');
requireExcludes(signUp, 'Continue with Email', 'SignUp.jsx');
requireExcludes(signUp, 'free credit', 'SignUp.jsx');
requireExcludes(signUp, 'Join your campus community', 'SignUp.jsx');

requireIncludes(app, 'RedirectOnboardingNameToSignup', 'App.jsx');
requireIncludes(app, "to={search ? `/signup?${search}` : '/signup'}", 'App.jsx');
requireExcludes(app, "import('./pages/OnboardingName')", 'App.jsx');

requireIncludes(auth, "typeof metadata === 'string'", 'AuthContext.jsx');
requireIncludes(auth, 'metadata?.full_name || metadata?.name', 'AuthContext.jsx');

requireIncludes(upload, 'Generate your first lesson', 'UploadMaterials.jsx');
requireIncludes(upload, "We'll take you to your first lesson when it's ready.", 'UploadMaterials.jsx');
requireIncludes(upload, 'Opening your first lesson', 'UploadMaterials.jsx');
requireIncludes(upload, 'navigate(first.lessonsHref)', 'UploadMaterials.jsx');
requireIncludes(upload, 'buildFirstLessonHref', 'UploadMaterials.jsx');
requireIncludes(upload, 'fetchCourses', 'UploadMaterials.jsx');
requireExcludes(upload, 'Add to your workspace', 'UploadMaterials.jsx');

requireIncludes(nav, 'firstRunPrimaryTabs', 'MobileBottomNav.jsx');
requireIncludes(nav, "path: '/dashboard/upload'", 'MobileBottomNav.jsx');
requireIncludes(nav, 'useHasUploads', 'MobileBottomNav.jsx');

requireIncludes(library, 'Nothing to study yet', 'MyMaterialsLibrary.jsx');
requireExcludes(library, 'No downloads yet', 'MyMaterialsLibrary.jsx');

console.log('first-run-activation-regression.test.mjs passed');
