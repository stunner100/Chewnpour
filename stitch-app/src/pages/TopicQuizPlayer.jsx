import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AppIcon from '../components/AppIcon';

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

const TopicQuizPlayer = () => {
    const { topicId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [quiz, setQuiz] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [answers, setAnswers] = useState({});
    const [result, setResult] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    const load = useCallback(async () => {
        if (!user?.id || !topicId) {
            setQuiz(null);
            setLoading(false);
            return;
        }
        setLoading(true);
        setError('');
        setResult(null);
        try {
            const response = await fetch(`/api/topics/${encodeURIComponent(topicId)}/quiz`, {
                credentials: 'include',
                headers: { Accept: 'application/json' },
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || 'Failed to load quiz');
            setQuiz(payload);
            setAnswers({});
        } catch (err) {
            setError(err.message || 'Could not load quiz');
        } finally {
            setLoading(false);
        }
    }, [topicId, user?.id]);

    useEffect(() => {
        load();
    }, [load]);

    const questions = useMemo(
        () => (Array.isArray(quiz?.questions) ? quiz.questions : []),
        [quiz],
    );

    const answeredCount = useMemo(
        () => questions.filter((question) => Number.isFinite(Number(answers[question.id])) && Number(answers[question.id]) >= 0).length,
        [answers, questions],
    );

    const progressPct = questions.length > 0
        ? Math.round((answeredCount / questions.length) * 100)
        : 0;

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!topicId || submitting) return;
        setSubmitting(true);
        setError('');
        try {
            const response = await fetch(`/api/topics/${encodeURIComponent(topicId)}/quiz`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    answers: questions.map((question) => ({
                        questionId: question.id,
                        selectedIndex: Number.isFinite(Number(answers[question.id]))
                            ? Number(answers[question.id])
                            : -1,
                    })),
                }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || 'Failed to submit quiz');
            const attempt = payload.attempt || null;
            setResult(attempt);
            const nextAttemptId = attempt?.id || attempt?.attemptId;
            if (nextAttemptId) {
                navigate(`/dashboard/quiz/results/${encodeURIComponent(nextAttemptId)}`, {
                    replace: true,
                });
            }
        } catch (err) {
            setError(err.message || 'Could not submit quiz');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-[calc(100vh-4rem)] animate-pulse bg-background-light px-4 py-8 md:px-8 md:py-10">
                <div className="mx-auto max-w-3xl space-y-4">
                    <div className="h-8 w-40 rounded-full bg-surface-soft" />
                    <div className="h-48 rounded-[24px] bg-surface-soft" />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-background-light px-4 py-8 md:px-8 md:py-10">
            <div className="mx-auto max-w-3xl">
                <Link
                    to="/dashboard/quiz"
                    className="inline-flex items-center gap-1.5 text-body-sm font-semibold text-primary hover:text-primary-hover"
                >
                    <AppIcon name="arrow_back" className="text-[16px]" />
                    All quizzes
                </Link>

                <div className="mt-5 flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <p className="text-caption font-semibold uppercase tracking-[0.06em] text-text-muted">
                            {quiz?.course?.title || 'Course'}
                        </p>
                        <h1 className="mt-2 font-display text-display-md font-bold tracking-[-0.02em] text-text-primary">
                            {quiz?.topic?.title || 'Topic quiz'}
                        </h1>
                        <p className="mt-2 text-body-sm text-text-secondary">
                            {questions.length} questions
                        </p>
                    </div>
                    {questions.length > 0 && !result && (
                        <span className="inline-flex items-center rounded-full bg-warning-soft px-3 py-1.5 text-caption font-semibold text-warning">
                            {answeredCount} of {questions.length} answered
                        </span>
                    )}
                </div>

                {questions.length > 0 && !result && (
                    <div className="mt-5">
                        <div className="mb-2 flex items-center justify-between text-caption font-semibold text-text-secondary">
                            <span>Progress</span>
                            <span>{progressPct}%</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-surface-soft">
                            <div
                                className="h-full rounded-full bg-cta transition-all"
                                style={{ width: `${Math.max(progressPct, answeredCount > 0 ? 8 : 0)}%` }}
                            />
                        </div>
                    </div>
                )}

                {error && (
                    <div role="alert" className="mt-5 rounded-[16px] border border-error/30 bg-error-soft px-4 py-3 text-body-sm text-error">
                        {error}
                    </div>
                )}

                {questions.length === 0 ? (
                    <div className="mt-8 flex flex-col items-center rounded-[28px] border border-dashed border-border-default bg-surface px-6 py-12 text-center shadow-sm">
                        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-surface-soft text-text-muted">
                            <AppIcon name="quiz" className="text-[28px]" />
                        </div>
                        <h2 className="font-display text-display-sm font-bold text-text-primary">No questions yet</h2>
                        <p className="mt-2 max-w-sm text-body-sm text-text-secondary">
                            No quiz questions are ready for this topic yet.
                        </p>
                        <Link to="/dashboard/quiz" className="btn-secondary mt-6 inline-flex min-h-11 text-body-sm">
                            Back to quizzes
                        </Link>
                    </div>
                ) : result ? (
                    <section className="mt-8 rounded-[24px] border border-border-subtle bg-surface p-6 shadow-sm">
                        <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-success-soft text-success">
                            <AppIcon name="check_circle" className="text-[28px]" />
                        </div>
                        <h2 className="font-display text-display-sm font-bold text-text-primary">Results</h2>
                        <p className="mt-3 text-body-md text-text-secondary">
                            You scored {result.score}/{result.total} ({result.percent}%).
                        </p>
                        <div className="mt-6 flex flex-wrap gap-3">
                            <button type="button" className="btn-secondary inline-flex min-h-11 text-body-sm" onClick={load}>
                                Retry
                            </button>
                            <Link to="/dashboard/quiz" className="btn-primary inline-flex min-h-11 text-body-sm">
                                Back to quizzes
                            </Link>
                        </div>
                    </section>
                ) : (
                    <form className="mt-8 space-y-5 ph-mask" onSubmit={handleSubmit}>
                        {questions.map((question, index) => (
                            <fieldset
                                key={question.id}
                                className="rounded-[24px] border border-border-subtle bg-surface p-5 shadow-sm"
                            >
                                <legend className="px-1 font-display text-body-md font-bold text-text-primary">
                                    {index + 1}. {question.prompt}
                                </legend>
                                <div className="mt-4 space-y-2.5">
                                    {(question.options || []).map((option, optionIndex) => {
                                        const selected = Number(answers[question.id]) === optionIndex;
                                        const letter = OPTION_LETTERS[optionIndex] || String(optionIndex + 1);
                                        return (
                                            <label
                                                key={`${question.id}-${optionIndex}`}
                                                className={`flex cursor-pointer items-start gap-3 rounded-[16px] border px-3.5 py-3.5 transition-colors ${
                                                    selected
                                                        ? 'border-primary bg-primary-subtle'
                                                        : 'border-border-default bg-surface hover:bg-surface-soft'
                                                }`}
                                            >
                                                <input
                                                    type="radio"
                                                    name={question.id}
                                                    className="sr-only"
                                                    checked={selected}
                                                    onChange={() => setAnswers((current) => ({
                                                        ...current,
                                                        [question.id]: optionIndex,
                                                    }))}
                                                />
                                                <span
                                                    className={`mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full text-caption font-bold ${
                                                        selected
                                                            ? 'bg-cta text-cta-foreground'
                                                            : 'bg-surface-soft text-text-secondary'
                                                    }`}
                                                >
                                                    {letter}
                                                </span>
                                                <span className="text-body-sm text-text-primary">{option}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </fieldset>
                        ))}
                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-5">
                            <p className="text-body-sm text-text-secondary">
                                {answeredCount}/{questions.length} answered
                            </p>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="btn-primary inline-flex min-h-11 items-center gap-2 text-body-sm disabled:opacity-60"
                            >
                                {submitting ? 'Submitting…' : 'Submit quiz'}
                                {!submitting && <AppIcon name="arrow_forward" className="text-[16px]" />}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default TopicQuizPlayer;
