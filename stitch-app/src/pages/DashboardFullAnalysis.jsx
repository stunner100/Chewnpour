import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useConvexAuth } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';
import { buildConceptPracticePath } from '../lib/conceptReviewLinks';

const TIER_STYLES = {
    mastered: {
        label: 'Mastered',
        barClass: 'bg-accent-emerald',
        chipClass: 'bg-accent-emerald/10 text-accent-emerald',
    },
    progressing: {
        label: 'Progressing',
        barClass: 'bg-primary',
        chipClass: 'bg-primary/10 text-primary',
    },
    needsWork: {
        label: 'Needs work',
        barClass: 'bg-rose-500',
        chipClass: 'bg-rose-500/10 text-rose-500',
    },
};

const tierForScore = (score) => {
    if (score >= 80) return 'mastered';
    if (score >= 50) return 'progressing';
    return 'needsWork';
};

const formatTime = (seconds) => {
    if (!seconds || !Number.isFinite(seconds)) return '—';
    const total = Math.max(0, Math.round(seconds));
    if (total < 60) return `${total}s`;
    const m = Math.floor(total / 60);
    const s = total % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
};

const formatRelativeDate = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const StatCard = ({ icon, label, value, sub }) => (
    <div className="card-base p-4">
        <div className="flex items-center gap-2 text-text-faint-light dark:text-text-faint-dark">
            <span className="material-symbols-outlined text-[18px]">{icon}</span>
            <span className="text-overline">{label}</span>
        </div>
        <p className="mt-2 text-display-sm font-semibold text-text-main-light dark:text-text-main-dark">
            {value}
        </p>
        {sub && (
            <p className="mt-0.5 text-caption text-text-sub-light dark:text-text-sub-dark">{sub}</p>
        )}
    </div>
);

const EmptyState = () => (
    <div className="card-base p-8 md:p-10 text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-[28px]">insights</span>
        </div>
        <h2 className="text-display-sm text-text-main-light dark:text-text-main-dark mb-1">
            No study data yet
        </h2>
        <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark max-w-md mx-auto">
            Take your first quiz or complete a topic and your performance insights and personalized
            plan will appear here.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <Link to="/dashboard" className="btn-primary text-body-sm">
                <span className="material-symbols-outlined text-[16px]">play_arrow</span>
                Go to dashboard
            </Link>
            <Link to="/dashboard/search" className="btn-secondary text-body-sm">
                <span className="material-symbols-outlined text-[16px]">auto_stories</span>
                Browse library
            </Link>
        </div>
    </div>
);

