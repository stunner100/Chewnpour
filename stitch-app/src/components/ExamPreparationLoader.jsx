import { useState, useEffect, useRef, useMemo, memo } from 'react';

/**
 * Gamified preparation loader for exams and fill-in exercises.
 *
 * Props:
 *   mode        – 'exam' | 'fill_in'  (default: 'exam')
 *   examFormat  – 'mcq' | 'essay'     (only used when mode='exam')
 *   title       – optional heading override
 *   subtitle    – optional subheading override
 *   failed      – boolean
 *   errorMsg    – string
 *   onRetry     – () => void
 *   onBack      – () => void
 *   isSessionExpired – boolean
 */

/* ── stage pipelines ───────────────────────────────────────────── */
const EXAM_STAGES = [
    { key: 'recall', label: 'Reviewing your history', icon: 'history', durationMs: 4_000, encouragement: 'Checking what you already know...' },
    { key: 'blueprint', label: 'Building the blueprint', icon: 'architecture', durationMs: 6_000, encouragement: 'Mapping out the perfect challenge for you' },
    { key: 'generate', label: 'Crafting questions', icon: 'edit_note', durationMs: 12_000, encouragement: 'Our AI is writing questions tailored to your level' },
    { key: 'quality', label: 'Quality check', icon: 'verified', durationMs: 8_000, encouragement: 'Making sure every question is fair and clear' },
    { key: 'finalize', label: 'Locking in your questions', icon: 'lock', durationMs: null, encouragement: 'Almost there — finalizing your exam' },
];

const FILL_IN_STAGES = [
    { key: 'evidence', label: 'Scanning your notes', icon: 'description', durationMs: 3_000, encouragement: 'Finding the key concepts from your material...' },
    { key: 'generate', label: 'Creating fill-in sentences', icon: 'edit_note', durationMs: 6_000, encouragement: 'Turning concepts into interactive challenges' },
    { key: 'verify', label: 'Verifying accuracy', icon: 'fact_check', durationMs: 4_000, encouragement: 'Making sure every blank is grounded in your notes' },
    { key: 'finalize', label: 'Preparing your exercise', icon: 'emoji_objects', durationMs: null, encouragement: 'Almost ready — finalizing your fill-ins' },
];

const EXAM_ETA_SEC = 30;
const FILL_IN_ETA_SEC = 15;

const EXAM_FUN_FACTS = [
    'Students who take practice exams score 20-30% higher on average.',
    'Spaced repetition can boost retention by up to 200%.',
    'The testing effect: retrieving information strengthens memory more than re-reading.',
    'Your brain forms stronger connections when actively challenged.',
    'AI-generated exams adapt to your weak spots for maximum learning.',
    'Even getting an answer wrong helps you remember the right one later.',
];

const FILL_IN_FUN_FACTS = [
    'Fill-in exercises activate deeper recall than multiple choice.',
    'Active retrieval practice strengthens long-term memory by up to 50%.',
    'Your brain treats blank-filling like a puzzle — engagement goes up.',
    'Students who practice recall outperform those who only re-read by 2x.',
    'Context clues in fill-ins train you to think like the examiner.',
    'Each blank you fill correctly reinforces the neural pathway for that concept.',
];

const resolveConfig = (mode) => {
    if (mode === 'fill_in') {
        return { stages: FILL_IN_STAGES, funFacts: FILL_IN_FUN_FACTS, etaSec: FILL_IN_ETA_SEC };
    }
    return { stages: EXAM_STAGES, funFacts: EXAM_FUN_FACTS, etaSec: EXAM_ETA_SEC };
};

const computeTotalTimedMs = (stages) => stages.reduce((s, st) => s + (st.durationMs || 0), 0);

