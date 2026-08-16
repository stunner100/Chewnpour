import React, { useEffect, useReducer, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
    QUESTION_TYPE_FILL_BLANK,
    isEssayFormat,
    normalizeQuestionType,
} from '../lib/objectiveExam';
import NextStepsGuidance from '../components/NextStepsGuidance';
import { WatermelonWidget, WatermelonWidgetsGrid } from '../components/watermelon/WatermelonWidgets';
import { Confetti } from '../components/magicui/Confetti';
import AppIcon from '../components/AppIcon';

// ─── Post-exam upgrade prompt ────────────────────────────────────────────────

const PostExamUpgradeCard = () => (
    <section className="w-full max-w-2xl mx-auto">
        <div className="rounded-[24px] border border-primary/20 bg-primary-subtle p-5 shadow-sm">
            <div className="flex flex-col items-center gap-4 sm:flex-row">
                <div className="flex-1 text-center sm:text-left">
                    <h3 className="mb-1 font-display text-display-sm font-bold text-text-primary">
                        Ready for your next course?
                    </h3>
                    <p className="text-body-sm text-text-secondary">
                        Keep the momentum going and upload another course to study.
                    </p>
                </div>
                <Link
                    to="/dashboard"
                    className="btn-primary inline-flex min-h-11 items-center gap-2 whitespace-nowrap text-body-sm"
                >
                    Upload Another Course
                    <AppIcon name="arrow_forward" className="text-[18px]" />
                </Link>
            </div>
        </div>
    </section>
);

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
        <section className="w-full max-w-2xl mx-auto">
            <div className="card-base p-5">
                <div className="flex flex-col items-center text-center gap-3">
                    <p className="text-body-base font-semibold text-text-main-light dark:text-text-main-dark">
                        Nice score! Challenge your friends
                    </p>
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark">
                        Share your result and invite a friend to study with ChewnPour.
                    </p>
                    <div className="flex gap-3 mt-1">
                        <button
                            type="button"
                            onClick={handleShareWhatsApp}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#25D366] text-white text-body-sm font-semibold hover:brightness-110 transition-all"
                        >
                            <svg className="size-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.611.611l4.458-1.495A11.952 11.952 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.291 0-4.42-.658-6.237-1.794l-.435-.27-2.642.886.886-2.642-.27-.435A9.956 9.956 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/></svg>
                            Share on WhatsApp
                        </button>
                        <button
                            type="button"
                            onClick={handleShareTelegram}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0088cc] text-white text-body-sm font-semibold hover:brightness-110 transition-all"
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
        easy: 'bg-accent-emerald/10 text-accent-emerald border-accent-emerald/20',
        medium: 'bg-accent-amber/10 text-accent-amber border-accent-amber/20',
        hard: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    };

    return (
        <div className="mt-4 flex flex-wrap gap-2 justify-center">
            {pills.map(([d, v]) => (
                <span key={d} className={`text-caption font-semibold px-3 py-1 rounded-full border ${colors[d]}`}>
                    {DIFFICULTY_LABELS[d]}: {v.correct}/{v.total}
                </span>
            ))}
        </div>
    );
};

// ─── Bloom level breakdown helpers ───────────────────────────────────────────

const BLOOM_LABELS = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'];

const BLOOM_COLORS = {
    Remember: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    Understand: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
    Apply: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    Analyze: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
    Evaluate: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    Create: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
};

const buildBloomBreakdown = (answers) => {
    const buckets = {};
    for (const a of answers) {
        if (a.skipped) continue;
        const bloom = String(a.bloomLevel || '').trim();
        if (!bloom) continue;
        if (!buckets[bloom]) buckets[bloom] = { correct: 0, total: 0 };
        buckets[bloom].total += 1;
        if (a.isCorrect) buckets[bloom].correct += 1;
    }
    return buckets;
};

