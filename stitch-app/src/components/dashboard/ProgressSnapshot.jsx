import React from 'react';
import { Link } from 'react-router-dom';

const StatCard = ({ icon, label, value, hint, accent = 'primary' }) => {
    const accentClasses = {
        primary: 'bg-primary-50 text-primary-700 dark:bg-primary-900/25 dark:text-primary-300',
        emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-300',
        amber: 'bg-amber-50 text-amber-700 dark:bg-amber-900/25 dark:text-amber-300',
        rose: 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300',
        teal: 'bg-teal-50 text-teal-700 dark:bg-teal-900/25 dark:text-teal-300',
    }[accent] || 'bg-primary-50 text-primary-700';

    return (
        <div className="card-flat p-4">
            <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${accentClasses}`}>
                    <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
                </div>
                <div className="min-w-0">
                    <p className="text-caption text-text-sub-light dark:text-text-sub-dark">{label}</p>
                    <p className="text-body-lg font-bold text-text-main-light dark:text-text-main-dark leading-tight">{value}</p>
                </div>
            </div>
            {hint && <p className="text-caption text-text-faint-light dark:text-text-faint-dark mt-2">{hint}</p>}
        </div>
    );
};

const ProgressSnapshot = ({ insights, userStats, podcastCount = 0, uploadQuota }) => {
    if (!insights && !userStats) return null;

    const overall = Number(insights?.overallPreparedness ?? 0);
    const masteredCount = insights?.mastered?.length ?? 0;
    const progressingCount = insights?.progressing?.length ?? 0;
    const needsWorkCount = insights?.needsWork?.length ?? 0;

    const ringColor = overall >= 80 ? '#10b981' : overall >= 50 ? '#914bf1' : '#f59e0b';

    return (
        <section className="space-y-4 animate-fade-in-up animate-delay-300">
            <div className="flex items-end justify-between gap-3">
                <div>
                    <h2 className="text-display-sm text-text-main-light dark:text-text-main-dark">Progress snapshot</h2>
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark mt-0.5">Your mastery across all uploaded materials.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-3">
                {/* Mastery Ring */}
                {insights && (
                    <div className="card-base p-5 md:p-6 flex items-center gap-5">
                        <div className="relative w-20 h-20 shrink-0">
                            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                                <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="6" className="text-border-subtle dark:text-border-subtle-dark" />
                                <circle
                                    cx="40" cy="40" r="34" fill="none" strokeWidth="6"
                                    stroke={ringColor}
                                    strokeDasharray={`${(overall / 100) * 213.6} 213.6`}
                                    strokeLinecap="round"
                                />
                            </svg>
                            <span className="absolute inset-0 flex items-center justify-center text-display-sm font-bold text-text-main-light dark:text-text-main-dark">
                                {overall}%
                            </span>
                        </div>
                        <div className="flex-1">
                            <p className="text-body-md font-semibold text-text-main-light dark:text-text-main-dark">
                                {overall >= 80 ? 'Exam ready'
                                    : overall >= 50 ? 'Almost ready'
                                        : 'Needs more practice'}
                            </p>
                            <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark mt-1">
                                {masteredCount} mastered · {progressingCount} progressing · {needsWorkCount} needs work
                            </p>
                            <div className="flex flex-wrap gap-2 mt-3">
                                <Link to="/dashboard/analysis" className="text-caption font-semibold text-primary hover:text-primary-hover transition-colors inline-flex items-center gap-1">
                                    View full analysis
                                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                                </Link>
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                    <StatCard
                        icon="local_fire_department"
                        label="Streak"
                        value={`${userStats?.streakDays ?? 0}d`}
                        hint="Keep it going daily"
                        accent="amber"
                    />
                    <StatCard
                        icon="podcasts"
                        label="Podcasts"
                        value={podcastCount}
                        hint={podcastCount === 0 ? 'Generate your first' : 'Generated this month'}
                        accent="primary"
                    />
                    <StatCard
                        icon="workspace_premium"
                        label="Mastered"
                        value={masteredCount}
                        hint="Strong concepts"
                        accent="emerald"
                    />
                    <StatCard
                        icon="cloud_upload"
                        label="Uploads left"
                        value={uploadQuota?.remaining ?? '—'}
                        hint={uploadQuota ? `of ${uploadQuota.totalAllowed}` : 'Quota loading'}
                        accent="teal"
                    />
                </div>
            </div>

            {insights && (insights.mastered?.length > 0 || insights.needsWork?.length > 0) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {insights.mastered?.length > 0 && (
                        <div className="card-flat p-4 bg-emerald-50/40 dark:bg-emerald-900/10 border-emerald-200/40 dark:border-emerald-800/30">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="material-symbols-outlined text-emerald-600 text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
                                <span className="text-overline text-emerald-700 dark:text-emerald-300">Strengths</span>
                            </div>
                            <ul className="space-y-2">
                                {insights.mastered.slice(0, 4).map((t) => (
                                    <li key={t.topicId} className="flex items-center justify-between gap-2">
                                        <span className="text-body-sm text-text-main-light dark:text-text-main-dark truncate">{t.title}</span>
                                        <span className="text-caption font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">{t.best}%</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {insights.needsWork?.length > 0 && (
                        <div className="card-flat p-4 bg-amber-50/40 dark:bg-amber-900/10 border-amber-200/40 dark:border-amber-800/30">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="material-symbols-outlined text-amber-600 text-[18px]">priority_high</span>
                                <span className="text-overline text-amber-700 dark:text-amber-300">Needs attention</span>
                            </div>
                            <ul className="space-y-2">
                                {insights.needsWork.slice(0, 4).map((t) => (
                                    <li key={t.topicId} className="flex items-center justify-between gap-2">
                                        <span className="text-body-sm text-text-main-light dark:text-text-main-dark truncate">{t.title}</span>
                                        <Link to={`/dashboard/topic/${t.topicId}`} className="text-caption font-semibold text-primary hover:text-primary-hover transition-colors shrink-0">
                                            Study
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </section>
    );
};

export { StatCard };
export default ProgressSnapshot;
