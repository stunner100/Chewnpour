import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { m as Motion, useReducedMotion } from 'motion/react';
import AppIcon from '../AppIcon';

const MAX_TAKEAWAYS = 4;
const NOISE_TITLE_PATTERN = /^(quick check|word bank|glossary|summary|introduction)\b/i;

/**
 * Deliberate end-of-lesson moment. Completion is persisted through the
 * existing topic-progress mechanism via `onComplete` (POST
 * /api/topics/:id/progress with completedAt) — this component owns no
 * separate completion state.
 */
const LessonCompletion = ({
    topicTitle,
    sectionTitles = [],
    quizHref,
    quizLabel = 'Start quiz',
    onReview,
    onReviewLabel = 'Review lesson',
    onComplete,
    completed = false,
}) => {
    const reduceMotion = useReducedMotion();
    const takeaways = useMemo(
        () => (Array.isArray(sectionTitles) ? sectionTitles : [])
            .map((title) => String(title || '').trim())
            .filter((title) => title && !NOISE_TITLE_PATTERN.test(title))
            .slice(0, MAX_TAKEAWAYS),
        [sectionTitles],
    );

    return (
        <div className="py-8 text-center md:py-12">
            <Motion.div
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
                animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="mx-auto flex size-14 items-center justify-center rounded-full bg-success-soft text-success"
            >
                <AppIcon name="check" className="text-[28px]" />
            </Motion.div>

            <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
                Lesson complete
            </p>
            <h2 className="mt-2 font-display text-display-md font-bold tracking-[-0.02em] text-text-primary">
                {topicTitle}
            </h2>

            {takeaways.length > 0 ? (
                <div className="mx-auto mt-7 max-w-md text-left">
                    <p className="text-caption font-semibold uppercase tracking-[0.06em] text-text-muted">
                        You've covered
                    </p>
                    <ul className="mt-3 space-y-2.5">
                        {takeaways.map((title) => (
                            <li key={title} className="flex items-start gap-2.5">
                                <AppIcon name="check" className="mt-0.5 shrink-0 text-[16px] text-success" />
                                <span className="text-body-sm leading-6 text-text-primary">{title}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}

            <p className="mt-7 text-body-sm text-text-secondary">
                Ready to test what you remember?
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {quizHref ? (
                    <Link
                        to={quizHref}
                        className="btn-primary inline-flex min-h-11 items-center gap-1.5 text-body-sm"
                        onClick={() => onComplete?.()}
                    >
                        <AppIcon name="quiz" className="text-[16px]" />
                        {quizLabel}
                    </Link>
                ) : (
                    <button
                        type="button"
                        className="btn-primary inline-flex min-h-11 items-center gap-1.5 text-body-sm"
                        onClick={() => onComplete?.()}
                    >
                        <AppIcon name="check_circle" className="text-[16px]" />
                        {completed ? 'Completed' : 'Mark lesson complete'}
                    </button>
                )}
                {onReview ? (
                    <button
                        type="button"
                        className="btn-secondary inline-flex min-h-11 items-center gap-1.5 text-body-sm"
                        onClick={onReview}
                    >
                        <AppIcon name="arrow_back" className="text-[16px]" />
                        {onReviewLabel}
                    </button>
                ) : null}
            </div>
        </div>
    );
};

export default LessonCompletion;
