import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import StatusBadge from './StatusBadge';
import MasteryBadge from './MasteryBadge';

// Light gradient palette for module thumbnails. Picked deterministically by
// topic index so each module feels distinct without bespoke artwork.
const GRADIENT_PALETTE = [
    'linear-gradient(135deg, #6c2bd9 0%, #4338ca 100%)',
    'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
    'linear-gradient(135deg, #f59e0b 0%, #db2777 100%)',
    'linear-gradient(135deg, #10b981 0%, #0d9488 100%)',
    'linear-gradient(135deg, #ec4899 0%, #6366f1 100%)',
    'linear-gradient(135deg, #f97316 0%, #b91c1c 100%)',
    'linear-gradient(135deg, #06b6d4 0%, #2563eb 100%)',
    'linear-gradient(135deg, #84cc16 0%, #16a34a 100%)',
];

const initialsFromTitle = (title) => {
    if (!title) return '·';
    const words = String(title)
        .replace(/[_-]+/g, ' ')
        .split(/\s+/)
        .filter(Boolean);
    if (words.length === 0) return '·';
    if (words.length === 1) {
        return words[0].slice(0, 2).toUpperCase();
    }
    return (words[0][0] + words[1][0]).toUpperCase();
};

const PendingModuleCard = ({ index, title }) => (
    <article className="card-base border-dashed p-5 opacity-80 flex flex-col gap-3">
        <div className="flex items-center justify-between">
            <span className="text-overline text-text-faint-light dark:text-text-faint-dark">
                Module {index + 1}
            </span>
            <StatusBadge status="pending" />
        </div>
        <h3 className="text-body-base font-semibold text-text-sub-light dark:text-text-sub-dark line-clamp-2">
            {title}
        </h3>
        <p className="text-caption text-text-faint-light dark:text-text-faint-dark">
            Will appear here as soon as ChewnPour finishes generating it.
        </p>
    </article>
);

