import React from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useConvexAuth, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

const EMPTY_LIST = [];

const StudyToolSkeleton = () => (
    <div className="flex-1 flex flex-col lg:flex-row relative pb-20 md:pb-0">
        <article className="flex-1 mx-auto w-full max-w-5xl px-space-4 md:px-space-10 pt-space-6 pb-space-8 md:pt-space-8 md:pb-space-10 lg:pt-space-8 lg:pb-space-12">
            <div className="animate-pulse space-y-space-6">
                <div className="h-8 w-48 rounded-lg bg-surface-muted" />
                <div className="h-36 rounded-2xl bg-surface" />
                <div className="grid gap-space-4 md:grid-cols-2">
                    <div className="h-44 rounded-2xl bg-surface" />
                    <div className="h-44 rounded-2xl bg-surface" />
                </div>
            </div>
        </article>
    </div>
);

const EmptyLessonsState = () => (
    <section className="rounded-2xl border border-border-subtle bg-surface p-space-8 text-center shadow-sm">
        <div className="mx-auto mb-space-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
            <span className="material-symbols-outlined">menu_book</span>
        </div>
        <h2 className="font-headline-sm text-headline-sm font-bold text-text-primary">
            Upload material to generate lessons
        </h2>
        <p className="mx-auto mt-space-3 max-w-xl font-body-base text-body-base text-text-secondary">
            Lessons are created from your own notes, slides, documents, and images. Add material to build your first real lesson.
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

const ResumeLessonCard = ({ resumeTarget }) => {
    if (!resumeTarget?.topicId) return null;

    return (
        <section className="rounded-2xl border border-primary/20 bg-primary-soft p-space-6 shadow-sm">
            <div className="flex flex-col gap-space-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p className="font-label-sm text-label-sm font-bold uppercase tracking-wider text-primary">
                        Continue reading
                    </p>
                    <h2 className="mt-space-2 font-display-sm text-display-sm text-text-primary">
                        {resumeTarget.topicTitle || 'Your latest topic'}
                    </h2>
                    <p className="mt-space-2 font-body-base text-body-base text-text-secondary">
                        Jump back into the generated lesson you last studied.
                    </p>
                </div>
                <Link
                    to={`/dashboard/topic/${resumeTarget.topicId}`}
                    className="inline-flex shrink-0 items-center justify-center gap-space-2 rounded-xl bg-primary px-space-5 py-space-3 font-label-md text-label-md text-on-primary shadow-sm transition-colors hover:bg-primary-hover"
                >
                    Open Lesson
                    <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                </Link>
            </div>
        </section>
    );
};

const CourseLessonCard = ({ course }) => (
    <Link
        to={`/dashboard/course/${course._id}`}
        className="group rounded-2xl border border-border-subtle bg-surface p-space-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
    >
        <div className="mb-space-5 flex items-start justify-between gap-space-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <span className="material-symbols-outlined">auto_stories</span>
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
            <span>View lessons</span>
            <span className="material-symbols-outlined transition-transform group-hover:translate-x-1">
                arrow_forward
            </span>
        </div>
    </Link>
);

const LessonMemoryNeuralBasis = () => {
    const { lessonId } = useParams();
    const { isAuthenticated } = useConvexAuth();
    const courses = useQuery(api.courses.getUserCourses, isAuthenticated ? {} : 'skip');
    const resumeTarget = useQuery(api.topics.getResumeTarget, isAuthenticated ? {} : 'skip');

    if (lessonId) {
        return <Navigate to={`/dashboard/topic/${lessonId}`} replace />;
    }

    if (!isAuthenticated || courses === undefined || resumeTarget === undefined) {
        return <StudyToolSkeleton />;
    }

    const courseList = Array.isArray(courses) ? courses : EMPTY_LIST;

    return (
        <div className="flex-1 flex flex-col lg:flex-row relative pb-20 md:pb-0">
            <article className="flex-1 mx-auto w-full max-w-5xl px-space-4 md:px-space-10 pt-space-6 pb-space-8 md:pt-space-8 md:pb-space-10 lg:pt-space-8 lg:pb-space-12">
                <div className="mb-space-6 flex flex-col gap-space-2">
                    <p className="font-label-sm text-label-sm font-bold uppercase tracking-wider text-primary">
                        Lessons
                    </p>
                    <h1 className="font-display-sm text-display-sm text-text-primary">
                        Read lessons generated from your materials
                    </h1>
                    <p className="max-w-2xl font-body-base text-body-base text-text-secondary">
                        Open a course to continue through topic lessons, summaries, Word Banks, and practice checks from your own uploads.
                    </p>
                </div>

                <div className="space-y-space-5">
                    <ResumeLessonCard resumeTarget={resumeTarget} />

                        {courseList.length > 0 ? (
                            <section className="grid gap-space-4 md:grid-cols-2">
                                {courseList.map((course) => (
                                    <CourseLessonCard key={course._id} course={course} />
                                ))}
                            </section>
                        ) : !resumeTarget?.topicId ? (
                            <EmptyLessonsState />
                        ) : null}
                </div>
            </article>
        </div>
    );
};

export default LessonMemoryNeuralBasis;
