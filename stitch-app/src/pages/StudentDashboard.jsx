import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';

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

const buildActivityData = (courses) => {
    const visibleCourses = courses.slice(0, 7);
    const padded = visibleCourses.length > 0
        ? visibleCourses
        : [{ title: 'Start', progress: 0 }];
    const maxProgress = Math.max(1, ...padded.map((course) => Number(course.progress || 0)));
    return padded.map((course, index) => ({
        day: course.title ? course.title.slice(0, 3) : `C${index + 1}`,
        minutes: Number(course.progress || 0),
        height: `${Math.max(Number(course.progress || 0) > 0 ? 12 : 3, Math.round((Number(course.progress || 0) / maxProgress) * 100))}%`,
        active: Number(course.progress || 0) === maxProgress && maxProgress > 0,
    }));
};

const DashboardSkeleton = () => (
    <div className="flex-1 pt-space-8 px-space-8 pb-space-16 max-w-container-max mx-auto w-full animate-pulse">
        <div className="h-20 w-full rounded-2xl bg-surface-soft mb-space-8" />
        <div className="grid grid-cols-12 gap-space-6">
            <div className="col-span-12 lg:col-span-8 h-64 rounded-xl bg-surface-soft" />
            <div className="col-span-12 lg:col-span-4 h-64 rounded-xl bg-surface-soft" />
            <div className="col-span-12 lg:col-span-8 h-72 rounded-xl bg-surface-soft" />
            <div className="col-span-12 lg:col-span-4 h-72 rounded-xl bg-surface-soft" />
        </div>
    </div>
);

const EmptyDashboard = ({ displayName }) => (
    <div className="flex-1 pt-space-8 px-space-8 pb-space-16 max-w-container-max mx-auto w-full">
        <section className="bg-surface rounded-2xl border border-border-subtle shadow-sm p-space-8 md:p-space-10">
            <p className="font-label-md text-label-md text-primary mb-space-3">Welcome, {displayName}.</p>
            <h2 className="font-display-lg text-display-lg text-text-primary tracking-tight max-w-2xl">
                Upload your first material to build a real study dashboard.
            </h2>
            <p className="font-body-base text-body-base text-text-secondary mt-space-3 max-w-2xl">
                Once ChewnPour processes your notes, this page will show your courses, progress, due reviews, and weak concepts from your own study data.
            </p>
            <Link
                to="/dashboard/upload"
                className="mt-space-8 inline-flex items-center gap-space-2 bg-primary text-on-primary px-space-6 py-space-3 rounded-xl font-label-md text-label-md hover:bg-primary-hover transition-colors"
            >
                <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
                Upload Material
            </Link>
        </section>
    </div>
);

