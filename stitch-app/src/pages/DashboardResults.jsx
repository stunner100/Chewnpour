import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useReducedMotion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import {
    QUESTION_TYPE_FILL_BLANK,
    isEssayFormat,
    normalizeQuestionType,
} from '../lib/objectiveExam';
import NextStepsGuidance from '../components/NextStepsGuidance';
import { Confetti } from '../components/magicui/Confetti';
import AppIcon from '../components/AppIcon';

// ─── Post-quiz share prompt ──────────────────────────────────────────────────

const PostQuizSharePrompt = ({ percentage, topicTitle, profile }) => {
    if (percentage < 70 || !profile?.referralCode) return null;

    const referralLink = `https://www.chewnpour.com/signup?ref=${profile.referralCode}`;
    const courseName = topicTitle || 'a course';

    const handleShareWhatsApp = () => {
        const text = `I scored ${percentage}% on ${courseName} using Chew & Pour! Can you beat me? Try it free:\n\n${referralLink}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    };

    const handleShareTelegram = () => {
        const text = `I scored ${percentage}% on ${courseName} using Chew & Pour! Can you beat me? Try it free:`;
        window.open(`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(text)}`, '_blank');
    };

    return (
        <section className="w-full max-w-2xl">
            <div className="rounded-[24px] border border-border-subtle bg-surface p-5 shadow-sm">
                <div className="flex flex-col items-center gap-3 text-center">
                    <p className="text-body-md font-semibold text-text-primary">
                        Nice score! Challenge your friends
                    </p>
                    <p className="text-body-sm text-text-secondary">
                        Share your result and invite a friend to study with ChewnPour.
                    </p>
                    <div className="mt-1 flex gap-3">
                        <button
                            type="button"
                            onClick={handleShareWhatsApp}
                            className="inline-flex items-center gap-2 rounded-lg bg-[#25D366] px-4 py-2 text-body-sm font-semibold text-white transition-all hover:brightness-110"
                        >
                            <svg className="size-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.611.611l4.458-1.495A11.952 11.952 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.291 0-4.42-.658-6.237-1.794l-.435-.27-2.642.886.886-2.642-.27-.435A9.956 9.956 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/></svg>
                            Share on WhatsApp
                        </button>
                        <button
                            type="button"
                            onClick={handleShareTelegram}
                            className="inline-flex items-center gap-2 rounded-lg bg-[#0088cc] px-4 py-2 text-body-sm font-semibold text-white transition-all hover:brightness-110"
                        >
                            <svg className="size-4" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                            Share on Telegram
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
};

// ─── Strengths / Needs-review lists (real answers only) ──────────────────────

const truncate = (text, max = 90) =>
    text && text.length > max ? `${text.slice(0, max).trimEnd()}…` : text || '';

const UnderstandSection = ({ answers }) => {
    const strong = answers.filter((a) => a.isCorrect).slice(0, 3);
    const needsReview = answers.filter((a) => !a.isCorrect).slice(0, 3);
    if (strong.length === 0 && needsReview.length === 0) return null;

    return (
        <section className="w-full max-w-2xl">
            <h3 className="mb-3 text-caption font-semibold uppercase tracking-[0.06em] text-text-muted">
                What do I understand?
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {strong.length > 0 && (
                    <div className="rounded-[24px] border border-border-subtle bg-surface p-4 shadow-sm">
                        <div className="mb-3 flex items-center gap-2">
                            <AppIcon name="thumb_up" className="text-[18px] text-success" />
                            <span className="text-caption font-semibold uppercase tracking-[0.06em] text-success">Strong areas</span>
                        </div>
                        <ul className="space-y-2">
                            {strong.map((a) => (
                                <li key={a.questionId || a.questionText} className="text-body-sm leading-snug text-text-secondary">
                                    {truncate(a.questionText)}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                {needsReview.length > 0 && (
                    <div className="rounded-[24px] border border-border-subtle bg-surface p-4 shadow-sm">
                        <div className="mb-3 flex items-center gap-2">
                            <AppIcon name="target" className="text-[18px] text-warning" />
                            <span className="text-caption font-semibold uppercase tracking-[0.06em] text-warning">Needs review</span>
                        </div>
                        <ul className="space-y-2">
                            {needsReview.map((a) => (
                                <li key={a.questionId || a.questionText} className="text-body-sm leading-snug text-text-secondary">
                                    {truncate(a.questionText)}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </section>
    );
};

// ─── Main component ───────────────────────────────────────────────────────────

// react-doctor-disable-next-line react-doctor/no-giant-component
const DashboardResults = () => {
    const { attemptId } = useParams();
    const { profile } = useAuth();
    const reduceMotion = useReducedMotion();
    // `undefined` = loading, `null` = not found / no attemptId.
    const [attempt, setAttempt] = useState(undefined);
    const [showConfetti, setShowConfetti] = useState(false);
    const confettiTriggeredRef = useRef(false);

    useEffect(() => {
        if (!attemptId) return undefined;
        let cancelled = false;
        fetch(`/api/quiz-attempts/${encodeURIComponent(attemptId)}`, {
            credentials: 'include',
            headers: { Accept: 'application/json' },
        })
            .then(async (response) => {
                if (response.status === 404) return null;
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(payload.error || 'Failed to load results');
                return payload.attempt || null;
            })
            .then((nextAttempt) => {
                if (!cancelled) setAttempt(nextAttempt);
            })
            .catch(() => {
                if (!cancelled) setAttempt(null);
            });
        return () => {
            cancelled = true;
        };
    }, [attemptId]);

    const rawPercentage = attempt && typeof attempt === 'object'
        ? (typeof attempt.percentage === 'number'
            ? attempt.percentage
            : ((attempt.answers?.length || attempt.totalQuestions || 0) > 0
                ? Math.round(((attempt.score || 0) / (attempt.answers?.length || attempt.totalQuestions || 0)) * 100)
                : 0))
        : 0;

    // One-shot confetti on good scores (≥70%), skipped entirely under reduced motion.
    useEffect(() => {
        if (reduceMotion) return undefined;
        if (!confettiTriggeredRef.current && rawPercentage >= 70) {
            confettiTriggeredRef.current = true;
            const timer = window.setTimeout(() => setShowConfetti(true), 400);
            const clearTimer = window.setTimeout(() => setShowConfetti(false), 6000);
            return () => {
                window.clearTimeout(timer);
                window.clearTimeout(clearTimer);
            };
        }
        return undefined;
    }, [rawPercentage, reduceMotion]);

    if (!attemptId) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background-light">
                <div className="max-w-md px-6 text-center">
                    <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl border border-border-subtle bg-surface">
                        <AppIcon name="quiz" className="text-2xl text-text-muted" />
                    </div>
                    <h2 className="mb-2 font-display text-display-sm font-bold text-text-primary">No quiz selected</h2>
                    <p className="mb-6 text-body-sm text-text-secondary">Return to your dashboard and open a completed quiz.</p>
                    <Link to="/dashboard" className="btn-primary inline-flex min-h-11 items-center gap-2 text-body-sm">
                        Back to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    if (attempt === undefined) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background-light">
                <div className="text-center">
                    <div className="mx-auto mb-4 size-10 animate-spin rounded-full border-2 border-border-light border-t-primary dark:border-border-dark dark:border-t-primary"></div>
                    <p className="text-body-sm text-text-secondary">Loading quiz results…</p>
                </div>
            </div>
        );
    }

    if (attempt === null) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background-light">
                <div className="max-w-md px-6 text-center">
                    <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl border border-border-subtle bg-surface">
                        <AppIcon name="search_off" className="text-2xl text-text-muted" />
                    </div>
                    <h2 className="mb-2 font-display text-display-sm font-bold text-text-primary">Results not found</h2>
                    <p className="mb-6 text-body-sm text-text-secondary">We couldn't find that quiz attempt.</p>
                    <Link to="/dashboard" className="btn-primary inline-flex min-h-11 items-center gap-2 text-body-sm">
                        Back to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    const answers = Array.isArray(attempt.answers) ? attempt.answers : [];
    const isEssay = isEssayFormat(attempt.examFormat);
    const skippedCount = answers.filter((a) => a.skipped).length;
    const answeredCount = answers.filter((a) => !a.skipped).length;
    const correctCount = attempt.score || 0;
    const incorrectCount = Math.max(0, answeredCount - correctCount);
    const totalQuestions = answers.length || attempt.totalQuestions || attempt.total || 0;
    const percentage = typeof attempt.percentage === 'number'
        ? attempt.percentage
        : totalQuestions > 0
            ? Math.round((correctCount / totalQuestions) * 100)
            : 0;

    // Resolve the full option text. The DB stores plain string options and the
    // selected/correct answers as letter labels, so index into options first.
    const resolveOptionText = (answer, index, label) => {
        const options = Array.isArray(answer?.options) ? answer.options : [];
        if (Number.isFinite(index) && index >= 0 && index < options.length) {
            return options[index];
        }
        return label || '';
    };

    return (
        <div className="flex min-h-screen flex-col bg-background-light">
            <Confetti active={showConfetti} />
            <header className="sticky top-0 z-30 w-full border-b border-border-subtle bg-surface/95 backdrop-blur-xl">
                <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 md:px-8">
                    <div className="flex items-center gap-3">
                        <Link to="/dashboard" className="btn-icon size-9">
                            <AppIcon name="arrow_back" className="text-lg" />
                        </Link>
                        <div>
                            <h1 className="font-display text-body-md font-bold leading-tight text-text-primary">Quiz Results</h1>
                            <span className="text-caption text-text-muted">{attempt.topicTitle || 'ChewnPour Mode'}</span>
                        </div>
                    </div>
                    <Link to="/dashboard" aria-label="Close" className="btn-icon size-9">
                        <AppIcon name="close" className="text-lg" />
                    </Link>
                </div>
            </header>

            <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center gap-8 px-4 py-8 pb-24 md:px-8 md:pb-12">
                {/* 1) How did I do? */}
                <section className="w-full max-w-2xl">
                    <p className="text-caption font-semibold uppercase tracking-[0.06em] text-text-muted">Quiz complete</p>
                    <h2 className="mt-1 font-display text-display-md font-bold tracking-[-0.02em] text-text-primary">
                        {attempt.topicTitle || 'Topic quiz'}
                    </h2>
                    <div className="mt-5 flex flex-col items-center rounded-[24px] border border-border-subtle bg-surface p-8 text-center shadow-sm">
                        <div className="flex items-baseline justify-center gap-1">
                            <span className="font-display text-display-xl font-bold text-text-primary">{percentage}%</span>
                        </div>
                        <div className="mt-1 text-body-md text-text-secondary">
                            {isEssay
                                ? `${totalQuestions} essay question${totalQuestions !== 1 ? 's' : ''} — quality score`
                                : `${correctCount} / ${totalQuestions} correct`}
                        </div>
                        <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
                            <span className="rounded-full bg-success-soft px-3 py-1 text-caption font-semibold text-success">
                                {correctCount} {isEssay ? 'Pass' : 'Correct'}
                            </span>
                            {incorrectCount > 0 && (
                                <span className="rounded-full bg-error-soft px-3 py-1 text-caption font-semibold text-error">
                                    {incorrectCount} {isEssay ? 'Needs Work' : 'Incorrect'}
                                </span>
                            )}
                            {skippedCount > 0 && (
                                <span className="rounded-full bg-surface-soft px-3 py-1 text-caption font-semibold text-text-muted">
                                    {skippedCount} Skipped
                                </span>
                            )}
                        </div>
                    </div>
                </section>

                {/* Share prompt for high scores */}
                <PostQuizSharePrompt percentage={percentage} topicTitle={attempt.topicTitle} profile={profile} />

                {/* 2) What do I understand? */}
                {answers.length > 0 && <UnderstandSection answers={answers} />}

                {/* 3) What should I do next? */}
                <section className="w-full max-w-2xl">
                    <h3 className="mb-3 text-caption font-semibold uppercase tracking-[0.06em] text-text-muted">
                        What should I do next?
                    </h3>
                    <div className="flex flex-col gap-3 sm:flex-row">
                        <a
                            href="#question-review"
                            className="btn-secondary inline-flex min-h-11 flex-1 items-center justify-center gap-2 text-body-sm"
                        >
                            <AppIcon name="rate_review" className="text-[18px]" />
                            <span>Review mistakes</span>
                        </a>
                        <Link
                            to={`/dashboard/quiz/${attempt.topicId}`}
                            className="btn-secondary inline-flex min-h-11 flex-1 items-center justify-center gap-2 text-body-sm"
                        >
                            <AppIcon name="refresh" className="text-[18px]" />
                            <span>Retry quiz</span>
                        </Link>
                        <Link
                            to={`/dashboard/topic/${attempt.topicId}`}
                            className="btn-primary inline-flex min-h-11 flex-1 items-center justify-center gap-2 text-body-sm"
                        >
                            <AppIcon name="menu_book" className="text-[18px]" />
                            <span>Back to lesson</span>
                        </Link>
                    </div>
                    <div className="mt-4 rounded-[24px] border border-border-subtle bg-surface p-5 shadow-sm">
                        <NextStepsGuidance
                            topicId={attempt.topicId}
                            topicTitle={attempt.topicTitle}
                            percentage={percentage}
                            completedAt={null}
                            bestScore={null}
                            hasWordBank={false}
                            onOpenChat={null}
                            variant="exam"
                        />
                    </div>
                </section>

                {/* Question Review — collapsed by default, lower on the page */}
                <section id="question-review" className="w-full max-w-3xl scroll-mt-20">
                    <details className="group rounded-[24px] border border-border-subtle bg-surface shadow-sm">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
                            <div className="flex items-center gap-2">
                                <AppIcon name="rate_review" className="text-[18px] text-primary" />
                                <span className="text-body-md font-semibold text-text-primary">Question review</span>
                                <span className="text-caption text-text-muted">({totalQuestions})</span>
                            </div>
                            <AppIcon name="expand_more" className="text-[20px] text-text-muted transition-transform group-open:rotate-180" />
                        </summary>
                        <div className="border-t border-border-subtle px-5 py-5">
                            {answers.length === 0 ? (
                                <p className="text-body-sm text-text-secondary">No answers recorded for this attempt.</p>
                            ) : (
                                <div className="space-y-4">
                                    {answers.map((answer, index) => {
                                        const questionText = answer.questionText || `Question ${index + 1}`;
                                        const questionType = normalizeQuestionType(answer.questionType);
                                        const isFillBlank = questionType === QUESTION_TYPE_FILL_BLANK;
                                        const isCorrect = Boolean(answer.isCorrect);
                                        const hasEssayFeedback = isEssay && Boolean(answer.feedback);
                                        const yourAnswerText = isFillBlank
                                            ? (answer.selectedAnswer || 'Not answered')
                                            : resolveOptionText(answer, answer.selectedIndex, answer.selectedAnswer) || 'Not answered';
                                        const correctAnswerText = isFillBlank
                                            ? (answer.correctAnswer || 'Not available')
                                            : resolveOptionText(answer, answer.correctIndex, answer.correctAnswer);
                                        return (
                                            <article key={answer.questionId || index} className="rounded-[16px] border border-border-subtle bg-background-light p-4">
                                                <div className="mb-3 flex items-center justify-between gap-2">
                                                    <span className="text-caption font-semibold text-text-muted">Question {index + 1}</span>
                                                    <span className={`rounded-md border px-2.5 py-1 text-caption font-semibold ${
                                                        answer.skipped
                                                            ? 'border-border-default bg-surface-soft text-text-muted'
                                                            : isCorrect
                                                                ? 'border-success/20 bg-success-soft text-success'
                                                                : 'border-error/20 bg-error-soft text-error'
                                                    }`}>
                                                        {answer.skipped ? 'Skipped' : hasEssayFeedback ? (isCorrect ? 'Pass' : 'Needs Work') : (isCorrect ? 'Correct' : 'Incorrect')}
                                                    </span>
                                                </div>
                                                <p className="text-body-md leading-relaxed text-text-primary">
                                                    {questionText}
                                                </p>

                                                {hasEssayFeedback ? (
                                                    <div className="mt-4 space-y-3">
                                                        <div className={`rounded-xl border p-4 ${isCorrect ? 'border-success/20 bg-success-soft' : 'border-error/20 bg-error-soft'}`}>
                                                            <span className={`mb-2 block text-caption font-semibold uppercase tracking-wide ${isCorrect ? 'text-success' : 'text-error'}`}>
                                                                Your Answer
                                                            </span>
                                                            <p className="whitespace-pre-wrap text-body-sm leading-relaxed text-text-primary">{answer.selectedAnswer || 'Not answered'}</p>
                                                        </div>
                                                        {answer.feedback && (
                                                            <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary-subtle p-4">
                                                                <AppIcon name="psychology" className="mt-0.5 text-[20px] text-primary" />
                                                                <div className="flex-1">
                                                                    <span className="mb-1 block text-caption font-semibold uppercase tracking-wide text-primary">AI Feedback</span>
                                                                    <span className="text-body-sm text-text-primary">{answer.feedback}</span>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {answer.correctAnswer && (
                                                            <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary-subtle p-4">
                                                                <AppIcon name="school" className="mt-0.5 text-[20px] text-primary" />
                                                                <div className="flex-1">
                                                                    <span className="mb-1 block text-caption font-semibold uppercase tracking-wide text-primary">Model Answer</span>
                                                                    <span className="text-body-sm text-text-primary">{answer.correctAnswer}</span>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="mt-4 space-y-3">
                                                        <div className={`flex items-start gap-3 rounded-xl border p-4 ${
                                                            answer.skipped
                                                                ? 'border-border-default bg-surface-soft'
                                                                : isCorrect
                                                                    ? 'border-success/20 bg-success-soft'
                                                                    : 'border-error/20 bg-error-soft'
                                                        }`}>
                                                            <AppIcon name={answer.skipped ? 'remove_circle_outline' : isCorrect ? 'check_circle' : 'cancel'} className="mt-0.5 text-[20px]" />
                                                            <div className="flex-1">
                                                                <span className={`mb-1 block text-caption font-semibold uppercase tracking-wide ${
                                                                    answer.skipped ? 'text-text-muted' : isCorrect ? 'text-success' : 'text-error'
                                                                }`}>
                                                                    {answer.skipped ? 'Skipped' : 'Your Answer'}
                                                                </span>
                                                                <span className="text-body-sm font-semibold text-text-primary">
                                                                    {answer.skipped ? 'No answer selected' : yourAnswerText}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        {!isCorrect && !answer.skipped && correctAnswerText && (
                                                            <div className="flex items-start gap-3 rounded-xl border border-success/20 bg-success-soft p-4">
                                                                <AppIcon name="check_circle" className="mt-0.5 text-[20px] text-success" />
                                                                <div className="flex-1">
                                                                    <span className="mb-1 block text-caption font-semibold uppercase tracking-wide text-success">Correct Answer</span>
                                                                    <span className="text-body-sm font-semibold text-text-primary">{correctAnswerText}</span>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {answer.explanation && (
                                                    <div className="mt-3 rounded-xl border border-border-subtle bg-surface p-4 text-body-sm leading-relaxed text-text-secondary">
                                                        <div className="mb-2 flex items-center gap-2">
                                                            <AppIcon name="lightbulb" className="text-[18px] text-primary" />
                                                            <span className="text-body-sm font-semibold text-text-primary">Why?</span>
                                                        </div>
                                                        {answer.explanation}
                                                    </div>
                                                )}
                                            </article>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </details>
                </section>
            </main>
        </div>
    );
};

export default DashboardResults;
