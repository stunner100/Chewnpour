import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AppIcon from '../components/AppIcon';

const EmptyExamState = () => (
  <section className="w-full rounded-2xl border border-border-subtle bg-surface p-space-8 text-center shadow-sm">
    <div className="mx-auto mb-space-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
      <AppIcon name="school" />
    </div>
    <h2 className="font-headline-sm text-headline-sm font-bold text-text-primary">
      Upload material to unlock exam practice
    </h2>
    <p className="mx-auto mt-space-3 max-w-xl font-body-base text-body-base text-text-secondary">
      Exam practice runs a focused MCQ session from one of your course topics — the same question bank as Quizzes. Add a PDF, DOCX, or PPTX first so questions can be generated.
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

/**
 * Exam practice hub — topic MCQ via the live Supabase quiz APIs.
 * This is not a separate whole-document exam engine.
 */
const ExamMode = () => {
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
      if (!response.ok) throw new Error(payload.error || 'Failed to load exam courses');
      setCourses(Array.isArray(payload.courses) ? payload.courses : []);
    } catch (err) {
      setError(err.message || 'Could not load exam courses');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const examReadyCourses = useMemo(
    () =>
      courses.filter(
        (course) => Boolean(course.firstQuizTopicId) || Number(course.quizzesReady || 0) > 0,
      ),
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
            <h1 className="font-headline-lg text-headline-lg font-bold text-text-primary">Exam practice</h1>
            <p className="mt-2 text-body text-text-secondary">
              Run a focused MCQ practice session from one topic in your uploaded materials. This uses the same question bank as Quizzes — not a separate whole-document exam yet.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-error-soft bg-error-soft/40 p-4 text-body-sm text-error"
            >
              {error}
            </div>
          )}

          {examReadyCourses.length === 0 ? (
            <EmptyExamState />
          ) : (
            <div className="grid gap-space-4 md:grid-cols-2">
              {examReadyCourses.slice(0, 8).map((course) => {
                const targetTopicId = course.firstQuizTopicId || course.firstTopicId;
                if (!targetTopicId) return null;
                return (
                  <Link
                    key={course.id}
                    to={`/dashboard/quiz/${encodeURIComponent(targetTopicId)}?autostart=mcq`}
                    className="rounded-2xl border border-border-subtle bg-surface p-space-6 hover:shadow-md transition-shadow"
                  >
                    <p className="text-label-xs uppercase tracking-wide text-text-muted">
                      {course.title}
                    </p>
                    <h2 className="mt-2 font-headline-sm text-headline-sm text-text-primary">
                      Start exam practice
                    </h2>
                    <p className="mt-2 text-body-sm text-text-secondary">
                      {course.quizzesReady} quiz-ready topic
                      {course.quizzesReady === 1 ? '' : 's'} · same MCQ bank as Quizzes
                    </p>
                  </Link>
                );
              })}
            </div>
          )}

          <p className="text-body-sm text-text-muted">
            Prefer shorter practice?{' '}
            <Link to="/dashboard/quiz" className="font-semibold text-primary hover:text-primary-hover">
              Open Quizzes
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  );
};

export default ExamMode;
