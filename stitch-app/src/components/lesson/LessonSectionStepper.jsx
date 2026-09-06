import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, m as Motion, useReducedMotion } from 'motion/react';
import LessonContentRenderer from '../LessonContentRenderer';
import LessonInlineCheck from './LessonInlineCheck';
import LessonCompletion from '../study/LessonCompletion';
import AppIcon from '../AppIcon';
import { blocksToSpeechText } from '../../lib/lessonSections';

const scrollLessonToTop = (reduceMotion) => {
    if (typeof window === 'undefined') return;
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
};

export default function LessonSectionStepper({
    steps,
    topicId,
    topicTitle,
    shareToken,
    lessonChecks,
    quizHref,
    quizLabel = 'Start quiz',
    onStepChange,
    cleanInline,
    onViewSource,
    wordBankTerms,
    starredTerms,
    onTermsStarred,
    shouldAnimateBlocks = false,
    contentRef,
    onFinishLesson,
    lessonCompleted = false,
    initialIndex = 0,
    initialFinished = false,
}) {
    const reduceMotion = useReducedMotion();
    const safeSteps = Array.isArray(steps) ? steps : [];
    const [index, setIndex] = useState(() => {
        const next = Number(initialIndex);
        return Number.isFinite(next) && next > 0 ? Math.round(next) : 0;
    });
    const [finished, setFinished] = useState(() => Boolean(initialFinished));
    const [sessionAttemptedIds, setSessionAttemptedIds] = useState([]);
    const attemptedIds = useMemo(() => {
        const next = new Set(Object.keys(lessonChecks || {}));
        sessionAttemptedIds.forEach((id) => next.add(id));
        return next;
    }, [lessonChecks, sessionAttemptedIds]);

    const total = safeSteps.length;
    const clampedIndex = total === 0 ? 0 : Math.min(index, total - 1);
    const step = safeSteps[clampedIndex] || null;
    const canContinue = Boolean(step) && (!step.check || attemptedIds.has(step.check.id));

    const speechText = useMemo(() => blocksToSpeechText(step?.blocks || []), [step]);
    const renderBlocks = useMemo(() => {
        const blocks = Array.isArray(step?.blocks) ? step.blocks : [];
        const first = blocks[0];
        if (
            first?.type === 'header'
            && String(first.text || '').trim().toLowerCase() === String(step?.title || '').trim().toLowerCase()
        ) {
            return blocks.slice(1);
        }
        return blocks;
    }, [step]);

    useEffect(() => {
        onStepChange?.({
            index: clampedIndex,
            title: step?.title || '',
            speechText,
            finished,
        });
    }, [clampedIndex, step, speechText, finished, onStepChange]);

    const markAttempted = useCallback((questionId) => {
        if (!questionId) return;
        setSessionAttemptedIds((prev) => (prev.includes(questionId) ? prev : [...prev, questionId]));
    }, []);

    const goTo = (nextIndex) => {
        if (nextIndex < 0) return;
        if (nextIndex >= total) {
            setFinished(true);
            // Persist completion through the existing topic-progress mechanism.
            onFinishLesson?.();
            scrollLessonToTop(reduceMotion);
            return;
        }
        setFinished(false);
        setIndex(nextIndex);
        scrollLessonToTop(reduceMotion);
    };

    if (total === 0) {
        return (
            <p className="py-10 text-center text-body-sm text-text-secondary">
                This lesson does not have readable sections yet.
            </p>
        );
    }

    if (finished) {
        return (
            <LessonCompletion
                topicTitle={topicTitle || step?.title || 'Lesson'}
                sectionTitles={safeSteps.map((entry) => entry?.title)}
                quizHref={quizHref}
                quizLabel={quizLabel}
                onReview={() => goTo(0)}
                onReviewLabel="Review lesson"
                onComplete={onFinishLesson}
                completed={lessonCompleted}
            />
        );
    }

    const headingId = 'lesson-reading-heading';
    const sectionTransition = reduceMotion
        ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.18 } }
        : {
            initial: { opacity: 0, y: 10 },
            animate: { opacity: 1, y: 0 },
            exit: { opacity: 0, y: -10 },
            transition: { duration: 0.22, ease: 'easeOut' },
        };

    return (
        <div className="space-y-8">
            <AnimatePresence mode="wait" initial={false}>
                <Motion.div key={clampedIndex} {...sectionTransition} className="space-y-8">
                    <article
                        ref={contentRef}
                        aria-labelledby={headingId}
                        className="lesson-reading-stage lesson-prose ph-mask"
                    >
                        <h2
                            id={headingId}
                            className="font-display text-display-sm font-bold tracking-[-0.02em] text-text-primary md:text-display-md"
                        >
                            {step.title}
                        </h2>
                        <LessonContentRenderer
                            blocks={renderBlocks}
                            shouldAnimateBlocks={shouldAnimateBlocks}
                            cleanInline={cleanInline}
                            onViewSource={onViewSource}
                            wordBankTerms={wordBankTerms}
                            topicId={topicId}
                            starredTerms={starredTerms}
                            onTermsStarred={onTermsStarred}
                        />
                    </article>

                    {step.check ? (
                        <LessonInlineCheck
                            key={step.check.id}
                            check={step.check}
                            topicId={topicId}
                            shareToken={shareToken}
                            onAttempted={markAttempted}
                        />
                    ) : null}
                </Motion.div>
            </AnimatePresence>

            <div className="flex items-center justify-between gap-3 border-t border-border-subtle pt-5">
                <button
                    type="button"
                    className="btn-secondary inline-flex min-h-11 items-center gap-1.5 text-body-sm disabled:opacity-40"
                    disabled={clampedIndex === 0}
                    onClick={() => goTo(clampedIndex - 1)}
                >
                    <AppIcon name="arrow_back" className="text-[16px]" />
                    Previous
                </button>
                <button
                    type="button"
                    className="btn-primary inline-flex min-h-11 items-center gap-1.5 text-body-sm disabled:opacity-50"
                    disabled={!canContinue}
                    onClick={() => goTo(clampedIndex + 1)}
                >
                    {clampedIndex + 1 >= total ? 'Finish lesson' : 'Continue'}
                    <AppIcon name="arrow_forward" className="text-[16px]" />
                </button>
            </div>
            {step.check && !canContinue ? (
                <p className="text-caption text-text-muted">Attempt the check above to continue. You do not need a perfect answer.</p>
            ) : null}
        </div>
    );
}
