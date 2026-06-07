import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { useMutation } from 'convex/react';
import { LazyMotion, domAnimation } from 'motion/react';
import { api } from '../convex/_generated/api';
import { useAuth } from './contexts/AuthContext';
import { hasConvexUrl } from './lib/convex-config';
import {
  buildRecordedCampaignAttributionKey,
  clearPendingCampaignAttribution,
  hasRecordedCampaignAttribution,
  markRecordedCampaignAttribution,
  readCampaignAttributionFromSearch,
  readPendingCampaignAttribution,
  stashPendingCampaignAttribution,
} from './lib/campaignAttribution';
import { capturePostHogEvent, capturePostHogPageView } from './lib/posthog';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './components/DashboardLayout';
import PublicShell, { ArrowBadge } from './components/PublicShell';
import SignUpPage from './pages/SignUp';
import { addSentryBreadcrumb } from './lib/sentry';
import { attemptChunkRecoveryReload, isChunkLoadError } from './lib/chunkLoadRecovery';
import { useRouteTheme } from './lib/useRouteTheme';

const ChunkRecoveryFallback = ({ componentName, reloadRequested = false }) => (
  <div className="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center px-6">
    <div className="w-full max-w-md card-base p-6 text-center">
      <h2 className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark">
        {reloadRequested ? 'Refreshing app files' : 'Reload needed'}
      </h2>
      <p className="mt-2 text-body-sm font-medium text-text-faint-light dark:text-text-faint-dark">
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

const resolveLazyRouteModule = (mod, { componentName, namedExport } = {}) => {
  if (mod?.default) return mod;

  const exportCandidates = [];
  const seenExportCandidates = new Set();
  for (const candidate of [namedExport, componentName]) {
    if (candidate && !seenExportCandidates.has(candidate)) {
      seenExportCandidates.add(candidate);
      exportCandidates.push(candidate);
    }
  }

  for (const candidate of exportCandidates) {
    if (mod?.[candidate]) {
      return { default: mod[candidate] };
    }
  }

  if (mod && typeof mod === 'object') {
    const functionExports = Object.entries(mod)
      .filter(([key, value]) => key !== 'default' && typeof value === 'function');
    if (functionExports.length === 1) {
      return { default: functionExports[0][1] };
    }
  }

  return null;
};

const lazyRoute = (importer, { componentName, namedExport } = {}) => lazy(() =>
  importer()
    .then((mod) => {
      const resolvedModule = resolveLazyRouteModule(mod, { componentName, namedExport });
      if (resolvedModule) {
        return resolvedModule;
      }

      const routeName = componentName || namedExport || 'route';
      throw new Error(`Lazy route "${routeName}" did not export a React component.`);
    })
    .catch((error) => {
      const routeName = componentName || namedExport || 'route';
      if (isChunkLoadError(error)) {
        const reloadRequested = attemptChunkRecoveryReload(routeName);
        return {
          default: () => (
            <ChunkRecoveryFallback
              componentName={routeName}
              reloadRequested={reloadRequested}
            />
          ),
        };
      }
      throw error;
    })
);

const StudentDashboard = lazyRoute(() => import('./pages/StudentDashboard'), { componentName: 'StudentDashboard' });
const MyMaterialsLibrary = lazyRoute(() => import('./pages/MyMaterialsLibrary'), { componentName: 'MyMaterialsLibrary' });
const UploadMaterials = lazyRoute(() => import('./pages/UploadMaterials'), { componentName: 'UploadMaterials' });
const ActiveQuizSession = lazyRoute(() => import('./pages/ActiveQuizSession'), { componentName: 'ActiveQuizSession' });
const QuizPlayer = lazyRoute(() => import('./pages/ExamMode'), { componentName: 'QuizPlayer' });
const QuizResults = lazyRoute(() => import('./pages/DashboardResults'), { componentName: 'QuizResults' });
const FlashcardStudySession = lazyRoute(() => import('./pages/FlashcardStudySession'), { componentName: 'FlashcardStudySession' });
const AIStudyTutor = lazyRoute(() => import('./pages/AIStudyTutor'), { componentName: 'AIStudyTutor' });
const StudyProgressMastery = lazyRoute(() => import('./pages/StudyProgressMastery'), { componentName: 'StudyProgressMastery' });
const AccountStudySettings = lazyRoute(() => import('./pages/AccountStudySettings'), { componentName: 'AccountStudySettings' });
const LessonMemoryNeuralBasis = lazyRoute(() => import('./pages/LessonMemoryNeuralBasis'), { componentName: 'LessonMemoryNeuralBasis' });
const TopicDetail = lazyRoute(() => import('./pages/TopicDetail'), { componentName: 'TopicDetail', namedExport: 'TopicDetail' });
const DashboardPodcasts = lazyRoute(() => import('./pages/DashboardPodcasts'), { componentName: 'DashboardPodcasts' });
const LandingPage = lazyRoute(() => import('./pages/LandingPage'), { componentName: 'LandingPage' });
const Login = lazyRoute(() => import('./pages/Login'), { componentName: 'Login' });
const ResetPassword = lazyRoute(() => import('./pages/ResetPassword'), { componentName: 'ResetPassword' });
const ProductResearch = lazyRoute(() => import('./pages/ProductResearch'), { componentName: 'ProductResearch' });
const Unsubscribe = lazyRoute(() => import('./pages/Unsubscribe'), { componentName: 'Unsubscribe' });
const Terms = lazyRoute(() => import('./pages/Terms'), { componentName: 'Terms' });
const Privacy = lazyRoute(() => import('./pages/Privacy'), { componentName: 'Privacy' });
const KidsParentHome = lazyRoute(() => import('./pages/Kids'), { componentName: 'KidsParentHome', namedExport: 'KidsParentHome' });
const KidsUpload = lazyRoute(() => import('./pages/Kids'), { componentName: 'KidsUpload', namedExport: 'KidsUpload' });
const KidsChildHome = lazyRoute(() => import('./pages/Kids'), { componentName: 'KidsChildHome', namedExport: 'KidsChildHome' });
const KidsLesson = lazyRoute(() => import('./pages/Kids'), { componentName: 'KidsLesson', namedExport: 'KidsLesson' });
const OnboardingName = lazyRoute(() => import('./pages/OnboardingName'), { componentName: 'OnboardingName' });
const OnboardingLevel = lazyRoute(() => import('./pages/OnboardingLevel'), { componentName: 'OnboardingLevel' });
const OnboardingDepartment = lazyRoute(() => import('./pages/OnboardingDepartment'), { componentName: 'OnboardingDepartment' });
const SubscriptionCallback = lazyRoute(() => import('./pages/SubscriptionCallback'), { componentName: 'SubscriptionCallback' });
const AdminDashboard = lazyRoute(() => import('./pages/AdminDashboard'), { componentName: 'AdminDashboard' });

function RouteChangeTracker() {
  const routerLocation = useLocation();

  useRouteTheme();

  useEffect(() => {
    addSentryBreadcrumb({
      category: 'navigation',
      message: 'Route changed',
      data: {
        pathname: routerLocation.pathname,
        search: routerLocation.search,
        hash: routerLocation.hash,
      },
    });
    capturePostHogPageView({
      pathname: routerLocation.pathname,
      search: routerLocation.search || '',
      hash: routerLocation.hash || '',
      title: typeof document !== 'undefined' ? document.title : undefined,
    });
  }, [routerLocation.pathname, routerLocation.search, routerLocation.hash]);

  return null;
}

function CampaignAttributionTracker() {
  const routerLocation = useLocation();
  const { user } = useAuth();
  const recordCampaignLanding = useMutation(api.campaignAttribution.recordCampaignLanding);

  useEffect(() => {
    const attributionFromUrl = readCampaignAttributionFromSearch(routerLocation.search, routerLocation.pathname);
    if (attributionFromUrl) {
      stashPendingCampaignAttribution(attributionFromUrl);
    }
  }, [routerLocation.pathname, routerLocation.search]);

  useEffect(() => {
    if (!user?.id) return undefined;

    const pendingAttribution = readPendingCampaignAttribution();
    if (!pendingAttribution?.campaignId) return undefined;

    const deliveryKey = buildRecordedCampaignAttributionKey({
      userId: user.id,
      campaignId: pendingAttribution.campaignId,
    });
    if (!deliveryKey) return undefined;
    if (hasRecordedCampaignAttribution(deliveryKey)) {
      clearPendingCampaignAttribution();
      return undefined;
    }

    let cancelled = false;

    void recordCampaignLanding({
      campaignId: pendingAttribution.campaignId,
      source: pendingAttribution.source,
      medium: pendingAttribution.medium,
      content: pendingAttribution.content,
      landingPath: pendingAttribution.landingPath || routerLocation.pathname,
      landingSearch: pendingAttribution.landingSearch || routerLocation.search || '',
    })
      .then(() => {
        if (cancelled) return;
        capturePostHogEvent('campaign_landing', {
          campaignId: pendingAttribution.campaignId,
          campaignSource: pendingAttribution.source,
          campaignMedium: pendingAttribution.medium,
          campaignContent: pendingAttribution.content,
          landingPath: pendingAttribution.landingPath || routerLocation.pathname,
          landingSearch: pendingAttribution.landingSearch || routerLocation.search || '',
          userId: String(user.id),
        });
        markRecordedCampaignAttribution(deliveryKey);
        clearPendingCampaignAttribution();
      })
      .catch(() => {
        // Leave the pending attribution in session storage so it can retry on the next navigation.
      });

    return () => {
      cancelled = true;
    };
  }, [routerLocation.pathname, routerLocation.search, recordCampaignLanding, user?.id]);

  return null;
}

const NotFound = () => (
  <PublicShell>
    <div className="max-w-xl mx-auto text-center py-10">
      <div className="inline-flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-[#E8651B] justify-center mb-6">
        <span className="inline-block w-8 h-[2px] bg-[#E8651B]" /> 404
      </div>
      <h1 className="text-5xl sm:text-6xl font-semibold leading-[1.05] tracking-tight mb-6">
        Page <span className="text-[#F3C64A]">not</span>
        <br />
        <span className="inline-flex items-center gap-3">
          <ArrowBadge size={44} /> found
        </span>
      </h1>
      <p className="text-[#687384] text-base leading-relaxed max-w-md mx-auto mb-8">
        The page you're looking for doesn't exist or has been moved. Let's get you back on track.
      </p>
      <a href="/dashboard" className="cp-btn-primary inline-flex w-auto px-6">
        <span className="material-symbols-outlined text-[20px]">home</span>
        Back to Dashboard
      </a>
    </div>
  </PublicShell>
);

const RouteLoader = () => (
  <div className="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <div className="animate-spin rounded-full size-12 border-t-2 border-b-2 border-primary"></div>
      <p className="text-text-faint-light dark:text-text-faint-dark text-body-sm font-medium">Loading…</p>
    </div>
  </div>
);

const RouteSuspense = ({ children }) => {
  const routerLocation = useLocation();

  return (
    <Suspense key={routerLocation.pathname} fallback={<RouteLoader />}>
      {children}
    </Suspense>
  );
};

const withSuspense = (element) => (
  <RouteSuspense>
    {element}
  </RouteSuspense>
);

const RedirectLegacyLessonDetailRoute = () => {
  const { lessonId } = useParams();
  return <Navigate to={lessonId ? `/dashboard/topic/${lessonId}` : '/dashboard/lessons'} replace />;
};

const RedirectLegacyQuizRoute = () => {
  const { topicId } = useParams();
  const location = useLocation();
  const search = location?.search || '';
  return (
    <Navigate
      to={topicId ? `/dashboard/quiz/${topicId}${search}` : `/dashboard/quiz${search}`}
      replace
    />
  );
};

const RedirectLegacyFlashcardsRoute = () => {
  const { topicId } = useParams();
  return <Navigate to={topicId ? `/dashboard/flashcards/${topicId}` : '/dashboard/flashcards'} replace />;
};

const RedirectCourseToLessonsRoute = () => {
  const { courseId } = useParams();
  const to = courseId
    ? `/dashboard/lessons?courseId=${encodeURIComponent(courseId)}`
    : '/dashboard/lessons';
  return <Navigate to={to} replace />;
};

const TopicDetailRoute = () => {
  const { topicId } = useParams();
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <TopicDetail key={topicId || 'topic'} />
      </DashboardLayout>
    </ProtectedRoute>
  );
};

