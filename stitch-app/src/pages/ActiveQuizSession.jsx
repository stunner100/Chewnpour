import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AppIcon from '../components/AppIcon';

const EmptyStudyToolState = () => (
    <section className="w-full rounded-2xl border border-border-subtle bg-surface p-space-8 text-center shadow-sm">
        <div className="mx-auto mb-space-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
            <AppIcon name="quiz" />
        </div>
        <h2 className="font-headline-sm text-headline-sm font-bold text-text-primary">
            Upload material to generate quizzes
        </h2>
        <p className="mx-auto mt-space-3 max-w-xl font-body-base text-body-base text-text-secondary">
            Quizzes are generated from your own course topics. Add a PDF, slide deck, or document to start practicing.
        </p>
        <Link
            to="/dashboard/upload"
            className="mt-space-6 inline-flex items-center justify-center gap-space-2 rounded-xl bg-primary px-space-5 py-space-3 font-label-md text-label-md text-on-primary shadow-sm transition-colors hover:bg-primary-hover"
        >
            <AppIcon name="cloud_upload" className="text-[20px]" />
            Upload Material
        </Link>
    </section>
);

const ActiveQuizSession = () => {
    const { user } = useAuth();
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        if (!user?.id) {
            setCourses([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        setError('');
        try {
            const response = await fetch('/api/courses', {
                credentials: 'include',
                headers: { Accept: 'application/json' },
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || 'Failed to load quizzes');
            setCourses(Array.isArray(payload.courses) ? payload.courses : []);
        } catch (err) {
            setError(err.message || 'Could not load quizzes');
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    useEffect(() => {
        load();
    }, [load]);

    const quizReadyCourses = useMemo(
        () => courses.filter((course) => Boolean(course.firstQuizTopicId) || Number(course.quizzesReady || 0) > 0),
        [courses],
    );

    if (loading) {
        return (
            <div className="flex-1 flex flex-col ml-0 h-[calc(100vh-64px)] overflow-hidden">
                <main className="flex-1 min-h-0 p-space-4 md:px-space-10 md:py-space-8 animate-pulse">
                    <div className="h-36 rounded-2xl bg-surface" />
                </main>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col ml-0 h-[calc(100vh-64px)] overflow-hidden">
            <main className="flex-1 min-h-0 p-space-4 md:px-space-10 md:py-space-8 flex flex-col items-center justify-start overflow-y-auto">
                <div className="w-full max-w-5xl space-y-space-6">
                    <div>
                        <h1 className="font-headline-lg text-headline-lg font-bold text-text-primary">Quizzes</h1>
                        <p className="mt-2 text-body text-text-secondary">
                            Practice with questions generated from your uploaded materials.
                        </p>
                    </div>

                    {error && (
                        <div role="alert" className="rounded-xl border border-error-soft bg-error-soft/40 p-4 text-body-sm text-error">
                            {error}
                        </div>
                    )}

                    {quizReadyCourses.length === 0 ? (
                        <EmptyStudyToolState />
                    ) : (
                        <div className="grid gap-space-4 md:grid-cols-2">
                            {quizReadyCourses.slice(0, 8).map((course) => {
                                const targetTopicId = course.firstQuizTopicId || course.firstTopicId;
                                if (!targetTopicId) return null;
                                return (
                                    <Link
                                        key={course.id}
                                        to={`/dashboard/quiz/${encodeURIComponent(targetTopicId)}`}
                                        className="rounded-2xl border border-border-subtle bg-surface p-space-6 hover:shadow-md transition-shadow"
                                    >
                                        <p className="text-label-xs uppercase tracking-wide text-text-muted">
                                            {course.title}
                                        </p>
                                        <h2 className="mt-2 font-headline-sm text-headline-sm text-text-primary">
                                            Start quiz
                                        </h2>
                                        <p className="mt-2 text-body-sm text-text-secondary">
                                            {course.quizzesReady} quiz-ready topic{course.quizzesReady === 1 ? '' : 's'}
                                        </p>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default ActiveQuizSession;
