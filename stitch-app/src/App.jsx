import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { usePostHog } from '@posthog/react';
import LandingPage from './pages/LandingPage';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './components/DashboardLayout';
import { addSentryBreadcrumb } from './lib/sentry';

const Login = lazy(() => import('./pages/Login'));
const SignUp = lazy(() => import('./pages/SignUp'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const OnboardingName = lazy(() => import('./pages/OnboardingName'));
const OnboardingLevel = lazy(() => import('./pages/OnboardingLevel'));
const OnboardingDepartment = lazy(() => import('./pages/OnboardingDepartment'));
const Subscription = lazy(() => import('./pages/Subscription'));
const DashboardAnalysis = lazy(() => import('./pages/DashboardAnalysis'));
const DashboardProcessing = lazy(() => import('./pages/DashboardProcessing'));
const DashboardCourse = lazy(() => import('./pages/DashboardCourse'));
const TopicDetail = lazy(() => import('./pages/TopicDetail'));
const ExamMode = lazy(() => import('./pages/ExamMode'));
const DashboardResults = lazy(() => import('./pages/DashboardResults'));
const DashboardFullAnalysis = lazy(() => import('./pages/DashboardFullAnalysis'));
const Profile = lazy(() => import('./pages/Profile'));
const EditProfile = lazy(() => import('./pages/EditProfile'));
const PastQuestionsComingSoon = lazy(() => import('./pages/PastQuestionsComingSoon'));
const ConceptIntro = lazy(() => import('./pages/ConceptIntro'));
const ConceptBuilder = lazy(() => import('./pages/ConceptBuilder'));
const AssignmentHelper = lazy(() => import('./pages/AssignmentHelper'));
const AIHumanizer = lazy(() => import('./pages/AIHumanizer'));

function RouteChangeTracker() {
  const location = useLocation();
  const posthog = usePostHog();

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
    if (posthog && typeof posthog.capture === 'function') {
      posthog.capture('$pageview', {
        pathname: location.pathname,
        search: location.search || '',
        hash: location.hash || '',
        title: typeof document !== 'undefined' ? document.title : undefined,
      });
    }
  }, [location.pathname, location.search, location.hash, posthog]);

  return null;
}

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
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={withSuspense(<Login />)} />
        <Route path="/signup" element={withSuspense(<SignUp />)} />
        <Route path="/reset-password" element={withSuspense(<ResetPassword />)} />

        {/* Onboarding Routes */}
        <Route path="/onboarding/name" element={withSuspense(<OnboardingName />)} />
        <Route path="/onboarding/level" element={withSuspense(<ProtectedRoute><OnboardingLevel /></ProtectedRoute>)} />
        <Route path="/onboarding/department" element={withSuspense(<ProtectedRoute><OnboardingDepartment /></ProtectedRoute>)} />

        {/* Protected Dashboard Routes — wrapped in DashboardLayout for mobile nav */}
        <Route path="/dashboard" element={withSuspense(<ProtectedRoute><DashboardLayout><DashboardAnalysis /></DashboardLayout></ProtectedRoute>)} />
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

        {/* Profile Routes */}
        <Route path="/profile" element={withSuspense(<ProtectedRoute><DashboardLayout><Profile /></DashboardLayout></ProtectedRoute>)} />
        <Route path="/profile/edit" element={withSuspense(<ProtectedRoute><DashboardLayout><EditProfile /></DashboardLayout></ProtectedRoute>)} />
      </Routes>
    </Router>
  );
}

export default App;
