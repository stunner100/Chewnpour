import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import AppIcon from '../components/AppIcon';
import QuizProgress from '../components/quiz/QuizProgress';
import { useAuth } from '../contexts/AuthContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { FUNNEL_EVENTS, trackFunnelEvent } from '../lib/funnelEvents';
import { formatReviewDay } from '../lib/reviewQueue';
import { requestJsonWithRetry } from '../lib/requestWithRetry';

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

const optionClassName = ({ index, selectedIndex, result }) => {
    if (!result) {
        if (index === selectedIndex) return 'border-primary bg-primary-subtle';
        return 'border-border-default bg-surface hover:bg-surface-soft hover:border-primary/40';
    }
    if (index === result.correctIndex) return 'border-success bg-success-soft';
    if (index === selectedIndex) return 'border-error bg-error-soft';
    return 'border-border-subtle bg-surface opacity-70';
};

const CenteredCard = ({ icon, iconClassName, title, children }) => (
    <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-background-light px-4 py-8">
        <div className="flex w-full max-w-md flex-col items-center rounded-[28px] border border-border-subtle bg-surface px-6 py-12 text-center shadow-sm">
            <div className={`mb-4 flex size-14 items-center justify-center rounded-2xl ${iconClassName}`}>
                <AppIcon name={icon} className="text-[28px]" aria-hidden="true" />
            </div>
            <h1 className="font-display text-display-sm font-bold text-text-primary">{title}</h1>
            {children}
        </div>
    </div>
);

