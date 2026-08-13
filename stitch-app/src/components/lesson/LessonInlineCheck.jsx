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
}) {
    const [selectedIndex, setSelectedIndex] = useState(null);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    if (!check?.id || !check?.prompt) return null;

    const handleGraded = (graded) => {
        setResult(graded);
        onAttempted?.(check.id);
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

    return (
        <section className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-sm md:p-5">
            <div className="mb-3 flex items-center gap-2">
                <AppIcon name="quiz" className="text-[20px] text-primary" />
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">
                        {check.questionType === 'true_false' ? 'True or false' : 'Check your understanding'}
                    </p>
                    <h3 id={`${check.id}-prompt`} className="text-body-md font-semibold text-text-primary">{check.prompt}</h3>
                </div>
            </div>
            <div className="space-y-2" role="radiogroup" aria-labelledby={`${check.id}-prompt`}>
                {options.map((option, index) => {
                    const selected = selectedIndex === index;
                    const revealCorrect = submitted && result?.correctIndex === index;
                    const revealWrong = submitted && selected && !result?.correct;
                    return (
                        <button
                            key={`${check.id}-${index}`}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            disabled={submitted}
                            onClick={() => setSelectedIndex(index)}
                            className={`flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left text-body-sm leading-6 transition-colors ${
                                revealCorrect
                                    ? 'border-success/40 bg-success-soft text-text-primary'
                                    : revealWrong
                                      ? 'border-warning/40 bg-warning-soft text-text-primary'
                                      : selected
                                        ? 'border-primary bg-primary-subtle text-text-primary'
                                        : 'border-border-subtle bg-surface-soft text-text-primary hover:border-primary/40'
                            } ${submitted ? 'cursor-default' : ''}`}
                        >
                            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-caption font-bold text-primary">
                                {check.questionType === 'true_false' ? (index === 0 ? 'T' : 'F') : String.fromCharCode(65 + index)}
                            </span>
                            <span>{option}</span>
                        </button>
                    );
                })}
            </div>
            <div className="mt-4">
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
                <div
                    className={`mt-4 rounded-xl border px-4 py-3 ${
                        result.correct
                            ? 'border-success/30 bg-success-soft text-success'
                            : 'border-warning/30 bg-warning-soft text-text-primary'
                    }`}
                >
                    <p className="text-body-sm font-semibold">
                        {result.correct ? 'That’s right.' : 'Not quite — keep going with the lesson.'}
                    </p>
                    <p className="sr-only">{result.correct ? 'Correct' : 'Incorrect'}</p>
                    {result.explanation ? (
                        <p className="mt-2 text-body-sm text-text-secondary">{result.explanation}</p>
                    ) : null}
                    {result.hint && !result.correct ? (
                        <p className="mt-2 text-caption text-text-muted">{result.hint}</p>
                    ) : null}
                </div>
            ) : null}
        </section>
    );
}
