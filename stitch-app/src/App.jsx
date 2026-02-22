import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { capturePostHogPageView } from './lib/posthog';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './components/DashboardLayout';
import { addSentryBreadcrumb } from './lib/sentry';
import { attemptChunkRecoveryReload, isChunkLoadError } from './lib/chunkLoadRecovery';

const ChunkRecoveryFallback = ({ componentName }) => (
  <div className="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center px-6">
    <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 text-center shadow-xl">
      <h2 className="text-lg font-bold text-slate-900 dark:text-white">Refreshing app files</h2>
      <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-300">
        We hit a stale app bundle while opening {componentName}. Please reload once.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-5 inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white hover:bg-primary-hover transition-colors"
      >
        Reload
      </button>
    </div>
  </div>
);

const lazyRoute = (importer, { componentName, namedExport } = {}) => lazy(() =>
  importer()
    .then((mod) => {
      if (mod?.default) return mod;
      if (namedExport && mod?.[namedExport]) {
        return { default: mod[namedExport] };
      }
      throw new Error(
        `Expected the result of a dynamic import() call with a default export for ${componentName || 'route component'}.`
      );
    })
    .catch((error) => {
      const routeName = componentName || namedExport || 'route';
      if (isChunkLoadError(error)) {
        if (attemptChunkRecoveryReload(routeName)) {
          // Keep Suspense pending until the hard reload starts.
          return new Promise(() => { });
        }
        return {
          default: () => <ChunkRecoveryFallback componentName={routeName} />,
        };
      }
      throw error;
    })
);

const LandingPage = lazyRoute(() => import('./pages/LandingPage'), { componentName: 'LandingPage' });
const Login = lazyRoute(() => import('./pages/Login'), { componentName: 'Login' });
const SignUp = lazyRoute(() => import('./pages/SignUp'), {
  componentName: 'SignUp',
  namedExport: 'SignUp',
});
const ResetPassword = lazyRoute(() => import('./pages/ResetPassword'), { componentName: 'ResetPassword' });
const OnboardingName = lazyRoute(() => import('./pages/OnboardingName'), { componentName: 'OnboardingName' });
const OnboardingLevel = lazyRoute(() => import('./pages/OnboardingLevel'), { componentName: 'OnboardingLevel' });
const OnboardingDepartment = lazyRoute(() => import('./pages/OnboardingDepartment'), { componentName: 'OnboardingDepartment' });
const Subscription = lazyRoute(() => import('./pages/Subscription'), { componentName: 'Subscription' });
const SubscriptionCallback = lazyRoute(() => import('./pages/SubscriptionCallback'), { componentName: 'SubscriptionCallback' });
const DashboardSearch = lazyRoute(() => import('./pages/DashboardSearch'), { componentName: 'DashboardSearch' });
const DashboardAnalysis = lazyRoute(() => import('./pages/DashboardAnalysis'), { componentName: 'DashboardAnalysis' });
const DashboardProcessing = lazyRoute(() => import('./pages/DashboardProcessing'), {
  componentName: 'DashboardProcessing',
  namedExport: 'DashboardProcessing',
});
const DashboardCourse = lazyRoute(() => import('./pages/DashboardCourse'), { componentName: 'DashboardCourse' });
const TopicDetail = lazyRoute(() => import('./pages/TopicDetail'), {
  componentName: 'TopicDetail',
  namedExport: 'TopicDetail',
});
const ExamMode = lazyRoute(() => import('./pages/ExamMode'), { componentName: 'ExamMode' });
const DashboardResults = lazyRoute(() => import('./pages/DashboardResults'), { componentName: 'DashboardResults' });
const DashboardFullAnalysis = lazyRoute(() => import('./pages/DashboardFullAnalysis'), { componentName: 'DashboardFullAnalysis' });
const Profile = lazyRoute(() => import('./pages/Profile'), { componentName: 'Profile' });
const EditProfile = lazyRoute(() => import('./pages/EditProfile'), { componentName: 'EditProfile' });
const PastQuestionsComingSoon = lazyRoute(() => import('./pages/PastQuestionsComingSoon'), { componentName: 'PastQuestionsComingSoon' });
const ConceptIntro = lazyRoute(() => import('./pages/ConceptIntro'), { componentName: 'ConceptIntro' });
const ConceptBuilder = lazyRoute(() => import('./pages/ConceptBuilder'), { componentName: 'ConceptBuilder' });
const AssignmentHelper = lazyRoute(() => import('./pages/AssignmentHelper'), { componentName: 'AssignmentHelper' });
const AIHumanizer = lazyRoute(() => import('./pages/AIHumanizer'), {
  componentName: 'AIHumanizer',
  namedExport: 'AIHumanizer',
});

function RouteChangeTracker() {
  const location = useLocation();

  useEffect(() => {
    addSentryBreadcrumb({
      category: 'navigation',
      message: 'Route changed',
      data: {
        pathname: location.pathname,
        search: location.search,
        hash: location.hash,
      },
    });
    capturePostHogPageView({
      pathname: location.pathname,
      search: location.search || '',
      hash: location.hash || '',
      title: typeof document !== 'undefined' ? document.title : undefined,
    });
  }, [location.pathname, location.search, location.hash]);

  return null;
}

