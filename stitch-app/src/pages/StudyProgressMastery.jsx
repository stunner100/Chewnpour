import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AppIcon from '../components/AppIcon';
import { formatCourseTitle } from '../lib/courseTitle';
import { resumeActivityCopy } from '../lib/resumeActivity';

const EMPTY_LIST = [];

const scoreStyle = (score) => {
    if (score >= 80) return { color: 'bg-success', softColor: 'bg-success-soft', textColor: 'text-success' };
    if (score >= 50) return { color: 'bg-warning', softColor: 'bg-warning-soft', textColor: 'text-warning' };
    return { color: 'bg-error', softColor: 'bg-error-soft', textColor: 'text-error' };
};

const buildCourseProgressItems = (courses) => {
    const visible = courses.slice(0, 7);
    return visible.map((course) => ({
        id: String(course.id || course._id || course.title),
        title: formatCourseTitle(course.title) || String(course.title || 'Untitled course'),
        progress: Math.max(0, Math.min(100, Math.round(Number(course.progress || 0)))),
        topicCount: Number(course.topicCount || 0),
    }));
};

const ProgressSkeleton = () => (
    <div className="min-h-[calc(100dvh-4rem)] animate-pulse bg-background-light px-4 py-8 md:px-8 md:py-10">
        <div className="mx-auto max-w-6xl space-y-6">
            <div className="h-20 rounded-[20px] bg-surface-soft" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="h-44 rounded-[24px] bg-surface-soft" />
                ))}
            </div>
        </div>
    </div>
);

