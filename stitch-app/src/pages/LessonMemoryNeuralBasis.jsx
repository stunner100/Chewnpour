import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AppIcon from '../components/AppIcon';
import { formatCourseTitle } from '../lib/courseTitle';

const LessonsSkeleton = () => (
    <div className="min-h-[calc(100dvh-4rem)] animate-pulse bg-background-light px-4 py-8 md:px-8 md:py-10">
        <div className="mx-auto max-w-4xl space-y-5">
            <div className="h-16 rounded-[20px] bg-surface-soft" />
            {[0, 1, 2].map((item) => (
                <div key={item} className="h-28 rounded-[24px] bg-surface-soft" />
            ))}
        </div>
    </div>
);

const copyText = async (value) => {
    try {
        await navigator.clipboard.writeText(value);
        return true;
    } catch {
        return false;
    }
};

const CourseShareControls = ({ course, onCourseChange }) => {
    const [busy, setBusy] = useState(false);
    const [copied, setCopied] = useState(false);
    const [shareError, setShareError] = useState('');
    const shareHref = course?.shareUrl
        ? `${typeof window !== 'undefined' ? window.location.origin : ''}${course.shareUrl}`
        : '';

    const toggleShare = async (enable) => {
        if (!course?.id) return;
        setBusy(true);
        setShareError('');
        try {
            const response = await fetch(`/api/courses/${encodeURIComponent(course.id)}/share`, {
                method: enable ? 'POST' : 'DELETE',
                credentials: 'include',
                headers: { Accept: 'application/json' },
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || 'Could not update sharing');
            onCourseChange?.(payload.course || null);
        } catch (err) {
            setShareError(err.message || 'Could not update sharing');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="rounded-[20px] border border-border-subtle bg-surface p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="text-body-sm font-semibold text-text-primary">Share this course</p>
                    <p className="mt-1 text-caption text-text-secondary">
                        A read-only link to generated lessons. Source files, quizzes, and tutor stay private.
                    </p>
                </div>
                {course?.shareEnabled ? (
                    <button
                        type="button"
                        className="btn-secondary inline-flex min-h-10 items-center justify-center text-body-sm"
                        disabled={busy}
                        onClick={() => toggleShare(false)}
                    >
                        Stop sharing
                    </button>
                ) : (
                    <button
                        type="button"
                        className="btn-primary inline-flex min-h-10 items-center justify-center text-body-sm"
                        disabled={busy}
                        onClick={() => toggleShare(true)}
                    >
                        Create share link
                    </button>
                )}
            </div>
            {course?.shareEnabled && shareHref ? (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                        readOnly
                        value={shareHref}
                        className="min-h-10 flex-1 rounded-xl border border-border-subtle bg-surface-soft px-3 text-body-sm text-text-primary"
                    />
                    <button
                        type="button"
                        className="btn-secondary inline-flex min-h-10 items-center justify-center text-body-sm"
                        onClick={async () => {
                            const ok = await copyText(shareHref);
                            if (ok) {
                                setCopied(true);
                                window.setTimeout(() => setCopied(false), 1600);
                            }
                        }}
                    >
                        {copied ? 'Copied' : 'Copy link'}
                    </button>
                </div>
            ) : null}
            {shareError ? (
                <p className="mt-2 text-caption text-error" role="alert">{shareError}</p>
            ) : null}
        </div>
    );
};

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
        <div className="min-h-[calc(100dvh-4rem)] bg-background-light px-4 py-8 md:px-8 md:py-10">
            <div className="mx-auto max-w-4xl">
                <p className="text-caption font-semibold uppercase tracking-[0.06em] text-text-muted">
                    Lessons
                </p>
                <h1 className="mt-2 font-display text-display-md font-bold tracking-[-0.02em] text-text-primary md:text-display-lg">
                    {selectedCourse
                        ? (formatCourseTitle(selectedCourse.title) || selectedCourse.title)
                        : 'Your courses'}
                </h1>
                <p className="mt-2 max-w-2xl text-pretty text-body-md text-text-secondary">
                    Read a lesson, or take a quiz when questions are ready.
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
                            courses.map((course) => {
                                const courseTitle = formatCourseTitle(course.title) || course.title;
                                const readHref = course.firstTopicId
                                    ? `/dashboard/topic/${encodeURIComponent(course.firstTopicId)}`
                                    : `/dashboard/lessons?courseId=${encodeURIComponent(course.id)}`;
                                return (
                                <article
                                    key={course.id}
                                    className="rounded-[24px] border border-border-subtle bg-surface p-5 shadow-sm"
                                >
                                    <div className="min-w-0">
                                        <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-primary-subtle text-primary">
                                            <AppIcon name="menu_book" className="text-[22px]" />
                                        </div>
                                        <h2 className="font-display text-display-sm font-bold text-text-primary">
                                            {courseTitle}
                                        </h2>
                                        <p className="mt-1 text-body-sm text-text-secondary">
                                            {course.topicCount} topics · {course.quizzesReady} quizzes ready
                                        </p>
                                    </div>
                                    <div className="mt-4 flex flex-col gap-2 border-t border-border-subtle pt-4">
                                        <Link
                                            to={readHref}
                                            className="btn-primary inline-flex w-full min-h-11 items-center justify-center gap-2 text-body-sm"
                                            aria-label={`Read lessons for ${courseTitle}`}
                                        >
                                            Read lessons
                                            <AppIcon name="arrow_forward" className="text-[16px]" />
                                        </Link>
                                        {Number(course.quizzesReady || 0) > 0 ? (
                                            <div className="grid grid-cols-2 gap-2">
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
                                </article>
                                );
                            })
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

                        {selectedCourse ? (
                            <CourseShareControls
                                course={selectedCourse}
                                onCourseChange={(next) => {
                                    setSelectedCourse((current) => ({
                                        ...(current || {}),
                                        ...(next || {}),
                                        topics: current?.topics || next?.topics || [],
                                    }));
                                }}
                            />
                        ) : null}

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
                            <div className="flex flex-col items-center rounded-[24px] border border-dashed border-border-default bg-surface px-6 py-10 text-center">
                                <h2 className="font-display text-display-sm font-bold text-text-primary">No topics yet</h2>
                                <p className="mt-2 max-w-sm text-body-sm text-text-secondary">
                                    This course has no topics yet. Upload material or wait for processing to finish.
                                </p>
                                <Link to="/dashboard/upload" className="btn-primary mt-5 inline-flex min-h-11 items-center gap-2 text-body-sm">
                                    <AppIcon name="cloud_upload" className="text-[18px]" />
                                    Upload material
                                </Link>
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
                                                {formatCourseTitle(topic.title) || topic.title}
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
                                                Read lesson
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
