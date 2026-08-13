import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import LessonContentRenderer from '../LessonContentRenderer';
import LessonInlineCheck from './LessonInlineCheck';
import AppIcon from '../AppIcon';
import { blocksToSpeechText } from '../../lib/lessonSections';

export default function LessonSectionStepper({
    steps,
    topicId,
    shareToken,
    lessonChecks,
    quizHref,
    quizLabel = 'Start topic quiz',
    onStepChange,
    cleanInline,
    onViewSource,
    onAskTutor,
    wordBankTerms,
    starredTerms,
    onTermsStarred,
    shouldAnimateBlocks = false,
}) {
    const safeSteps = Array.isArray(steps) ? steps : [];
    const [index, setIndex] = useState(0);
    const [finished, setFinished] = useState(false);
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
            return;
        }
        setFinished(false);
        setIndex(nextIndex);
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
            <div className="rounded-2xl border border-border-subtle bg-surface px-5 py-8 text-center shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">Lesson complete</p>
                <h2 className="mt-2 font-display text-display-sm font-bold text-text-primary">You finished every section</h2>
                <p className="mt-2 text-body-sm text-text-secondary">
                    Take the topic quiz when you are ready. It uses different questions from the ones in this lesson.
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                    <button
                        type="button"
                        className="btn-secondary inline-flex min-h-10 items-center gap-1.5 text-body-sm"
                        onClick={() => goTo(total - 1)}
                    >
                        <AppIcon name="arrow_back" className="text-[16px]" />
                        Back to last section
                    </button>
                    {quizHref ? (
                        <Link to={quizHref} className="btn-primary inline-flex min-h-10 items-center gap-1.5 text-body-sm">
                            <AppIcon name="quiz" className="text-[16px]" />
                            {quizLabel}
                        </Link>
                    ) : null}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">
                        Section {clampedIndex + 1} of {total}
                    </p>
                    <h2 className="font-display text-xl font-bold tracking-[-0.02em] text-text-primary md:text-2xl">
                        {step.title}
                    </h2>
                </div>
                <div
                    className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-soft md:w-32"
                    role="progressbar"
                    aria-valuemin={1}
                    aria-valuemax={total}
                    aria-valuenow={clampedIndex + 1}
                    aria-label={`Section ${clampedIndex + 1} of ${total}`}
                >
                    <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.round(((clampedIndex + 1) / total) * 100)}%` }}
                    />
                </div>
            </div>

            <LessonContentRenderer
                blocks={renderBlocks}
                shouldAnimateBlocks={shouldAnimateBlocks}
                cleanInline={cleanInline}
                onViewSource={onViewSource}
                onAskTutor={onAskTutor}
                wordBankTerms={wordBankTerms}
                topicId={topicId}
                starredTerms={starredTerms}
                onTermsStarred={onTermsStarred}
            />

            {step.check ? (
                <LessonInlineCheck
                    key={step.check.id}
                    check={step.check}
                    topicId={topicId}
                    shareToken={shareToken}
                    onAttempted={markAttempted}
                />
            ) : null}

            <div className="flex items-center justify-between gap-3 border-t border-border-subtle pt-4">
                <button
                    type="button"
                    className="btn-secondary inline-flex min-h-10 items-center gap-1.5 text-body-sm disabled:opacity-40"
                    disabled={clampedIndex === 0}
                    onClick={() => goTo(clampedIndex - 1)}
                >
                    <AppIcon name="arrow_back" className="text-[16px]" />
                    Previous
                </button>
                <button
                    type="button"
                    className="btn-primary inline-flex min-h-10 items-center gap-1.5 text-body-sm disabled:opacity-50"
                    disabled={!canContinue}
                    onClick={() => goTo(clampedIndex + 1)}
                >
                    {clampedIndex + 1 >= total ? 'Finish lesson' : 'Next section'}
                    <AppIcon name="arrow_forward" className="text-[16px]" />
                </button>
            </div>
            {step.check && !canContinue ? (
                <p className="text-caption text-text-muted">Attempt the check above to continue. You do not need a perfect answer.</p>
            ) : null}
        </div>
    );
}
