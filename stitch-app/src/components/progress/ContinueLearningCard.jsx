import React from 'react';
import { Link } from 'react-router-dom';
import { m as Motion, useReducedMotion } from 'motion/react';
import AppIcon from '../AppIcon';
import { formatLastStudied } from './progressModel';

const KIND_ICON = {
    exam: 'timer',
    quiz: 'quiz',
    podcast: 'podcasts',
    lesson: 'menu_book',
};

/**
 * Hero "pick up where you left off" card for the progress page.
 * Renders the real resumeTarget through resumeActivityCopy wording.
 */
const ContinueLearningCard = ({ resumeTarget, resumeCopy }) => {
    const reduceMotion = useReducedMotion();
    const hasTarget = Boolean(resumeTarget);
    const href = hasTarget ? resumeTarget.href || '/dashboard/upload' : '/dashboard/upload';
    const progress = Math.max(0, Math.min(100, Math.round(Number(resumeTarget?.progressPercent ?? 0))));
    const lastStudied = formatLastStudied(resumeTarget?.lastActivityAt);
    const iconName = KIND_ICON[String(resumeTarget?.kind || 'lesson')] || 'menu_book';

    return (
        <Motion.section
            aria-labelledby="progress-continue-heading"
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="relative overflow-hidden rounded-[24px] border border-border-subtle bg-surface shadow-sm"
        >
            <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-primary-subtle opacity-70 blur-3xl" />
            <div className="relative z-10 flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between md:gap-10 md:p-9">
                <div className="min-w-0 max-w-xl">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-subtle px-3 py-1.5 text-caption font-semibold text-primary">
                            <AppIcon name={iconName} className="text-[14px]" />
                            {hasTarget ? resumeCopy.badge : 'Start fresh'}
                        </span>
                        {lastStudied ? (
                            <span className="text-caption text-text-muted">
                                Last studied {lastStudied}
                            </span>
                        ) : null}
                    </div>
                    <h2
                        id="progress-continue-heading"
                        className="mt-4 font-display text-display-md font-bold tracking-[-0.02em] text-text-primary md:text-display-lg"
                    >
                        {hasTarget ? resumeCopy.heading : 'Begin your learning journey'}
                    </h2>
                    <p className="mt-2 text-body-md text-text-secondary">
                        {hasTarget
                            ? resumeCopy.hint
                            : 'Upload a material to generate your first lesson, then come back here to track your streak, courses, and quiz scores.'}
                    </p>
                    {hasTarget ? (
                        <div className="mt-5 max-w-md">
                            <div className="flex items-center justify-between text-caption font-semibold">
                                <span className="text-text-muted">Progress</span>
                                <span className="text-text-primary">{progress}%</span>
                            </div>
                            <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-soft">
                                <div
                                    className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
                                    style={{ width: `${progress}%` }}
                                    role="progressbar"
                                    aria-label={`${resumeCopy.heading} progress`}
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                    aria-valuenow={progress}
                                />
                            </div>
                        </div>
                    ) : null}
                </div>
                <Link
                    to={href}
                    className="btn-primary inline-flex min-h-12 shrink-0 items-center justify-center gap-2 px-7 text-body-md"
                >
                    {hasTarget ? resumeCopy.cta : 'Upload material'}
                    <AppIcon name="arrow_forward" className="text-[18px]" />
                </Link>
            </div>
        </Motion.section>
    );
};

export default ContinueLearningCard;
