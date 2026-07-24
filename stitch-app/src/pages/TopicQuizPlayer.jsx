import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

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
            <div className="md:ml-0 pt-16 min-h-screen p-space-6 md:p-space-8 animate-pulse">
                <div className="mx-auto max-w-3xl h-40 rounded-2xl bg-surface-soft" />
            </div>
        );
    }

    return (
        <div className="md:ml-0 pt-16 min-h-screen p-space-6 md:p-space-8 pb-24">
            <div className="mx-auto max-w-3xl">
                <Link to="/dashboard/quiz" className="text-body-sm text-primary hover:text-primary-hover">
                    ← All quizzes
                </Link>
                <h1 className="mt-4 font-headline-lg text-headline-lg font-bold text-text-primary">
                    {quiz?.topic?.title || 'Topic quiz'}
                </h1>
                <p className="mt-2 text-body text-text-secondary">
                    {quiz?.course?.title || 'Course'} · {questions.length} questions
                </p>

                {error && (
                    <div role="alert" className="mt-6 rounded-xl border border-error-soft bg-error-soft/40 p-4 text-body-sm text-error">
                        {error}
                    </div>
                )}

                {questions.length === 0 ? (
                    <div className="mt-8 rounded-2xl border border-dashed border-border-strong bg-surface-soft p-8 text-center text-body-sm text-text-secondary">
                        No quiz questions are ready for this topic yet.
                    </div>
                ) : result ? (
                    <section className="mt-8 rounded-2xl border border-border-subtle bg-surface p-6">
                        <h2 className="font-headline-sm text-headline-sm text-text-primary">Results</h2>
                        <p className="mt-3 text-body text-text-secondary">
                            You scored {result.score}/{result.total} ({result.percent}%).
                        </p>
                        <div className="mt-6 flex gap-3">
                            <button type="button" className="btn-secondary" onClick={load}>
                                Retry
                            </button>
                            <Link to="/dashboard/quiz" className="btn-primary inline-flex">
                                Back to quizzes
                            </Link>
                        </div>
                    </section>
                ) : (
                    <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                        {questions.map((question, index) => (
                            <fieldset key={question.id} className="rounded-2xl border border-border-subtle bg-surface p-5">
                                <legend className="px-1 font-label-md text-label-md text-text-primary">
                                    {index + 1}. {question.prompt}
                                </legend>
                                <div className="mt-4 space-y-2">
                                    {(question.options || []).map((option, optionIndex) => (
                                        <label
                                            key={`${question.id}-${optionIndex}`}
                                            className="flex cursor-pointer items-start gap-3 rounded-xl border border-border-default px-3 py-3 hover:bg-surface-soft"
                                        >
                                            <input
                                                type="radio"
                                                name={question.id}
                                                checked={Number(answers[question.id]) === optionIndex}
                                                onChange={() => setAnswers((current) => ({
                                                    ...current,
                                                    [question.id]: optionIndex,
                                                }))}
                                            />
                                            <span className="text-body-sm text-text-primary">{option}</span>
                                        </label>
                                    ))}
                                </div>
                            </fieldset>
                        ))}
                        <button
                            type="submit"
                            disabled={submitting}
                            className="btn-primary inline-flex disabled:opacity-60"
                        >
                            {submitting ? 'Submitting…' : 'Submit quiz'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default TopicQuizPlayer;
