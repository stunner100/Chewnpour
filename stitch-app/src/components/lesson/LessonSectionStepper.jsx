import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, m as Motion, useReducedMotion } from 'motion/react';
import LessonContentRenderer from '../LessonContentRenderer';
import InteractiveWordBank from '../InteractiveWordBank';
import LessonInlineCheck from './LessonInlineCheck';
import LessonSectionHeading from './LessonSectionHeading';
import LessonRecapCards from './LessonRecapCards';
import LessonCompletion from '../study/LessonCompletion';
import AppIcon from '../AppIcon';
import { markdownToSpeechText } from '../../lib/lessonMarkdown';

const sectionAnchorId = (index) => `lesson-section-${index}`;

const scrollToSection = (index, reduceMotion) => {
    if (typeof document === 'undefined') return;
    document.getElementById(sectionAnchorId(index))?.scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'start',
    });
};

const scrollLessonToTop = (reduceMotion) => {
    if (typeof document === 'undefined') return;
    const main = document.getElementById('dashboard-main');
    const behavior = reduceMotion ? 'auto' : 'smooth';
    if (main) {
        main.scrollTo({ top: 0, behavior });
        return;
    }
    window.scrollTo({ top: 0, behavior });
};

export default function LessonSectionStepper({
    steps,
    topicId,
    topicTitle,
    hook = '',
    shareToken,
    lessonChecks,
    quizHref,
    quizLabel = 'Start quiz',
    onStepChange,
    wordBankTerms,
    starredTerms,
    onTermsStarred,
    contentRef,
    onFinishLesson,
    lessonCompleted = false,
    initialIndex = 0,
    initialFinished = false,
    nextLesson = null,
    examHref = '',
    onAskTutor,
    requestedIndex = null,
    onRequestConsumed,
}) {
    const reduceMotion = useReducedMotion();
    const safeSteps = Array.isArray(steps) ? steps : [];
    const [index, setIndex] = useState(() => {
        const next = Number(initialIndex);
        return Number.isFinite(next) && next > 0 ? Math.round(next) : 0;
    });
    const [finished, setFinished] = useState(() => Boolean(initialFinished));
    // "Read all" shows every section on one page for revision and in-page
    // search; stepping one section at a time stays the default.
    const [readAll, setReadAll] = useState(false);
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

    const speechText = useMemo(() => {
        if (step?.type === 'recap') return (step.items || []).map((item) => item.prompt).join(' ');
        return markdownToSpeechText(step?.markdown || '');
    }, [step]);
    // The one-line hook opens the lesson, above the first section's body.
    const showHook = Boolean(hook) && clampedIndex === 0 && step?.type === 'section';

    useEffect(() => {
        onStepChange?.({
            index: clampedIndex,
            title: step?.title || '',
            speechText,
            finished,
        });
    }, [clampedIndex, step, speechText, finished, onStepChange]);

    // A section jump (TOC, tutor) arrives as a prop. Apply it during render;
    // the effect below only scrolls and tells the parent it was consumed.
    const requestedSection = requestedIndex == null || requestedIndex === ''
        || !Number.isFinite(Number(requestedIndex))
        ? null
        : Math.round(Number(requestedIndex));
    const validRequest = requestedSection != null && requestedSection >= 0 && requestedSection < total
        ? requestedSection
        : null;
    const [appliedRequest, setAppliedRequest] = useState(null);
    if (validRequest !== appliedRequest) {
        setAppliedRequest(validRequest);
        if (validRequest != null) {
            setFinished(false);
            setIndex(validRequest);
        }
    }

    useEffect(() => {
        if (validRequest == null) return;
        if (readAll) scrollToSection(validRequest, reduceMotion);
        else scrollLessonToTop(reduceMotion);
        onRequestConsumed?.();
    }, [validRequest, readAll, reduceMotion, onRequestConsumed]);

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
                topicId={topicId}
                topicTitle={topicTitle || step?.title || 'Lesson'}
                sectionTitles={safeSteps.map((entry) => entry?.title)}
                quizHref={quizHref}
                quizLabel={quizLabel}
                onReview={() => goTo(0)}
                onReviewLabel="Review lesson"
                onComplete={onFinishLesson}
                completed={lessonCompleted}
                nextLesson={nextLesson}
                examHref={examHref}
            />
        );
    }

    const renderStep = (entry, { headingId, withHook, ref }) => (
        <article
            ref={ref}
            aria-labelledby={headingId}
            className="lesson-reading-stage lesson-prose ph-mask"
        >
            <LessonSectionHeading id={headingId} title={entry.title} role={entry.role} />
            {withHook ? <p className="lesson-hook">{hook}</p> : null}
            {entry.type === 'wordbank' ? (
                <div id="topic-wordbank" style={{ scrollMarginTop: 108 }}>
                    <InteractiveWordBank
                        terms={wordBankTerms}
                        topicId={topicId}
                        starredTerms={starredTerms}
                        onTermsStarred={onTermsStarred}
                    />
                </div>
            ) : null}
            {entry.type === 'recap' ? <LessonRecapCards items={entry.items} /> : null}
            {entry.type === 'section' ? <LessonContentRenderer markdown={entry.markdown} /> : null}
        </article>
    );

    const renderCheck = (entry) => (entry.check ? (
        <LessonInlineCheck
            key={entry.check.id}
            check={entry.check}
            topicId={topicId}
            shareToken={shareToken}
            onAttempted={markAttempted}
            onAskTutor={onAskTutor}
        />
    ) : null);

    const viewToggle = (
        <div className="flex justify-end">
            <button
                type="button"
                aria-pressed={readAll}
                onClick={() => setReadAll((value) => !value)}
                className="btn-ghost inline-flex min-h-11 items-center gap-1.5 text-body-sm"
            >
                <AppIcon name={readAll ? 'view_carousel' : 'view_agenda'} className="text-[16px]" />
                {readAll ? 'Step by step' : 'Read all'}
            </button>
        </div>
    );

    if (readAll) {
        return (
            <div className="space-y-8">
                {viewToggle}
                <div ref={contentRef} className="space-y-12">
                    {safeSteps.map((entry, stepIndex) => (
                        <section
                            key={`${entry.type}-${entry.sectionIndex ?? entry.title}-${stepIndex}`}
                            id={sectionAnchorId(stepIndex)}
                            style={{ scrollMarginTop: 108 }}
                            className="space-y-8"
                        >
                            {renderStep(entry, {
                                headingId: `${sectionAnchorId(stepIndex)}-heading`,
                                withHook: Boolean(hook) && stepIndex === 0 && entry.type === 'section',
                            })}
                            {renderCheck(entry)}
                        </section>
                    ))}
                </div>
                <div className="flex justify-end border-t border-border-subtle pt-5">
                    <button
                        type="button"
                        className="btn-primary inline-flex min-h-11 items-center gap-1.5 text-body-sm"
                        onClick={() => goTo(total)}
                    >
                        Finish lesson
                        <AppIcon name="arrow_forward" className="text-[16px]" />
                    </button>
                </div>
            </div>
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
            {viewToggle}
            <AnimatePresence mode="wait" initial={false}>
                <Motion.div key={clampedIndex} {...sectionTransition} className="space-y-8">
                    {renderStep(step, { headingId, withHook: showHook, ref: contentRef })}
                    {renderCheck(step)}
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