const DashboardFullAnalysis = () => {
    const { user } = useAuth();
    const userId = user?.id;
    const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();

    const userStats = useQuery(
        api.profiles.getUserStats,
        userId ? { userId } : 'skip'
    );
    const performanceInsights = useQuery(
        api.exams.getUserPerformanceInsights,
        isConvexAuthenticated ? {} : 'skip'
    );
    const examAttempts = useQuery(
        api.exams.getUserExamAttempts,
        userId && isConvexAuthenticated ? { userId } : 'skip'
    );
    const conceptReviewQueue = useQuery(
        api.concepts.getConceptReviewQueue,
        isConvexAuthenticated ? { limit: 5 } : 'skip'
    );

    const isLoading =
        userStats === undefined ||
        performanceInsights === undefined ||
        examAttempts === undefined;

    const topicMastery = useMemo(() => {
        if (!performanceInsights) return [];
        const all = [
            ...(performanceInsights.needsWork || []),
            ...(performanceInsights.progressing || []),
            ...(performanceInsights.mastered || []),
        ];
        return all
            .map((t) => ({
                topicId: t.topicId,
                title: t.title,
                pct: Math.round(t.best),
                tier: tierForScore(t.best),
            }))
            .sort((a, b) => a.pct - b.pct)
            .slice(0, 6);
    }, [performanceInsights]);

    const recentAttempts = useMemo(() => {
        if (!Array.isArray(examAttempts)) return [];
        return [...examAttempts]
            .filter((a) => Array.isArray(a.answers) && a.answers.length > 0)
            .sort((a, b) => a._creationTime - b._creationTime)
            .slice(-8);
    }, [examAttempts]);

    const timeAnalysis = useMemo(() => {
        if (!Array.isArray(examAttempts)) return null;
        const buckets = {
            objective: { totalSeconds: 0, totalQuestions: 0, count: 0 },
            essay: { totalSeconds: 0, totalQuestions: 0, count: 0 },
        };
        for (const attempt of examAttempts) {
            if (!Array.isArray(attempt.answers) || attempt.answers.length === 0) continue;
            const seconds = Number(attempt.timeTakenSeconds || 0);
            const questions = Number(attempt.totalQuestions || attempt.answers.length || 0);
            if (!questions || !seconds) continue;
            const format = String(attempt.examFormat || 'objective').toLowerCase();
            const bucket = format === 'essay' ? buckets.essay : buckets.objective;
            bucket.totalSeconds += seconds;
            bucket.totalQuestions += questions;
            bucket.count += 1;
        }
        const summarize = (bucket) =>
            bucket.totalQuestions > 0
                ? Math.round(bucket.totalSeconds / bucket.totalQuestions)
                : null;
        return {
            objective: summarize(buckets.objective),
            essay: summarize(buckets.essay),
            objectiveCount: buckets.objective.count,
            essayCount: buckets.essay.count,
        };
    }, [examAttempts]);

    const recommendations = useMemo(() => {
        if (!performanceInsights) return [];
        const needs = (performanceInsights.needsWork || []).slice(0, 2).map((t, i) => ({
            num: i + 1,
            title: `Revise ${t.title}`,
            desc: `Best score so far is ${Math.round(t.best)}%. Refresh the lesson and retake the quiz.`,
            to: `/dashboard/topic/${t.topicId}`,
        }));
        if (needs.length === 2) return needs;
        const progressing = (performanceInsights.progressing || [])
            .slice(0, 2 - needs.length)
            .map((t, i) => ({
                num: needs.length + i + 1,
                title: `Push ${t.title} to mastery`,
                desc: `You're at ${Math.round(t.best)}%. One more attempt could lock it in.`,
                to: `/dashboard/topic/${t.topicId}`,
            }));
        const combined = [...needs, ...progressing];
        if (combined.length > 0) return combined;
        const mastered = (performanceInsights.mastered || []).slice(0, 2).map((t, i) => ({
            num: i + 1,
            title: `Review ${t.title}`,
            desc: `Strong score (${Math.round(t.best)}%). Quick review to keep it fresh.`,
            to: `/dashboard/topic/${t.topicId}`,
        }));
        return mastered;
    }, [performanceInsights]);

    const trendChart = useMemo(() => {
        if (recentAttempts.length === 0) return null;
        const points = recentAttempts.map((attempt) => {
            const total = attempt.totalQuestions || attempt.answers.length || 1;
            const pct = Math.max(0, Math.min(100, Math.round((attempt.score / total) * 100)));
            return {
                pct,
                topicTitle: attempt.topicTitle || 'Quiz',
                createdAt: attempt._creationTime,
            };
        });
        const width = 400;
        const height = 120;
        const xStep = points.length > 1 ? width / (points.length - 1) : 0;
        const coords = points.map((point, idx) => ({
            ...point,
            x: idx * xStep,
            y: height - (point.pct / 100) * height,
        }));
        const linePath = coords
            .map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
            .join(' ');
        const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;
        return { coords, linePath, areaPath, width, height };
    }, [recentAttempts]);

    const hasAnyData =
        Boolean(performanceInsights) || (Array.isArray(examAttempts) && examAttempts.length > 0);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background-light dark:bg-background-dark">
                <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 space-y-4">
                    <div className="h-6 w-32 bg-surface-hover-light dark:bg-surface-hover-dark rounded animate-pulse" />
                    <div className="h-10 w-56 bg-surface-hover-light dark:bg-surface-hover-dark rounded animate-pulse" />
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div
                                key={i}
                                className="card-base h-24 animate-pulse bg-surface-hover-light dark:bg-surface-hover-dark"
                            />
                        ))}
                    </div>
                    <div className="card-base h-72 animate-pulse bg-surface-hover-light dark:bg-surface-hover-dark" />
                </div>
            </div>
        );
    }

    const overallPreparedness = performanceInsights?.overallPreparedness ?? 0;
    const masteredCount = performanceInsights?.mastered?.length ?? 0;
    const progressingCount = performanceInsights?.progressing?.length ?? 0;
    const needsWorkCount = performanceInsights?.needsWork?.length ?? 0;

    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark flex flex-col">
            <header className="sticky top-0 z-30 w-full bg-surface-light/90 dark:bg-surface-dark/90 backdrop-blur-md border-b border-border-light dark:border-border-dark">
                <div className="max-w-5xl mx-auto px-4 md:px-8 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link to="/dashboard" aria-label="Back to dashboard" className="btn-icon w-10 h-10">
                            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                        </Link>
                        <div className="flex flex-col">
                            <h1 className="text-body-base font-semibold text-text-main-light dark:text-text-main-dark leading-tight">
                                Study Plan
                            </h1>
                            <p className="text-caption text-text-faint-light dark:text-text-faint-dark">
                                Performance insights and personalized recommendations
                            </p>
                        </div>
                    </div>
                    <div className="h-9 w-9 rounded-xl bg-primary/8 flex items-center justify-center text-primary">
                        <span className="material-symbols-outlined text-[18px]">analytics</span>
                    </div>
                </div>
            </header>

            <main className="flex-1 w-full max-w-5xl mx-auto px-4 md:px-8 py-6 pb-24 md:pb-12 space-y-4">
                {!hasAnyData ? (
                    <EmptyState />
                ) : (
                    <>
                        {/* Stats grid */}
                        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <StatCard
                                icon="local_fire_department"
                                label="Streak"
                                value={`${userStats?.streakDays ?? 0}d`}
                                sub={userStats?.streakDays ? 'Keep it going' : 'Study today to start'}
                            />
                            <StatCard
                                icon="quiz"
                                label="Topics Studied"
                                value={userStats?.topics ?? 0}
                                sub={`${userStats?.courses ?? 0} course${(userStats?.courses ?? 0) === 1 ? '' : 's'}`}
                            />
                            <StatCard
                                icon="check_circle"
                                label="Avg accuracy"
                                value={`${userStats?.accuracy ?? 0}%`}
                                sub={`${examAttempts?.length ?? 0} attempt${(examAttempts?.length ?? 0) === 1 ? '' : 's'}`}
                            />
                            <StatCard
                                icon="verified"
                                label="Preparedness"
                                value={`${overallPreparedness}%`}
                                sub={`${masteredCount} mastered`}
                            />
                        </section>

                        {/* Topic Mastery + Score Trend */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <section className="card-base p-5 flex flex-col">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark flex items-center gap-2">
                                        <span className="material-symbols-outlined text-primary text-[18px]">bar_chart</span>
                                        Topic Mastery
                                    </h2>
                                    <div className="flex items-center gap-2 text-caption text-text-faint-light dark:text-text-faint-dark">
                                        <span className="inline-flex items-center gap-1">
                                            <span className="w-2 h-2 rounded-full bg-rose-500" />
                                            {needsWorkCount}
                                        </span>
                                        <span className="inline-flex items-center gap-1">
                                            <span className="w-2 h-2 rounded-full bg-primary" />
                                            {progressingCount}
                                        </span>
                                        <span className="inline-flex items-center gap-1">
                                            <span className="w-2 h-2 rounded-full bg-accent-emerald" />
                                            {masteredCount}
                                        </span>
                                    </div>
                                </div>

                                {topicMastery.length === 0 ? (
                                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark py-6 text-center">
                                        Take a quiz on any topic to see your mastery breakdown.
                                    </p>
                                ) : (
                                    <ul className="space-y-3">
                                        {topicMastery.map((t) => {
                                            const tier = TIER_STYLES[t.tier];
                                            return (
                                                <li key={t.topicId}>
                                                    <Link
                                                        to={`/dashboard/topic/${t.topicId}`}
                                                        className="block group"
                                                    >
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="text-body-sm font-medium text-text-main-light dark:text-text-main-dark line-clamp-1 group-hover:text-primary transition-colors">
                                                                {t.title}
                                                            </span>
                                                            <span className={`text-caption font-semibold px-1.5 py-0.5 rounded-md ${tier.chipClass}`}>
                                                                {t.pct}%
                                                            </span>
                                                        </div>
                                                        <div className="h-1.5 bg-surface-hover-light dark:bg-surface-hover-dark rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full transition-all duration-500 ${tier.barClass}`}
                                                                style={{ width: `${t.pct}%` }}
                                                            />
                                                        </div>
                                                    </Link>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </section>

                            <section className="card-base p-5 flex flex-col">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark flex items-center gap-2">
                                        <span className="material-symbols-outlined text-primary text-[18px]">trending_up</span>
                                        Score Trend
                                    </h2>
                                    <span className="text-caption text-text-faint-light dark:text-text-faint-dark">
                                        Last {recentAttempts.length} attempt{recentAttempts.length === 1 ? '' : 's'}
                                    </span>
                                </div>

                                {!trendChart ? (
                                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark py-6 text-center">
                                        No quiz attempts yet. Start a topic quiz to begin tracking your trend.
                                    </p>
                                ) : (
                                    <div className="flex-1 flex flex-col justify-end">
                                        <svg
                                            className="w-full h-[140px] overflow-visible"
                                            preserveAspectRatio="none"
                                            viewBox={`0 0 ${trendChart.width} ${trendChart.height}`}
                                        >
                                            <defs>
                                                <linearGradient id="studyTrendGradient" x1="0%" x2="0%" y1="0%" y2="100%">
                                                    <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
                                                    <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                                                </linearGradient>
                                            </defs>
                                            <line
                                                className="stroke-border-light dark:stroke-border-dark"
                                                strokeWidth="1"
                                                x1="0"
                                                x2={trendChart.width}
                                                y1={trendChart.height}
                                                y2={trendChart.height}
                                            />
                                            <line
                                                className="stroke-border-light dark:stroke-border-dark"
                                                strokeDasharray="4 4"
                                                strokeWidth="1"
                                                x1="0"
                                                x2={trendChart.width}
                                                y1={trendChart.height / 3}
                                                y2={trendChart.height / 3}
                                            />
                                            <line
                                                className="stroke-border-light dark:stroke-border-dark"
                                                strokeDasharray="4 4"
                                                strokeWidth="1"
                                                x1="0"
                                                x2={trendChart.width}
                                                y1={(trendChart.height * 2) / 3}
                                                y2={(trendChart.height * 2) / 3}
                                            />
                                            <path d={trendChart.areaPath} fill="url(#studyTrendGradient)" className="text-primary" />
                                            <path
                                                d={trendChart.linePath}
                                                fill="none"
                                                stroke="currentColor"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth="2.5"
                                                vectorEffect="non-scaling-stroke"
                                                className="text-primary"
                                            />
                                            {trendChart.coords.map((c, idx) => (
                                                <circle
                                                    key={idx}
                                                    cx={c.x}
                                                    cy={c.y}
                                                    r="3.5"
                                                    className="fill-surface-light dark:fill-surface-dark stroke-primary"
                                                    strokeWidth="2"
                                                >
                                                    <title>{`${c.topicTitle}: ${c.pct}% on ${formatRelativeDate(c.createdAt)}`}</title>
                                                </circle>
                                            ))}
                                        </svg>
                                        <div className="flex justify-between w-full mt-3 text-caption text-text-faint-light dark:text-text-faint-dark px-1">
                                            <span>{formatRelativeDate(trendChart.coords[0]?.createdAt)}</span>
                                            <span>{formatRelativeDate(trendChart.coords[trendChart.coords.length - 1]?.createdAt)}</span>
                                        </div>
                                    </div>
                                )}
                            </section>
                        </div>

                        {/* Time Analysis + Weak Concepts */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <section className="card-base p-5">
                                <h2 className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark flex items-center gap-2 mb-4">
                                    <span className="material-symbols-outlined text-primary text-[18px]">timer</span>
                                    Time Analysis
                                </h2>
                                {!timeAnalysis || (timeAnalysis.objective == null && timeAnalysis.essay == null) ? (
                                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark py-4">
                                        Complete a timed quiz to see your average pace.
                                    </p>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between p-3 rounded-xl bg-surface-hover-light dark:bg-surface-hover-dark">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center text-primary">
                                                    <span className="material-symbols-outlined text-[20px]">quiz</span>
                                                </div>
                                                <div>
                                                    <p className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark">
                                                        Objective avg / question
                                                    </p>
                                                    <p className="text-caption text-text-faint-light dark:text-text-faint-dark">
                                                        Across {timeAnalysis.objectiveCount} attempt
                                                        {timeAnalysis.objectiveCount === 1 ? '' : 's'}
                                                    </p>
                                                </div>
                                            </div>
                                            <span className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark">
                                                {formatTime(timeAnalysis.objective)}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between p-3 rounded-xl bg-surface-hover-light dark:bg-surface-hover-dark">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center text-primary">
                                                    <span className="material-symbols-outlined text-[20px]">edit_note</span>
                                                </div>
                                                <div>
                                                    <p className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark">
                                                        Essay avg / question
                                                    </p>
                                                    <p className="text-caption text-text-faint-light dark:text-text-faint-dark">
                                                        Across {timeAnalysis.essayCount} attempt
                                                        {timeAnalysis.essayCount === 1 ? '' : 's'}
                                                    </p>
                                                </div>
                                            </div>
                                            <span className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark">
                                                {formatTime(timeAnalysis.essay)}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </section>

                            <section className="card-base p-5">
                                <h2 className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark flex items-center gap-2 mb-4">
                                    <span className="material-symbols-outlined text-primary text-[18px]">flash_on</span>
                                    Weak concepts to review
                                </h2>
                                {!conceptReviewQueue || (conceptReviewQueue.items?.length ?? 0) === 0 ? (
                                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark py-4">
                                        No weak concepts queued. Take a quiz and missed concepts will land here.
                                    </p>
                                ) : (
                                    <ul className="space-y-2">
                                        {conceptReviewQueue.items.slice(0, 5).map((item) => (
                                            <li key={item.topicId}>
                                                <Link
                                                    to={buildConceptPracticePath(item.topicId, item.reviewConceptKeys)}
                                                    className="flex items-center gap-3 p-2.5 rounded-xl border border-transparent hover:border-primary/20 hover:bg-primary-50/40 dark:hover:bg-primary-900/10 transition-all group"
                                                >
                                                    <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-rose-500/10 text-rose-500 shrink-0">
                                                        <span className="material-symbols-outlined text-[18px]">flash_on</span>
                                                    </span>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark line-clamp-1">
                                                            {item.topicTitle}
                                                        </p>
                                                        <p className="text-caption text-text-faint-light dark:text-text-faint-dark line-clamp-1">
                                                            {(item.reviewConceptKeys || []).length || 1} concept
                                                            {((item.reviewConceptKeys || []).length || 1) === 1 ? '' : 's'} to review
                                                        </p>
                                                    </div>
                                                    <span className="material-symbols-outlined text-text-faint-light dark:text-text-faint-dark group-hover:text-primary text-[18px] transition-colors">
                                                        arrow_forward
                                                    </span>
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </section>
                        </div>

                        {/* AI Improvement Plan */}
                        {recommendations.length > 0 && (
                            <section className="relative overflow-hidden bg-primary rounded-2xl p-6 md:p-8 text-white">
                                <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16" />
                                <div className="absolute bottom-0 left-0 w-36 h-36 bg-white/5 rounded-full blur-2xl -ml-12 -mb-12" />
                                <div className="relative z-10 flex flex-col md:flex-row md:items-start md:gap-6">
                                    <div className="flex-1 space-y-5">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="bg-white/20 p-2 rounded-lg">
                                                <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
                                            </div>
                                            <div>
                                                <h2 className="text-body-lg font-semibold">Recommended next sessions</h2>
                                                <p className="text-white/70 text-caption">
                                                    Based on your most recent quiz performance.
                                                </p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {recommendations.map((item) => (
                                                <Link
                                                    key={item.num}
                                                    to={item.to}
                                                    className="flex items-start gap-3 bg-white/10 hover:bg-white/15 transition-colors p-4 rounded-xl border border-white/10"
                                                >
                                                    <div className="bg-white text-primary rounded-full w-6 h-6 flex items-center justify-center shrink-0 mt-0.5">
                                                        <span className="text-caption font-bold">{item.num}</span>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-body-sm font-semibold leading-snug line-clamp-2">
                                                            {item.title}
                                                        </p>
                                                        <p className="text-caption text-white/70 mt-1 line-clamp-2">{item.desc}</p>
                                                    </div>
                                                </Link>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </section>
                        )}
                    </>
                )}
            </main>
        </div>
    );
};

export default DashboardFullAnalysis;