/* ── component ─────────────────────────────────────────────────── */
const ExamPreparationLoader = memo(function ExamPreparationLoader({
    mode = 'exam',
    examFormat = 'mcq',
    title,
    subtitle,
    failed = false,
    errorMsg = '',
    onRetry,
    onBack,
    isSessionExpired = false,
}) {
    const { stages, funFacts, etaSec } = useMemo(() => resolveConfig(mode), [mode]);
    const totalTimedMs = useMemo(() => computeTotalTimedMs(stages), [stages]);

    const [activeStage, setActiveStage] = useState(0);
    const [stageProgress, setStageProgress] = useState(0);
    const [elapsedMs, setElapsedMs] = useState(0);
    const [funFactIdx, setFunFactIdx] = useState(() => Math.floor(Math.random() * funFacts.length));
    const startTime = useRef(Date.now());
    const rafRef = useRef(null);

    const resolvedTitle = title || (mode === 'fill_in' ? 'Preparing Fill-ins' : 'Preparing Your Exam');
    const resolvedSubtitle = subtitle || (mode === 'fill_in'
        ? 'Generating fill-in exercises from your notes'
        : `Generating your ${examFormat === 'essay' ? 'essay' : 'objective'} exam from this topic`);
    const failedTitle = mode === 'fill_in' ? 'Fill-in Generation Failed' : 'Exam Preparation Failed';

    // Main animation loop
    useEffect(() => {
        if (failed) return;
        const tick = () => {
            const elapsed = Date.now() - startTime.current;
            setElapsedMs(elapsed);

            let accumulated = 0;
            let currentStage = stages.length - 1;
            let progressInStage = 100;

            for (let i = 0; i < stages.length; i++) {
                const dur = stages[i].durationMs;
                if (dur === null) {
                    currentStage = i;
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
        return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    }, [failed, stages]);

    // Rotate fun facts
    useEffect(() => {
        if (failed) return;
        const interval = setInterval(() => {
            setFunFactIdx((prev) => (prev + 1) % funFacts.length);
        }, 8_000);
        return () => clearInterval(interval);
    }, [failed, funFacts.length]);

    const overallProgress = useMemo(() => {
        let completed = 0;
        for (let i = 0; i < activeStage; i++) completed += stages[i].durationMs || 0;
        const currentDur = stages[activeStage]?.durationMs;
        completed += currentDur
            ? (stageProgress / 100) * currentDur
            : (stageProgress / 100) * 5_000;
        return Math.min(99, (completed / (totalTimedMs + 5_000)) * 100);
    }, [activeStage, stageProgress, stages, totalTimedMs]);

    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    const displayMinutes = String(Math.floor(elapsedSeconds / 60)).padStart(1, '0');
    const displaySeconds = String(elapsedSeconds % 60).padStart(2, '0');
    const remainingSec = Math.max(0, etaSec - elapsedSeconds);
    const etaLabel = remainingSec > 0 ? `~${remainingSec}s remaining` : 'Finishing up...';

    const currentStageData = stages[activeStage] || stages[stages.length - 1];

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
                            {failedTitle}
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
                                            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
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
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-primary/[0.04] blur-[100px] pointer-events-none" />

            <div className="w-full max-w-md relative z-10">
                <div className="text-center mb-8">
                    <div className="relative w-24 h-24 mx-auto mb-6">
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
                        <div className="absolute inset-3 rounded-full bg-primary/10 flex items-center justify-center transition-all duration-500">
                            <span key={currentStageData.key} className="material-symbols-outlined text-3xl text-primary animate-fade-in">
                                {currentStageData.icon}
                            </span>
                        </div>
                    </div>

                    <h2 className="text-display-sm text-text-main-light dark:text-text-main-dark mb-1.5">
                        {resolvedTitle}
                    </h2>
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark">
                        {resolvedSubtitle}
                    </p>
                </div>

                <div className="card-base p-6">
                    <div className="mb-5">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-caption font-semibold text-text-main-light dark:text-text-main-dark">
                                Step {activeStage + 1} of {stages.length}
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

                    <div className="space-y-1">
                        {stages.map((stage, idx) => {
                            const isDone = idx < activeStage;
                            const isActive = idx === activeStage;
                            return (
                                <div
                                    key={stage.key}
                                    className={`flex items-center gap-3 py-2 px-3 rounded-xl transition-all duration-300 ${isActive ? 'bg-primary/[0.06]' : ''}`}
                                >
                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all duration-300 ${isDone ? 'bg-accent-emerald/15' : isActive ? 'bg-primary/15' : 'bg-transparent'}`}>
                                        <span className={`material-symbols-outlined text-[18px] transition-all duration-300 ${isDone ? 'text-accent-emerald' : isActive ? 'text-primary' : 'text-text-faint-light dark:text-text-faint-dark opacity-40'}`}>
                                            {isDone ? 'check_circle' : isActive ? stage.icon : 'radio_button_unchecked'}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-body-sm transition-colors duration-300 ${isDone ? 'text-text-faint-light dark:text-text-faint-dark line-through decoration-text-faint-light/30 dark:decoration-text-faint-dark/30' : isActive ? 'text-text-main-light dark:text-text-main-dark font-medium' : 'text-text-faint-light dark:text-text-faint-dark opacity-60'}`}>
                                            {stage.label}
                                        </p>
                                        {isActive && (
                                            <div className="mt-1.5 h-1 rounded-full bg-border-light dark:bg-border-dark overflow-hidden">
                                                <div className="h-full rounded-full bg-primary/60 transition-all duration-200 ease-out" style={{ width: `${stageProgress}%` }} />
                                            </div>
                                        )}
                                    </div>
                                    {isDone && (
                                        <span className="text-[10px] font-semibold text-accent-emerald uppercase tracking-wider">Done</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="mt-5 text-center space-y-3">
                    <p key={currentStageData.key} className="text-body-sm text-text-sub-light dark:text-text-sub-dark animate-fade-in">
                        {currentStageData.encouragement}
                    </p>
                    <div className="flex items-start gap-2 justify-center px-4">
                        <span className="material-symbols-outlined text-[14px] text-primary/60 mt-0.5 shrink-0">lightbulb</span>
                        <p key={funFactIdx} className="text-caption text-text-faint-light dark:text-text-faint-dark leading-relaxed text-left animate-fade-in">
                            {funFacts[funFactIdx]}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
});

export default ExamPreparationLoader;
