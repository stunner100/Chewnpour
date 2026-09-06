import React from 'react';
import { m as Motion, useReducedMotion } from 'motion/react';
import AppIcon from '../AppIcon';

const StatCard = ({ icon, iconTone, label, value, unit }) => (
    <div className="flex items-center gap-4 rounded-[24px] border border-border-subtle bg-surface p-5 shadow-sm md:p-6">
        <div className={`flex size-11 shrink-0 items-center justify-center rounded-full ${iconTone}`}>
            <AppIcon name={icon} className="text-[20px]" />
        </div>
        <div className="min-w-0">
            <p className="text-caption font-semibold uppercase tracking-[0.06em] text-text-muted">
                {label}
            </p>
            <p className="mt-1 flex items-baseline gap-1.5">
                <span className="font-display text-display-md font-bold text-text-primary">
                    {value}
                </span>
                {unit ? <span className="text-body-sm text-text-muted">{unit}</span> : null}
            </p>
        </div>
    </div>
);

/**
 * Calm, truthful activity stats: streak, topics practiced, quiz average.
 * No charts, no invented metrics.
 */
const ActivityStatsRow = ({ streakDays, topicsPracticed, quizAverage }) => {
    const reduceMotion = useReducedMotion();
    return (
        <Motion.section
            aria-labelledby="progress-activity-heading"
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: reduceMotion ? 0 : 0.05, ease: [0.16, 1, 0.3, 1] }}
        >
            <h2
                id="progress-activity-heading"
                className="font-display text-display-sm font-bold text-text-primary"
            >
                Overall activity
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatCard
                    icon="local_fire_department"
                    iconTone="bg-warning-soft text-warning"
                    label="Study streak"
                    value={streakDays}
                    unit={streakDays === 1 ? 'day' : 'days'}
                />
                <StatCard
                    icon="menu_book"
                    iconTone="bg-info-soft text-info"
                    label="Topics practiced"
                    value={topicsPracticed}
                    unit={topicsPracticed === 1 ? 'topic' : 'topics'}
                />
                <StatCard
                    icon="analytics"
                    iconTone="bg-success-soft text-success"
                    label="Quiz average"
                    value={`${quizAverage}%`}
                />
            </div>
        </Motion.section>
    );
};

export default ActivityStatsRow;