const QuizPlayerRoute = () => {
  const { topicId } = useParams();
  const routerLocation = useLocation();
  const routeKey = `${topicId || 'quiz'}:${routerLocation.search || ''}`;
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <QuizPlayer key={routeKey} />
      </DashboardLayout>
    </ProtectedRoute>
  );
};

function App() {
  return (
    <LazyMotion features={domAnimation}>
      <Router>
        <RouteChangeTracker />
        {hasConvexUrl ? <CampaignAttributionTracker /> : null}
        <Routes>
        {/* Public Routes */}
        <Route path="/" element={withSuspense(<LandingPage />)} />
        <Route path="/login" element={withSuspense(<Login />)} />
        <Route path="/signup" element={withSuspense(<SignUpPage />)} />
        <Route path="/reset-password" element={withSuspense(<ResetPassword />)} />
        <Route path="/research" element={withSuspense(<ProductResearch />)} />
        <Route path="/unsubscribe" element={withSuspense(<Unsubscribe />)} />
        <Route path="/terms" element={withSuspense(<Terms />)} />
        <Route path="/privacy" element={withSuspense(<Privacy />)} />
        <Route path="/kids" element={withSuspense(<KidsParentHome />)} />
        <Route path="/kids/parent" element={withSuspense(<KidsParentHome />)} />
        <Route path="/kids/upload" element={withSuspense(<KidsUpload />)} />
        <Route path="/kids/child" element={withSuspense(<KidsChildHome />)} />
        <Route path="/kids/lesson/:lessonId" element={withSuspense(<KidsLesson />)} />

        {/* Onboarding Routes — /onboarding/name is sign-up (public), level+department are protected */}
        <Route path="/onboarding/name" element={withSuspense(<OnboardingName />)} />
        <Route path="/onboarding/level" element={withSuspense(<ProtectedRoute><OnboardingLevel /></ProtectedRoute>)} />
        <Route path="/onboarding/department" element={withSuspense(<ProtectedRoute><OnboardingDepartment /></ProtectedRoute>)} />

        {/* Protected Dashboard Routes — wrapped in DashboardLayout for mobile nav */}
        <Route path="/dashboard" element={withSuspense(<ProtectedRoute><DashboardLayout><StudentDashboard /></DashboardLayout></ProtectedRoute>)} />
        <Route path="/dashboard/library" element={withSuspense(<ProtectedRoute><DashboardLayout><MyMaterialsLibrary /></DashboardLayout></ProtectedRoute>)} />
        <Route path="/dashboard/upload" element={withSuspense(<ProtectedRoute><DashboardLayout><UploadMaterials /></DashboardLayout></ProtectedRoute>)} />
        <Route path="/dashboard/quiz/results/:attemptId" element={withSuspense(<ProtectedRoute><DashboardLayout><QuizResults /></DashboardLayout></ProtectedRoute>)} />
        <Route path="/dashboard/quiz/:topicId" element={withSuspense(<QuizPlayerRoute />)} />
        <Route path="/dashboard/quiz" element={withSuspense(<ProtectedRoute><DashboardLayout><ActiveQuizSession /></DashboardLayout></ProtectedRoute>)} />
        <Route path="/dashboard/flashcards" element={withSuspense(<ProtectedRoute><DashboardLayout><FlashcardStudySession /></DashboardLayout></ProtectedRoute>)} />
        <Route path="/dashboard/flashcards/:deckId" element={withSuspense(<ProtectedRoute><DashboardLayout><FlashcardStudySession /></DashboardLayout></ProtectedRoute>)} />
        <Route path="/dashboard/ai-tutor" element={withSuspense(<ProtectedRoute><DashboardLayout><AIStudyTutor /></DashboardLayout></ProtectedRoute>)} />
        <Route path="/dashboard/progress" element={withSuspense(<ProtectedRoute><DashboardLayout><StudyProgressMastery /></DashboardLayout></ProtectedRoute>)} />
        <Route path="/dashboard/settings" element={withSuspense(<ProtectedRoute><DashboardLayout><AccountStudySettings /></DashboardLayout></ProtectedRoute>)} />
        <Route path="/dashboard/lessons" element={withSuspense(<ProtectedRoute><DashboardLayout><LessonMemoryNeuralBasis /></DashboardLayout></ProtectedRoute>)} />
        <Route path="/dashboard/lessons/:lessonId" element={<RedirectLegacyLessonDetailRoute />} />
        <Route path="/dashboard/podcasts" element={withSuspense(<ProtectedRoute><DashboardLayout><DashboardPodcasts /></DashboardLayout></ProtectedRoute>)} />
        {/* Redirect old dashboard surfaces to the new dashboard screens */}
        <Route path="/dashboard/search" element={<Navigate to="/dashboard/library" replace />} />
        <Route path="/dashboard/processing" element={<Navigate to="/dashboard/library" replace />} />
        <Route path="/dashboard/processing/:courseId" element={<Navigate to="/dashboard/library" replace />} />
        <Route path="/dashboard/course/:courseId" element={<RedirectCourseToLessonsRoute />} />
        <Route path="/dashboard/topic/:topicId" element={withSuspense(<TopicDetailRoute />)} />
        <Route path="/dashboard/exam" element={<Navigate to="/dashboard/quiz" replace />} />
        <Route path="/dashboard/exam/:topicId" element={<RedirectLegacyQuizRoute />} />
        <Route path="/dashboard/results" element={<Navigate to="/dashboard/progress" replace />} />
        <Route path="/dashboard/results/:attemptId" element={<Navigate to="/dashboard/progress" replace />} />
        <Route path="/dashboard/analysis" element={<Navigate to="/dashboard/progress" replace />} />
        <Route path="/dashboard/assignment-helper" element={<Navigate to="/dashboard/ai-tutor" replace />} />
        <Route path="/dashboard/humanizer" element={<Navigate to="/dashboard/ai-tutor" replace />} />
        <Route path="/dashboard/community" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard/community/:channelId" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard/concept-intro" element={<Navigate to="/dashboard/flashcards" replace />} />
        <Route path="/dashboard/concept-intro/:topicId" element={<RedirectLegacyFlashcardsRoute />} />
        <Route path="/dashboard/concept" element={<Navigate to="/dashboard/flashcards" replace />} />
        <Route path="/dashboard/concept/:topicId" element={<RedirectLegacyFlashcardsRoute />} />

        {/* Subscription Route */}
        <Route path="/subscription" element={<Navigate to="/dashboard/settings#subscription" replace />} />
        <Route path="/subscription/callback" element={withSuspense(<ProtectedRoute><SubscriptionCallback /></ProtectedRoute>)} />

        {/* Profile Routes */}
        <Route path="/profile" element={<Navigate to="/dashboard/settings#profile" replace />} />
        <Route path="/profile/edit" element={<Navigate to="/dashboard/settings#profile" replace />} />

        {/* Admin Route */}
        <Route path="/admin" element={withSuspense(<ProtectedRoute><DashboardLayout><AdminDashboard /></DashboardLayout></ProtectedRoute>)} />

        {/* 404 Catch-all */}
        <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </LazyMotion>
  );
}

export default App;
