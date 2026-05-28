import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useConvexAuth, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';

const EMPTY_LIST = [];
const FOCUS_RING =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-soft focus-visible:ring-offset-2';

const materialIconByKind = {
    pdf: { icon: 'picture_as_pdf', color: 'bg-error-soft text-error' },
    pptx: { icon: 'slideshow', color: 'bg-mastery-soft text-mastery' },
    docx: { icon: 'description', color: 'bg-info-soft text-info' },
    audio: { icon: 'graphic_eq', color: 'bg-primary-soft text-primary' },
    image: { icon: 'image', color: 'bg-success-soft text-success' },
    notes: { icon: 'description', color: 'bg-info-soft text-info' },
};

const resolveFileKind = (fileType = '', fileName = '') => {
    const source = `${fileType} ${fileName}`.toLowerCase();
    if (source.includes('pdf')) return 'pdf';
    if (source.includes('ppt') || source.includes('presentation')) return 'pptx';
    if (source.includes('doc')) return 'docx';
    if (source.includes('audio') || /\.(mp3|wav|m4a|aac)\b/.test(source)) return 'audio';
    if (source.includes('image') || /\.(png|jpe?g|webp)\b/.test(source)) return 'image';
    return 'notes';
};

const formatRelativeTime = (timestamp) => {
    const value = Number(timestamp || 0);
    if (!Number.isFinite(value) || value <= 0) return 'recently';
    const diffMs = Date.now() - value;
    const minutes = Math.max(1, Math.round(diffMs / 60000));
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value));
};

const greetingForHour = (hour) => {
    if (hour < 5) return 'Studying late';
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    if (hour < 22) return 'Good evening';
    return 'Studying late';
};

const labelStopWords = new Set([
    'a',
    'an',
    'and',
    'for',
    'from',
    'of',
    'the',
    'to',
    'with',
]);

const formatActivityLabel = (title, index) => {
    const normalizedTitle = String(title || '').replace(/\s+/g, ' ').trim();
    if (!normalizedTitle) return `Course ${index + 1}`;

    const meaningfulWords = normalizedTitle
        .split(' ')
        .map((word) => word.replace(/^[^\w]+|[^\w]+$/g, ''))
        .filter((word) => word && !labelStopWords.has(word.toLowerCase()));

    const label = meaningfulWords.slice(0, 2).join(' ') || normalizedTitle;
    return label.length > 18 ? `${label.slice(0, 17)}...` : label;
};

const isDashboardProbeTitle = (title = '') => {
    const normalizedTitle = String(title || '').trim().toLowerCase();
    return /\b(?:prod(?:uction)?\s+)?objective\s+probe\b/.test(normalizedTitle)
        || /\bprobe\s+\d{6,}\b/.test(normalizedTitle)
        || /\bqa[-\s]?probe\b/.test(normalizedTitle)
        || /(?:^|[-_\s])qa(?:$|[-_\s])/.test(normalizedTitle);
};

const formatDashboardTitle = (title, fallback) => {
    const normalizedTitle = String(title || '').replace(/\s+/g, ' ').trim();
    if (!normalizedTitle || isDashboardProbeTitle(normalizedTitle)) return fallback;
    return normalizedTitle;
};

const buildActivityData = (courses) => {
    const visibleCourses = courses.slice(0, 7);
    const padded = visibleCourses.length > 0
        ? visibleCourses
        : [{ title: 'Start', progress: 0 }];
    const maxProgress = Math.max(1, ...padded.map((course) => Number(course.progress || 0)));
    return padded.map((course, index) => ({
        key: String(course._id || `${index}-${course.title || 'course'}`),
        label: formatActivityLabel(formatDashboardTitle(course.title, ''), index),
        title: formatDashboardTitle(course.title, `Course ${index + 1}`),
        progress: Number(course.progress || 0),
        height: `${Math.max(Number(course.progress || 0) > 0 ? 12 : 3, Math.round((Number(course.progress || 0) / maxProgress) * 100))}%`,
        active: Number(course.progress || 0) === maxProgress && maxProgress > 0,
    }));
};

