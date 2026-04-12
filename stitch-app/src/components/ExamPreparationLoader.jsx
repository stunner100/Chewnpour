import { useState, useEffect, useRef, useMemo, memo } from 'react';

/**
 * Gamified exam preparation loader.
 *
 * Simulates a multi-stage pipeline with realistic ETA per stage. The backend
 * call (`startExamAttempt`) is a single awaited action that takes 15-45 s on
 * average, but the user sees a 5-step journey that auto-advances on timed
 * intervals calibrated to cover the typical 25-35 s window.  If the backend
 * finishes early the parent unmounts this component; if it runs long, the
 * last stage ("Locking in your questions") holds with a gentle pulse.
 *
 * Props:
 *   examFormat  – 'mcq' | 'essay'
 *   failed      – boolean  (true → show error state)
 *   errorMsg    – string   (shown when failed)
 *   onRetry     – () => void
 *   onBack      – () => void
 *   isSessionExpired – boolean (show sign-in instead of retry)
 */

/* ── stage pipeline ────────────────────────────────────────────── */
const STAGES = [
    {
        key: 'recall',
        label: 'Reviewing your history',
        icon: 'history',
        durationMs: 4_000,
        encouragement: 'Checking what you already know...',
    },
    {
        key: 'blueprint',
        label: 'Building the blueprint',
        icon: 'architecture',
        durationMs: 6_000,
        encouragement: 'Mapping out the perfect challenge for you',
    },
    {
        key: 'generate',
        label: 'Crafting questions',
        icon: 'edit_note',
        durationMs: 12_000,
        encouragement: 'Our AI is writing questions tailored to your level',
    },
    {
        key: 'quality',
        label: 'Quality check',
        icon: 'verified',
        durationMs: 8_000,
        encouragement: 'Making sure every question is fair and clear',
    },
    {
        key: 'finalize',
        label: 'Locking in your questions',
        icon: 'lock',
        durationMs: null, // holds until parent unmounts
        encouragement: 'Almost there — finalizing your exam',
    },
];

const TOTAL_TIMED_MS = STAGES.reduce((s, st) => s + (st.durationMs || 0), 0); // ~30 s

/* ── fun facts shown while waiting ─────────────────────────────── */
const FUN_FACTS = [
    'Students who take practice exams score 20-30% higher on average.',
    'Spaced repetition can boost retention by up to 200%.',
    'The testing effect: retrieving information strengthens memory more than re-reading.',
    'Your brain forms stronger connections when actively challenged.',
    'AI-generated exams adapt to your weak spots for maximum learning.',
    'Even getting an answer wrong helps you remember the right one later.',
];