const StudentDashboard = () => {
    const { user, profile } = useAuth();
    const userStats = useQuery(api.profiles.getUserStats, {});
    const courses = useQuery(api.courses.getUserCourses, {});
    const uploads = useQuery(api.uploads.getUserUploads, {});
    const resumeTarget = useQuery(api.topics.getResumeTarget, {});
    const conceptReviewQueue = useQuery(api.concepts.getConceptReviewQueue, { limit: 6 });

    const loading = [userStats, courses, uploads, resumeTarget, conceptReviewQueue].some((value) => value === undefined);
    const displayName = profile?.fullName || user?.name || user?.email?.split('@')[0] || 'Student';
    const firstName = displayName.split(' ')[0] || 'Student';
    const safeCourses = useMemo(() => courses || [], [courses]);
    const safeUploads = useMemo(() => uploads || [], [uploads]);
    const weakConcepts = conceptReviewQueue?.items?.flatMap((item) => item.concepts || []).slice(0, 6) || [];
    const activityData = useMemo(() => buildActivityData(safeCourses), [safeCourses]);

    const coursesById = useMemo(() => new Map(safeCourses.map((course) => [String(course._id), course])), [safeCourses]);
    const resumeCourse = resumeTarget?.courseId ? coursesById.get(String(resumeTarget.courseId)) : safeCourses[0];
    const resumeHref = resumeTarget?.topicId
        ? `/dashboard/topic/${resumeTarget.topicId}`
        : resumeCourse?._id
            ? `/dashboard/course/${resumeCourse._id}`
            : '/dashboard/upload';
    const resumeProgress = resumeCourse?.progress || resumeTarget?.bestScore || 0;

    const recentMaterials = useMemo(() => {
        return safeUploads.slice(0, 3).map((upload) => {
            const relatedCourse = safeCourses.find((course) => String(course.uploadId || '') === String(upload._id));
            return {
                uploadId: upload._id,
                courseId: relatedCourse?._id || null,
                title: relatedCourse?.title || upload.fileName,
                kind: resolveFileKind(upload.fileType, upload.fileName),
                createdAt: upload._creationTime,
            };
        });
    }, [safeCourses, safeUploads]);

    const recommendedAction = weakConcepts[0]
        ? {
            title: `Review ${weakConcepts[0].label}`,
            description: 'This concept needs more practice based on your recent answers.',
            href: conceptReviewQueue?.items?.[0]?.topicId ? `/dashboard/concept-intro/${conceptReviewQueue.items[0].topicId}` : '/dashboard/progress',
            cta: 'Start Review',
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
                description: 'Generate lessons, quizzes, and review cards from your own notes.',
                href: '/dashboard/upload',
                cta: 'Upload',
            };

    if (loading) return <DashboardSkeleton />;
    if (safeCourses.length === 0 && safeUploads.length === 0) {
        return <EmptyDashboard displayName={firstName} />;
    }

    return (
        <div className="flex-1 pt-space-8 px-space-8 pb-space-16 max-w-container-max mx-auto w-full">
            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-end gap-space-6 mb-space-10">
                <div>
                    <h2 className="font-display-lg text-display-lg text-text-primary tracking-tight">Good morning, {firstName}.</h2>
                    <p className="font-body-lg text-body-lg text-text-secondary mt-space-2">
                        Ready to study? Your dashboard is based on your uploaded materials.
                    </p>
                </div>
                <div className="flex flex-wrap gap-space-4">
                    <div className="bg-surface shadow-sm rounded-xl px-space-4 py-space-3 flex items-center gap-space-3 border border-border-subtle">
                        <div className="p-2 bg-warning-soft rounded-lg text-warning">
                            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>local_fire_department</span>
                        </div>
                        <div>
                            <p className="font-label-xs text-label-xs text-text-muted uppercase tracking-wider">Streak</p>
                            <p className="font-headline-sm text-headline-sm text-text-primary">{userStats?.streakDays || 0} Days</p>
                        </div>
                    </div>
                    <div className="bg-surface shadow-sm rounded-xl px-space-4 py-space-3 flex items-center gap-space-3 border border-border-subtle">
                        <div className="p-2 bg-mastery-soft rounded-lg text-mastery">
                            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>style</span>
                        </div>
                        <div>
                            <p className="font-label-xs text-label-xs text-text-muted uppercase tracking-wider">Due Today</p>
                            <p className="font-headline-sm text-headline-sm text-text-primary">{conceptReviewQueue?.dueConceptCount || 0} Cards</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-space-6 mb-space-10">
                <section className="col-span-12 lg:col-span-8 bg-surface rounded-xl shadow-sm border border-border-subtle overflow-hidden flex hover:shadow-md transition-shadow relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-surface via-surface/95 to-surface/80 z-0" />
                    <div className="p-space-8 flex flex-col justify-between w-full z-10">
                        <div>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary-soft text-primary rounded-full font-label-xs text-label-xs mb-space-4">
                                <span className="material-symbols-outlined text-[14px]">schedule</span>
                                {resumeTarget?.lastStudiedAt ? `Last studied ${formatRelativeTime(resumeTarget.lastStudiedAt)}` : 'Ready when you are'}
                            </span>
                            <h3 className="font-display-lg text-display-lg text-text-primary mb-space-2">
                                {resumeCourse?.title || 'No course selected'}
                            </h3>
                            <p className="font-body-base text-body-base text-text-secondary max-w-md">
                                {resumeTarget?.topicTitle || resumeCourse?.description || 'Upload a material to generate your first lesson.'}
                            </p>
                        </div>
                        <div className="mt-space-8 max-w-md">
                            <div className="flex justify-between items-end mb-space-2">
                                <span className="font-label-md text-label-md text-text-primary">Overall Progress</span>
                                <span className="font-label-md text-label-md text-primary">{resumeProgress}%</span>
                            </div>
                            <div className="w-full bg-surface-variant rounded-full h-2 overflow-hidden">
                                <div className="bg-primary h-2 rounded-full" style={{ width: `${resumeProgress}%` }} />
                            </div>
                            <div className="mt-space-4">
                                <Link
                                    to={resumeHref}
                                    className="bg-primary text-on-primary px-space-6 py-space-3 rounded-xl font-label-md text-label-md hover:bg-primary-hover transition-colors inline-flex items-center gap-space-2"
                                >
                                    Continue Studying
                                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                                </Link>
                            </div>
                        </div>
                    </div>
                </section>

                <Link
                    to="/dashboard/upload"
                    className="col-span-12 lg:col-span-4 bg-surface-soft rounded-xl border-2 border-dashed border-border-strong p-space-8 flex flex-col items-center justify-center text-center hover:bg-surface-muted transition-colors group"
                >
                    <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center shadow-sm text-primary mb-space-4 group-hover:scale-110 transition-transform">
                        <span className="material-symbols-outlined text-[32px]">cloud_upload</span>
                    </div>
                    <h3 className="font-headline-md text-headline-md text-text-primary mb-space-2">Upload Material</h3>
                    <p className="font-body-sm text-body-sm text-text-secondary mb-space-6">Add PDFs, docs, images, or audio to generate lessons and practice.</p>
                    <span className="bg-surface text-text-primary border border-border-default px-space-6 py-space-2 rounded-xl font-label-md text-label-md group-hover:bg-primary group-hover:text-on-primary transition-colors w-full">
                        Browse Files
                    </span>
                </Link>
            </div>

            <div className="grid grid-cols-12 gap-space-6">
                <div className="col-span-12 lg:col-span-8 flex flex-col gap-space-6">
                    <section className="bg-surface rounded-xl shadow-sm border border-border-subtle p-space-6">
                        <div className="flex justify-between items-center mb-space-6">
                            <h3 className="font-headline-sm text-headline-sm text-text-primary">Course Progress</h3>
                            <Link to="/dashboard/progress" className="text-text-muted hover:text-primary font-label-md text-label-md flex items-center gap-1">
                                View Progress
                                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                            </Link>
                        </div>
                        <div className="flex items-end gap-space-4 h-48 mt-space-4">
                            {activityData.map((bar) => (
                                <div key={bar.day} className="flex-1 flex flex-col justify-end gap-2 group">
                                    <div
                                        className={`w-full rounded-t-md relative transition-colors ${
                                            bar.active ? 'bg-primary' : 'bg-surface-variant group-hover:bg-primary-soft'
                                        }`}
                                        style={{ height: bar.height }}
                                    >
                                        {bar.active && (
                                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-surface shadow-md px-2 py-1 rounded text-xs font-label-xs border border-border-subtle">
                                                {bar.minutes}%
                                            </div>
                                        )}
                                    </div>
                                    <span className={`text-center font-label-xs text-label-xs truncate ${bar.active ? 'text-primary font-bold' : 'text-text-muted'}`}>
                                        {bar.day}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="bg-ai-subtle rounded-xl shadow-sm border border-border-subtle p-space-6 relative overflow-hidden">
                        <div className="absolute right-0 top-0 p-4 opacity-10">
                            <span className="material-symbols-outlined text-[100px] text-primary">smart_toy</span>
                        </div>
                        <div className="relative z-10 flex flex-col md:flex-row md:justify-between md:items-center gap-space-5">
                            <div>
                                <span className="font-label-xs text-label-xs text-primary uppercase tracking-wider font-bold">Recommended Action</span>
                                <h3 className="font-headline-sm text-headline-sm text-text-primary mt-space-1 mb-space-2">{recommendedAction.title}</h3>
                                <p className="font-body-sm text-body-sm text-text-secondary max-w-md">
                                    {recommendedAction.description}
                                </p>
                            </div>
                            <Link
                                to={recommendedAction.href}
                                className="bg-surface text-primary border border-primary px-space-5 py-space-2 rounded-xl font-label-md text-label-md hover:bg-primary-soft transition-colors inline-flex items-center gap-2 shrink-0"
                            >
                                {recommendedAction.cta}
                                <span className="material-symbols-outlined text-[16px]">play_arrow</span>
                            </Link>
                        </div>
                    </section>
                </div>

                <div className="col-span-12 lg:col-span-4 flex flex-col gap-space-6">
                    <section className="bg-surface rounded-xl shadow-sm border border-border-subtle p-space-6 flex-1">
                        <div className="flex justify-between items-center mb-space-4">
                            <h3 className="font-headline-sm text-headline-sm text-text-primary">Recent Materials</h3>
                            <Link to="/dashboard/library" className="text-text-muted hover:text-primary">
                                <span className="material-symbols-outlined">more_horiz</span>
                            </Link>
                        </div>
                        {recentMaterials.length > 0 ? (
                            <ul className="flex flex-col gap-space-4">
                                {recentMaterials.map((material) => {
                                    const typeConfig = materialIconByKind[material.kind] || materialIconByKind.notes;
                                    const href = material.courseId ? `/dashboard/course/${material.courseId}` : '/dashboard/library';
                                    return (
                                        <li key={material.uploadId}>
                                            <Link to={href} className="flex items-center gap-space-3 p-space-2 hover:bg-surface-soft rounded-lg transition-colors -ml-space-2">
                                                <div className={`w-10 h-10 ${typeConfig.color} rounded-lg flex items-center justify-center`}>
                                                    <span className="material-symbols-outlined">{typeConfig.icon}</span>
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
                            <p className="font-body-sm text-body-sm text-text-muted">Your uploaded materials will appear here.</p>
                        )}
                    </section>

                    <section className="bg-surface rounded-xl shadow-sm border border-border-subtle p-space-6">
                        <h3 className="font-headline-sm text-headline-sm text-text-primary mb-space-4">Weak Concepts</h3>
                        {weakConcepts.length > 0 ? (
                            <div className="flex flex-wrap gap-space-2">
                                {weakConcepts.map((concept) => (
                                    <span
                                        key={concept.conceptKey || concept.label}
                                        className="px-space-3 py-space-1 bg-surface-variant text-text-secondary rounded-full font-label-sm text-label-sm border border-border-subtle"
                                    >
                                        {concept.label}
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <p className="font-body-sm text-body-sm text-text-muted">Weak spots will appear after you complete practice.</p>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
};

export default StudentDashboard;
