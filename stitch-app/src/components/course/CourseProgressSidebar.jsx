import React from 'react';
import { Link } from 'react-router-dom';

const ProgressRing = ({ value = 0, size = 80, stroke = 6, accent = '#6c2bd9' }) => {
    const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const dashOffset = circumference * (1 - clamped / 100);

    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                strokeWidth={stroke}
                stroke="currentColor"
                fill="none"
                className="text-border-light dark:text-border-dark"
            />
            <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                strokeWidth={stroke}
                stroke={accent}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                style={{ transition: 'stroke-dashoffset 500ms ease' }}
            />
            <text
                x="50%"
                y="50%"
                dominantBaseline="middle"
                textAnchor="middle"
                className="fill-text-main-light dark:fill-text-main-dark"
                fontWeight="700"
                fontSize="18"
            >
                {Math.round(clamped)}%
            </text>
        </svg>
    );
};

const Row = ({ label, value, sub }) => (
    <div className="flex items-center justify-between gap-3 text-body-sm">
        <span className="text-text-sub-light dark:text-text-sub-dark">{label}</span>
        <span className="text-text-main-light dark:text-text-main-dark font-semibold">
            {value}
            {sub && (
                <span className="ml-1 text-caption text-text-faint-light dark:text-text-faint-dark font-normal">
                    {sub}
                </span>
            )}
        </span>
    </div>
);

const CourseProgressSidebar = ({
    progressPercent = 0,
    completedTopics,
    totalTopics,
    quizzesReady,
    quizAccuracy,
    weakConceptCount,
    onContinue,
    onGeneratePodcast,
    podcastStatus,
}) => {
    return (
        <div className="space-y-3">
            <section className="card-base p-5">
                <h3 className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark inline-flex items-center gap-2 mb-3">
                    <span className="material-symbols-outlined text-primary text-[18px]">analytics</span>
                    Course progress
                </h3>
                <div className="flex items-center gap-4">
                    <ProgressRing value={progressPercent} />
                    <div className="space-y-1.5 flex-1 min-w-0">
                        <Row
                            label="Modules"
                            value={`${completedTopics ?? 0}`}
                            sub={`/ ${totalTopics ?? 0}`}
                        />
                        <Row label="Quizzes ready" value={quizzesReady ?? 0} />
                        {typeof quizAccuracy === 'number' && quizAccuracy > 0 && (
                            <Row label="Quiz accuracy" value={`${quizAccuracy}%`} />
                        )}
                        <Row label="Weak concepts" value={weakConceptCount ?? 0} />
                    </div>
                </div>
            </section>

            <section className="card-base p-5">
                <h3 className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark inline-flex items-center gap-2 mb-3">
                    <span className="material-symbols-outlined text-primary text-[18px]">bolt</span>
                    Quick actions
                </h3>
                <div className="space-y-2">
                    <button
                        type="button"
                        onClick={onContinue}
                        className="btn-primary w-full justify-center text-body-sm h-10"
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
                        onClick={onGeneratePodcast}
                        className="btn-secondary w-full justify-center text-body-sm h-10"
                    >
                        <span className="material-symbols-outlined text-[16px]">graphic_eq</span>
                        {podcastStatus === 'ready' ? 'Open podcast' : 'Generate podcast'}
                    </button>
                    <Link
                        to="/dashboard/analysis"
                        className="btn-ghost w-full justify-center text-body-sm h-10"
                    >
                        <span className="material-symbols-outlined text-[16px]">trending_up</span>
                        View study plan
                    </Link>
                </div>
            </section>
        </div>
    );
};

export default CourseProgressSidebar;
