import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, m as Motion, useReducedMotion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import AppIcon from '../components/AppIcon';
import QuizProgress from '../components/quiz/QuizProgress';
import QuizQuestion from '../components/quiz/QuizQuestion';

const TopicQuizPlayer = () => {
    const { topicId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const reduceMotion = useReducedMotion();
    const [quiz, setQuiz] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [answers, setAnswers] = useState({});
    const [questionIndex, setQuestionIndex] = useState(0);
    const [submitting, setSubmitting] = useState(false);

    const load = useCallback(async () => {
        if (!user?.id || !topicId) {
            setQuiz(null);
            setLoading(false);
            return;
        }
        setLoading(true);
        setError('');
        try {
            const response = await fetch(`/api/topics/${encodeURIComponent(topicId)}/quiz`, {
                credentials: 'include',
                headers: { Accept: 'application/json' },
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || 'Failed to load quiz');
            setQuiz(payload);
            setAnswers({});
            setQuestionIndex(0);
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

    const total = questions.length;
    const isLastQuestion = questionIndex === total - 1;
    const currentQuestion = questions[questionIndex] || null;
    const currentSelected = currentQuestion ? answers[currentQuestion.id] : undefined;
    const hasCurrentSelection = Number.isFinite(Number(currentSelected)) && Number(currentSelected) >= 0;

    const unansweredCount = useMemo(
        () => questions.filter(
            (question) => !(Number.isFinite(Number(answers[question.id])) && Number(answers[question.id]) >= 0),
        ).length,
        [answers, questions],
    );

    // Scroll to top whenever the visible question changes.
    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
        }
    }, [questionIndex, reduceMotion]);

    const handleSelect = useCallback(
        (optionIndex) => {
            if (!currentQuestion) return;
            setAnswers((current) => ({
                ...current,
                [currentQuestion.id]: optionIndex,
            }));
        },
        [currentQuestion],
    );

    const handleBack = useCallback(() => {
        setQuestionIndex((index) => Math.max(0, index - 1));
    }, []);

    const handleContinue = useCallback(() => {
        setQuestionIndex((index) => Math.min(total - 1, index + 1));
    }, [total]);

    const handleSubmit = async (event) => {
        if (event?.preventDefault) event.preventDefault();
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
            const nextAttemptId = attempt?.id || attempt?.attemptId;
            if (nextAttemptId) {
                navigate(`/dashboard/quiz/results/${encodeURIComponent(nextAttemptId)}`, {
                    replace: true,
                });
            }
        } catch (err) {
            setError(err.message || 'Could not submit quiz');
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-[calc(100dvh-4rem)] animate-pulse bg-background-light px-4 py-8 md:px-8 md:py-10">
                <div className="mx-auto max-w-2xl space-y-4">
                    <div className="h-8 w-40 rounded-full bg-surface-soft" />
                    <div className="h-4 w-full rounded-full bg-surface-soft" />
                    <div className="h-10 w-3/4 rounded-[12px] bg-surface-soft" />
                    <div className="space-y-3">
                        <div className="h-16 rounded-[16px] bg-surface-soft" />
                        <div className="h-16 rounded-[16px] bg-surface-soft" />
                        <div className="h-16 rounded-[16px] bg-surface-soft" />
                    </div>
                </div>
            </div>
        );
    }

    if (error && !quiz) {
        return (
            <div className="flex min-h-dvh items-center justify-center bg-background-light px-4">
                <div className="flex w-full max-w-md flex-col items-center rounded-[28px] border border-dashed border-border-default bg-surface px-6 py-12 text-center shadow-sm">
                    <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-error-soft text-error">
                        <AppIcon name="error" className="text-[28px]" />
                    </div>
                    <h2 className="font-display text-display-sm font-bold text-text-primary">Could not load quiz</h2>
                    <p className="mt-2 max-w-sm text-body-sm text-text-secondary">{error}</p>
                    <div className="mt-6 flex flex-wrap justify-center gap-3">
                        <button type="button" onClick={load} className="btn-secondary inline-flex min-h-11 text-body-sm">
                            Try again
                        </button>
                        <Link to="/dashboard/quiz" className="btn-primary inline-flex min-h-11 text-body-sm">
                            Back to quizzes
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-dvh bg-background-light px-4 pb-28 pt-0 md:px-8 md:pb-10 md:pt-8">
            <div className="mx-auto max-w-2xl">
                <header className="sticky top-0 z-30 -mx-4 bg-background-light/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-none">
                    <div className="flex items-center justify-between gap-3">
                        <Link
                            to="/dashboard/quiz"
                            className="inline-flex min-h-11 items-center gap-1.5 text-body-sm font-semibold text-primary hover:text-primary-hover"
                        >
                            <AppIcon name="arrow_back" className="text-[16px]" />
                            All quizzes
                        </Link>
                        <p className="hidden text-caption font-semibold uppercase tracking-[0.06em] text-text-muted sm:block">
                            {quiz?.topic?.title || 'Topic quiz'}
                        </p>
                    </div>
                    {total > 0 && (
                        <div className="mt-3">
                            <QuizProgress current={questionIndex} total={total} />
                        </div>
                    )}
                </header>

                {error && (
                    <div role="alert" className="mt-5 rounded-[16px] border border-error/30 bg-error-soft px-4 py-3 text-body-sm text-error">
                        {error}
                    </div>
                )}

                {total === 0 ? (
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
                ) : (
                    <form
                        className="ph-mask mt-6"
                        onSubmit={(event) => event.preventDefault()}
                    >
                        <AnimatePresence mode="wait" initial={false}>
                            <Motion.div
                                key={questionIndex}
                                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
                                transition={{ duration: 0.22, ease: 'easeOut' }}
                            >
                                <QuizQuestion
                                    question={currentQuestion}
                                    selectedIndex={currentSelected}
                                    onSelect={handleSelect}
                                />
                            </Motion.div>
                        </AnimatePresence>

                        {isLastQuestion && unansweredCount > 0 && (
                            <p className="mt-4 text-body-sm text-text-muted">
                                {unansweredCount} question{unansweredCount === 1 ? '' : 's'} will be submitted as skipped.
                            </p>
                        )}

                        <div className="sticky bottom-0 z-30 -mx-4 mt-8 flex items-center justify-between gap-3 border-t border-border-subtle bg-background-light/95 px-4 py-4 backdrop-blur md:static md:mx-0 md:bg-transparent md:px-0 md:backdrop-blur-none">
                            <button
                                type="button"
                                onClick={handleBack}
                                disabled={questionIndex === 0}
                                className="btn-secondary inline-flex min-h-11 items-center gap-2 text-body-sm disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <AppIcon name="arrow_back" className="text-[16px]" />
                                Back
                            </button>

                            {isLastQuestion ? (
                                <button
                                    type="button"
                                    onClick={handleSubmit}
                                    disabled={submitting}
                                    className="btn-primary inline-flex min-h-11 items-center gap-2 text-body-sm disabled:opacity-60"
                                >
                                    {submitting ? 'Submitting…' : 'Submit quiz'}
                                    {!submitting && <AppIcon name="check_circle" className="text-[16px]" />}
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleContinue}
                                    disabled={!hasCurrentSelection}
                                    className="btn-primary inline-flex min-h-11 items-center gap-2 text-body-sm disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Continue
                                    <AppIcon name="arrow_forward" className="text-[16px]" />
                                </button>
                            )}
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default TopicQuizPlayer;