const NotFound = () => (
  <div className="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center px-6">
    <div className="text-center max-w-md">
      <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
        <span className="material-symbols-outlined text-4xl text-slate-400">explore_off</span>
      </div>
      <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white mb-2">Page not found</h1>
      <p className="text-slate-500 dark:text-slate-400 text-sm mb-8">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <a
        href="/dashboard"
        className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-primary text-white font-bold shadow-lg shadow-primary/20 hover:bg-primary-hover transition-colors"
      >
        <span className="material-symbols-outlined text-[20px]">home</span>
        Back to Dashboard
      </a>
    </div>
  </div>
);

const RouteLoader = () => (
  <div className="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Loading...</p>
    </div>
  </div>
);

const withSuspense = (element) => (
  <Suspense fallback={<RouteLoader />}>
    {element}
  </Suspense>
);

function App() {
  return (
    <Router>
      <RouteChangeTracker />
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={withSuspense(<LandingPage />)} />
        <Route path="/login" element={withSuspense(<Login />)} />
        <Route path="/signup" element={withSuspense(<SignUp />)} />
        <Route path="/reset-password" element={withSuspense(<ResetPassword />)} />

        {/* Onboarding Routes */}
        <Route path="/onboarding/name" element={withSuspense(<OnboardingName />)} />
        <Route path="/onboarding/level" element={withSuspense(<ProtectedRoute><OnboardingLevel /></ProtectedRoute>)} />
        <Route path="/onboarding/department" element={withSuspense(<ProtectedRoute><OnboardingDepartment /></ProtectedRoute>)} />

        {/* Protected Dashboard Routes — wrapped in DashboardLayout for mobile nav */}
        <Route path="/dashboard" element={withSuspense(<ProtectedRoute><DashboardLayout><DashboardAnalysis /></DashboardLayout></ProtectedRoute>)} />
        <Route path="/dashboard/search" element={withSuspense(<ProtectedRoute><DashboardLayout><DashboardSearch /></DashboardLayout></ProtectedRoute>)} />
        <Route path="/dashboard/processing" element={withSuspense(<ProtectedRoute><DashboardLayout><DashboardProcessing /></DashboardLayout></ProtectedRoute>)} />
        <Route path="/dashboard/processing/:courseId" element={withSuspense(<ProtectedRoute><DashboardLayout><DashboardProcessing /></DashboardLayout></ProtectedRoute>)} />
        <Route path="/dashboard/course/:courseId" element={withSuspense(<ProtectedRoute><DashboardLayout><DashboardCourse /></DashboardLayout></ProtectedRoute>)} />
        <Route path="/dashboard/topic/:topicId" element={withSuspense(<ProtectedRoute><DashboardLayout><TopicDetail /></DashboardLayout></ProtectedRoute>)} />
        <Route path="/dashboard/exam" element={withSuspense(<ProtectedRoute><DashboardLayout><PastQuestionsComingSoon /></DashboardLayout></ProtectedRoute>)} />
        <Route path="/dashboard/exam/:topicId" element={withSuspense(<ProtectedRoute><DashboardLayout><ExamMode /></DashboardLayout></ProtectedRoute>)} />
        <Route path="/dashboard/results" element={withSuspense(<ProtectedRoute><DashboardLayout><DashboardResults /></DashboardLayout></ProtectedRoute>)} />
        <Route path="/dashboard/results/:attemptId" element={withSuspense(<ProtectedRoute><DashboardLayout><DashboardResults /></DashboardLayout></ProtectedRoute>)} />
        <Route path="/dashboard/analysis" element={withSuspense(<ProtectedRoute><DashboardLayout><DashboardFullAnalysis /></DashboardLayout></ProtectedRoute>)} />
        <Route path="/dashboard/assignment-helper" element={withSuspense(<ProtectedRoute><DashboardLayout><AssignmentHelper /></DashboardLayout></ProtectedRoute>)} />
        <Route path="/dashboard/humanizer" element={withSuspense(<ProtectedRoute><DashboardLayout><AIHumanizer /></DashboardLayout></ProtectedRoute>)} />

        {/* Concept Flow */}
        <Route path="/dashboard/concept-intro" element={withSuspense(<ProtectedRoute><DashboardLayout><ConceptIntro /></DashboardLayout></ProtectedRoute>)} />
        <Route path="/dashboard/concept-intro/:topicId" element={withSuspense(<ProtectedRoute><DashboardLayout><ConceptIntro /></DashboardLayout></ProtectedRoute>)} />
        <Route path="/dashboard/concept" element={withSuspense(<ProtectedRoute><DashboardLayout><ConceptBuilder /></DashboardLayout></ProtectedRoute>)} />
        <Route path="/dashboard/concept/:topicId" element={withSuspense(<ProtectedRoute><DashboardLayout><ConceptBuilder /></DashboardLayout></ProtectedRoute>)} />

        {/* Subscription Route */}
        <Route path="/subscription" element={withSuspense(<ProtectedRoute><DashboardLayout><Subscription /></DashboardLayout></ProtectedRoute>)} />
        <Route path="/subscription/callback" element={withSuspense(<ProtectedRoute><SubscriptionCallback /></ProtectedRoute>)} />

        {/* Profile Routes */}
        <Route path="/profile" element={withSuspense(<ProtectedRoute><DashboardLayout><Profile /></DashboardLayout></ProtectedRoute>)} />
        <Route path="/profile/edit" element={withSuspense(<ProtectedRoute><DashboardLayout><EditProfile /></DashboardLayout></ProtectedRoute>)} />

        {/* 404 Catch-all */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default App;
