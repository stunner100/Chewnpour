import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useConvexAuth } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';
import { formatCourseTitle } from '../lib/courseTitle';
import GeneratedCourseHeader from '../components/course/GeneratedCourseHeader';
import CourseSummaryStats from '../components/course/CourseSummaryStats';
import ContinueLearningPanel from '../components/course/ContinueLearningPanel';
import CoursePodcastCard from '../components/course/CoursePodcastCard';
import SourceFileCard from '../components/course/SourceFileCard';
import TopicModuleCard from '../components/course/TopicModuleCard';
import CourseWeakConcepts from '../components/course/CourseWeakConcepts';
import CourseProgressSidebar from '../components/course/CourseProgressSidebar';

const EMPTY_LIST = [];
const PODCAST_GENERATE_PATH = '/dashboard/podcasts?generate=1';

const ACTION_PROMPTS = {
    quiz: {
        icon: 'quiz',
        title: 'Pick a topic to generate a quiz',
        description:
            'Quizzes are tailored to each topic. Open any module below to start its quiz.',
    },
    flashcards: {
        icon: 'style',
        title: 'Pick a topic to open its Word Bank',
        description:
            'Each topic lesson contains a Word Bank with key terms. Open one and scroll to the Word Bank to start reviewing.',
    },
};

const PODCAST_STATUS_LABEL = {
    ready: 'Ready',
    pending: 'Generating',
    running: 'Generating',
    failed: 'Failed',
};

const buildObjectiveExamRoute = (topicId) =>
    topicId ? `/dashboard/exam/${topicId}?autostart=mcq` : '/dashboard';

const estimateReadingMinutes = (content) => {
    if (!content) return null;
    const words = content.split(/\s+/).length;
    return Math.max(1, Math.ceil(words / 200));
};

