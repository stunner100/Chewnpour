import { Link } from 'react-router-dom';
import AppIcon from '../components/AppIcon';

const RATING_ACTIONS = [
    { label: 'Again', hint: '< 1m' },
    { label: 'Hard', hint: '6m' },
    { label: 'Good', hint: '10m' },
    { label: 'Easy', hint: '4d' },
];

/**
 * Flashcards are parked after the Supabase cutover.
 * Keep an honest pause state while matching the Slate study-shell look.
 */
export default function FlashcardStudySession() {
    return (
        <div className="min-h-[calc(100vh-4rem)] bg-background-light px-4 py-8 md:px-8 md:py-10">
            <div className="mx-auto max-w-3xl">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-caption font-semibold uppercase tracking-[0.06em] text-text-muted">
                            Flashcards
                        </p>
                        <h1 className="mt-2 font-display text-display-md font-bold tracking-[-0.02em] text-text-primary md:text-display-lg">
                            Spaced review
                        </h1>
                        <p className="mt-2 max-w-xl text-body-md text-text-secondary">
                            This surface is paused while we keep the live study loop stable. Lessons, quizzes, AI tutor, and progress are available now.
                        </p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-warning-soft px-3 py-1.5 text-caption font-semibold text-warning">
                        <AppIcon name="schedule" className="text-[14px]" />
                        Paused
                    </span>
                </div>

                <div className="mt-6 flex items-center justify-between gap-4 rounded-[20px] border border-border-subtle bg-surface px-4 py-3 shadow-sm">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-subtle text-primary">
                            <AppIcon name="folder" className="text-[20px]" />
                        </div>
                        <div className="min-w-0">
                            <p className="truncate font-semibold text-text-primary">Your course decks</p>
                            <p className="text-caption text-text-muted">Preview only</p>
                        </div>
                    </div>
                    <div className="w-28 shrink-0 sm:w-40">
                        <div className="mb-1 flex justify-between text-caption font-semibold text-text-muted">
                            <span>0/0</span>
                            <span>cards</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-surface-soft">
                            <div className="h-full w-[12%] rounded-full bg-cta/40" />
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex min-h-[320px] flex-col items-center justify-center rounded-[28px] border border-border-subtle bg-surface px-6 py-12 text-center shadow-sm md:min-h-[380px]">
                    <div className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-primary-subtle text-primary">
                        <AppIcon name="style" className="text-[28px]" />
                    </div>
                    <h2 className="font-display text-display-md font-bold tracking-[-0.02em] text-text-primary">
                        Flashcards coming back
                    </h2>
                    <p className="mt-3 max-w-md text-body-sm text-text-secondary md:text-body-md">
                        Flip cards and rate Again / Hard / Good / Easy will return here. Until then, keep studying with lessons and quizzes.
                    </p>
                    <span className="mt-8 inline-flex items-center rounded-full border border-border-subtle bg-surface-soft px-4 py-2 text-caption font-semibold text-text-muted">
                        Click or press Space to flip
                    </span>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {RATING_ACTIONS.map((action) => (
                        <button
                            key={action.label}
                            type="button"
                            disabled
                            className="flex min-h-14 cursor-not-allowed flex-col items-center justify-center rounded-[16px] border border-border-subtle bg-surface px-3 py-3 text-center opacity-60 shadow-sm"
                        >
                            <span className="text-body-sm font-semibold text-text-primary">{action.label}</span>
                            <span className="mt-0.5 text-caption text-text-muted">{action.hint}</span>
                        </button>
                    ))}
                </div>

                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                    <Link to="/dashboard" className="btn-primary inline-flex min-h-11 text-body-sm">
                        Back to dashboard
                    </Link>
                    <Link to="/dashboard/lessons" className="btn-secondary inline-flex min-h-11 text-body-sm">
                        Open lessons
                    </Link>
                    <Link to="/dashboard/quiz" className="btn-secondary inline-flex min-h-11 text-body-sm">
                        Practice quiz
                    </Link>
                </div>
            </div>
        </div>
    );
}
