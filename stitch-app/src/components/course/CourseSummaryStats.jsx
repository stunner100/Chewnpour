import React from 'react';

const StatCard = ({ icon, label, value, sub, accent = 'primary' }) => {
    const accentClass = {
        primary: 'bg-primary/10 text-primary',
        emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-300',
        amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/25 dark:text-amber-300',
        rose: 'bg-rose-100 text-rose-700 dark:bg-rose-900/25 dark:text-rose-300',
        violet: 'bg-violet-100 text-violet-700 dark:bg-violet-900/25 dark:text-violet-300',
    }[accent] || 'bg-primary/10 text-primary';

    return (
        <div className="card-base p-4 flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${accentClass}`}>
                <span
                    className="material-symbols-outlined text-[20px]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                >
                    {icon}
                </span>
            </div>
            <div className="min-w-0">
                <p className="text-caption text-text-faint-light dark:text-text-faint-dark uppercase tracking-wide truncate">
                    {label}
                </p>
                <p className="text-body-lg md:text-display-sm font-semibold text-text-main-light dark:text-text-main-dark truncate">
                    {value}
                </p>
                {sub && (
                    <p className="text-caption text-text-sub-light dark:text-text-sub-dark truncate">
                        {sub}
                    </p>
                )}
            </div>
        </div>
    );
};

const CourseSummaryStats = ({
    topicsReady,
    plannedTopics,
    completedTopics,
    completedTopicsLabel,
    quizzesReady,
    estimatedMinutes,
    progressPercent,
    podcastStatusLabel,
}) => {
    const totalTopics = plannedTopics ?? topicsReady ?? 0;

    return (
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
                icon="auto_stories"
                label="Topics ready"
                value={`${topicsReady}${plannedTopics ? ` / ${plannedTopics}` : ''}`}
                sub={
                    totalTopics > 0
                        ? `${Math.round((topicsReady / totalTopics) * 100)}% generated`
                        : 'Generating…'
                }
                accent="primary"
            />
            <StatCard
                icon="check_circle"
                label="Course progress"
                value={`${progressPercent ?? 0}%`}
                sub={
                    completedTopicsLabel
                        ? completedTopicsLabel
                        : totalTopics > 0
                            ? `${completedTopics ?? 0} of ${totalTopics} completed`
                        : ''
                }
                accent="emerald"
            />
            <StatCard
                icon="quiz"
                label="Quizzes ready"
                value={quizzesReady ?? 0}
                sub={(quizzesReady ?? 0) > 0 ? 'Practice anytime' : 'Coming soon'}
                accent="violet"
            />
            <StatCard
                icon={podcastStatusLabel === 'Ready' ? 'podcasts' : 'graphic_eq'}
                label="Audio lesson"
                value={podcastStatusLabel || 'Not generated'}
                sub={
                    estimatedMinutes
                        ? `${estimatedMinutes} min study time`
                        : 'Listen on the go'
                }
                accent="amber"
            />
        </section>
    );
};

export default CourseSummaryStats;
