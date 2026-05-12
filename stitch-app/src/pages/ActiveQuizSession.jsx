import React from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useConvexAuth, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

const EMPTY_LIST = [];

const buildObjectiveExamRoute = (topicId) =>
    topicId ? `/dashboard/exam/${topicId}?autostart=mcq` : '/dashboard';

const StudyToolSkeleton = () => (
    <div className="flex-1 flex flex-col ml-0 h-[calc(100vh-64px)] overflow-hidden">
        <main className="flex-1 min-h-0 p-space-4 md:px-space-10 md:py-space-8 flex flex-col items-center justify-start overflow-y-auto">
            <div className="w-full max-w-5xl animate-pulse space-y-space-6">
                <div className="h-8 w-44 rounded-lg bg-surface-muted" />
                <div className="h-36 rounded-2xl bg-surface" />
                <div className="grid gap-space-4 md:grid-cols-2">
                    <div className="h-40 rounded-2xl bg-surface" />
                    <div className="h-40 rounded-2xl bg-surface" />
                </div>
            </div>
        </main>
    </div>
);

const EmptyStudyToolState = () => (
    <section className="w-full rounded-2xl border border-border-subtle bg-surface p-space-8 text-center shadow-sm">
        <div className="mx-auto mb-space-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
            <span className="material-symbols-outlined">quiz</span>
        </div>
        <h2 className="font-headline-sm text-headline-sm font-bold text-text-primary">
            Upload material to generate quizzes
        </h2>
        <p className="mx-auto mt-space-3 max-w-xl font-body-base text-body-base text-text-secondary">
            Quizzes are generated from your own course topics. Add a PDF, slide deck, document, or image to start practicing from real study material.
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

const ResumeQuizCard = ({ resumeTarget }) => {
    if (!resumeTarget?.topicId) return null;

    return (
        <section className="rounded-2xl border border-primary/20 bg-primary-soft p-space-6 shadow-sm">
            <div className="flex flex-col gap-space-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p className="font-label-sm text-label-sm font-bold uppercase tracking-wider text-primary">
                        Continue practice
                    </p>
                    <h2 className="mt-space-2 font-display-sm text-display-sm text-text-primary">
                        {resumeTarget.topicTitle || 'Your latest topic'}
                    </h2>
                    <p className="mt-space-2 font-body-base text-body-base text-text-secondary">
                        Start an objective quiz from the topic you last studied.
                    </p>
                </div>
                <Link
                    to={buildObjectiveExamRoute(resumeTarget.topicId)}
                    className="inline-flex shrink-0 items-center justify-center gap-space-2 rounded-xl bg-primary px-space-5 py-space-3 font-label-md text-label-md text-on-primary shadow-sm transition-colors hover:bg-primary-hover"
                >
                    Start Quiz
                    <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                </Link>
            </div>
        </section>
    );
};

const CourseQuizCard = ({ course }) => (
    <Link
        to={`/dashboard/course/${course._id}?action=quiz`}
        className="group rounded-2xl border border-border-subtle bg-surface p-space-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
    >
        <div className="mb-space-5 flex items-start justify-between gap-space-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <span className="material-symbols-outlined">school</span>
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

const ActiveQuizSession = () => {
    const { quizId } = useParams();
    const { isAuthenticated } = useConvexAuth();
    const courses = useQuery(api.courses.getUserCourses, isAuthenticated ? {} : 'skip');
    const resumeTarget = useQuery(api.topics.getResumeTarget, isAuthenticated ? {} : 'skip');

    if (quizId) {
        return <Navigate to={buildObjectiveExamRoute(quizId)} replace />;
    }

    if (!isAuthenticated || courses === undefined || resumeTarget === undefined) {
        return <StudyToolSkeleton />;
    }

    const courseList = Array.isArray(courses) ? courses : EMPTY_LIST;

    return (
        <div className="flex-1 flex flex-col ml-0 h-[calc(100vh-64px)] overflow-hidden">
            <main className="flex-1 min-h-0 p-space-4 md:px-space-10 md:py-space-8 flex flex-col items-center justify-start overflow-y-auto">
                <div className="w-full max-w-5xl">
                    <div className="mb-space-6 flex flex-col gap-space-2">
                        <p className="font-label-sm text-label-sm font-bold uppercase tracking-wider text-primary">
                            Quizzes
                        </p>
                        <h1 className="font-display-sm text-display-sm text-text-primary">
                            Practice from your generated topics
                        </h1>
                        <p className="max-w-2xl font-body-base text-body-base text-text-secondary">
                            Pick a real course or continue your latest topic to start objective questions from your own study material.
                        </p>
                    </div>

                    <div className="space-y-space-5">
                        <ResumeQuizCard resumeTarget={resumeTarget} />

                        {courseList.length > 0 ? (
                            <section className="grid gap-space-4 md:grid-cols-2">
                                {courseList.map((course) => (
                                    <CourseQuizCard key={course._id} course={course} />
                                ))}
                            </section>
                        ) : !resumeTarget?.topicId ? (
                            <EmptyStudyToolState />
                        ) : null}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default ActiveQuizSession;