const ReviewSession = () => {
    const { user } = useAuth();
    const [review, setReview] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [index, setIndex] = useState(0);
    const [selectedIndex, setSelectedIndex] = useState(null);
    const [result, setResult] = useState(null);
    const [answering, setAnswering] = useState(false);
    const [results, setResults] = useState([]);
    const resultRef = useRef(null);

    useDocumentTitle('Review');

    const load = useCallback(async () => {
        if (!user?.id) return;
        setLoading(true);
        setError('');
        try {
            const response = await fetch('/api/review', {
                credentials: 'include',
                headers: { Accept: 'application/json' },
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || 'Failed to load your review');
            setReview(payload.review || null);
            setIndex(0);
            setSelectedIndex(null);
            setResult(null);
            setResults([]);
        } catch (err) {
            setError(err.message || 'Could not load your review');
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    useEffect(() => {
        load();
    }, [load]);

    const questions = Array.isArray(review?.questions) ? review.questions : [];
    const question = questions[index] || null;
    const finished = questions.length > 0 && results.length === questions.length && !result;

    // On a phone the feedback card usually lands below the fold.
    useEffect(() => {
        if (result) resultRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    }, [result]);

    const handleAnswer = async (optionIndex) => {
        if (!question || result || answering) return;
        setSelectedIndex(optionIndex);
        setAnswering(true);
        setError('');
        try {
            // A failed check keeps the picked option so one tap retries it.
            const payload = await requestJsonWithRetry('/api/review/answer', {
                method: 'POST',
                credentials: 'include',
                headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
                body: JSON.stringify({ questionId: question.id, selectedIndex: optionIndex }),
            }, { fallbackMessage: 'Could not check your answer' });
            setResult(payload.result);
            trackFunnelEvent(FUNNEL_EVENTS.reviewAnswered, {
                isCorrect: payload.result?.isCorrect,
                box: payload.result?.box,
            });
        } catch (err) {
            setError(err.message || 'Could not check your answer');
        } finally {
            setAnswering(false);
        }
    };

    const handleNext = () => {
        const nextResults = [...results, result];
        setResults(nextResults);
        setResult(null);
        setSelectedIndex(null);
        if (index + 1 < questions.length) {
            setIndex(index + 1);
            return;
        }
        trackFunnelEvent(FUNNEL_EVENTS.reviewSessionCompleted, {
            total: nextResults.length,
            correct: nextResults.filter((item) => item?.isCorrect).length,
        });
    };

    if (loading) {
        return (
            <div className="min-h-[calc(100dvh-4rem)] animate-pulse bg-background-light px-4 py-8 md:px-8 md:py-10">
                <div className="mx-auto max-w-2xl space-y-4">
                    <div className="h-4 w-full rounded-full bg-surface-soft" />
                    <div className="h-10 w-3/4 rounded-[12px] bg-surface-soft" />
                    <div className="h-16 rounded-[16px] bg-surface-soft" />
                    <div className="h-16 rounded-[16px] bg-surface-soft" />
                </div>
            </div>
        );
    }

    if (error && !review) {
        return (
            <CenteredCard icon="error" iconClassName="bg-error-soft text-error" title="Could not load your review">
                <p className="mt-2 text-body-sm text-text-secondary">{error}</p>
                <button type="button" onClick={load} className="btn-primary mt-6 inline-flex min-h-11 text-body-sm">
                    Try again
                </button>
            </CenteredCard>
        );
    }

    if (questions.length === 0) {
        const next = review?.nextDueAt ? formatReviewDay(review.nextDueAt) : '';
        return (
            <CenteredCard icon="verified" iconClassName="bg-success-soft text-success" title="Nothing to review today">
                <p className="mt-2 max-w-sm text-body-sm text-text-secondary">
                    {next
                        ? `Your next review is ${next}.`
                        : 'Questions you miss in quizzes and exams will show up here on a schedule.'}
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                    <Link to="/dashboard/quiz" className="btn-primary inline-flex min-h-11 text-body-sm">
                        Take a quiz
                    </Link>
                    <Link to="/dashboard" className="btn-secondary inline-flex min-h-11 text-body-sm">
                        Back to home
                    </Link>
                </div>
            </CenteredCard>
        );
    }

    if (finished) {
        const correct = results.filter((item) => item?.isCorrect).length;
        const missed = results.length - correct;
        const moreDue = Number(review?.dueCount || 0) > questions.length;
        return (
            <CenteredCard icon="check_circle" iconClassName="bg-success-soft text-success" title={`${correct} of ${results.length} right`}>
                <p className="mt-2 max-w-sm text-body-sm text-text-secondary">
                    {missed > 0
                        ? `${missed} missed question${missed === 1 ? '' : 's'} will come back tomorrow. The ones you got right come back later.`
                        : 'Each one you got right comes back after a longer gap.'}
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                    {moreDue && (
                        <button type="button" onClick={load} className="btn-primary inline-flex min-h-11 text-body-sm">
                            Review more
                        </button>
                    )}
                    <Link to="/dashboard" className={`${moreDue ? 'btn-secondary' : 'btn-primary'} inline-flex min-h-11 text-body-sm`}>
                        Back to home
                    </Link>
                </div>
            </CenteredCard>
        );
    }

    return (
        <div className="flex h-full min-h-0 flex-1 flex-col bg-background-light">
            <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-8 pt-6 md:px-8 md:pt-8">
                <div className="flex items-center justify-between gap-3">
                    <Link
                        to="/dashboard"
                        className="inline-flex min-h-11 items-center gap-1.5 text-body-sm font-semibold text-primary hover:text-primary-hover"
                    >
                        <AppIcon name="arrow_back" className="text-[16px]" />
                        Home
                    </Link>
                    <p className="max-w-[60%] truncate text-caption font-semibold text-text-muted">
                        {question.topicTitle || 'Review'}
                    </p>
                </div>
                <div className="mt-3">
                    <QuizProgress current={index} total={questions.length} />
                </div>

                {error && (
                    <div role="alert" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-error/30 bg-error-soft px-4 py-3 text-body-sm text-error">
                        <span className="min-w-0 flex-1">{error}</span>
                        {selectedIndex != null && !result && (
                            <button
                                type="button"
                                onClick={() => handleAnswer(selectedIndex)}
                                disabled={answering}
                                className="btn-secondary inline-flex min-h-11 shrink-0 text-body-sm"
                            >
                                {answering ? 'Checking…' : 'Try again'}
                            </button>
                        )}
                    </div>
                )}

                <fieldset className="ph-mask mt-6 min-w-0 border-0 p-0 [overflow-wrap:anywhere]" disabled={Boolean(result) || answering}>
                    <legend className="font-display text-display-md font-bold leading-snug tracking-[-0.02em] text-text-primary">
                        {question.prompt}
                    </legend>
                    <div className="mt-6 space-y-3">
                        {question.options.map((option, optionIndex) => (
                            <button
                                key={`${question.id}-${optionIndex}`}
                                type="button"
                                onClick={() => handleAnswer(optionIndex)}
                                aria-pressed={selectedIndex === optionIndex}
                                className={`flex min-h-14 w-full items-start gap-3 rounded-[16px] border px-4 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${optionClassName({ index: optionIndex, selectedIndex, result })}`}
                            >
                                <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-soft text-body-sm font-bold text-text-secondary">
                                    {OPTION_LETTERS[optionIndex] || optionIndex + 1}
                                </span>
                                <span className="text-body-md text-text-primary">{option}</span>
                                {result && optionIndex === result.correctIndex && (
                                    <AppIcon name="check_circle" className="ml-auto mt-0.5 shrink-0 text-[20px] text-success" aria-label="Correct answer" />
                                )}
                                {result && !result.isCorrect && optionIndex === selectedIndex && (
                                    <AppIcon name="cancel" className="ml-auto mt-0.5 shrink-0 text-[20px] text-error" aria-label="Your answer" />
                                )}
                            </button>
                        ))}
                    </div>
                </fieldset>

                {result && (
                    <div ref={resultRef} role="status" className="mt-6 rounded-[18px] border border-border-subtle bg-surface p-4 [overflow-wrap:anywhere]">
                        <p className={`font-semibold ${result.isCorrect ? 'text-success' : 'text-error'}`}>
                            {result.isCorrect
                                ? result.graduated
                                    ? 'Correct. You know this one now.'
                                    : result.nextDueAt
                                        ? `Correct. Next review ${formatReviewDay(result.nextDueAt)}.`
                                        : 'Correct.'
                                : 'Not quite. This one comes back tomorrow.'}
                        </p>
                        {result.explanation && (
                            <p className="mt-2 text-body-sm text-text-secondary">{result.explanation}</p>
                        )}
                        <button type="button" onClick={handleNext} className="btn-primary mt-4 inline-flex min-h-11 text-body-sm">
                            {index + 1 < questions.length ? 'Next question' : 'See results'}
                            <AppIcon name="arrow_forward" className="text-[18px]" aria-hidden="true" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReviewSession;
