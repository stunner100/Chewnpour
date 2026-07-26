import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AppIcon from '../components/AppIcon';

const EmptyStudyToolState = () => (
    <section className="flex w-full flex-col items-center rounded-[28px] border border-dashed border-border-default bg-surface px-6 py-12 text-center shadow-sm">
        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary-subtle text-primary">
            <AppIcon name="quiz" className="text-[28px]" />
        </div>
        <h2 className="font-display text-display-sm font-bold text-text-primary">
            Upload material to generate quizzes
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-body-sm text-text-secondary md:text-body-md">
            Quizzes are generated from your course topics. Add a PDF, slide deck, or document to start practicing.
        </p>
        <Link
            to="/dashboard/upload"
            className="btn-primary mt-6 inline-flex min-h-11 items-center gap-2 text-body-sm"
        >
            <AppIcon name="cloud_upload" className="text-[18px]" />
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
            <div className="min-h-[calc(100vh-4rem)] animate-pulse bg-background-light px-4 py-8 md:px-8 md:py-10">
                <div className="mx-auto max-w-5xl space-y-5">
                    <div className="h-16 rounded-[20px] bg-surface-soft" />
                    <div className="grid gap-4 md:grid-cols-2">
                        {[0, 1].map((item) => (
                            <div key={item} className="h-40 rounded-[24px] bg-surface-soft" />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-background-light px-4 py-8 md:px-8 md:py-10">
            <div className="mx-auto max-w-5xl">
                <h1 className="font-display text-display-md font-bold tracking-[-0.02em] text-text-primary md:text-display-lg">
                    Quizzes
                </h1>
                <p className="mt-2 max-w-2xl text-body-md text-text-secondary">
                    Practice with questions generated from your uploaded materials.
                </p>

                {error && (
                    <div role="alert" className="mt-5 rounded-[16px] border border-error/30 bg-error-soft px-4 py-3 text-body-sm text-error">
                        {error}
                    </div>
                )}

                <div className="mt-8">
                    {quizReadyCourses.length === 0 ? (
                        <EmptyStudyToolState />
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                            {quizReadyCourses.slice(0, 8).map((course) => {
                                const targetTopicId = course.firstQuizTopicId || course.firstTopicId;
                                if (!targetTopicId) return null;
                                const quizCount = Number(course.quizzesReady || 0);
                                return (
                                    <Link
                                        key={course.id}
                                        to={`/dashboard/quiz/${encodeURIComponent(targetTopicId)}`}
                                        className="flex h-full flex-col rounded-[24px] border border-border-subtle bg-surface p-5 shadow-sm transition-shadow hover:shadow-md md:p-6"
                                    >
                                        <div className="mb-4 flex items-start justify-between gap-3">
                                            <div className="flex size-11 items-center justify-center rounded-xl bg-primary-subtle text-primary">
                                                <AppIcon name="quiz" className="text-[22px]" />
                                            </div>
                                            <span className="inline-flex items-center rounded-full bg-warning-soft px-2.5 py-1 text-caption font-semibold text-warning">
                                                Ready
                                            </span>
                                        </div>
                                        <p className="text-caption font-semibold uppercase tracking-[0.06em] text-text-muted">
                                            {course.title}
                                        </p>
                                        <h2 className="mt-2 font-display text-display-sm font-bold text-text-primary">
                                            Start quiz
                                        </h2>
                                        <p className="mt-2 text-body-sm text-text-secondary">
                                            {quizCount} quiz-ready topic{quizCount === 1 ? '' : 's'}
                                        </p>
                                        <span className="btn-primary mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 text-body-sm">
                                            Begin practice
                                            <AppIcon name="arrow_forward" className="text-[16px]" />
                                        </span>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ActiveQuizSession;
