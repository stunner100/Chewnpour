import React from 'react';
import { m as Motion, useReducedMotion } from 'motion/react';
import AppIcon from '../AppIcon';
import {
    STATUS_DEVELOPING,
    STATUS_NEEDS_REVIEW,
    STATUS_NOT_PRACTICED,
    STATUS_STRONG,
    buildTopicRows,
} from './progressModel';

const STATUS_TONE = {
    [STATUS_STRONG]: 'bg-success-soft text-success',
    [STATUS_DEVELOPING]: 'bg-warning-soft text-warning',
    [STATUS_NEEDS_REVIEW]: 'bg-error-soft text-error',
    [STATUS_NOT_PRACTICED]: 'bg-surface-soft text-text-muted',
};

/**
 * Per-topic quiz performance with honest status labels.
 * Scores are best quiz results — they describe quiz performance only.
 */
const TopicPerformanceList = ({ performanceInsights }) => {
    const reduceMotion = useReducedMotion();
    const rows = buildTopicRows(performanceInsights);

    return (
        <Motion.section
            aria-labelledby="progress-topics-heading"
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: reduceMotion ? 0 : 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-[24px] border border-border-subtle bg-surface p-5 shadow-sm md:p-6"
        >
            <div className="flex items-center gap-2">
                <AppIcon name="target" className="text-[20px] text-primary" />
                <h2
                    id="progress-topics-heading"
                    className="font-display text-display-sm font-bold text-text-primary"
                >
                    Topic performance
                </h2>
            </div>
            <p className="mt-1 text-body-sm text-text-secondary">
                Your best quiz score for each topic.
            </p>
            {rows.length > 0 ? (
                <ul className="mt-5 flex flex-col gap-2">
                    {rows.map((topic) => (
                        <li
                            key={topic.id}
                            className="flex items-center justify-between gap-3 rounded-[16px] border border-border-subtle px-4 py-3 transition-colors hover:bg-surface-soft"
                        >
                            <div className="min-w-0">
                                <p className="truncate text-body-sm font-medium text-text-primary">
                                    {topic.title}
                                </p>
                                {topic.courseTitle ? (
                                    <p className="mt-0.5 truncate text-caption text-text-muted">
                                        {topic.courseTitle}
                                    </p>
                                ) : null}
                            </div>
                            <div className="flex shrink-0 items-center gap-2.5">
                                <span className="w-10 text-right text-body-sm font-semibold tabular-nums text-text-primary">
                                    {topic.score != null ? `${topic.score}%` : '\u2014'}
                                </span>
                                <span
                                    className={`inline-flex w-28 items-center justify-center rounded-full px-2.5 py-1 text-caption font-semibold ${STATUS_TONE[topic.status]}`}
                                >
                                    {topic.status}
                                </span>
                            </div>
                        </li>
                    ))}
                </ul>
            ) : (
                <div className="mt-5 rounded-[16px] border border-dashed border-border-subtle bg-surface-soft p-5 text-center">
                    <p className="text-body-sm font-medium text-text-primary">No quiz scores yet</p>
                    <p className="mt-1 text-body-sm text-text-muted">
                        Topics stay {STATUS_NOT_PRACTICED.toLowerCase()} until you take a quiz.
                    </p>
                </div>
            )}
        </Motion.section>
    );
};

export default TopicPerformanceList;
