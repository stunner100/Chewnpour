import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

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
        return (
            <div className="md:ml-0 pt-16 min-h-screen p-space-6 md:p-space-8 animate-pulse">
                <div className="h-10 w-64 rounded-lg bg-surface-soft mb-6" />
                <div className="space-y-4">
                    {[0, 1, 2].map((item) => (
                        <div key={item} className="h-24 rounded-xl bg-surface-soft" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="md:ml-0 pt-16 min-h-screen p-space-6 md:p-space-8 pb-24">
            <div className="max-w-3xl mx-auto">
                <p className="text-body-sm font-medium text-text-secondary">Lessons</p>
                <h1 className="mt-2 font-headline-lg text-headline-lg font-bold text-text-primary">
                    {selectedCourse?.title || 'Your courses'}
                </h1>
                <p className="mt-3 text-body text-text-secondary">
                    Topics are generated from your uploads. Full AI lesson polish comes in later milestones.
                </p>

                {error && (
                    <div role="alert" className="mt-6 rounded-xl border border-error-soft bg-error-soft/40 p-4 text-body-sm text-error">
                        {error}
                    </div>
                )}

                {!courseId && (
                    <div className="mt-8 space-y-4">
                        {courses.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-border-strong bg-surface-soft p-8 text-center">
                                <p className="text-body-sm text-text-secondary">No courses yet. Upload material to generate topics.</p>
                                <Link to="/dashboard/upload" className="btn-primary mt-4 inline-flex">Upload Material</Link>
                            </div>
                        ) : (
                            courses.map((course) => (
                                <Link
                                    key={course.id}
                                    to={`/dashboard/lessons?courseId=${encodeURIComponent(course.id)}`}
                                    className="block rounded-2xl border border-border-subtle bg-surface p-5 hover:shadow-md transition-shadow"
                                >
                                    <h2 className="font-headline-sm text-headline-sm text-text-primary">{course.title}</h2>
                                    <p className="mt-2 text-body-sm text-text-secondary">
                                        {course.topicCount} topics · {course.quizzesReady} quizzes ready
                                    </p>
                                </Link>
                            ))
                        )}
                    </div>
                )}

                {courseId && (
                    <div className="mt-8 space-y-4">
                        <Link to="/dashboard/lessons" className="text-body-sm text-primary hover:text-primary-hover">
                            ← All courses
                        </Link>
                        {topics.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-border-strong bg-surface-soft p-8 text-center text-body-sm text-text-secondary">
                                This course has no topics yet.
                            </div>
                        ) : (
                            topics.map((topic) => (
                                <article key={topic.id} className="rounded-2xl border border-border-subtle bg-surface p-5">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <h2 className="font-headline-sm text-headline-sm text-text-primary">{topic.title}</h2>
                                            <p className="mt-2 text-body-sm text-text-secondary line-clamp-3">
                                                {topic.description || topic.content}
                                            </p>
                                        </div>
                                        {topic.questionCount > 0 && (
                                            <Link
                                                to={`/dashboard/quiz/${encodeURIComponent(topic.id)}`}
                                                className="shrink-0 rounded-lg bg-primary px-3 py-2 text-label-sm text-on-primary hover:bg-primary-hover"
                                            >
                                                Quiz
                                            </Link>
                                        )}
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
