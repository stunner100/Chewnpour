import React from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useConvexAuth, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

const EMPTY_LIST = [];

const buildWordBankRoute = (topicId) =>
    topicId ? `/dashboard/topic/${topicId}?panel=wordbank` : '/dashboard';

const StudyToolSkeleton = () => (
    <div className="flex-1 flex flex-col md:ml-0 h-[calc(100vh-64px)] overflow-hidden">
        <main className="flex-1 min-h-0 flex flex-col items-center justify-start px-space-8 pt-space-8 pb-space-8 overflow-y-auto">
            <div className="w-full max-w-5xl animate-pulse space-y-space-6">
                <div className="h-8 w-52 rounded-lg bg-surface-muted" />
                <div className="h-36 rounded-2xl bg-surface" />
                <div className="grid gap-space-4 md:grid-cols-2">
                    <div className="h-40 rounded-2xl bg-surface" />
                    <div className="h-40 rounded-2xl bg-surface" />
                </div>
            </div>
        </main>
    </div>
);

const EmptyFlashcardState = () => (
    <section className="w-full rounded-2xl border border-border-subtle bg-surface p-space-8 text-center shadow-sm">
        <div className="mx-auto mb-space-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
            <span className="material-symbols-outlined">style</span>
        </div>
        <h2 className="font-headline-sm text-headline-sm font-bold text-text-primary">
            Upload material to generate flashcards
        </h2>
        <p className="mx-auto mt-space-3 max-w-xl font-body-base text-body-base text-text-secondary">
            Word Banks and review cards come from terms found in your own lessons. Add study material to create a real deck.
        </p>
        <Link
            to="/dashboard/upload"
            className="mt-space-6 inline-flex items-center justify-center gap-space-2 rounded-xl bg-primary px-space-5 py-space-3 font-label-md text-label-md text-on-primary shadow-sm transition-colors hover:bg-primary-hover"
        >
            <span className="material-symbols-outlined text-[20px]">cloud_upload</span>
            Upload Material
        </Link>
    </section>
);

const ResumeFlashcardsCard = ({ resumeTarget }) => {
    if (!resumeTarget?.topicId) return null;

    return (
        <section className="rounded-2xl border border-primary/20 bg-primary-soft p-space-6 shadow-sm">
            <div className="flex flex-col gap-space-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p className="font-label-sm text-label-sm font-bold uppercase tracking-wider text-primary">
                        Latest topic
                    </p>
                    <h2 className="mt-space-2 font-display-sm text-display-sm text-text-primary">
                        {resumeTarget.topicTitle || 'Your latest topic'}
                    </h2>
                    <p className="mt-space-2 font-body-base text-body-base text-text-secondary">
                        Open the Word Bank for the topic you last studied.
                    </p>
                </div>
                <Link
                    to={buildWordBankRoute(resumeTarget.topicId)}
                    className="inline-flex shrink-0 items-center justify-center gap-space-2 rounded-xl bg-primary px-space-5 py-space-3 font-label-md text-label-md text-on-primary shadow-sm transition-colors hover:bg-primary-hover"
                >
                    Open Word Bank
                    <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                </Link>
            </div>
        </section>
    );
};

const ConceptReviewCard = ({ item }) => (
    <Link
        to={buildWordBankRoute(item.topicId)}
        className="group rounded-2xl border border-warning/20 bg-warning-soft/40 p-space-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-warning/40 hover:shadow-md"
    >
        <div className="mb-space-4 flex h-11 w-11 items-center justify-center rounded-xl bg-warning-soft text-warning">
            <span className="material-symbols-outlined">psychology</span>
        </div>
        <h3 className="font-headline-sm text-headline-sm text-text-primary">
            {item.topicTitle || 'Review topic'}
        </h3>
        <p className="mt-space-2 font-body-sm text-body-sm text-text-secondary">
            {Number(item.dueCount || 0)} terms due, {Number(item.weakCount || 0)} need reinforcement.
        </p>
        <div className="mt-space-5 flex items-center justify-between border-t border-border-subtle pt-space-4 font-label-md text-label-md text-primary">
            <span>Review terms</span>
            <span className="material-symbols-outlined transition-transform group-hover:translate-x-1">
                arrow_forward
            </span>
        </div>
    </Link>
);

