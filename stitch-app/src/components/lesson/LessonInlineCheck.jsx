import React, { useRef, useState } from 'react';
import AppIcon from '../AppIcon';
import { gradeWithRetry, nextRadioIndex, radioTabIndex } from '../../lib/lessonCheckControls';
import LessonOrderingCheck from './LessonOrderingCheck';
import { AnnotatedText } from '../opensource-ui/AnnotatedText';

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
    const optionRefs = useRef([]);

    if (!check?.id || !check?.prompt) return null;

    // Submitting counts as an attempt before grading starts, so a grading
    // failure never keeps the student on this section; grading is retried and
    // only the feedback waits.
    const submit = async (answer) => {
        if (submitting) return;
        onAttempted?.(check.id);
        setSubmitting(true);
        setError('');
        try {
            const graded = await gradeWithRetry(() => submitLessonCheck({
                topicId,
                shareToken,
                questionId: check.id,
                ...answer,
            }));
            setResult(graded);
            setAttempts((count) => count + 1);
        } catch {
            setError('We could not check your answer right now. You can keep going, or try checking again.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSubmitChoice = () => {
        if (!Number.isInteger(selectedIndex)) return;
        submit({ selectedIndex });
    };

    const handleSubmitOrder = (orderedSteps) => submit({ orderedSteps });

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
                <div role="status" aria-live="polite">
                    {error ? <p className="mt-2 text-caption text-error">{error}</p> : null}
                </div>
            </div>
        );
    }

    const options = Array.isArray(check.options) ? check.options : [];
    const submitted = Boolean(result);
    const correct = Boolean(result?.correct);
    // A failed first attempt is teaching, not punishment: allow one retry
    // before revealing the correct answer.
    const revealAnswer = submitted && !correct && attempts >= 2;
    const locked = submitted && (correct || revealAnswer);

    // Arrows move from the focused option, which is the selected one once
    // anything is selected.
    const handleOptionKeyDown = (event, index) => {
        const next = nextRadioIndex(index, event.key, options.length);
        if (next === null || locked) return;
        event.preventDefault();
        setSelectedIndex(next);
        optionRefs.current[next]?.focus();
    };

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
                            ref={(node) => { optionRefs.current[index] = node; }}
                            tabIndex={radioTabIndex(index, selectedIndex)}
                            disabled={locked}
                            onClick={() => setSelectedIndex(index)}
                            onKeyDown={(event) => handleOptionKeyDown(event, index)}
                            className={`flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left text-body-sm leading-6 transition-colors ${
                                revealCorrect
                                    ? 'border-success/40 bg-success-soft text-text-primary'
                                    : revealWrong
                                      ? 'border-warning/40 bg-warning-soft text-text-primary'
                                      : selected
                                        ? 'border-primary bg-primary-subtle text-text-primary'
                                        : 'border-border-subtle bg-transparent text-text-primary hover:border-primary/40'
                            } ${locked ? 'cursor-default' : ''}`}
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
                        className="btn-primary inline-flex min-h-11 items-center gap-1.5 text-body-sm disabled:opacity-50"
                        disabled={!Number.isInteger(selectedIndex) || submitting}
                        onClick={handleSubmitChoice}
                    >
                        {submitting ? 'Checking…' : 'Check answer'}
                    </button>
                ) : null}
            </div>

            <div role="status" aria-live="polite">
                {error ? <p className="mt-2 text-caption text-error">{error}</p> : null}

                {submitted ? (
                    correct ? (
                        <div className="mt-4 flex items-start gap-2.5">
                            <AppIcon name="check" className="mt-0.5 shrink-0 text-[18px] text-success" />
                            <div>
                                <p className="text-body-sm font-semibold text-text-primary">
                                    <AnnotatedText variant="highlight">Exactly.</AnnotatedText>
                                </p>
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
                                    <p className="text-body-sm font-semibold text-text-primary">
                                        <AnnotatedText variant="wavy" color="text-warning">Not quite.</AnnotatedText>
                                    </p>
                                    <p className="sr-only">Not quite. Try another answer.</p>
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
                                        className="btn-secondary inline-flex min-h-11 items-center gap-1.5 text-body-sm"
                                        onClick={handleTryAgain}
                                    >
                                        <AppIcon name="refresh" className="text-[16px]" />
                                        Try again
                                    </button>
                                ) : null}
                                {onAskTutor ? (
                                    <button
                                        type="button"
                                        className="btn-ghost inline-flex min-h-11 items-center gap-1.5 text-body-sm"
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
            </div>
        </section>
    );
}