const DashboardSkeleton = () => (
    <div className="student-dashboard flex-1 pt-space-6 px-space-6 md:px-space-8 pb-space-16 max-w-container-max mx-auto w-full animate-pulse">
        <div className="h-14 w-full rounded-xl bg-surface-soft mb-space-6" />
        <div className="h-40 w-full rounded-2xl bg-surface-soft mb-space-6" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-space-3 mb-space-8">
            {[0, 1, 2, 3].map((key) => (
                <div key={key} className="h-20 rounded-xl bg-surface-soft" />
            ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-space-6">
            <div className="h-72 rounded-xl bg-surface-soft" />
            <div className="h-72 rounded-xl bg-surface-soft" />
        </div>
    </div>
);

const EmptyDashboard = ({ displayName }) => (
    <div className="student-dashboard flex-1 pt-space-6 px-space-6 md:px-space-8 pb-space-16 max-w-container-max mx-auto w-full">
        <section className="bg-surface rounded-2xl border border-border-subtle p-space-8 md:p-space-10 max-w-3xl">
            <p className="font-body-base text-body-base text-text-secondary mb-space-2">Welcome, {displayName}.</p>
            <h2 className="font-display-lg text-display-lg text-text-primary tracking-tight [overflow-wrap:anywhere] min-w-0">
                Upload your first material to build a real study dashboard.
            </h2>
            <p className="font-body-base text-body-base text-text-secondary mt-space-3 max-w-2xl">
                Once ChewnPour processes your notes, this page will show your courses, progress, due reviews, and weak concepts from your own study data.
            </p>
            <Link
                to="/dashboard/upload"
                className={`mt-space-8 inline-flex items-center gap-space-2 bg-primary text-on-primary px-space-6 py-space-3 rounded-xl font-label-md text-label-md hover:bg-primary-hover transition-colors whitespace-nowrap ${FOCUS_RING}`}
            >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">cloud_upload</span>
                Upload Material
            </Link>
        </section>
    </div>
);

const MetricItem = ({ label, value, unit }) => (
    <div className="min-w-0">
        <dt className="font-label-sm text-label-sm text-text-muted">{label}</dt>
        <dd className="font-headline-sm text-headline-sm text-text-primary tabular-nums mt-0.5">
            {value}
            {unit ? <span className="font-body-sm text-body-sm text-text-secondary ml-1">{unit}</span> : null}
        </dd>
    </div>
);

const StudentDashboard = () => {
    const { user, profile } = useAuth();
    const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
    const shouldLoadDashboardData = isAuthenticated && !authLoading;
    const userStats = useQuery(api.profiles.getUserStats, shouldLoadDashboardData ? {} : 'skip');
    const courses = useQuery(api.courses.getUserCourses, shouldLoadDashboardData ? {} : 'skip');
    const uploads = useQuery(api.uploads.getUserUploads, shouldLoadDashboardData ? {} : 'skip');
    const resumeTarget = useQuery(api.topics.getResumeTarget, shouldLoadDashboardData ? {} : 'skip');
    const conceptReviewQueue = useQuery(api.concepts.getConceptReviewQueue, shouldLoadDashboardData ? { limit: 6 } : 'skip');

    const loading = !shouldLoadDashboardData
        || [userStats, courses, uploads, resumeTarget, conceptReviewQueue].some((value) => value === undefined);
    const displayName = profile?.fullName || user?.name || user?.email?.split('@')[0] || 'Student';
    const firstName = displayName.split(' ')[0] || 'Student';
    const safeCourses = useMemo(() => courses || EMPTY_LIST, [courses]);
    const safeUploads = useMemo(() => uploads || EMPTY_LIST, [uploads]);
    const weakConcepts = conceptReviewQueue?.items?.flatMap((item) => item.concepts || []).slice(0, 6) || [];
    const activityData = useMemo(() => buildActivityData(safeCourses), [safeCourses]);
    const dueCount = conceptReviewQueue?.dueConceptCount || 0;
    const quizAccuracy = userStats?.accuracy ?? 0;
    const topicsStudied = userStats?.topics ?? 0;

    const coursesById = useMemo(() => new Map(safeCourses.map((course) => [String(course._id), course])), [safeCourses]);
    const resumeCourse = resumeTarget?.courseId ? coursesById.get(String(resumeTarget.courseId)) : safeCourses[0];
    const resumeHref = resumeTarget?.topicId
        ? `/dashboard/topic/${resumeTarget.topicId}`
        : resumeCourse?._id
            ? `/dashboard/lessons?courseId=${resumeCourse._id}`
            : '/dashboard/upload';
    const resumeProgress = Number(resumeCourse?.progress || 0);
    const displayResumeTitle = formatDashboardTitle(
        resumeCourse?.title,
        formatDashboardTitle(resumeTarget?.topicTitle, 'Continue your latest lesson'),
    );
    const displayResumeDescription = formatDashboardTitle(
        resumeTarget?.topicTitle,
        resumeCourse?.description || 'Pick up where you left off.',
    );

    const recentMaterials = useMemo(() => {
        return safeUploads.slice(0, 4).map((upload) => {
            const relatedCourse = safeCourses.find((course) => String(course.uploadId || '') === String(upload._id));
            const uploadTitle = formatDashboardTitle(upload.fileName, 'Recent material');
            return {
                uploadId: upload._id,
                courseId: relatedCourse?._id || null,
                title: formatDashboardTitle(relatedCourse?.title, uploadTitle),
                kind: resolveFileKind(upload.fileType, upload.fileName),
                createdAt: upload._creationTime,
            };
        });
    }, [safeCourses, safeUploads]);

    const recommendedAction = weakConcepts[0]
        ? {
            title: `Review ${weakConcepts[0].label}`,
            description: 'This concept needs more practice based on your recent answers.',
            href: conceptReviewQueue?.items?.[0]?.topicId ? `/dashboard/flashcards/${conceptReviewQueue.items[0].topicId}` : '/dashboard/progress',
            cta: 'Start review',
        }
        : resumeTarget
            ? {
                title: `Continue ${resumeTarget.topicTitle}`,
                description: 'Pick up from your most recent study session.',
                href: resumeHref,
                cta: 'Continue',
            }
            : {
                title: 'Upload a material',
                description: 'Generate lessons, quizzes, and flashcards from your own notes.',
                href: '/dashboard/upload',
                cta: 'Upload',
            };

    const quickActions = useMemo(() => ([
        { label: 'Upload', description: 'PDFs, slides, or audio', icon: 'cloud_upload', href: '/dashboard/upload' },
        { label: 'Quiz', description: 'Check understanding', icon: 'quiz', href: '/dashboard/quiz' },
        {
            label: 'Flashcards',
            description: dueCount > 0 ? `${dueCount} due today` : 'Review decks',
            icon: 'style',
            href: '/dashboard/flashcards',
        },
        { label: 'Progress', description: 'Scores and mastery', icon: 'bar_chart', href: '/dashboard/progress' },
    ]), [dueCount]);

    if (loading) return <DashboardSkeleton />;
    if (safeCourses.length === 0 && safeUploads.length === 0) {
        return <EmptyDashboard displayName={firstName} />;
    }

    return (
        <div className="student-dashboard flex-1 pt-space-6 px-space-6 md:px-space-8 pb-space-16 max-w-container-max mx-auto w-full min-w-0">
            <header className="mb-space-6 min-w-0">
                <h1 className="font-display-md text-display-md text-text-primary tracking-tight [overflow-wrap:anywhere] min-w-0">
                    {greetingForHour(new Date().getHours())}, {firstName}.
                </h1>
                <p className="font-body-base text-body-base text-text-secondary mt-space-1 max-w-2xl">
                    What should you study next? Your dashboard reflects your uploaded materials.
                </p>
            </header>

            <dl className="grid grid-cols-2 md:grid-cols-4 gap-space-4 md:gap-space-6 pb-space-6 mb-space-6 border-b border-border-subtle tabular-nums">
                <MetricItem label="Streak" value={userStats?.streakDays || 0} unit="days" />
                <MetricItem label="Due today" value={dueCount} unit="cards" />
                <MetricItem label="Quiz accuracy" value={`${quizAccuracy}%`} />
                <MetricItem label="Topics studied" value={topicsStudied} />
            </dl>

            <section className="bg-surface rounded-2xl border border-border-default shadow-md p-space-6 md:p-space-8 mb-space-6 min-w-0">
                <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-space-6">
                    <div className="min-w-0 flex-1">
                        <p className="font-body-sm text-body-sm text-text-secondary mb-space-2">
                            {resumeTarget?.lastStudiedAt
                                ? `Last studied ${formatRelativeTime(resumeTarget.lastStudiedAt)}`
                                : 'Ready when you are'}
                        </p>
                        <h2 className="font-display-sm text-display-sm text-text-primary leading-tight line-clamp-2 [overflow-wrap:anywhere] min-w-0">
                            {displayResumeTitle}
                        </h2>
                        <p className="font-body-sm text-body-sm text-text-secondary mt-space-2 max-w-xl line-clamp-2">
                            {displayResumeDescription}
                        </p>
                    </div>
                    <Link
                        to={resumeHref}
                        className={`shrink-0 inline-flex items-center justify-center gap-space-2 bg-primary text-on-primary px-space-6 py-space-3 rounded-xl font-label-md text-label-md hover:bg-primary-hover transition-colors whitespace-nowrap ${FOCUS_RING}`}
                    >
                        Continue studying
                        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_forward</span>
                    </Link>
                </div>
                <div className="mt-space-6 max-w-lg">
                    <div className="flex justify-between items-end mb-space-2 gap-space-3">
                        <span className="font-label-md text-label-md text-text-primary">Overall progress</span>
                        <span className="font-label-md text-label-md text-primary tabular-nums">{resumeProgress}%</span>
                    </div>
                    <div className="w-full bg-surface-variant rounded-full h-2 overflow-hidden" role="progressbar" aria-valuenow={resumeProgress} aria-valuemin={0} aria-valuemax={100}>
                        <div className="bg-primary h-2 rounded-full transition-[width] duration-300 ease-out" style={{ width: `${resumeProgress}%` }} />
                    </div>
                </div>
            </section>

            <nav aria-label="Study shortcuts" className="grid grid-cols-2 lg:grid-cols-4 gap-space-3 mb-space-8 min-w-0">
                {quickActions.map((action) => (
                    <Link
                        key={action.href}
                        to={action.href}
                        className={`group min-w-0 rounded-xl border border-border-subtle bg-surface-soft/60 dark:bg-surface px-space-4 py-space-4 hover:bg-surface dark:hover:bg-surface-variant hover:border-border-default transition-[background-color,border-color] ${FOCUS_RING}`}
                    >
                        <span className="material-symbols-outlined text-[22px] text-primary mb-space-2" aria-hidden="true">{action.icon}</span>
                        <span className="block font-label-md text-label-md text-text-primary whitespace-nowrap">{action.label}</span>
                        <span className="block font-body-sm text-body-sm text-text-muted mt-0.5 truncate">{action.description}</span>
                    </Link>
                ))}
            </nav>

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-space-6 min-w-0">
                <section className="min-w-0">
                    <div className="flex justify-between items-center gap-space-3 mb-space-4">
                        <h2 className="font-headline-sm text-headline-sm text-text-primary">Course progress</h2>
                        <Link
                            to="/dashboard/progress"
                            className={`text-text-muted hover:text-primary font-label-md text-label-md inline-flex items-center gap-1 whitespace-nowrap ${FOCUS_RING}`}
                        >
                            View progress
                            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">arrow_forward</span>
                        </Link>
                    </div>
                    <div className="rounded-xl border border-border-subtle bg-surface p-space-5 min-w-0">
                        <div className="flex items-end gap-space-2 sm:gap-space-4 h-44 mt-space-2 overflow-x-auto pb-space-1">
                            {activityData.map((bar) => (
                                <div key={bar.key} className="flex-1 min-w-[2.5rem] max-w-[4.5rem] flex flex-col justify-end gap-2 group">
                                    <div
                                        className={`w-full rounded-t-md relative transition-colors ${
                                            bar.active ? 'bg-primary' : 'bg-surface-variant group-hover:bg-primary-soft'
                                        }`}
                                        style={{ height: bar.height }}
                                        title={`${bar.title}: ${bar.progress}%`}
                                    />
                                    <span
                                        title={bar.title}
                                        className={`text-center font-label-xs text-label-xs truncate min-w-0 ${bar.active ? 'text-primary font-semibold' : 'text-text-muted'}`}
                                    >
                                        {bar.label}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <section className="mt-space-6 rounded-xl bg-ai-subtle dark:bg-surface border border-border-subtle p-space-5 md:p-space-6 min-w-0">
                        <h2 className="font-headline-sm text-headline-sm text-text-primary mb-space-1">Recommended next</h2>
                        <p className="font-body-sm text-body-sm text-text-secondary mb-space-4 max-w-xl">
                            {recommendedAction.description}
                        </p>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-space-4">
                            <p className="font-label-md text-label-md text-text-primary [overflow-wrap:anywhere] min-w-0">
                                {recommendedAction.title}
                            </p>
                            <Link
                                to={recommendedAction.href}
                                className={`shrink-0 inline-flex items-center gap-2 bg-surface text-primary border border-primary px-space-5 py-space-2 rounded-xl font-label-md text-label-md hover:bg-primary-soft transition-colors whitespace-nowrap ${FOCUS_RING}`}
                            >
                                {recommendedAction.cta}
                                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">play_arrow</span>
                            </Link>
                        </div>
                    </section>
                </section>

                <aside className="flex flex-col gap-space-6 min-w-0">
                    <section className="min-w-0">
                        <div className="flex justify-between items-center gap-space-3 mb-space-4">
                            <h2 className="font-headline-sm text-headline-sm text-text-primary">Recent materials</h2>
                            <Link
                                to="/dashboard/library"
                                aria-label="View all materials"
                                className={`text-text-muted hover:text-primary font-label-md text-label-md whitespace-nowrap ${FOCUS_RING}`}
                            >
                                See all
                            </Link>
                        </div>
                        {recentMaterials.length > 0 ? (
                            <ul className="divide-y divide-border-subtle rounded-xl border border-border-subtle bg-surface overflow-hidden">
                                {recentMaterials.map((material) => {
                                    const typeConfig = materialIconByKind[material.kind] || materialIconByKind.notes;
                                    const href = material.courseId ? `/dashboard/lessons?courseId=${material.courseId}` : '/dashboard/library';
                                    return (
                                        <li key={material.uploadId}>
                                            <Link
                                                to={href}
                                                className={`flex items-center gap-space-3 px-space-4 py-space-3 hover:bg-surface-soft transition-colors min-w-0 ${FOCUS_RING}`}
                                            >
                                                <div className={`shrink-0 w-10 h-10 ${typeConfig.color} rounded-lg flex items-center justify-center`}>
                                                    <span className="material-symbols-outlined text-[20px]" aria-hidden="true">{typeConfig.icon}</span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-label-md text-label-md text-text-primary truncate">{material.title}</p>
                                                    <p className="font-label-xs text-label-xs text-text-muted mt-0.5">Uploaded {formatRelativeTime(material.createdAt)}</p>
                                                </div>
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : (
                            <div className="rounded-xl border border-border-subtle bg-surface px-space-4 py-space-5 text-center">
                                <p className="font-body-sm text-body-sm text-text-muted mb-space-3">No materials yet.</p>
                                <Link
                                    to="/dashboard/upload"
                                    className={`btn-primary text-body-sm px-4 py-2 inline-flex items-center gap-1.5 whitespace-nowrap ${FOCUS_RING}`}
                                >
                                    <span className="material-symbols-outlined text-[16px]" aria-hidden="true">upload</span>
                                    Upload material
                                </Link>
                            </div>
                        )}
                    </section>

                    <section className="min-w-0">
                        <div className="flex justify-between items-center gap-space-3 mb-space-4">
                            <h2 className="font-headline-sm text-headline-sm text-text-primary">Weak concepts</h2>
                            {quizAccuracy > 0 ? (
                                <Link
                                    to="/dashboard/progress"
                                    className={`font-label-sm text-label-sm text-text-muted hover:text-primary tabular-nums whitespace-nowrap ${FOCUS_RING}`}
                                >
                                    {quizAccuracy}% accuracy
                                </Link>
                            ) : null}
                        </div>
                        {weakConcepts.length > 0 ? (
                            <ul className="flex flex-wrap gap-space-2">
                                {weakConcepts.map((concept) => (
                                    <li key={concept.conceptKey || concept.label}>
                                        <span className="inline-block px-space-3 py-space-1 bg-surface-variant text-text-secondary rounded-full font-label-sm text-label-sm border border-border-subtle max-w-full truncate">
                                            {concept.label}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="rounded-xl border border-dashed border-border-strong bg-surface-soft/50 px-space-4 py-space-5 text-center">
                                <p className="font-body-sm text-body-sm text-text-muted mb-space-3">Complete practice quizzes to surface weak areas.</p>
                                <Link
                                    to="/dashboard/quiz"
                                    className={`btn-secondary text-body-sm px-4 py-2 inline-flex items-center gap-1.5 whitespace-nowrap ${FOCUS_RING}`}
                                >
                                    <span className="material-symbols-outlined text-[16px]" aria-hidden="true">quiz</span>
                                    Take a quiz
                                </Link>
                            </div>
                        )}
                    </section>
                </aside>
            </div>
        </div>
    );
};

export default StudentDashboard;
