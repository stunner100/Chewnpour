import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useConvexAuth, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

const EMPTY_LIST = [];

const scoreStyle = (score) => {
    if (score >= 80) return { color: 'bg-success', softColor: 'bg-success-soft', textColor: 'text-success' };
    if (score >= 50) return { color: 'bg-warning', softColor: 'bg-warning-soft', textColor: 'text-warning' };
    return { color: 'bg-error', softColor: 'bg-error-soft', textColor: 'text-error' };
};

const buildCourseProgressItems = (courses) => {
    const visible = courses.slice(0, 7);
    return visible.map((course) => ({
        id: String(course._id || course.title),
        title: String(course.title || 'Untitled course'),
        progress: Math.max(0, Math.min(100, Math.round(Number(course.progress || 0)))),
        topicCount: Number(course.topicCount || 0),
    }));
};

const ProgressSkeleton = () => (
    <div className="flex-1 pt-[88px] md:ml-0 p-space-4 md:p-space-8 max-w-container-max mx-auto flex flex-col gap-space-10 pb-20 animate-pulse">
        <div className="h-24 rounded-2xl bg-surface-soft" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-space-6">
            {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-44 rounded-xl bg-surface-soft" />
            ))}
        </div>
    </div>
);

const StudyProgressMastery = () => {
    const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
    const userStats = useQuery(api.profiles.getUserStats, isAuthenticated ? {} : 'skip');
    const performanceInsights = useQuery(api.exams.getUserPerformanceInsights, isAuthenticated ? {} : 'skip');
    const conceptReviewQueue = useQuery(api.concepts.getConceptReviewQueue, isAuthenticated ? { limit: 6 } : 'skip');
    const courses = useQuery(api.courses.getUserCourses, isAuthenticated ? {} : 'skip');
    const resumeTarget = useQuery(api.topics.getResumeTarget, isAuthenticated ? {} : 'skip');
    const safeCourses = courses || EMPTY_LIST;
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
            name: course.title,
            score: Math.round(course.progress || 0),
        }));
    }, [performanceInsights, safeCourses]);

    const nextReviewItem = conceptReviewQueue?.items?.[0] || null;
    const averageAccuracy = performanceInsights?.overallPreparedness ?? userStats?.accuracy ?? 0;
    const recommendedHref = nextReviewItem?.topicId
        ? `/dashboard/flashcards/${nextReviewItem.topicId}`
        : resumeTarget?.topicId
            ? `/dashboard/topic/${resumeTarget.topicId}`
            : '/dashboard/upload';
    const loading = authLoading || !isAuthenticated || [userStats, performanceInsights, conceptReviewQueue, courses, resumeTarget].some((value) => value === undefined);

    if (loading) return <ProgressSkeleton />;

    return (
        <div className="flex-1 pt-[88px] md:ml-0 p-space-4 md:p-space-8 max-w-container-max mx-auto flex flex-col gap-space-10 pb-20">
            <header className="flex flex-col gap-space-2">
                <h2 className="font-display-lg text-display-lg text-text-primary">Progress</h2>
                <p className="font-body-lg text-body-lg text-text-secondary max-w-2xl">
                    A quick view of your lessons, quizzes, and study activity.
                </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-space-6">
                <section className="bg-surface shadow-sm rounded-xl p-space-6 flex flex-col gap-space-4 border border-border-subtle">
                    <div className="flex items-center justify-between">
                        <span className="font-label-md text-label-md text-text-secondary uppercase tracking-wider">Study Streak</span>
                        <div className="w-10 h-10 rounded-full bg-primary-soft flex items-center justify-center text-primary">
                            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>local_fire_department</span>
                        </div>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="font-display-xl text-display-xl text-text-primary">{userStats?.streakDays || 0}</span>
                        <span className="font-body-base text-body-base text-text-muted">days</span>
                    </div>
                </section>

                <section className="bg-surface shadow-sm rounded-xl p-space-6 flex flex-col gap-space-4 border border-border-subtle">
                    <div className="flex items-center justify-between">
                        <span className="font-label-md text-label-md text-text-secondary uppercase tracking-wider">Topics Practiced</span>
                        <div className="w-10 h-10 rounded-full bg-info-soft flex items-center justify-center text-info">
                            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>menu_book</span>
                        </div>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="font-display-xl text-display-xl text-text-primary">{userStats?.topics || 0}</span>
                        <span className="font-body-base text-body-base text-text-muted">topics</span>
                    </div>
                </section>

                <section className="bg-surface shadow-sm rounded-xl p-space-6 flex flex-col gap-space-4 border border-border-subtle">
                    <div className="flex items-center justify-between">
                        <span className="font-label-md text-label-md text-text-secondary uppercase tracking-wider">Quiz Average</span>
                        <div className="w-10 h-10 rounded-full bg-success-soft flex items-center justify-center text-success">
                            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>analytics</span>
                        </div>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="font-display-xl text-display-xl text-text-primary">{averageAccuracy}%</span>
                        <span className="font-body-base text-body-base text-text-muted text-sm">average</span>
                    </div>
                </section>

                <section className="bg-surface shadow-sm rounded-xl p-space-8 border border-border-subtle md:col-span-2 flex flex-col justify-center relative overflow-hidden">
                    <div className="absolute right-0 top-0 w-64 h-64 bg-mastery-soft rounded-full blur-3xl opacity-30 -mr-20 -mt-20 pointer-events-none" />
                    <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 relative z-10 gap-4">
                        <div>
                            <h3 className="font-headline-md text-headline-md text-text-primary mb-1">Quiz Performance</h3>
                            <p className="font-body-sm text-body-sm text-text-secondary">Your average score across completed practice.</p>
                        </div>
                    </div>
                    <div className="relative w-full h-8 bg-surface-muted rounded-full overflow-hidden z-10">
                        <div className="absolute top-0 left-0 h-full bg-mastery rounded-full transition-all" style={{ width: `${averageAccuracy}%` }} />
                        <div className="absolute top-0 left-1/4 h-full w-[2px] bg-surface opacity-30" />
                        <div className="absolute top-0 left-2/4 h-full w-[2px] bg-surface opacity-30" />
                        <div className="absolute top-0 left-3/4 h-full w-[2px] bg-surface opacity-30" />
                    </div>
                    <div className="flex justify-between mt-2 font-label-xs text-label-xs text-text-muted z-10">
                        <span>0%</span>
                        <span>25%</span>
                        <span>50%</span>
                        <span>75%</span>
                        <span>100%</span>
                    </div>
                </section>

                <section className="bg-ai-subtle shadow-sm rounded-xl p-space-6 border border-border-subtle md:col-span-1 flex flex-col justify-between self-start">
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <span className="material-symbols-outlined text-primary">lightbulb</span>
                            <h3 className="font-headline-sm text-headline-sm text-text-primary">Next up</h3>
                        </div>
                        <p className="font-body-base text-body-base text-text-secondary mb-6">
                            {nextReviewItem
                                ? <>Review flashcards from <strong>{nextReviewItem.topicTitle}</strong>.</>
                                : resumeTarget
                                    ? <>Continue <strong>{resumeTarget.topicTitle}</strong> from your latest course.</>
                                    : 'Upload a material to start building your progress history.'}
                        </p>
                    </div>
                    <Link
                        to={recommendedHref}
                        className="w-full bg-primary text-on-primary font-label-md text-label-md py-3 px-4 rounded-xl shadow-md hover:bg-primary-hover transition-colors flex justify-center items-center gap-2"
                    >
                        {nextReviewItem ? 'Open Deck' : resumeTarget ? 'Continue Studying' : 'Upload Material'}
                        <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </Link>
                </section>

                <section className="bg-surface shadow-sm rounded-xl p-space-6 border border-border-subtle md:col-span-2 self-start">
                    <h3 className="font-headline-sm text-headline-sm text-text-primary mb-6">Course Progress</h3>
                    {activityData.length > 0 ? (
                        <div className="grid grid-cols-1 gap-space-4">
                            {activityData.map((course) => (
                                <div key={course.id} className="rounded-xl border border-border-subtle bg-surface-soft/60 p-space-4">
                                    <div className="flex items-start justify-between gap-space-4">
                                        <div className="min-w-0">
                                            <p className="font-label-md text-label-md text-text-primary line-clamp-1">{course.title}</p>
                                            <p className="font-label-xs text-label-xs text-text-muted mt-1">
                                                {course.topicCount} {course.topicCount === 1 ? 'topic' : 'topics'}
                                            </p>
                                        </div>
                                        <span className="font-label-md text-label-md text-primary shrink-0">{course.progress}%</span>
                                    </div>
                                    <div className="mt-space-3 h-2 rounded-full bg-surface-muted overflow-hidden">
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
                        <p className="font-body-sm text-body-sm text-text-muted">Course progress will appear after your first generated lesson.</p>
                    )}
                </section>

                <section id="topic-breakdown" className="scroll-mt-20 bg-surface shadow-sm rounded-xl p-space-6 border border-border-subtle md:col-span-1 flex flex-col self-start">
                    <h3 className="font-headline-sm text-headline-sm text-text-primary mb-6">Topic Breakdown</h3>
                    {topicBreakdown.length > 0 ? (
                        <div className="flex flex-col gap-space-4 flex-1">
                            {topicBreakdown.map((topic) => {
                                const style = scoreStyle(topic.score);
                                return (
                                    <div key={topic.name} className="flex items-center justify-between p-3 rounded-lg border border-border-subtle hover:bg-surface-soft transition-colors">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className={`w-2 h-8 ${style.color} rounded-full shrink-0`} />
                                            <span className="font-body-sm text-body-sm font-medium text-text-primary truncate">{topic.name}</span>
                                        </div>
                                        <span className={`px-2 py-1 rounded ${style.softColor} ${style.textColor} font-label-xs text-label-xs`}>{topic.score}%</span>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="font-body-sm text-body-sm text-text-muted">Course progress will appear after your first generated lesson.</p>
                    )}
                </section>
            </div>
        </div>
    );
};

export default StudyProgressMastery;
