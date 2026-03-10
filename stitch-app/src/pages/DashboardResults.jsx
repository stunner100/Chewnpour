import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';

// ─── Post-exam upgrade prompt ────────────────────────────────────────────────

const PostExamUpgradeCard = () => {
    const uploadQuota = useQuery(api.subscriptions.getUploadQuotaStatus, {});

    // Don't render while loading or if query fails
    if (uploadQuota === undefined || uploadQuota === null) return null;

    const hasRemaining = (uploadQuota.remaining ?? 0) > 0;

    if (hasRemaining) {
        return (
            <section className="w-full flex justify-center">
                <div className="w-full max-w-2xl rounded-2xl p-6 bg-gradient-to-r from-primary/10 via-purple-500/10 to-primary/10 dark:from-primary/20 dark:via-purple-500/15 dark:to-primary/20 border border-primary/20 dark:border-primary/30">
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                        <div className="flex-1 text-center sm:text-left">
                            <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-1">
                                Ready for your next course?
                            </h3>
                            <p className="text-sm text-neutral-600 dark:text-neutral-400">
                                Keep the momentum going and upload another course to study.
                            </p>
                        </div>
                        <Link
                            to="/dashboard/analysis"
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white font-bold text-sm shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:brightness-110 transition-all whitespace-nowrap"
                        >
                            Upload Another Course
                            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                        </Link>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="w-full flex justify-center">
            <div className="w-full max-w-2xl rounded-2xl p-6 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 dark:from-amber-500/15 dark:via-orange-500/10 dark:to-amber-500/15 border border-amber-500/20 dark:border-amber-500/30">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="flex-1 text-center sm:text-left">
                        <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-1">
                            Want to study more courses?
                        </h3>
                        <p className="text-sm text-neutral-600 dark:text-neutral-400">
                            Get 5 more uploads starting at GHS 20
                        </p>
                    </div>
                    <Link
                        to="/subscription?reason=post_exam"
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 text-white font-bold text-sm shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 hover:brightness-110 transition-all whitespace-nowrap"
                    >
                        Upgrade Now
                        <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </Link>
                </div>
            </div>
        </section>
    );
};

// ─── Difficulty breakdown helpers ────────────────────────────────────────────

const DIFFICULTY_LABELS = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

const buildDifficultyBreakdown = (answers) => {
    const buckets = { easy: { correct: 0, total: 0 }, medium: { correct: 0, total: 0 }, hard: { correct: 0, total: 0 } };
    for (const a of answers) {
        if (a.skipped) continue;
        const d = (a.difficulty || 'medium').toLowerCase();
        const key = buckets[d] ? d : 'medium';
        buckets[key].total += 1;
        if (a.isCorrect) buckets[key].correct += 1;
    }
    return buckets;
};

const DifficultyPills = ({ answers }) => {
    const breakdown = buildDifficultyBreakdown(answers);
    const pills = Object.entries(breakdown).filter(([, v]) => v.total > 0);
    if (pills.length === 0) return null;

    const colors = {
        easy: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-100 dark:border-green-900/30',
        medium: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-900/30',
        hard: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-100 dark:border-red-900/30',
    };

    return (
        <div className="mt-4 flex flex-wrap gap-2 justify-center">
            {pills.map(([d, v]) => (
                <span key={d} className={`text-xs font-bold px-3 py-1 rounded-full border ${colors[d]}`}>
                    {DIFFICULTY_LABELS[d]}: {v.correct}/{v.total}
                </span>
            ))}
        </div>
    );
};

// ─── Strengths / Focus Area chips ────────────────────────────────────────────

const truncate = (text, max = 60) =>
    text && text.length > max ? `${text.slice(0, max).trimEnd()}…` : text || '';

const StrengthsAndFocus = ({ answers }) => {
    const strengths = answers.filter((a) => a.isCorrect).slice(0, 3);
    const focusAreas = answers.filter((a) => !a.isCorrect && !a.skipped).slice(0, 3);
    if (strengths.length === 0 && focusAreas.length === 0) return null;

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
            {strengths.length > 0 && (
                <div className="bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-800/30 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="material-symbols-outlined text-green-600 text-[20px]">thumb_up</span>
                        <span className="text-xs font-bold uppercase tracking-wider text-green-700 dark:text-green-400">Your Strengths</span>
                    </div>
                    <ul className="space-y-2">
                        {strengths.map((a, i) => (
                            <li key={i} className="text-xs font-medium text-neutral-700 dark:text-neutral-300 leading-snug">
                                {truncate(a.questionText)}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {focusAreas.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="material-symbols-outlined text-amber-600 text-[20px]">target</span>
                        <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Focus Areas</span>
                    </div>
                    <ul className="space-y-2">
                        {focusAreas.map((a, i) => (
                            <li key={i} className="text-xs font-medium text-neutral-700 dark:text-neutral-300 leading-snug">
                                {truncate(a.questionText)}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

// ─── Tutor Report card ────────────────────────────────────────────────────────

const READINESS_BADGE = {
    'Not Ready': 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-100 dark:border-red-900/30',
    'Almost Ready': 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-900/30',
    Ready: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-900/30',
    'Exam Ready': 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-100 dark:border-green-900/30',
};

// #6 — use regex word boundaries for robust readiness label extraction
const extractReadinessLabel = (text) => {
    if (!text) return null;
    // Check for structured "Verdict: X" format first (requested in prompt)
    const verdictMatch = text.match(/Verdict:\s*(Exam Ready|Almost Ready|Not Ready|Ready)/i);
    if (verdictMatch) {
        // Normalize to title case
        const raw = verdictMatch[1];
        const candidates = ['Exam Ready', 'Almost Ready', 'Not Ready', 'Ready'];
        for (const label of candidates) {
            if (raw.toLowerCase() === label.toLowerCase()) return label;
        }
    }
    // Fallback: word-boundary matching in priority order (longest match first)
    const patterns = [
        { label: 'Exam Ready', re: /\bExam\s+Ready\b/i },
        { label: 'Almost Ready', re: /\bAlmost\s+Ready\b/i },
        { label: 'Not Ready', re: /\bNot\s+Ready\b/i },
        { label: 'Ready', re: /\bReady\b/i },
    ];
    for (const { label, re } of patterns) {
        if (re.test(text)) {
            // Make sure "Ready" alone doesn't match when "Not Ready" or "Almost Ready" also appears
            if (label === 'Ready') {
                if (/\bNot\s+Ready\b/i.test(text)) return 'Not Ready';
                if (/\bAlmost\s+Ready\b/i.test(text)) return 'Almost Ready';
                if (/\bExam\s+Ready\b/i.test(text)) return 'Exam Ready';
            }
            return label;
        }
    }
    return null;
};

// #3 — track in-flight generation to prevent duplicate calls
const feedbackInFlight = new Set();

const TutorReport = ({ attemptId, storedFeedback }) => {
    const generateFeedback = useAction(api.ai.generateExamFeedback);
    const normalizedStoredFeedback = typeof storedFeedback === 'string'
        ? storedFeedback.trim()
        : '';
    const [generatedFeedback, setGeneratedFeedback] = useState(null);
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(() => Boolean(attemptId && !normalizedStoredFeedback));
    const feedback = normalizedStoredFeedback || generatedFeedback;

    useEffect(() => {
        if (!attemptId || normalizedStoredFeedback || generatedFeedback !== null) return undefined;
        // #3 — prevent duplicate concurrent calls for same attempt
        if (feedbackInFlight.has(attemptId)) return undefined;
        feedbackInFlight.add(attemptId);
        let cancelled = false;
        generateFeedback({ attemptId })
            .then((text) => {
                // Success — feedback confirmed generated, safe to clear guard
                feedbackInFlight.delete(attemptId);
                if (cancelled) return;
                const normalized = String(text || '').trim();
                if (normalized) setGeneratedFeedback(normalized);
                setLoading(false);
            })
            .catch((err) => {
                // #5 — log error instead of silently swallowing
                console.error('[TutorReport] Failed to generate feedback:', err);
                // Permanent failure (4xx-class) — clear guard so retry is possible on next mount
                const isPermanent = err?.data?.code === 'INVALID_ARGUMENT' || err?.data?.code === 'NOT_FOUND';
                if (isPermanent) feedbackInFlight.delete(attemptId);
                // Transient failure — keep the Set entry so rapid re-mount won't re-trigger
                if (!cancelled) {
                    setError(true);
                    setLoading(false);
                }
            });
        return () => {
            cancelled = true;
        };
    }, [attemptId, normalizedStoredFeedback, generatedFeedback, generateFeedback]);

    const readinessLabel = feedback ? extractReadinessLabel(feedback) : null;

    return (
        <div className="w-full max-w-2xl bg-surface-light dark:bg-surface-dark border border-neutral-100 dark:border-neutral-700 rounded-2xl shadow-soft overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 dark:border-neutral-700/60 bg-gradient-to-r from-primary/5 to-purple-500/5">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[22px]">psychology</span>
                    <span className="text-sm font-bold text-neutral-900 dark:text-white">Personal Tutor</span>
                </div>
                {/* #19 — only show badge when label is actually extracted */}
                {readinessLabel && READINESS_BADGE[readinessLabel] && (
                    <span className={`text-[11px] font-bold px-3 py-1 rounded-full border ${READINESS_BADGE[readinessLabel]}`}>
                        {readinessLabel}
                    </span>
                )}
            </div>
            <div className="px-6 py-5">
                {/* #16 — skeleton that better matches paragraph layout */}
                {loading && (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <div className="h-3 bg-neutral-100 dark:bg-neutral-800 rounded-full w-full animate-pulse"></div>
                            <div className="h-3 bg-neutral-100 dark:bg-neutral-800 rounded-full w-11/12 animate-pulse"></div>
                            <div className="h-3 bg-neutral-100 dark:bg-neutral-800 rounded-full w-4/5 animate-pulse"></div>
                        </div>
                        <div className="space-y-2">
                            <div className="h-3 bg-neutral-100 dark:bg-neutral-800 rounded-full w-full animate-pulse"></div>
                            <div className="h-3 bg-neutral-100 dark:bg-neutral-800 rounded-full w-5/6 animate-pulse"></div>
                        </div>
                        <div className="space-y-2">
                            <div className="h-3 bg-neutral-100 dark:bg-neutral-800 rounded-full w-full animate-pulse"></div>
                            <div className="h-3 bg-neutral-100 dark:bg-neutral-800 rounded-full w-3/4 animate-pulse"></div>
                        </div>
                    </div>
                )}
                {/* #11 — overflow-hidden + break-words for mobile safety */}
                {!loading && feedback && (
                    <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed whitespace-pre-line break-words overflow-hidden">{feedback}</p>
                )}
                {/* #5 & #18 — show distinct error vs unavailable messages */}
                {!loading && !feedback && error && (
                    <p className="text-sm text-amber-600 dark:text-amber-400">Could not generate tutor feedback. Please try refreshing the page.</p>
                )}
                {!loading && !feedback && !error && (
                    <p className="text-sm text-neutral-400 dark:text-neutral-500">Tutor feedback unavailable for this attempt.</p>
                )}
            </div>
        </div>
    );
};

// ─── Main component ───────────────────────────────────────────────────────────

const DashboardResults = () => {
    const { attemptId } = useParams();
    const attempt = useQuery(
        api.exams.getExamAttempt,
        attemptId ? { attemptId } : 'skip'
    );

    if (!attemptId) {
        return (
            <div className="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center">
                <div className="text-center max-w-md px-6">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No exam selected</h2>
                    <p className="text-slate-500 font-medium mb-6">Return to your dashboard and open a completed exam.</p>
                    <Link to="/dashboard" className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/20">
                        Back to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    if (attempt === undefined) {
        return (
            <div className="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-slate-500 font-medium">Loading exam results...</p>
                </div>
            </div>
        );
    }

    if (attempt === null) {
        return (
            <div className="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center">
                <div className="text-center max-w-md px-6">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Results not found</h2>
                    <p className="text-slate-500 font-medium mb-6">We couldn't find that exam attempt.</p>
                    <Link to="/dashboard" className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/20">
                        Back to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    const answers = attempt.answers || [];
    const isEssay = attempt.examFormat === 'essay';
    const skippedCount = answers.filter((a) => a.skipped).length;
    const answeredCount = answers.filter((a) => !a.skipped).length;
    const correctCount = attempt.score || 0;
    const incorrectCount = Math.max(0, answeredCount - correctCount);
    // Use actual answers length so the score breakdown always adds up visually
    const totalQuestions = answers.length || attempt.totalQuestions || 0;
    const percentage = typeof attempt.percentage === 'number'
        ? attempt.percentage
        : totalQuestions > 0
            ? Math.round((correctCount / totalQuestions) * 100)
            : 0;

    // #10 — handle all option structures: objects with label/value/text, plain strings, nested
    const getOptionText = (options, label) => {
        if (!options || !label) return label || '';
        if (Array.isArray(options)) {
            for (const option of options) {
                if (typeof option === 'string') {
                    // Plain string options — match by prefix label like "A) ..."
                    const match = option.match(/^\s*([A-D])[).\-:\s]+(.+)$/i);
                    if (match && match[1].toUpperCase() === String(label).toUpperCase()) return match[2].trim();
                    if (option === label) return option;
                    continue;
                }
                if (!option || typeof option !== 'object') continue;
                if (option.label === label || option.value === label) {
                    return option.text || option.content || option.choiceText || option.value || label;
                }
            }
        }
        return label;
    };

    return (
        <div className="bg-background-light dark:bg-background-dark font-display antialiased text-neutral-900 dark:text-white min-h-screen flex flex-col">
            <header className="w-full bg-surface-light dark:bg-surface-dark border-b border-neutral-100 dark:border-neutral-800 sticky top-0 z-30 shadow-sm">
                <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col">
                            <h1 className="text-xl font-bold text-neutral-900 dark:text-white leading-tight">Exam Results</h1>
                            <span className="text-sm font-medium text-neutral-400 dark:text-neutral-500">{attempt.topicTitle || 'ChewnPour Mode'}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <Link to="/dashboard" className="flex items-center justify-center bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors rounded-full h-10 w-10">
                            <span className="material-symbols-outlined text-neutral-600 dark:text-neutral-300">close</span>
                        </Link>
                    </div>
                </div>
            </header>

            <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-8 flex flex-col gap-8">
                {/* Score card */}
                <section className="w-full flex justify-center">
                    <div className="w-full max-w-2xl bg-surface-light dark:bg-surface-dark border border-neutral-100 dark:border-neutral-700 rounded-2xl p-8 shadow-soft flex flex-col items-center text-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary via-purple-500 to-primary"></div>
                        <h2 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-4">Overall Score</h2>
                        <div className="flex items-baseline justify-center gap-1 mb-2">
                            <span className="text-7xl font-extrabold text-neutral-900 dark:text-white tracking-tight">{percentage}</span>
                            <span className="text-3xl text-neutral-400 font-bold">/100</span>
                        </div>
                        <div className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">
                            {isEssay
                                ? `${totalQuestions} essay question${totalQuestions !== 1 ? 's' : ''} — quality score`
                                : `${attempt.score} correct out of ${totalQuestions}`}
                        </div>
                        <div className="mt-4 flex items-center gap-3 text-xs font-bold text-neutral-500">
                            <span className="px-3 py-1 rounded-full bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300">
                                {attempt.score} {isEssay ? 'Pass' : 'Correct'}
                            </span>
                            {incorrectCount > 0 && (
                                <span className="px-3 py-1 rounded-full bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300">
                                    {incorrectCount} {isEssay ? 'Needs Work' : 'Incorrect'}
                                </span>
                            )}
                            {skippedCount > 0 && (
                                <span className="px-3 py-1 rounded-full bg-neutral-50 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400">
                                    {skippedCount} Skipped
                                </span>
                            )}
                        </div>
                        {answers.length > 0 && <DifficultyPills answers={answers} />}
                    </div>
                </section>

                {/* Strengths and Focus Areas */}
                {answers.length > 0 && (
                    <section className="w-full flex justify-center">
                        <StrengthsAndFocus answers={answers} />
                    </section>
                )}

                {/* Tutor Report */}
                <section className="w-full flex justify-center">
                    <TutorReport key={attemptId} attemptId={attemptId} storedFeedback={attempt.tutorFeedback} />
                </section>

                {/* Question Review */}
                <section className="w-full">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="bg-primary/10 p-2 rounded-xl text-primary shadow-sm">
                            <span className="material-symbols-outlined text-[24px]">quiz</span>
                        </div>
                        <h3 className="text-xl font-bold text-neutral-900 dark:text-white">Question Review</h3>
                    </div>

                    {answers.length === 0 ? (
                        <div className="bg-surface-light dark:bg-surface-dark border border-neutral-100 dark:border-neutral-700 rounded-3xl p-6 shadow-card">
                            <p className="text-neutral-600 dark:text-neutral-400">No answers recorded for this attempt.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {answers.map((answer, index) => {
                                const questionText = answer.questionText || `Question ${index + 1}`;
                                const yourAnswerText = getOptionText(answer.options, answer.selectedAnswer) || 'Not answered';
                                const correctAnswerText = getOptionText(answer.options, answer.correctAnswer) || answer.correctAnswer;
                                const isCorrect = Boolean(answer.isCorrect);
                                const hasEssayFeedback = Boolean(answer.feedback);
                                return (
                                    <div key={`${answer.questionId}-${index}`} className="bg-surface-light dark:bg-surface-dark border border-neutral-100 dark:border-neutral-700 rounded-3xl p-6 shadow-card">
                                        <div className="flex justify-between items-center mb-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Question {index + 1}</span>
                                                {/* #14 — always show difficulty, default to "Medium" */}
                                                <span className="text-[10px] font-bold text-neutral-400 uppercase">{answer.difficulty || 'Medium'}</span>
                                            </div>
                                            <span className={`text-[11px] font-bold px-3 py-1.5 rounded-lg uppercase tracking-wide border ${
                                                answer.skipped
                                                    ? 'bg-neutral-50 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700'
                                                    : isCorrect
                                                        ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300 border-green-100 dark:border-green-900/30'
                                                        : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300 border-red-100 dark:border-red-900/30'
                                                }`}>
                                                {answer.skipped ? 'Skipped' : hasEssayFeedback ? (isCorrect ? 'Pass' : 'Needs Work') : (isCorrect ? 'Correct' : 'Incorrect')}
                                            </span>
                                        </div>
                                        <p className="text-lg font-medium text-neutral-800 dark:text-neutral-200 mb-6 leading-relaxed">
                                            {questionText}
                                        </p>

                                        {/* Essay answer display */}
                                        {hasEssayFeedback ? (
                                            <div className="space-y-4 mb-6">
                                                <div className={`p-4 rounded-2xl border ${isCorrect
                                                    ? 'bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-800/30'
                                                    : 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-800/30'
                                                    }`}>
                                                    <span className={`text-xs font-bold uppercase block mb-2 ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                                                        Your Answer
                                                    </span>
                                                    <p className="text-sm text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap leading-relaxed">{answer.selectedAnswer || 'Not answered'}</p>
                                                </div>

                                                {/* AI Feedback */}
                                                <div className="flex items-start gap-3 p-4 rounded-2xl bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-800/30">
                                                    <span className="material-symbols-outlined text-purple-600 mt-0.5 text-[24px]">psychology</span>
                                                    <div className="flex-1">
                                                        <span className="text-xs text-purple-600 font-bold uppercase block mb-1">AI Feedback</span>
                                                        <span className="text-sm font-medium text-neutral-800 dark:text-white">{answer.feedback}</span>
                                                    </div>
                                                </div>

                                                {/* Model answer for learning */}
                                                {answer.correctAnswer && (
                                                    <div className="flex items-start gap-3 p-4 rounded-2xl bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30">
                                                        <span className="material-symbols-outlined text-blue-600 mt-0.5 text-[24px]">school</span>
                                                        <div className="flex-1">
                                                            <span className="text-xs text-blue-600 font-bold uppercase block mb-1">Model Answer</span>
                                                            <span className="text-sm font-medium text-neutral-800 dark:text-white">{answer.correctAnswer}</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            /* MCQ answer display */
                                            <div className="space-y-4 mb-6">
                                                <div className={`flex items-start gap-4 p-4 rounded-2xl border ${
                                                    answer.skipped
                                                        ? 'bg-neutral-50 dark:bg-neutral-800/30 border-neutral-200 dark:border-neutral-700'
                                                        : isCorrect
                                                            ? 'bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-800/30'
                                                            : 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-800/30'
                                                    }`}>
                                                    <span className={`material-symbols-outlined mt-0.5 text-[24px] ${
                                                        answer.skipped ? 'text-neutral-400' : isCorrect ? 'text-green-600' : 'text-red-600'
                                                    }`}>
                                                        {answer.skipped ? 'remove_circle_outline' : isCorrect ? 'check_circle' : 'cancel'}
                                                    </span>
                                                    <div className="flex-1">
                                                        <span className={`text-xs font-bold uppercase block mb-1 ${
                                                            answer.skipped ? 'text-neutral-400' : isCorrect ? 'text-green-600' : 'text-red-600'
                                                        }`}>
                                                            {answer.skipped ? 'Skipped' : 'Your Answer'}
                                                        </span>
                                                        <span className="text-base font-bold text-neutral-800 dark:text-white">
                                                            {answer.skipped ? 'No answer selected' : yourAnswerText}
                                                        </span>
                                                    </div>
                                                </div>
                                                {!isCorrect && (
                                                    <div className="flex items-start gap-4 p-4 rounded-2xl bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-800/30">
                                                        <span className="material-symbols-outlined text-green-600 mt-0.5 text-[24px]">check_circle</span>
                                                        <div className="flex-1">
                                                            <span className="text-xs text-green-600 font-bold uppercase block mb-1">Correct Answer</span>
                                                            <span className="text-base font-bold text-neutral-800 dark:text-white">{correctAnswerText}</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* #13 — show explanation for both MCQ and essay (if available) */}
                                        {answer.explanation && (
                                            <div className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed bg-neutral-50 dark:bg-black/20 p-5 rounded-2xl border border-neutral-100 dark:border-neutral-700/50">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="material-symbols-outlined text-primary text-[20px]">lightbulb</span>
                                                    <span className="font-bold text-neutral-900 dark:text-white">Why?</span>
                                                </div>
                                                {answer.explanation}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                {/* Post-exam upgrade prompt */}
                <PostExamUpgradeCard />
            </main>
        </div>
    );
};

export default DashboardResults;