const StudyProgressMastery = () => {
    const { user } = useAuth();
    const [progress, setProgress] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!user?.id) {
            setProgress(null);
            setLoading(false);
            return undefined;
        }

        let cancelled = false;
        setLoading(true);
        setError('');
        (async () => {
            try {
                const response = await fetch('/api/progress', {
                    method: 'GET',
                    credentials: 'include',
                    headers: { Accept: 'application/json' },
                });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(payload?.error || `Failed to load progress (${response.status})`);
                }
                if (!cancelled) setProgress(payload.progress || null);
            } catch (err) {
                console.error('Failed to load progress:', err);
                if (!cancelled) {
                    setError(err.message || 'Could not load progress.');
                    setProgress(null);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [user?.id]);

    const userStats = progress?.stats || null;
    const performanceInsights = progress?.performanceInsights || null;
    const resumeTarget = progress?.resumeTarget || null;
    const resumeCopy = resumeActivityCopy(resumeTarget);
    const recommendedHref = resumeTarget?.href
        ? resumeTarget.href
        : resumeTarget?.topicId
            ? `/dashboard/topic/${resumeTarget.topicId}`
            : '/dashboard/upload';
    const safeCourses = progress?.courses || EMPTY_LIST;
    const activityData = useMemo(() => buildCourseProgressItems(safeCourses), [safeCourses]);
    const topicBreakdown = useMemo(() => {
        const insightTopics = [
            ...(performanceInsights?.needsWork || []),
            ...(performanceInsights?.progressing || []),
            ...(performanceInsights?.mastered || []),
        ];
        if (insightTopics.length > 0) {
            return insightTopics.slice(0, 8).map((topic) => ({
                name: topic.title,
                score: Math.round(topic.best || 0),
            }));
        }
        return safeCourses.slice(0, 8).map((course) => ({
            name: formatCourseTitle(course.title) || course.title,
            score: Math.round(course.progress || 0),
        }));
    }, [performanceInsights, safeCourses]);

    const averageAccuracy = performanceInsights?.overallPreparedness ?? userStats?.accuracy ?? 0;

    if (loading) return <ProgressSkeleton />;

    return (
        <div className="min-h-[calc(100dvh-4rem)] bg-background-light px-4 py-8 md:px-8 md:py-10">
            <div className="mx-auto max-w-6xl">
                <header>
                    <h1 className="font-display text-display-md font-bold tracking-[-0.02em] text-text-primary md:text-display-lg">
                        Progress
                    </h1>
                    <p className="mt-2 max-w-2xl text-body-md text-text-secondary">
                        A quick view of your lessons, quizzes, and study activity.
                    </p>
                    {error ? (
                        <p className="mt-3 rounded-[16px] border border-error/30 bg-error-soft px-4 py-3 text-body-sm text-error">
                            {error}
                        </p>
                    ) : null}
                </header>

                <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
                    <section className="flex flex-col gap-4 rounded-[24px] border border-border-subtle bg-surface p-5 shadow-sm md:p-6">
                        <div className="flex items-center justify-between">
                            <span className="text-caption font-semibold uppercase tracking-[0.06em] text-text-muted">
                                Study Streak
                            </span>
                            <div className="flex size-10 items-center justify-center rounded-full bg-warning-soft text-warning">
                                <AppIcon name="local_fire_department" />
                            </div>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="font-display text-display-lg font-bold text-text-primary">
                                {userStats?.streakDays || 0}
                            </span>
                            <span className="text-body-sm text-text-muted">days</span>
                        </div>
                    </section>

                    <section className="flex flex-col gap-4 rounded-[24px] border border-border-subtle bg-surface p-5 shadow-sm md:p-6">
                        <div className="flex items-center justify-between">
                            <span className="text-caption font-semibold uppercase tracking-[0.06em] text-text-muted">
                                Topics Practiced
                            </span>
                            <div className="flex size-10 items-center justify-center rounded-full bg-info-soft text-info">
                                <AppIcon name="menu_book" />
                            </div>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="font-display text-display-lg font-bold text-text-primary">
                                {userStats?.topics || 0}
                            </span>
                            <span className="text-body-sm text-text-muted">topics</span>
                        </div>
                    </section>

                    <section className="flex flex-col gap-4 rounded-[24px] border border-border-subtle bg-surface p-5 shadow-sm md:p-6">
                        <div className="flex items-center justify-between">
                            <span className="text-caption font-semibold uppercase tracking-[0.06em] text-text-muted">
                                Quiz Average
                            </span>
                            <div className="flex size-10 items-center justify-center rounded-full bg-success-soft text-success">
                                <AppIcon name="analytics" />
                            </div>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="font-display text-display-lg font-bold text-text-primary">
                                {averageAccuracy}%
                            </span>
                            <span className="text-body-sm text-text-muted">average</span>
                        </div>
                    </section>

                    <section className="relative overflow-hidden rounded-[24px] border border-border-subtle bg-surface p-5 shadow-sm md:col-span-2 md:p-7">
                        <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-primary-subtle opacity-70 blur-3xl" />
                        <div className="relative z-10 mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                            <div>
                                <h2 className="font-display text-display-sm font-bold text-text-primary">
                                    Quiz Performance
                                </h2>
                                <p className="mt-1 text-body-sm text-text-secondary">
                                    Your average score across completed practice.
                                </p>
                            </div>
                            <span className="inline-flex self-start rounded-full bg-primary-subtle px-3 py-1.5 text-caption font-semibold text-primary">
                                Readiness {averageAccuracy}%
                            </span>
                        </div>
                        <div className="relative z-10 h-3 overflow-hidden rounded-full bg-surface-soft">
                            <div
                                className="h-full rounded-full bg-cta transition-all"
                                style={{ width: `${Math.max(0, Math.min(100, averageAccuracy))}%` }}
                            />
                        </div>
                        <div className="relative z-10 mt-2 flex justify-between text-caption font-semibold text-text-muted">
                            <span>0%</span>
                            <span>25%</span>
                            <span>50%</span>
                            <span>75%</span>
                            <span>100%</span>
                        </div>
                    </section>

                    <section className="flex flex-col justify-between rounded-[24px] border border-border-subtle bg-surface p-5 shadow-sm md:p-6">
                        <div>
                            <div className="mb-3 flex items-center gap-2">
                                <AppIcon name="lightbulb" className="text-primary" />
                                <h2 className="font-display text-display-sm font-bold text-text-primary">Next up</h2>
                            </div>
                            <p className="text-body-sm text-text-secondary">
                                {resumeTarget
                                    ? resumeCopy.hint
                                    : 'Upload a material to start building your progress history.'}
                            </p>
                        </div>
                        <Link
                            to={recommendedHref}
                            className="btn-primary mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 text-body-sm"
                        >
                            {resumeTarget ? resumeCopy.cta : 'Upload Material'}
                            <AppIcon name="arrow_forward" className="text-[18px]" />
                        </Link>
                    </section>

                    <section className="rounded-[24px] border border-border-subtle bg-surface p-5 shadow-sm md:col-span-2 md:p-6">
                        <h2 className="font-display text-display-sm font-bold text-text-primary">Course Progress</h2>
                        {activityData.length > 0 ? (
                            <div className="mt-5 grid grid-cols-1 gap-3">
                                {activityData.map((course) => (
                                    <div
                                        key={course.id}
                                        className="rounded-[18px] border border-border-subtle bg-surface-variant p-4"
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="min-w-0">
                                                <p className="line-clamp-1 font-semibold text-text-primary">
                                                    {course.title}
                                                </p>
                                                <p className="mt-1 text-caption text-text-muted">
                                                    {course.topicCount} {course.topicCount === 1 ? 'topic' : 'topics'}
                                                </p>
                                            </div>
                                            <span className="shrink-0 text-body-sm font-semibold text-primary">
                                                {course.progress}%
                                            </span>
                                        </div>
                                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-soft">
                                            <div
                                                className="h-full rounded-full bg-primary transition-all"
                                                style={{ width: `${course.progress}%` }}
                                                role="progressbar"
                                                aria-label={`${course.title} progress`}
                                                aria-valuemin={0}
                                                aria-valuemax={100}
                                                aria-valuenow={course.progress}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="mt-4 text-body-sm text-text-muted">
                                Course progress will appear after your first generated lesson.
                            </p>
                        )}
                    </section>

                    <section
                        id="topic-breakdown"
                        className="scroll-mt-20 flex flex-col rounded-[24px] border border-border-subtle bg-surface p-5 shadow-sm md:p-6"
                    >
                        <h2 className="font-display text-display-sm font-bold text-text-primary">Topic Breakdown</h2>
                        {topicBreakdown.length > 0 ? (
                            <div className="mt-5 flex flex-1 flex-col gap-3">
                                {topicBreakdown.map((topic) => {
                                    const style = scoreStyle(topic.score);
                                    return (
                                        <div
                                            key={topic.name}
                                            className="flex items-center justify-between gap-3 rounded-[16px] border border-border-subtle px-3 py-2.5 transition-colors hover:bg-surface-soft"
                                        >
                                            <div className="flex min-w-0 items-center gap-3">
                                                <div className={`h-8 w-2 shrink-0 rounded-full ${style.color}`} />
                                                <span className="truncate text-body-sm font-medium text-text-primary">
                                                    {topic.name}
                                                </span>
                                            </div>
                                            <span className={`rounded-full px-2.5 py-1 text-caption font-semibold ${style.softColor} ${style.textColor}`}>
                                                {topic.score}%
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="mt-4 text-body-sm text-text-muted">
                                Topic scores will appear after your first quiz.
                            </p>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
};

export default StudyProgressMastery;
