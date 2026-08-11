import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AppIcon from '../components/AppIcon';
import { formatCourseTitle } from '../lib/courseTitle';

const LessonsSkeleton = () => (
    <div className="min-h-[calc(100vh-4rem)] animate-pulse bg-background-light px-4 py-8 md:px-8 md:py-10">
        <div className="mx-auto max-w-4xl space-y-5">
            <div className="h-16 rounded-[20px] bg-surface-soft" />
            {[0, 1, 2].map((item) => (
                <div key={item} className="h-28 rounded-[24px] bg-surface-soft" />
            ))}
        </div>
    </div>
);

const LessonMemoryNeuralBasis = () => {
    const { user } = useAuth();
    const [searchParams] = useSearchParams();
    const courseId = String(searchParams.get('courseId') || '').trim();
    const [courses, setCourses] = useState([]);
    const [selectedCourse, setSelectedCourse] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        if (!user?.id) {
            setCourses([]);
            setSelectedCourse(null);
            setLoading(false);
            return;
        }
        setLoading(true);
        setError('');
        try {
            if (courseId) {
                const response = await fetch(`/api/courses/${encodeURIComponent(courseId)}`, {
                    credentials: 'include',
                    headers: { Accept: 'application/json' },
                });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(payload.error || 'Failed to load course');
                setSelectedCourse(payload.course || null);
                setCourses(payload.course ? [payload.course] : []);
            } else {
                const response = await fetch('/api/courses', {
                    credentials: 'include',
                    headers: { Accept: 'application/json' },
                });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(payload.error || 'Failed to load courses');
                const list = Array.isArray(payload.courses) ? payload.courses : [];
                setCourses(list);
                setSelectedCourse(null);
            }
        } catch (err) {
            setError(err.message || 'Could not load lessons');
        } finally {
            setLoading(false);
        }
    }, [courseId, user?.id]);

    useEffect(() => {
        load();
    }, [load]);

    const topics = useMemo(
        () => (Array.isArray(selectedCourse?.topics) ? selectedCourse.topics : []),
        [selectedCourse],
    );

    if (loading) {
        return <LessonsSkeleton />;
    }

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-background-light px-4 py-8 md:px-8 md:py-10">
            <div className="mx-auto max-w-4xl">
                <p className="text-caption font-semibold uppercase tracking-[0.06em] text-text-muted">
                    Lessons
                </p>
                <h1 className="mt-2 font-display text-display-md font-bold tracking-[-0.02em] text-text-primary md:text-display-lg">
                    {selectedCourse
                        ? (formatCourseTitle(selectedCourse.title) || selectedCourse.title)
                        : 'Your courses'}
                </h1>
                <p className="mt-2 max-w-2xl text-body-md text-text-secondary">
                    Topics are generated from your uploads. Open a lesson to study, or jump into a quiz when questions are ready.
                </p>

                {error && (
                    <div role="alert" className="mt-5 rounded-[16px] border border-error/30 bg-error-soft px-4 py-3 text-body-sm text-error">
                        {error}
                    </div>
                )}

                {!courseId && (
                    <div className="mt-8 space-y-4">
                        {courses.length === 0 ? (
                            <div className="flex flex-col items-center rounded-[28px] border border-dashed border-border-default bg-surface px-6 py-12 text-center shadow-sm">
                                <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary-subtle text-primary">
                                    <AppIcon name="menu_book" className="text-[28px]" />
                                </div>
                                <h2 className="font-display text-display-sm font-bold text-text-primary">No courses yet</h2>
                                <p className="mt-2 max-w-sm text-body-sm text-text-secondary">
                                    Upload material to generate topics and lessons.
                                </p>
                                <Link to="/dashboard/upload" className="btn-primary mt-6 inline-flex min-h-11 items-center gap-2 text-body-sm">
                                    <AppIcon name="cloud_upload" className="text-[18px]" />
                                    Upload Material
                                </Link>
                            </div>
                        ) : (
                            courses.map((course) => (
                                <div
                                    key={course.id}
                                    className="rounded-[24px] border border-border-subtle bg-surface p-5 shadow-sm"
                                >
                                    <Link
                                        to={`/dashboard/lessons?courseId=${encodeURIComponent(course.id)}`}
                                        className="flex items-center justify-between gap-4 transition-opacity hover:opacity-90"
                                    >
                                        <div className="min-w-0">
                                            <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-primary-subtle text-primary">
                                                <AppIcon name="menu_book" className="text-[22px]" />
                                            </div>
                                            <h2 className="font-display text-display-sm font-bold text-text-primary">
                                                {formatCourseTitle(course.title) || course.title}
                                            </h2>
                                            <p className="mt-1 text-body-sm text-text-secondary">
                                                {course.topicCount} topics · {course.quizzesReady} quizzes ready
                                            </p>
                                        </div>
                                        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-surface-soft text-text-secondary">
                                            <AppIcon name="arrow_forward" className="text-[18px]" />
                                        </span>
                                    </Link>
                                    {Number(course.quizzesReady || 0) > 0 ? (
                                        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border-subtle pt-4">
                                            <Link
                                                to={
                                                    course.firstQuizTopicId
                                                        ? `/dashboard/quiz/${encodeURIComponent(course.firstQuizTopicId)}`
                                                        : '/dashboard/quiz'
                                                }
                                                className="btn-secondary inline-flex min-h-10 items-center justify-center gap-1.5 text-body-sm"
                                            >
                                                <AppIcon name="quiz" className="text-[16px]" />
                                                Practice quiz
                                            </Link>
                                            <Link
                                                to={`/dashboard/exam?courseId=${encodeURIComponent(course.id)}`}
                                                className="btn-secondary inline-flex min-h-10 items-center justify-center gap-1.5 text-body-sm"
                                            >
                                                <AppIcon name="school" className="text-[16px]" />
                                                Timed exam
                                            </Link>
                                        </div>
                                    ) : null}
                                </div>
                            ))
                        )}
                    </div>
                )}

                {courseId && (
                    <div className="mt-8 space-y-4">
                        <Link
                            to="/dashboard/lessons"
                            className="inline-flex items-center gap-1.5 text-body-sm font-semibold text-primary hover:text-primary-hover"
                        >
                            <AppIcon name="arrow_back" className="text-[16px]" />
                            All courses
                        </Link>

                        {Number(selectedCourse?.quizzesReady || 0) > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                <Link
                                    to={
                                        selectedCourse.firstQuizTopicId
                                            ? `/dashboard/quiz/${encodeURIComponent(selectedCourse.firstQuizTopicId)}`
                                            : '/dashboard/quiz'
                                    }
                                    className="btn-secondary inline-flex min-h-10 items-center gap-1.5 text-body-sm"
                                >
                                    <AppIcon name="quiz" className="text-[16px]" />
                                    Practice quiz
                                </Link>
                                <Link
                                    to={`/dashboard/exam?courseId=${encodeURIComponent(selectedCourse.id)}`}
                                    className="btn-secondary inline-flex min-h-10 items-center gap-1.5 text-body-sm"
                                >
                                    <AppIcon name="school" className="text-[16px]" />
                                    Timed exam
                                </Link>
                            </div>
                        ) : null}

                        {topics.length === 0 ? (
                            <div className="rounded-[24px] border border-dashed border-border-default bg-surface px-6 py-10 text-center text-body-sm text-text-secondary">
                                This course has no topics yet.
                            </div>
                        ) : (
                            topics.map((topic, index) => (
                                <article
                                    key={topic.id}
                                    className="rounded-[24px] border border-border-subtle bg-surface p-5 shadow-sm"
                                >
                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="min-w-0">
                                            <div className="mb-2 flex flex-wrap items-center gap-2">
                                                <span className="inline-flex items-center rounded-full bg-surface-soft px-2.5 py-1 text-caption font-semibold text-text-muted">
                                                    Topic {index + 1}
                                                </span>
                                                {Number(topic.questionCount || 0) > 0 && (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-1 text-caption font-semibold text-success">
                                                        <span className="size-1.5 rounded-full bg-success" />
                                                        Quiz ready
                                                    </span>
                                                )}
                                            </div>
                                            <h2 className="font-display text-display-sm font-bold text-text-primary">
                                                {topic.title}
                                            </h2>
                                            <p className="mt-2 line-clamp-3 text-body-sm text-text-secondary">
                                                {topic.description || topic.content}
                                            </p>
                                        </div>
                                        <div className="flex shrink-0 flex-wrap gap-2">
                                            <Link
                                                to={`/dashboard/topic/${encodeURIComponent(topic.id)}`}
                                                className="btn-primary inline-flex min-h-10 items-center gap-1.5 text-body-sm"
                                            >
                                                Open lesson
                                                <AppIcon name="arrow_forward" className="text-[16px]" />
                                            </Link>
                                            {Number(topic.questionCount || 0) > 0 && (
                                                <Link
                                                    to={`/dashboard/quiz/${encodeURIComponent(topic.id)}`}
                                                    className="btn-secondary inline-flex min-h-10 items-center gap-1.5 text-body-sm"
                                                >
                                                    <AppIcon name="quiz" className="text-[16px]" />
                                                    Quiz
                                                </Link>
                                            )}
                                        </div>
                                    </div>
                                </article>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default LessonMemoryNeuralBasis;