const BloomBreakdown = ({ answers }) => {
    const breakdown = buildBloomBreakdown(answers);
    const pills = BLOOM_LABELS.filter((l) => breakdown[l]?.total > 0);
    if (pills.length === 0) return null;

    return (
        <div className="mt-3 flex flex-wrap gap-2 justify-center">
            {pills.map((level) => {
                const { correct, total } = breakdown[level];
                return (
                    <span key={level} className={`text-caption font-semibold px-3 py-1 rounded-full border ${BLOOM_COLORS[level] || ''}`}>
                        {level}: {correct}/{total}
                    </span>
                );
            })}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
            {strengths.length > 0 && (
                <div className="card-base p-4 border-accent-emerald/20 bg-accent-emerald/5 dark:bg-accent-emerald/10">
                    <div className="flex items-center gap-2 mb-3">
                        <AppIcon name="thumb_up" className="text-accent-emerald text-[18px]" />
                        <span className="text-overline text-accent-emerald">Your Strengths</span>
                    </div>
                    <ul className="space-y-2">
                        {strengths.map((a) => (
                            <li key={a.questionId || a.questionText} className="text-caption text-text-sub-light dark:text-text-sub-dark leading-snug">
                                {truncate(a.questionText)}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {focusAreas.length > 0 && (
                <div className="card-base p-4 border-accent-amber/20 bg-accent-amber/5 dark:bg-accent-amber/10">
                    <div className="flex items-center gap-2 mb-3">
                        <AppIcon name="target" className="text-accent-amber text-[18px]" />
                        <span className="text-overline text-accent-amber">Focus Areas</span>
                    </div>
                    <ul className="space-y-2">
                        {focusAreas.map((a) => (
                            <li key={a.questionId || a.questionText} className="text-caption text-text-sub-light dark:text-text-sub-dark leading-snug">
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
    'Not Ready': 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    'Almost Ready': 'bg-accent-amber/10 text-accent-amber border-accent-amber/20',
    Ready: 'bg-primary/10 text-primary border-primary/20',
    'Exam Ready': 'bg-purple-100 text-purple-700 border-purple-200',
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

const tutorFeedbackReducer = (state, action) => {
    switch (action.type) {
        case 'loaded':
            return {
                generatedFeedback: action.feedback,
                error: false,
                loading: false,
            };
        case 'failed':
            return {
                ...state,
                error: true,
                loading: false,
            };
        default:
            return state;
    }
};

const buildHeuristicTutorFeedback = (attempt) => {
    const percentage = Number(attempt?.percentage || attempt?.percent || 0);
    const topicTitle = attempt?.topicTitle || 'this lesson';
    const incorrect = (attempt?.answers || []).filter((answer) => !answer.isCorrect && !answer.skipped);
    if (percentage >= 85) {
        return `Exam Ready\n\nStrong work on ${topicTitle}. You scored ${percentage}%. Keep reviewing explanations on any misses, then move to another topic while this one is fresh.`;
    }
    if (percentage >= 70) {
        return `Almost Ready\n\nYou scored ${percentage}% on ${topicTitle}. Review the incorrect questions below, then retry once to lock in the weak spots.`;
    }
    if (incorrect.length > 0) {
        return `Not Ready\n\nYou scored ${percentage}% on ${topicTitle}. Focus first on the ${incorrect.length} missed question${incorrect.length === 1 ? '' : 's'} in the review list, then retake the quiz.`;
    }
    return `Ready\n\nYou finished ${topicTitle} at ${percentage}%. Review the question list once, then decide whether to retry or continue to the next lesson.`;
};

const TutorReport = ({ attemptId, storedFeedback, attempt }) => {
    const normalizedStoredFeedback = typeof storedFeedback === 'string'
        ? storedFeedback.trim()
        : '';
    const [{ generatedFeedback, error, loading }, dispatchTutorFeedback] = useReducer(
        tutorFeedbackReducer,
        {
            generatedFeedback: null,
            error: false,
            loading: Boolean(attemptId && !normalizedStoredFeedback),
        },
    );
    const feedback = normalizedStoredFeedback || generatedFeedback;

    useEffect(() => {
        if (!attemptId || normalizedStoredFeedback || generatedFeedback !== null) return undefined;
        if (feedbackInFlight.has(attemptId)) return undefined;
        feedbackInFlight.add(attemptId);
        let cancelled = false;
        Promise.resolve()
            .then(() => buildHeuristicTutorFeedback(attempt))
            .then((text) => {
                feedbackInFlight.delete(attemptId);
                if (cancelled) return;
                const normalized = String(text || '').trim();
                dispatchTutorFeedback({ type: 'loaded', feedback: normalized || null });
            })
            .catch((err) => {
                console.error('[TutorReport] Tutor feedback preparation did not complete:', err);
                feedbackInFlight.delete(attemptId);
                if (!cancelled) {
                    dispatchTutorFeedback({ type: 'failed' });
                }
            });
        return () => {
            cancelled = true;
        };
    }, [attemptId, attempt, normalizedStoredFeedback, generatedFeedback]);

    const readinessLabel = feedback ? extractReadinessLabel(feedback) : null;

    return (
        <div className="w-full max-w-2xl card-base overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border-light dark:border-border-dark">
                <div className="flex items-center gap-2">
                    <AppIcon name="psychology" className="text-primary text-[20px]" />
                    <span className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark">Personal Tutor</span>
                </div>
                {/* #19 — only show badge when label is actually extracted */}
                {readinessLabel && READINESS_BADGE[readinessLabel] && (
                    <span className={`text-caption font-semibold px-3 py-1 rounded-full border ${READINESS_BADGE[readinessLabel]}`}>
                        {readinessLabel}
                    </span>
                )}
            </div>
            <div className="p-5">
                {loading && (
                    <div className="space-y-4 animate-pulse">
                        <div className="space-y-2">
                            <div className="h-3 bg-border-light dark:bg-border-dark rounded w-full"></div>
                            <div className="h-3 bg-border-light dark:bg-border-dark rounded w-11/12"></div>
                            <div className="h-3 bg-border-light dark:bg-border-dark rounded w-4/5"></div>
                        </div>
                        <div className="space-y-2">
                            <div className="h-3 bg-border-light dark:bg-border-dark rounded w-full"></div>
                            <div className="h-3 bg-border-light dark:bg-border-dark rounded w-5/6"></div>
                        </div>
                    </div>
                )}
                {!loading && feedback && (
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark leading-relaxed whitespace-pre-line break-words overflow-hidden">{feedback}</p>
                )}
                {!loading && !feedback && error && (
                    <p className="text-body-sm text-accent-amber">Tutor feedback is still getting ready. Please refresh the page.</p>
                )}
                {!loading && !feedback && !error && (
                    <p className="text-body-sm text-text-faint-light dark:text-text-faint-dark">Tutor feedback unavailable for this attempt.</p>
                )}
            </div>
        </div>
    );
};

// ─── Main component ───────────────────────────────────────────────────────────

// react-doctor-disable-next-line react-doctor/no-giant-component
const DashboardResults = () => {
    const { attemptId } = useParams();
    const { profile } = useAuth();
    const [attempt, setAttempt] = useState(undefined);
    const [showConfetti, setShowConfetti] = useState(false);
    const confettiTriggeredRef = useRef(false);

    useEffect(() => {
        if (!attemptId) {
            setAttempt(null);
            return undefined;
        }
        let cancelled = false;
        setAttempt(undefined);
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

    // Compute percentage early for confetti hook (must be before any early return)
    const rawPercentage = attempt && typeof attempt === 'object'
        ? (typeof attempt.percentage === 'number'
            ? attempt.percentage
            : ((attempt.answers?.length || attempt.totalQuestions || 0) > 0
                ? Math.round(((attempt.score || 0) / (attempt.answers?.length || attempt.totalQuestions || 0)) * 100)
                : 0))
        : 0;

    // Trigger confetti on good scores (≥70%) once per page load
    useEffect(() => {
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
    }, [rawPercentage]);

    if (!attemptId) {
        return (
            <div className="bg-background-light min-h-screen flex items-center justify-center">
                <div className="text-center max-w-md px-6">
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
            <div className="bg-background-light min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full size-10 border-2 border-border-light dark:border-border-dark border-t-primary mx-auto mb-4"></div>
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark">Loading quiz results…</p>
                </div>
            </div>
        );
    }

    if (attempt === null) {
        return (
            <div className="bg-background-light min-h-screen flex items-center justify-center">
                <div className="text-center max-w-md px-6">
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

    const answers = attempt.answers || [];
    const isEssay = isEssayFormat(attempt.examFormat);
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
        <div className="bg-background-light min-h-screen flex flex-col">
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

            <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center gap-6 px-4 py-8 pb-24 md:px-8 md:pb-12">
                {/* Score card */}
                <section className="w-full max-w-2xl">
                    <div className="flex flex-col items-center rounded-[28px] border border-border-subtle bg-surface p-8 text-center shadow-sm">
                        <h2 className="mb-4 text-caption font-semibold uppercase tracking-[0.06em] text-text-muted">Overall Score</h2>
                        <div className="mb-2 flex items-baseline justify-center gap-1">
                            <span className="font-display text-display-xl font-bold text-text-primary">{percentage}</span>
                            <span className="font-display text-display-sm text-text-muted">/100</span>
                        </div>
                        <div className="text-body-sm text-text-secondary">
                            {isEssay
                                ? `${totalQuestions} essay question${totalQuestions !== 1 ? 's' : ''} — quality score`
                                : `${attempt.score} correct out of ${totalQuestions}`}
                        </div>
                        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                            <span className="rounded-full bg-success-soft px-3 py-1 text-caption font-semibold text-success">
                                {attempt.score} {isEssay ? 'Pass' : 'Correct'}
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
                        {answers.length > 0 && <DifficultyPills answers={answers} />}
                        {answers.length > 0 && <BloomBreakdown answers={answers} />}
                    </div>
                </section>

                {/* Score Breakdown Widgets */}
                <section className="w-full max-w-2xl">
                    <WatermelonWidgetsGrid cols={isEssay ? 2 : 4}>
                        <WatermelonWidget
                            title="Score"
                            value={`${percentage}%`}
                            icon="percent"
                            accent={percentage >= 70 ? 'emerald' : percentage >= 50 ? 'amber' : 'rose'}
                        />
                        {!isEssay && (
                            <WatermelonWidget
                                title="Correct"
                                value={correctCount}
                                subtitle={`of ${totalQuestions}`}
                                icon="check_circle"
                                accent="emerald"
                            />
                        )}
                        {!isEssay && incorrectCount > 0 && (
                            <WatermelonWidget
                                title="Incorrect"
                                value={incorrectCount}
                                icon="cancel"
                                accent="rose"
                            />
                        )}
                        {!isEssay && skippedCount > 0 && (
                            <WatermelonWidget
                                title="Skipped"
                                value={skippedCount}
                                icon="skip_next"
                                accent="amber"
                            />
                        )}
                        {isEssay && (
                            <WatermelonWidget
                                title="Questions"
                                value={totalQuestions}
                                subtitle="essay format"
                                icon="edit_note"
                                accent="primary"
                            />
                        )}
                    </WatermelonWidgetsGrid>
                </section>

                {/* Share prompt for high scores */}
                <PostQuizSharePrompt percentage={percentage} topicTitle={attempt.topicTitle} profile={profile} />

                {/* Strengths and Focus Areas */}
                {answers.length > 0 && (
                    <section className="w-full flex justify-center">
                        <StrengthsAndFocus answers={answers} />
                    </section>
                )}

                {/* Tutor Report */}
                <section className="w-full flex justify-center">
                    <TutorReport key={attemptId} attemptId={attemptId} storedFeedback={attempt.tutorFeedback} attempt={attempt} />
                </section>

                {/* Next Steps Guidance */}
                <section className="w-full max-w-2xl">
                    <div className="rounded-[24px] border border-border-subtle bg-surface p-5 shadow-sm">
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

                {/* Post-quiz action buttons */}
                <section className="w-full max-w-2xl">
                    <div className="flex flex-col gap-3 sm:flex-row">
                        <Link
                            to={`/dashboard/topic/${attempt.topicId}`}
                            className="btn-primary inline-flex min-h-11 flex-1 items-center justify-center gap-2 text-body-sm"
                        >
                            <AppIcon name="menu_book" className="text-[18px]" />
                            <span>Review weak topics</span>
                        </Link>
                        <Link
                            to={`/dashboard/quiz/${attempt.topicId}?autostart=mcq`}
                            className="btn-secondary inline-flex min-h-11 flex-1 items-center justify-center gap-2 text-body-sm"
                        >
                            <AppIcon name="refresh" className="text-[18px]" />
                            <span>Generate another quiz</span>
                        </Link>
                    </div>
                </section>

                {/* Question Review */}
                <section className="w-full max-w-4xl">
                    <h3 className="mb-3 text-caption font-semibold uppercase tracking-[0.06em] text-text-muted">Question Review</h3>

                    {answers.length === 0 ? (
                        <div className="rounded-[24px] border border-border-subtle bg-surface p-6 shadow-sm">
                            <p className="text-body-sm text-text-secondary">No answers recorded for this attempt.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                            {answers.map((answer, index) => {
                                const questionText = answer.questionText || `Question ${index + 1}`;
                                const questionType = normalizeQuestionType(answer.questionType);
                                const yourAnswerText = getOptionText(answer.options, answer.selectedAnswer) || 'Not answered';
                                const correctAnswerText = getOptionText(answer.options, answer.correctAnswer) || answer.correctAnswer;
                                const isFillBlank = questionType === QUESTION_TYPE_FILL_BLANK;
                                const isCorrect = Boolean(answer.isCorrect);
                                const hasEssayFeedback = isEssay && Boolean(answer.feedback);
                                return (
                                    <div key={answer.questionId || answer.questionText} className="rounded-[24px] border border-border-subtle bg-surface p-5 shadow-sm">
                                        <div className="flex justify-between items-center mb-3">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-overline text-text-faint-light dark:text-text-faint-dark">Question {index + 1}</span>
                                                <span className="text-caption text-text-faint-light dark:text-text-faint-dark">{answer.difficulty || 'Medium'}</span>
                                                {answer.bloomLevel && BLOOM_COLORS[answer.bloomLevel] && (
                                                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${BLOOM_COLORS[answer.bloomLevel]}`}>
                                                        {answer.bloomLevel}
                                                    </span>
                                                )}
                                            </div>
                                            <span className={`text-caption font-semibold px-2.5 py-1 rounded-md border ${
                                                answer.skipped
                                                    ? 'bg-surface-hover-light dark:bg-surface-hover-dark text-text-faint-light dark:text-text-faint-dark border-border-light dark:border-border-dark'
                                                    : isCorrect
                                                        ? 'bg-accent-emerald/10 text-accent-emerald border-accent-emerald/20'
                                                        : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                                                }`}>
                                                {answer.skipped ? 'Skipped' : hasEssayFeedback ? (isCorrect ? 'Pass' : 'Needs Work') : (isCorrect ? 'Correct' : 'Incorrect')}
                                            </span>
                                        </div>
                                        <p className="text-body-base text-text-main-light dark:text-text-main-dark leading-relaxed">
                                            {questionText}
                                        </p>
                                        {answer.learningObjective && (
                                            <p className="text-caption text-text-faint-light dark:text-text-faint-dark mt-1 mb-5 leading-snug">
                                                <span className="font-medium">Objective:</span> {answer.learningObjective}
                                            </p>
                                        )}
                                        {!answer.learningObjective && <div className="mb-5" />}

                                        {/* Essay answer display */}
                                        {hasEssayFeedback ? (
                                            <div className="space-y-3 mb-5">
                                                <div className={`p-4 rounded-xl border ${isCorrect
                                                    ? 'bg-accent-emerald/5 dark:bg-accent-emerald/10 border-accent-emerald/20'
                                                    : 'bg-red-500/5 dark:bg-red-500/10 border-red-500/20'
                                                    }`}>
                                                    <span className={`text-overline block mb-2 ${isCorrect ? 'text-accent-emerald' : 'text-red-600 dark:text-red-400'}`}>
                                                        Your Answer
                                                    </span>
                                                    <p className="text-body-sm text-text-main-light dark:text-text-main-dark whitespace-pre-wrap leading-relaxed">{answer.selectedAnswer || 'Not answered'}</p>
                                                </div>

                                                {/* Per-criterion rubric feedback */}
                                                {Array.isArray(answer.criteriaFeedback) && answer.criteriaFeedback.length > 0 ? (
                                                    <div className="p-4 rounded-xl bg-primary/5 dark:bg-primary/10 border border-primary/20 space-y-3">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <AppIcon name="rubric" className="text-primary text-[20px]" />
                                                            <span className="text-overline text-primary">Rubric Assessment</span>
                                                        </div>
                                                        {answer.criteriaFeedback.map((cf, cfIdx) => (
                                                            <div key={cfIdx} className="flex items-start gap-3 pl-1">
                                                                <span className={`flex-shrink-0 size-7 rounded-lg text-caption font-bold flex items-center justify-center ${
                                                                    cf.score >= 4 ? 'bg-accent-emerald/15 text-accent-emerald'
                                                                        : cf.score >= 3 ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                                                        : 'bg-red-500/15 text-red-600 dark:text-red-400'
                                                                }`}>{cf.score}</span>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-body-sm font-medium text-text-main-light dark:text-text-main-dark">{cf.criterion}</p>
                                                                    {cf.feedback && <p className="text-caption text-text-sub-light dark:text-text-sub-dark mt-0.5">{cf.feedback}</p>}
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {answer.feedback && (
                                                            <div className="pt-2 border-t border-primary/10">
                                                                <p className="text-body-sm text-text-main-light dark:text-text-main-dark">{answer.feedback}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 dark:bg-primary/10 border border-primary/20">
                                                        <AppIcon name="psychology" className="text-primary mt-0.5 text-[20px]" />
                                                        <div className="flex-1">
                                                            <span className="text-overline text-primary block mb-1">AI Feedback</span>
                                                            <span className="text-body-sm text-text-main-light dark:text-text-main-dark">{answer.feedback}</span>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Model answer for learning */}
                                                {answer.correctAnswer && (
                                                    <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 dark:bg-primary/10 border border-primary/20">
                                                        <AppIcon name="school" className="text-primary mt-0.5 text-[20px]" />
                                                        <div className="flex-1">
                                                            <span className="text-overline text-primary block mb-1">Model Answer</span>
                                                            <span className="text-body-sm text-text-main-light dark:text-text-main-dark">{answer.correctAnswer}</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            /* Objective answer display */
                                            <div className="space-y-3 mb-5">
                                                <div className={`flex items-start gap-3 p-4 rounded-xl border ${
                                                    answer.skipped
                                                        ? 'bg-surface-hover-light dark:bg-surface-hover-dark border-border-light dark:border-border-dark'
                                                        : isCorrect
                                                            ? 'bg-accent-emerald/5 dark:bg-accent-emerald/10 border-accent-emerald/20'
                                                            : 'bg-red-500/5 dark:bg-red-500/10 border-red-500/20'
                                                    }`}>
                                                    <AppIcon name={answer.skipped ? 'remove_circle_outline' : isCorrect ? 'check_circle' : 'cancel'} />
                                                    <div className="flex-1">
                                                        <span className={`text-overline block mb-1 ${
                                                            answer.skipped ? 'text-text-faint-light dark:text-text-faint-dark' : isCorrect ? 'text-accent-emerald' : 'text-red-600 dark:text-red-400'
                                                        }`}>
                                                            {answer.skipped ? 'Skipped' : 'Your Answer'}
                                                        </span>
                                                        <span className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark">
                                                            {answer.skipped
                                                                ? 'No answer selected'
                                                                : isFillBlank
                                                                    ? (answer.selectedAnswer || 'Not answered')
                                                                    : yourAnswerText}
                                                        </span>
                                                    </div>
                                                </div>
                                                {!isCorrect && (
                                                    <div className="flex items-start gap-3 p-4 rounded-xl bg-accent-emerald/5 dark:bg-accent-emerald/10 border border-accent-emerald/20">
                                                        <AppIcon name="check_circle" className="text-accent-emerald mt-0.5 text-[20px]" />
                                                        <div className="flex-1">
                                                            <span className="text-overline text-accent-emerald block mb-1">Correct Answer</span>
                                                            <span className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark">
                                                                {isFillBlank ? (answer.correctAnswer || 'Not available') : correctAnswerText}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {answer.explanation && (
                                            <div className="text-body-sm text-text-sub-light dark:text-text-sub-dark leading-relaxed bg-surface-hover-light dark:bg-surface-hover-dark p-4 rounded-xl border border-border-light dark:border-border-dark">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <AppIcon name="lightbulb" className="text-primary text-[18px]" />
                                                    <span className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark">Why?</span>
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