const CourseFlashcardsCard = ({ course }) => (
    <Link
        to={`/dashboard/course/${course._id}?action=flashcards`}
        className="group rounded-2xl border border-border-subtle bg-surface p-space-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
    >
        <div className="mb-space-5 flex items-start justify-between gap-space-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <span className="material-symbols-outlined">folder</span>
            </div>
            <span className="inline-flex items-center rounded-full bg-surface-soft px-space-3 py-space-1 font-label-xs text-label-xs text-text-secondary">
                {Number(course.progress || 0)}% complete
            </span>
        </div>
        <h3 className="font-headline-sm text-headline-sm text-text-primary">
            {course.title || 'Untitled course'}
        </h3>
        {course.description && (
            <p className="mt-space-2 line-clamp-2 font-body-sm text-body-sm text-text-secondary">
                {course.description}
            </p>
        )}
        <div className="mt-space-5 flex items-center justify-between border-t border-border-subtle pt-space-4 font-label-md text-label-md text-primary">
            <span>Choose topic</span>
            <span className="material-symbols-outlined transition-transform group-hover:translate-x-1">
                arrow_forward
            </span>
        </div>
    </Link>
);

const FlashcardStudySession = () => {
    const { deckId } = useParams();
    const { isAuthenticated } = useConvexAuth();
    const courses = useQuery(api.courses.getUserCourses, isAuthenticated ? {} : 'skip');
    const resumeTarget = useQuery(api.topics.getResumeTarget, isAuthenticated ? {} : 'skip');
    const reviewQueue = useQuery(
        api.concepts.getConceptReviewQueue,
        isAuthenticated ? { limit: 4 } : 'skip',
    );

    if (deckId) {
        return <Navigate to={buildWordBankRoute(deckId)} replace />;
    }

    if (
        !isAuthenticated
        || courses === undefined
        || resumeTarget === undefined
        || reviewQueue === undefined
    ) {
        return <StudyToolSkeleton />;
    }

    const courseList = Array.isArray(courses) ? courses : EMPTY_LIST;
    const reviewItems = Array.isArray(reviewQueue?.items) ? reviewQueue.items : EMPTY_LIST;

    return (
        <div className="flex-1 flex flex-col md:ml-0 h-[calc(100vh-64px)] overflow-hidden">
            <main className="flex-1 min-h-0 flex flex-col items-center justify-start px-space-8 pt-space-8 pb-space-8 overflow-y-auto">
                <div className="w-full max-w-5xl">
                    <div className="mb-space-6 flex flex-col gap-space-2">
                        <p className="font-label-sm text-label-sm font-bold uppercase tracking-wider text-primary">
                            Flashcards
                        </p>
                        <h1 className="font-display-sm text-display-sm text-text-primary">
                            Review terms from your lessons
                        </h1>
                        <p className="max-w-2xl font-body-base text-body-base text-text-secondary">
                            Flashcards are built from generated topic Word Banks and concept review history tied to your account.
                        </p>
                    </div>

                    <div className="space-y-space-5">
                        <ResumeFlashcardsCard resumeTarget={resumeTarget} />

                        {reviewItems.length > 0 && (
                            <section>
                                <h2 className="mb-space-3 font-headline-xs text-headline-xs text-text-primary">
                                    Due for review
                                </h2>
                                <div className="grid gap-space-4 md:grid-cols-2">
                                    {reviewItems.map((item) => (
                                        <ConceptReviewCard key={item.topicId} item={item} />
                                    ))}
                                </div>
                            </section>
                        )}

                        {courseList.length > 0 ? (
                            <section>
                                <h2 className="mb-space-3 font-headline-xs text-headline-xs text-text-primary">
                                    Courses
                                </h2>
                                <div className="grid gap-space-4 md:grid-cols-2">
                                    {courseList.map((course) => (
                                        <CourseFlashcardsCard key={course._id} course={course} />
                                    ))}
                                </div>
                            </section>
                        ) : !resumeTarget?.topicId && reviewItems.length === 0 ? (
                            <EmptyFlashcardState />
                        ) : null}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default FlashcardStudySession;