/* ── component ─────────────────────────────────────────────────── */
const ExamPreparationLoader = memo(function ExamPreparationLoader({
    examFormat = 'mcq',
    failed = false,
    errorMsg = '',
    onRetry,
    onBack,
    isSessionExpired = false,
}) {
    const [activeStage, setActiveStage] = useState(0);
    const [stageProgress, setStageProgress] = useState(0); // 0-100 within current stage
    const [elapsedMs, setElapsedMs] = useState(0);
    const [funFactIdx, setFunFactIdx] = useState(() => Math.floor(Math.random() * FUN_FACTS.length));
    const startTime = useRef(Date.now());
    const rafRef = useRef(null);

    const examLabel = examFormat === 'essay' ? 'essay' : 'objective';

    // Main animation loop — drives stage transitions + progress bar
    useEffect(() => {
        if (failed) return;

        const tick = () => {
            const now = Date.now();
            const elapsed = now - startTime.current;
            setElapsedMs(elapsed);

            // Walk through timed stages
            let accumulated = 0;
            let currentStage = STAGES.length - 1; // default to last (hold) stage
            let progressInStage = 100;

            for (let i = 0; i < STAGES.length; i++) {
                const dur = STAGES[i].durationMs;
                if (dur === null) {
                    // Hold stage — we've reached it
                    currentStage = i;
                    // Slow asymptotic progress (never hits 100)
                    const timeInHold = elapsed - accumulated;
                    progressInStage = Math.min(95, (timeInHold / (timeInHold + 15_000)) * 100);
                    break;
                }
                if (elapsed < accumulated + dur) {
                    currentStage = i;
                    progressInStage = ((elapsed - accumulated) / dur) * 100;
                    break;
                }
                accumulated += dur;
            }

            setActiveStage(currentStage);
            setStageProgress(Math.min(100, Math.max(0, progressInStage)));

            rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [failed]);

    // Rotate fun facts every 8 s
    useEffect(() => {
        if (failed) return;
        const interval = setInterval(() => {
            setFunFactIdx((prev) => (prev + 1) % FUN_FACTS.length);
        }, 8_000);
        return () => clearInterval(interval);
    }, [failed]);

    // Overall progress (0-100) across all stages
    const overallProgress = useMemo(() => {
        let completed = 0;
        for (let i = 0; i < activeStage; i++) {
            completed += STAGES[i].durationMs || 0;
        }
        const currentDur = STAGES[activeStage]?.durationMs;
        if (currentDur) {
            completed += (stageProgress / 100) * currentDur;
        } else {
            // Hold stage — use stageProgress scaled to a small residual
            completed += (stageProgress / 100) * 5_000;
        }
        return Math.min(99, (completed / (TOTAL_TIMED_MS + 5_000)) * 100);
    }, [activeStage, stageProgress]);

    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    const displayMinutes = String(Math.floor(elapsedSeconds / 60)).padStart(1, '0');
    const displaySeconds = String(elapsedSeconds % 60).padStart(2, '0');

    // Estimated remaining
    const estimatedTotalSec = 30;
    const remainingSec = Math.max(0, estimatedTotalSec - elapsedSeconds);
    const etaLabel = remainingSec > 0 ? `~${remainingSec}s remaining` : 'Finishing up...';

    const currentStageData = STAGES[activeStage] || STAGES[STAGES.length - 1];

    /* ── failed state ──────────────────────────────────────────── */
    if (failed) {
        return (
            <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center p-4">
                <div className="w-full max-w-md">
                    <div className="card-base p-8 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-accent-amber/10 flex items-center justify-center mx-auto mb-4">
                            <span className="material-symbols-outlined text-2xl text-accent-amber">warning</span>
                        </div>
                        <h2 className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark mb-2">
                            Exam Preparation Failed
                        </h2>
                        <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark mb-6">
                            {errorMsg || 'Something went wrong. Please try again.'}
                        </p>
                        <div className="flex gap-3">
                            {isSessionExpired ? (
                                <a href="/login" className="flex-1 btn-primary py-3 flex items-center justify-center gap-2">
                                    <span className="material-symbols-outlined text-[18px]">login</span>
                                    <span>Sign In</span>
                                </a>
                            ) : (
                                <>
                                    <button
                                        onClick={onRetry}
                                        className="flex-1 btn-primary py-3 flex items-center justify-center gap-2"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">refresh</span>
                                        <span>Retry</span>
                                    </button>
                                    {onBack && (
                                        <button
                                            onClick={onBack}
                                            className="btn-secondary px-4 py-3 flex items-center justify-center"
                                        >
                                            <span className="material-symbols-outlined text-[18px]">swap_horiz</span>
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    /* ── loading state ─────────────────────────────────────────── */
    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center p-4 relative overflow-hidden">
            {/* Ambient glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-primary/[0.04] blur-[100px] pointer-events-none" />

            <div className="w-full max-w-md relative z-10">
                <div className="text-center mb-8">
                    {/* Animated icon ring */}
                    <div className="relative w-24 h-24 mx-auto mb-6">
                        {/* Outer spinning ring */}
                        <svg className="absolute inset-0 w-full h-full animate-spin" style={{ animationDuration: '3s' }} viewBox="0 0 96 96">
                            <circle cx="48" cy="48" r="44" fill="none" stroke="currentColor" className="text-border-light dark:text-border-dark" strokeWidth="2" />
                            <circle
                                cx="48" cy="48" r="44" fill="none"
                                stroke="url(#progressGrad)"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeDasharray={`${overallProgress * 2.76} 276`}
                            />
                            <defs>
                                <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="var(--color-primary)" />
                                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.3" />
                                </linearGradient>
                            </defs>
                        </svg>

                        {/* Inner icon — changes per stage */}
                        <div className="absolute inset-3 rounded-full bg-primary/10 flex items-center justify-center transition-all duration-500">
                            <span
                                key={currentStageData.key}
                                className="material-symbols-outlined text-3xl text-primary animate-fade-in"
                            >
                                {currentStageData.icon}
                            </span>
                        </div>
                    </div>

                    {/* Title */}
                    <h2 className="text-display-sm text-text-main-light dark:text-text-main-dark mb-1.5">
                        Preparing Your Exam
                    </h2>
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark">
                        Generating your {examLabel} exam from this topic
                    </p>
                </div>

                {/* Progress card */}
                <div className="card-base p-6">
                    {/* Progress bar */}
                    <div className="mb-5">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-caption font-semibold text-text-main-light dark:text-text-main-dark">
                                Step {activeStage + 1} of {STAGES.length}
                            </span>
                            <span className="text-caption tabular-nums text-text-faint-light dark:text-text-faint-dark">
                                {displayMinutes}:{displaySeconds}
                            </span>
                        </div>
                        <div className="h-2 rounded-full bg-border-light dark:bg-border-dark overflow-hidden">
                            <div
                                className="h-full rounded-full bg-primary transition-all duration-300 ease-out relative"
                                style={{ width: `${overallProgress}%` }}
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                            </div>
                        </div>
                        <p className="mt-1.5 text-[11px] text-text-faint-light dark:text-text-faint-dark text-right tabular-nums">
                            {etaLabel}
                        </p>
                    </div>

                    {/* Stage checklist */}
                    <div className="space-y-1">
                        {STAGES.map((stage, idx) => {
                            const isDone = idx < activeStage;
                            const isActive = idx === activeStage;
                            const isPending = idx > activeStage;

                            return (
                                <div
                                    key={stage.key}
                                    className={`flex items-center gap-3 py-2 px-3 rounded-xl transition-all duration-300 ${
                                        isActive
                                            ? 'bg-primary/[0.06]'
                                            : ''
                                    }`}
                                >
                                    {/* Status icon */}
                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all duration-300 ${
                                        isDone
                                            ? 'bg-accent-emerald/15'
                                            : isActive
                                                ? 'bg-primary/15'
                                                : 'bg-transparent'
                                    }`}>
                                        <span className={`material-symbols-outlined text-[18px] transition-all duration-300 ${
                                            isDone
                                                ? 'text-accent-emerald'
                                                : isActive
                                                    ? 'text-primary'
                                                    : 'text-text-faint-light dark:text-text-faint-dark opacity-40'
                                        }`}>
                                            {isDone ? 'check_circle' : isActive ? stage.icon : 'radio_button_unchecked'}
                                        </span>
                                    </div>

                                    {/* Label + sub-progress */}
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-body-sm transition-colors duration-300 ${
                                            isDone
                                                ? 'text-text-faint-light dark:text-text-faint-dark line-through decoration-text-faint-light/30 dark:decoration-text-faint-dark/30'
                                                : isActive
                                                    ? 'text-text-main-light dark:text-text-main-dark font-medium'
                                                    : 'text-text-faint-light dark:text-text-faint-dark opacity-60'
                                        }`}>
                                            {stage.label}
                                        </p>
                                        {isActive && (
                                            <div className="mt-1.5 h-1 rounded-full bg-border-light dark:bg-border-dark overflow-hidden">
                                                <div
                                                    className="h-full rounded-full bg-primary/60 transition-all duration-200 ease-out"
                                                    style={{ width: `${stageProgress}%` }}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Completion indicator */}
                                    {isDone && (
                                        <span className="text-[10px] font-semibold text-accent-emerald uppercase tracking-wider">Done</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Encouragement + fun fact */}
                <div className="mt-5 text-center space-y-3">
                    <p
                        key={currentStageData.key}
                        className="text-body-sm text-text-sub-light dark:text-text-sub-dark animate-fade-in"
                    >
                        {currentStageData.encouragement}
                    </p>
                    <div className="flex items-start gap-2 justify-center px-4">
                        <span className="material-symbols-outlined text-[14px] text-primary/60 mt-0.5 shrink-0">lightbulb</span>
                        <p
                            key={funFactIdx}
                            className="text-caption text-text-faint-light dark:text-text-faint-dark leading-relaxed text-left animate-fade-in"
                        >
                            {FUN_FACTS[funFactIdx]}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
});

export default ExamPreparationLoader;