const ProcessingState = ({ processingStep }) => {
    const steps = [
        { key: 'extracting', label: 'Extracting content', icon: 'upload_file' },
        { key: 'analyzing', label: 'Analyzing materials', icon: 'analytics' },
        { key: 'generating_topics', label: 'Outlining topics', icon: 'list_alt' },
        { key: 'generating_first_topic', label: 'Building first lesson', icon: 'auto_stories' },
        { key: 'first_topic_ready', label: 'First topic ready', icon: 'check_circle' },
        { key: 'generating_remaining_topics', label: 'Generating remaining topics', icon: 'pending' },
        { key: 'generating_question_bank', label: 'Creating practice questions', icon: 'quiz' },
        { key: 'ready', label: 'All done', icon: 'task_alt' },
    ];
    const currentStep = processingStep || 'extracting';
    const currentIdx = steps.findIndex((s) => s.key === currentStep);

    return (
        <section className="card-base p-8 md:p-10 text-center">
            <div className="relative w-14 h-14 mx-auto mb-5">
                <div className="absolute inset-0 rounded-full border-[3px] border-border-light dark:border-border-dark" />
                <div className="absolute inset-0 rounded-full border-[3px] border-primary border-t-transparent animate-spin" />
                <div className="absolute inset-2 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary text-xl">auto_awesome</span>
                </div>
            </div>
            <h1 className="text-display-sm text-text-main-light dark:text-text-main-dark mb-2">
                Your course is being prepared
            </h1>
            <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark max-w-md mx-auto mb-6">
                ChewnPour is turning your material into lessons, quizzes, and podcast-ready study sections.
            </p>
            <div className="max-w-xs mx-auto space-y-2 text-left">
                {steps
                    .slice(0, Math.max(currentIdx + 2, 4))
                    .map((step, i) => {
                        const isDone = i < currentIdx;
                        const isActive = i === currentIdx;
                        return (
                            <div
                                key={step.key}
                                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                                    isActive
                                        ? 'bg-primary/10 border border-primary/20'
                                        : isDone
                                            ? 'opacity-70'
                                            : 'opacity-40'
                                }`}
                            >
                                <span
                                    className={`material-symbols-outlined text-[18px] ${
                                        isDone
                                            ? 'text-emerald-500'
                                            : isActive
                                                ? 'text-primary'
                                                : 'text-text-faint-light dark:text-text-faint-dark'
                                    }`}
                                    style={isDone ? { fontVariationSettings: "'FILL' 1" } : undefined}
                                >
                                    {isDone ? 'check_circle' : step.icon}
                                </span>
                                <span
                                    className={`text-body-sm ${
                                        isActive
                                            ? 'font-semibold text-text-main-light dark:text-text-main-dark'
                                            : 'text-text-sub-light dark:text-text-sub-dark'
                                    }`}
                                >
                                    {step.label}
                                </span>
                                {isActive && (
                                    <span className="material-symbols-outlined text-[14px] text-primary animate-spin ml-auto">
                                        sync
                                    </span>
                                )}
                            </div>
                        );
                    })}
            </div>
        </section>
    );
};

const SkeletonModuleCard = () => (
    <div className="card-base p-0 overflow-hidden animate-pulse">
        <div className="h-28 bg-surface-hover-light dark:bg-surface-hover-dark" />
        <div className="p-4 space-y-2">
            <div className="h-3 w-16 bg-border-subtle dark:bg-border-subtle-dark rounded" />
            <div className="h-5 w-3/4 bg-border-subtle dark:bg-border-subtle-dark rounded" />
            <div className="h-3 w-full bg-border-subtle dark:bg-border-subtle-dark rounded" />
        </div>
    </div>
);

const DashboardCourse = () => {
    const { courseId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const userId = user?.id;
    const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const requestedAction = searchParams.get('action');
    const actionPrompt = requestedAction ? ACTION_PROMPTS[requestedAction] : null;

    const dismissActionBanner = useCallback(() => {
        const next = new URLSearchParams(searchParams);
        next.delete('action');
        setSearchParams(next, { replace: true });
    }, [searchParams, setSearchParams]);

    useEffect(() => {
        const main = document.getElementById('dashboard-main');
        if (main) main.scrollTop = 0;
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }, [courseId]);

    useEffect(() => {
        if (!actionPrompt) return undefined;
        const timer = window.setTimeout(() => {
            const node = document.getElementById('course-modules');
            if (node) node.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 250);
        return () => window.clearTimeout(timer);
    }, [actionPrompt]);

    // ── Course + topics ────────────────────────────────────────────────────
    const courseData = useQuery(
        api.courses.getCourseWithTopics,
        courseId ? { courseId } : 'skip',
    );
    const allCourses = useQuery(
        api.courses.getUserCourses,
        !courseId && userId ? { userId } : 'skip',
    );
    const latestCourse = courseId ? null : allCourses?.[0];
    const latestCourseTopics = useQuery(
        api.courses.getCourseWithTopics,
        !courseId && latestCourse?._id ? { courseId: latestCourse._id } : 'skip',
    );
    const fallbackCourse = latestCourse ? { ...latestCourse, topics: [] } : null;
    const displayCourse = courseData || latestCourseTopics || fallbackCourse;

    const topics = Array.isArray(displayCourse?.topics) ? displayCourse.topics : EMPTY_LIST;
    const finalAssessmentTopics = Array.isArray(displayCourse?.finalAssessmentTopics)
        ? displayCourse.finalAssessmentTopics
        : EMPTY_LIST;
    const resolvedCourseId = displayCourse?._id;

    const courseProgress = useQuery(
        api.topics.getUserCourseProgress,
        resolvedCourseId && isConvexAuthenticated ? { courseId: resolvedCourseId } : 'skip',
    );
    const upload = useQuery(
        api.uploads.getUpload,
        displayCourse?.uploadId ? { uploadId: displayCourse.uploadId } : 'skip',
    );

    // Course-level podcasts (filter the user's recent list to this course)
    const recentUserPodcasts = useQuery(
        api.podcasts.listRecentUserPodcasts,
        isConvexAuthenticated ? { limit: 20 } : 'skip',
    );
    const coursePodcasts = useMemo(() => {
        if (!Array.isArray(recentUserPodcasts) || !resolvedCourseId) return [];
        return recentUserPodcasts
            .filter((p) => p.courseId === resolvedCourseId)
            .sort((a, b) => b.createdAt - a.createdAt);
    }, [recentUserPodcasts, resolvedCourseId]);
    const featuredPodcast = coursePodcasts.find((p) => p.status === 'ready')
        || coursePodcasts.find((p) => p.status === 'pending' || p.status === 'running')
        || coursePodcasts[0]
        || null;

    // Course-scoped weak concepts.
    const conceptReviewQueue = useQuery(
        api.concepts.getConceptReviewQueue,
        isConvexAuthenticated ? { limit: 10 } : 'skip',
    );
    const courseWeakConcepts = useMemo(() => {
        const items = conceptReviewQueue?.items || [];
        if (!resolvedCourseId) return [];
        return items.filter((item) => String(item.courseId) === String(resolvedCourseId)).slice(0, 5);
    }, [conceptReviewQueue, resolvedCourseId]);

    // ── Derived stats ──────────────────────────────────────────────────────
    const plannedTopicTitles = Array.isArray(upload?.plannedTopicTitles)
        ? upload.plannedTopicTitles
        : EMPTY_LIST;
    const plannedTopicCountFromUpload =
        typeof upload?.plannedTopicCount === 'number' ? upload.plannedTopicCount : 0;
    const plannedCount = Math.max(
        plannedTopicCountFromUpload,
        plannedTopicTitles.length,
        topics.length,
    );
    const generatedCountBase = Math.max(
        typeof upload?.generatedTopicCount === 'number' ? upload.generatedTopicCount : 0,
        topics.length,
    );
    const generatedCount = plannedCount > 0
        ? Math.min(generatedCountBase, plannedCount)
        : generatedCountBase;
    const firstTopicReady =
        generatedCount >= 1 || topics.length > 0 || upload?.processingStep === 'first_topic_ready';
    const shouldShowProcessing = Boolean(
        displayCourse && upload?.status === 'processing' && !firstTopicReady,
    );
    const backgroundGenerationActive = Boolean(
        displayCourse && upload?.status === 'processing' && firstTopicReady,
    );

    const [delayedProcessing, setDelayedProcessing] = useState(false);
    useEffect(() => {
        if (!shouldShowProcessing) return undefined;
        const timerId = window.setTimeout(() => setDelayedProcessing(true), 900);
        return () => window.clearTimeout(timerId);
    }, [shouldShowProcessing, courseId]);
    const isProcessing = shouldShowProcessing && delayedProcessing;

    const moduleItems = useMemo(() => {
        if (!topics.length && plannedCount === 0) return [];
        const topicsByOrder = new Map(
            [...topics]
                .sort((a, b) => a.orderIndex - b.orderIndex)
                .map((topic) => [topic.orderIndex, topic]),
        );
        return Array.from({ length: Math.max(plannedCount, topics.length) }, (_, index) => {
            const topic = topicsByOrder.get(index);
            if (topic) {
                return { kind: 'ready', index, topic };
            }
            return {
                kind: 'pending',
                index,
                title: plannedTopicTitles[index] || `Topic ${index + 1}`,
            };
        });
    }, [topics, plannedCount, plannedTopicTitles]);

    const readingTimeByTopicId = useMemo(() => {
        const map = new Map();
        for (const topic of topics) {
            const minutes = estimateReadingMinutes(topic.content);
            if (minutes != null) map.set(topic._id, minutes);
        }
        return map;
    }, [topics]);

    const totalEstimatedMinutes = useMemo(() => {
        let total = 0;
        for (const topic of topics) {
            const m = estimateReadingMinutes(topic.content);
            if (m) total += m;
        }
        return total;
    }, [topics]);

    const completedTopics = useMemo(() => {
        if (!courseProgress) return 0;
        return topics.filter((t) => courseProgress?.[t._id]?.completedAt).length;
    }, [topics, courseProgress]);

    const totalReadyTopics = topics.length;
    const storedCourseProgress = Number(displayCourse?.progress);
    const courseProgressPercent = Number.isFinite(storedCourseProgress)
        ? Math.max(0, Math.min(100, Math.round(storedCourseProgress)))
        : totalReadyTopics > 0
            ? Math.round((completedTopics / totalReadyTopics) * 100)
            : 0;
    const completedTopicsLabel = courseProgressPercent > 0 && completedTopics === 0
        ? 'Activity in progress'
        : `${completedTopics} of ${totalReadyTopics} completed`;

    const quizzesReady = useMemo(
        () =>
            topics.filter(
                (t) => (t.assessmentRoute || 'topic_quiz') === 'topic_quiz' && (t.usableMcqCount || 0) > 0,
            ).length,
        [topics],
    );

    const quizAccuracy = useMemo(() => {
        if (!courseProgress) return 0;
        const scores = topics
            .map((t) => courseProgress?.[t._id]?.bestScore)
            .filter((s) => typeof s === 'number');
        if (scores.length === 0) return 0;
        const sum = scores.reduce((a, b) => a + b, 0);
        return Math.round(sum / scores.length);
    }, [topics, courseProgress]);

    const lastStudiedAt = useMemo(() => {
        if (!courseProgress) return null;
        let latest = null;
        for (const t of topics) {
            const ts = courseProgress?.[t._id]?.lastStudiedAt;
            if (typeof ts === 'number' && (!latest || ts > latest)) latest = ts;
        }
        return latest;
    }, [topics, courseProgress]);

    // Recommended next module: in-progress > earliest not-started ready module.
    const nextModule = useMemo(() => {
        if (topics.length === 0) return null;
        const ordered = [...topics].sort((a, b) => a.orderIndex - b.orderIndex);
        const inProgress = ordered.find(
            (t) => courseProgress?.[t._id] && !courseProgress?.[t._id]?.completedAt,
        );
        if (inProgress) return inProgress;
        const notStarted = ordered.find((t) => !courseProgress?.[t._id]);
        if (notStarted) return notStarted;
        return null;
    }, [topics, courseProgress]);

    const nextModuleIndex = useMemo(
        () => (nextModule ? topics.findIndex((t) => t._id === nextModule._id) : -1),
        [nextModule, topics],
    );
    const nextModuleProgress = nextModule ? courseProgress?.[nextModule._id] : null;
    const nextModuleEstimatedMinutes = nextModule
        ? readingTimeByTopicId.get(nextModule._id) || null
        : null;
    const nextModuleQuizReady = Boolean(
        nextModule
            && (nextModule.assessmentRoute || 'topic_quiz') === 'topic_quiz'
            && (nextModule.usableMcqCount || 0) > 0,
    );

    // Source file used by the course header (first source).
    const courseSources = useQuery(
        api.courses.getCourseSources,
        resolvedCourseId ? { courseId: resolvedCourseId } : 'skip',
    );
    const primarySource = Array.isArray(courseSources) ? courseSources[0] : null;

    // ── Title formatting ──────────────────────────────────────────────────
    const readableTitle = useMemo(
        () => formatCourseTitle(displayCourse?.title) || displayCourse?.title || 'Your Course',
        [displayCourse?.title],
    );

    // ── Action handlers ───────────────────────────────────────────────────
    const handleContinue = useCallback(() => {
        if (nextModule) {
            navigate(`/dashboard/topic/${nextModule._id}`);
        } else if (topics[0]) {
            navigate(`/dashboard/topic/${topics[0]._id}`);
        }
    }, [navigate, nextModule, topics]);

    const handleGeneratePodcast = useCallback(() => {
        if (featuredPodcast?.status === 'ready') {
            navigate('/dashboard/podcasts');
        } else {
            navigate(PODCAST_GENERATE_PATH);
        }
    }, [navigate, featuredPodcast]);

    const podcastStatusLabel = featuredPodcast
        ? PODCAST_STATUS_LABEL[featuredPodcast.status] || 'Not generated'
        : 'Not generated';

    // ── Render ────────────────────────────────────────────────────────────
    return (
        <div className="w-full max-w-[1280px] mx-auto px-4 md:px-8 py-6 md:py-8 pb-32 md:pb-12 space-y-6">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-body-sm" aria-label="Breadcrumb">
                <Link
                    to="/dashboard"
                    className="text-text-faint-light dark:text-text-faint-dark hover:text-primary transition-colors"
                >
                    Dashboard
                </Link>
                <span className="material-symbols-outlined text-[14px] text-text-faint-light dark:text-text-faint-dark">
                    chevron_right
                </span>
                <Link
                    to="/dashboard/search"
                    className="text-text-faint-light dark:text-text-faint-dark hover:text-primary transition-colors"
                >
                    Library
                </Link>
                <span className="material-symbols-outlined text-[14px] text-text-faint-light dark:text-text-faint-dark">
                    chevron_right
                </span>
                <span className="text-text-sub-light dark:text-text-sub-dark truncate max-w-[260px]">
                    {readableTitle}
                </span>
            </nav>

            {isProcessing ? (
                <ProcessingState processingStep={upload?.processingStep} />
            ) : (
                <>
                    {/* Course Header */}
                    <GeneratedCourseHeader
                        title={readableTitle}
                        sourceFileType={primarySource?.fileType || upload?.fileType}
                        topicsReady={totalReadyTopics}
                        quizzesReady={quizzesReady}
                        estimatedMinutes={totalEstimatedMinutes}
                        lastStudiedAt={lastStudiedAt}
                        isGenerating={backgroundGenerationActive}
                        onContinue={handleContinue}
                        onGeneratePodcast={handleGeneratePodcast}
                        primaryDisabled={topics.length === 0}
                        podcastReady={featuredPodcast?.status === 'ready'}
                    />

                    {/* Action prompt banner (deep links from quick actions) */}
                    {actionPrompt && (
                        <div className="p-4 rounded-2xl border border-primary/20 bg-primary/5 dark:bg-primary/10 flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                                <span
                                    className="material-symbols-outlined text-[20px]"
                                    style={{ fontVariationSettings: "'FILL' 1" }}
                                >
                                    {actionPrompt.icon}
                                </span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark">
                                    {actionPrompt.title}
                                </p>
                                <p className="text-caption text-text-sub-light dark:text-text-sub-dark mt-0.5">
                                    {actionPrompt.description}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={dismissActionBanner}
                                className="btn-icon !p-1 shrink-0"
                                aria-label="Dismiss"
                            >
                                <span className="material-symbols-outlined text-[18px]">close</span>
                            </button>
                        </div>
                    )}

                    {/* Summary stats */}
                    <CourseSummaryStats
                        topicsReady={totalReadyTopics}
                        plannedTopics={plannedCount}
                        completedTopics={completedTopics}
                        completedTopicsLabel={completedTopicsLabel}
                        quizzesReady={quizzesReady}
                        estimatedMinutes={totalEstimatedMinutes || null}
                        progressPercent={courseProgressPercent}
                        podcastStatusLabel={podcastStatusLabel}
                    />

                    {/* Main grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
                        <div className="space-y-6 min-w-0">
                            {/* Continue Learning */}
                            {topics.length > 0 && (
                                <ContinueLearningPanel
                                    topic={nextModule}
                                    topicIndex={nextModuleIndex >= 0 ? nextModuleIndex : null}
                                    estimatedMinutes={nextModuleEstimatedMinutes}
                                    progressPercent={nextModuleProgress?.bestScore || 0}
                                    quizReady={nextModuleQuizReady}
                                />
                            )}

                            {/* Podcast (visible course-level action) */}
                            <CoursePodcastCard
                                podcast={featuredPodcast}
                                courseTitle={readableTitle}
                                generatePath={PODCAST_GENERATE_PATH}
                            />

                            {/* Final exam(s), if any */}
                            {finalAssessmentTopics.length > 0 && (
                                <section className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-primary text-[18px]">
                                            workspace_premium
                                        </span>
                                        <h2 className="text-body-base font-semibold text-text-main-light dark:text-text-main-dark">
                                            Final exam
                                        </h2>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {finalAssessmentTopics.map((topic) => {
                                            const progress = courseProgress?.[topic._id];
                                            return (
                                                <div
                                                    key={topic._id}
                                                    className="card-base p-5 border-primary/20 bg-primary/5 dark:bg-primary/10"
                                                >
                                                    <div className="flex items-center justify-between gap-3 mb-2">
                                                        <span className="badge badge-primary gap-1">
                                                            <span className="material-symbols-outlined text-[11px]">
                                                                quiz
                                                            </span>
                                                            Comprehensive
                                                        </span>
                                                        {progress?.bestScore != null && (
                                                            <span
                                                                className={`badge gap-1 ${
                                                                    progress.bestScore >= 80
                                                                        ? 'badge-success'
                                                                        : progress.bestScore >= 60
                                                                            ? 'badge-warning'
                                                                            : 'badge-danger'
                                                                }`}
                                                            >
                                                                {progress.bestScore}%
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h3 className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark mb-1">
                                                        {topic.title}
                                                    </h3>
                                                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark mb-4">
                                                        {topic.description ||
                                                            'This exam combines the most important concepts across the document.'}
                                                    </p>
                                                    <Link
                                                        to={buildObjectiveExamRoute(topic._id)}
                                                        reloadDocument
                                                        className="btn-primary w-full py-2 text-body-sm justify-center gap-1.5"
                                                    >
                                                        <span className="material-symbols-outlined text-[16px]">
                                                            play_arrow
                                                        </span>
                                                        {progress?.bestScore != null
                                                            ? 'Retake final exam'
                                                            : 'Start final exam'}
                                                    </Link>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>
                            )}

                            {/* Generated learning path */}
                            <section id="course-modules" className="space-y-3">
                                <div className="flex items-end justify-between gap-3">
                                    <div>
                                        <h2 className="text-display-sm text-text-main-light dark:text-text-main-dark">
                                            Generated learning path
                                        </h2>
                                        <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark mt-0.5">
                                            Course modules in the recommended study order.
                                        </p>
                                    </div>
                                    {plannedCount > totalReadyTopics && (
                                        <span className="badge gap-1">
                                            <span className="material-symbols-outlined text-[12px] animate-spin">
                                                sync
                                            </span>
                                            {plannedCount - totalReadyTopics} still generating
                                        </span>
                                    )}
                                </div>

                                {moduleItems.length === 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {Array.from({ length: 6 }).map((_, i) => (
                                            <SkeletonModuleCard key={i} />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {moduleItems.map((item) => {
                                            const recommended =
                                                item.kind === 'ready' && nextModule
                                                    ? item.topic._id === nextModule._id
                                                    : false;
                                            const estimated =
                                                item.kind === 'ready'
                                                    ? readingTimeByTopicId.get(item.topic._id) || null
                                                    : null;
                                            const progress =
                                                item.kind === 'ready' ? courseProgress?.[item.topic._id] : null;
                                            return (
                                                <TopicModuleCard
                                                    key={
                                                        item.kind === 'ready'
                                                            ? item.topic._id
                                                            : `pending-${item.index}`
                                                    }
                                                    item={item}
                                                    progress={progress}
                                                    estimatedMinutes={estimated}
                                                    isRecommended={recommended}
                                                />
                                            );
                                        })}
                                    </div>
                                )}
                            </section>

                            {/* Course-specific weak concepts */}
                            <CourseWeakConcepts items={courseWeakConcepts} />
                        </div>

                        {/* Right sidebar (desktop) */}
                        <aside className="space-y-3 lg:sticky lg:top-4 self-start">
                            <CourseProgressSidebar
                                progressPercent={courseProgressPercent}
                                completedTopics={completedTopics}
                                completedTopicsLabel={completedTopicsLabel}
                                totalTopics={totalReadyTopics}
                                quizzesReady={quizzesReady}
                                quizAccuracy={quizAccuracy}
                                weakConceptCount={courseWeakConcepts.length}
                                onContinue={handleContinue}
                                onGeneratePodcast={handleGeneratePodcast}
                                podcastStatus={featuredPodcast?.status || 'not_generated'}
                            />
                            {resolvedCourseId && (
                                <SourceFileCard courseId={resolvedCourseId} userId={userId} />
                            )}
                        </aside>
                    </div>

                    {/* Empty state */}
                    {moduleItems.length === 0 && !isProcessing && (
                        <div className="card-base text-center p-10">
                            <div className="w-14 h-14 rounded-2xl bg-surface-hover-light dark:bg-surface-hover-dark flex items-center justify-center mx-auto mb-4">
                                <span className="material-symbols-outlined text-2xl text-text-faint-light dark:text-text-faint-dark">
                                    school
                                </span>
                            </div>
                            <h3 className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark mb-1">
                                No topics generated yet
                            </h3>
                            <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark max-w-sm mx-auto">
                                Try regenerating the course or add another source to improve the learning path.
                            </p>
                        </div>
                    )}
                </>
            )}

            {/* Mobile sticky bottom CTA */}
            {!isProcessing && nextModule && (
                <div className="lg:hidden fixed bottom-[calc(4.25rem+env(safe-area-inset-bottom))] inset-x-0 px-4 z-40 pointer-events-none">
                    <div className="pointer-events-auto rounded-2xl bg-surface-light/95 dark:bg-surface-dark/95 backdrop-blur-xl border border-border-subtle dark:border-border-subtle-dark shadow-elevated p-2 flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleContinue}
                            className="btn-primary flex-1 h-10 text-body-sm justify-center"
                        >
                            <span
                                className="material-symbols-outlined text-[16px]"
                                style={{ fontVariationSettings: "'FILL' 1" }}
                            >
                                play_arrow
                            </span>
                            Continue learning
                        </button>
                        <button
                            type="button"
                            onClick={handleGeneratePodcast}
                            className="btn-secondary h-10 px-3 shrink-0"
                            aria-label="Generate podcast"
                        >
                            <span className="material-symbols-outlined text-[16px]">graphic_eq</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export { DashboardCourse };
export default DashboardCourse;
