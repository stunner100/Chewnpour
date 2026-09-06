import React, { useState } from 'react';
import AppIcon from '../AppIcon';
import LessonOrderingCheck from './LessonOrderingCheck';

const submitLessonCheck = async ({ topicId, shareToken, questionId, selectedIndex, orderedSteps }) => {
    const url = shareToken
        ? `/api/share/${encodeURIComponent(shareToken)}/lesson-check`
        : `/api/topics/${encodeURIComponent(topicId)}/lesson-check`;
    const response = await fetch(url, {
        method: 'POST',
        credentials: shareToken ? 'omit' : 'include',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ questionId, selectedIndex, orderedSteps }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload.error || 'Could not grade this check.');
    }
    return payload.result || payload;
};

export default function LessonInlineCheck({
    check,
    topicId,
    shareToken,
    onAttempted,
    onAskTutor,
}) {
    const [selectedIndex, setSelectedIndex] = useState(null);
    const [attempts, setAttempts] = useState(0);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    if (!check?.id || !check?.prompt) return null;

    const markAttempted = () => {
        setAttempts((count) => count + 1);
        onAttempted?.(check.id);
    };

    const handleGraded = (graded) => {
        setResult(graded);
        markAttempted();
    };

    const handleSubmitChoice = async () => {
        if (!Number.isInteger(selectedIndex) || submitting) return;
        setSubmitting(true);
        setError('');
        try {
            const graded = await submitLessonCheck({
                topicId,
                shareToken,
                questionId: check.id,
                selectedIndex,
            });
            handleGraded(graded);
        } catch (err) {
            setError(err.message || 'Could not grade this check.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSubmitOrder = async (orderedSteps) => {
        setSubmitting(true);
        setError('');
        try {
            const graded = await submitLessonCheck({
                topicId,
                shareToken,
                questionId: check.id,
                orderedSteps,
            });
            handleGraded(graded);
            return graded;
        } catch (err) {
            setError(err.message || 'Could not grade this check.');
            throw err;
        } finally {
            setSubmitting(false);
        }
    };

    const handleTryAgain = () => {
        setResult(null);
        setSelectedIndex(null);
        setError('');
    };

    if (check.questionType === 'ordering') {
        return (
            <div>
                <LessonOrderingCheck
                    check={check}
                    onSubmit={handleSubmitOrder}
                    result={result}
                    submitting={submitting}
                />
                {error ? <p className="mt-2 text-caption text-error">{error}</p> : null}
            </div>
        );
    }

    const options = Array.isArray(check.options) ? check.options : [];
    const submitted = Boolean(result);
    const correct = Boolean(result?.correct);
    // A failed first attempt is teaching, not punishment: allow one retry
    // before revealing the correct answer.
    const revealAnswer = submitted && !correct && attempts >= 2;

    return (
        <section aria-label="Quick check" className="my-8 border-t border-border-subtle pt-8 ph-mask">
            <div className="mb-4 flex items-start gap-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-primary">
                    <AppIcon name="help" className="text-[18px]" />
                </span>
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
                        Quick check
                    </p>
                    <h3 id={`${check.id}-prompt`} className="mt-1 text-body-md font-semibold leading-7 text-text-primary">
                        {check.prompt}
                    </h3>
                </div>
            </div>

            <div className="space-y-2" role="radiogroup" aria-labelledby={`${check.id}-prompt`}>
                {options.map((option, index) => {
                    const selected = selectedIndex === index;
                    const revealCorrect = revealAnswer && result?.correctIndex === index;
                    const revealWrong = submitted && !correct && selected;
                    return (
                        <button
                            key={`${check.id}-${index}`}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            disabled={submitted && (correct || revealAnswer)}
                            onClick={() => setSelectedIndex(index)}
                            className={`flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left text-body-sm leading-6 transition-colors ${
                                revealCorrect
                                    ? 'border-success/40 bg-success-soft text-text-primary'
                                    : revealWrong
                                      ? 'border-warning/40 bg-warning-soft text-text-primary'
                                      : selected
                                        ? 'border-primary bg-primary-subtle text-text-primary'
                                        : 'border-border-subtle bg-transparent text-text-primary hover:border-primary/40'
                            } ${submitted && (correct || revealAnswer) ? 'cursor-default' : ''}`}
                        >
                            <span
                                aria-hidden="true"
                                className={`mt-1 size-4 shrink-0 rounded-full border-2 transition-colors ${
                                    revealCorrect
                                        ? 'border-success bg-success'
                                        : selected
                                          ? 'border-primary bg-primary'
                                          : 'border-border-strong bg-transparent'
                                }`}
                            />
                            <span>{option}</span>
                        </button>
                    );
                })}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
                {!submitted ? (
                    <button
                        type="button"
                        className="btn-primary inline-flex min-h-10 items-center gap-1.5 text-body-sm disabled:opacity-50"
                        disabled={!Number.isInteger(selectedIndex) || submitting}
                        onClick={handleSubmitChoice}
                    >
                        {submitting ? 'Checking…' : 'Check answer'}
                    </button>
                ) : null}
            </div>

            {error ? <p className="mt-2 text-caption text-error">{error}</p> : null}

            {submitted ? (
                correct ? (
                    <div className="mt-4 flex items-start gap-2.5">
                        <AppIcon name="check" className="mt-0.5 shrink-0 text-[18px] text-success" />
                        <div>
                            <p className="text-body-sm font-semibold text-text-primary">Exactly.</p>
                            <p className="sr-only">Correct</p>
                            {result.explanation ? (
                                <p className="mt-1.5 text-body-sm leading-6 text-text-secondary">{result.explanation}</p>
                            ) : null}
                        </div>
                    </div>
                ) : (
                    <div className="mt-4 space-y-3">
                        <div className="flex items-start gap-2.5">
                            <AppIcon name="refresh" className="mt-0.5 shrink-0 text-[18px] text-warning" />
                            <div>
                                <p className="text-body-sm font-semibold text-text-primary">Not quite.</p>
                                <p className="sr-only">Incorrect</p>
                                {revealAnswer && result.explanation ? (
                                    <p className="mt-1.5 text-body-sm leading-6 text-text-secondary">{result.explanation}</p>
                                ) : null}
                                {result.hint ? (
                                    <p className="mt-1.5 text-caption leading-5 text-text-muted">{result.hint}</p>
                                ) : null}
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {!revealAnswer ? (
                                <button
                                    type="button"
                                    className="btn-secondary inline-flex min-h-10 items-center gap-1.5 text-body-sm"
                                    onClick={handleTryAgain}
                                >
                                    <AppIcon name="refresh" className="text-[16px]" />
                                    Try again
                                </button>
                            ) : null}
                            {onAskTutor ? (
                                <button
                                    type="button"
                                    className="btn-ghost inline-flex min-h-10 items-center gap-1.5 text-body-sm"
                                    onClick={() => onAskTutor(`I'm stuck on this quick check from the lesson: "${check.prompt}". Can you explain it?`)}
                                >
                                    <AppIcon name="smart_toy" className="text-[16px]" />
                                    Ask AI Tutor
                                </button>
                            ) : null}
                        </div>
                    </div>
                )
            ) : null}
        </section>
    );
}