const TopicModuleCard = ({
    item,
    progress,
    estimatedMinutes,
    isRecommended,
}) => {
    const topic = item.kind === 'ready' ? item.topic : null;
    const index = item.index;
    const gradient = useMemo(
        () => GRADIENT_PALETTE[index % GRADIENT_PALETTE.length],
        [index],
    );
    const initials = useMemo(
        () => initialsFromTitle(topic?.title),
        [topic?.title],
    );

    if (item.kind === 'pending' || !topic) {
        return <PendingModuleCard index={item.index} title={item.title} />;
    }

    const isCompleted = Boolean(progress?.completedAt);
    const isStarted = Boolean(progress) && !isCompleted;
    const status = isCompleted ? 'completed' : isStarted ? 'in_progress' : 'ready';

    const mcqCount = typeof topic.usableMcqCount === 'number' ? topic.usableMcqCount : 0;
    const assessmentRoute = topic.assessmentRoute || 'topic_quiz';
    const quizReady = assessmentRoute === 'topic_quiz' && mcqCount > 0;
    const isFinalExam = assessmentRoute !== 'topic_quiz';

    const masteryVariants = [];
    if (index === 0) masteryVariants.push('foundational');
    if (mcqCount >= 15) masteryVariants.push('exam-heavy');
    if (estimatedMinutes && estimatedMinutes <= 5 && !isCompleted) {
        masteryVariants.push('easy-win');
    }
    if (progress?.bestScore != null && progress.bestScore < 50) {
        masteryVariants.push('needs-review');
    }

    const cta = isCompleted
        ? { label: 'Review', icon: 'replay', class: 'btn-secondary' }
        : isStarted
            ? { label: 'Continue', icon: 'play_arrow', class: 'btn-primary' }
            : { label: 'Start module', icon: 'arrow_forward', class: 'btn-primary' };

    return (
        <article
            className={`card-base p-0 overflow-hidden flex flex-col h-full ${
                isRecommended ? 'ring-2 ring-primary/40' : ''
            }`}
        >
            <Link
                to={`/dashboard/topic/${topic._id}`}
                aria-label={`Open ${topic.title}`}
                className="block group"
            >
                <div
                    className="relative h-28 flex items-center justify-center"
                    style={{ background: gradient }}
                >
                    <div
                        className="pointer-events-none absolute inset-0 opacity-15"
                        style={{
                            backgroundImage:
                                'radial-gradient(circle at 20% 25%, rgba(255,255,255,0.55), transparent 35%), radial-gradient(circle at 80% 75%, rgba(255,255,255,0.35), transparent 40%)',
                        }}
                        aria-hidden="true"
                    />
                    <span className="relative z-10 text-white font-bold text-2xl tracking-tight font-mono">
                        {initials}
                    </span>
                    <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/30 backdrop-blur-md text-white/95 text-[10px] font-bold uppercase tracking-wider">
                        Module {index + 1}
                    </span>
                    {isRecommended && (
                        <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white text-primary text-[10px] font-bold uppercase tracking-wider shadow-md">
                            <span
                                className="material-symbols-outlined text-[12px]"
                                style={{ fontVariationSettings: "'FILL' 1" }}
                            >
                                star
                            </span>
                            Next up
                        </span>
                    )}
                </div>
            </Link>

            <div className="p-4 flex flex-col flex-1 gap-3">
                <div className="flex items-center justify-between gap-2">
                    <StatusBadge status={status} />
                    <div className="flex items-center gap-1 flex-wrap">
                        {masteryVariants.map((variant) => (
                            <MasteryBadge key={variant} variant={variant} />
                        ))}
                    </div>
                </div>

                <Link to={`/dashboard/topic/${topic._id}`} className="group">
                    <h3 className="text-body-base font-semibold text-text-main-light dark:text-text-main-dark group-hover:text-primary transition-colors line-clamp-2">
                        {topic.title}
                    </h3>
                </Link>
                <p className="text-caption text-text-sub-light dark:text-text-sub-dark line-clamp-2">
                    {topic.description || `Master the key concepts of ${topic.title}.`}
                </p>

                <div className="flex flex-wrap items-center gap-2 text-caption text-text-sub-light dark:text-text-sub-dark">
                    {estimatedMinutes && (
                        <span className="inline-flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">schedule</span>
                            {estimatedMinutes} min
                        </span>
                    )}
                    {mcqCount > 0 && (
                        <span className="inline-flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">quiz</span>
                            {mcqCount}q
                        </span>
                    )}
                    {progress?.bestScore != null && (
                        <span
                            className={`inline-flex items-center gap-1 font-semibold ${
                                progress.bestScore >= 80
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : progress.bestScore >= 60
                                        ? 'text-amber-600 dark:text-amber-400'
                                        : 'text-rose-600 dark:text-rose-400'
                            }`}
                        >
                            <span className="material-symbols-outlined text-[14px]">military_tech</span>
                            {progress.bestScore}%
                        </span>
                    )}
                </div>

                {progress?.bestScore != null && (
                    <div className="h-1 bg-border-subtle dark:bg-border-subtle-dark rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${
                                progress.bestScore >= 80
                                    ? 'bg-emerald-500'
                                    : progress.bestScore >= 60
                                        ? 'bg-amber-500'
                                        : 'bg-rose-500'
                            }`}
                            style={{ width: `${progress.bestScore}%` }}
                        />
                    </div>
                )}

                <div className="mt-auto pt-1 flex flex-wrap items-center gap-2">
                    <Link
                        to={`/dashboard/topic/${topic._id}`}
                        className={`${cta.class} flex-1 min-w-[120px] py-2 text-body-sm justify-center gap-1.5`}
                    >
                        <span
                            className="material-symbols-outlined text-[16px]"
                            style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                            {cta.icon}
                        </span>
                        {cta.label}
                    </Link>
                    {quizReady && (
                        <Link
                            to={`/dashboard/exam/${topic._id}?autostart=mcq`}
                            reloadDocument
                            className="btn-ghost text-body-sm py-2 px-3"
                            aria-label={`Take quiz for ${topic.title}`}
                        >
                            <span className="material-symbols-outlined text-[16px]">quiz</span>
                            Quiz
                        </Link>
                    )}
                    {isFinalExam && (
                        <span className="text-caption text-text-faint-light dark:text-text-faint-dark inline-flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">workspace_premium</span>
                            Final exam
                        </span>
                    )}
                </div>
            </div>
        </article>
    );
};

export default TopicModuleCard;
