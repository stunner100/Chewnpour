import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AppIcon from '../components/AppIcon';
import {
  classifyStudyToolAvailability,
  studyToolEmptyCopy,
} from '../lib/uploadReadiness';
import { formatCourseTitle } from '../lib/courseTitle';

const EmptyStudyToolState = ({ availability }) => {
  const copy = studyToolEmptyCopy(availability);
  return (
    <section className="flex w-full flex-col items-center rounded-[28px] border border-dashed border-border-default bg-surface px-6 py-12 text-center shadow-sm">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary-subtle text-primary">
        <AppIcon name="quiz" className="text-[28px]" />
      </div>
      <h2 className="font-display text-display-sm font-bold text-text-primary">
        {copy.title}
      </h2>
      <p className="mx-auto mt-2 max-w-xl text-body-sm text-text-secondary md:text-body-md">
        {copy.description}
      </p>
      <Link
        to={copy.ctaHref}
        className="btn-primary mt-6 inline-flex min-h-11 items-center gap-2 text-body-sm"
      >
        <AppIcon
          name={copy.ctaHref.includes('upload') ? 'cloud_upload' : 'arrow_forward'}
          className="text-[18px]"
        />
        {copy.ctaLabel}
      </Link>
      <Link
        to="/dashboard/exam"
        className="mt-3 text-body-sm font-semibold text-primary hover:text-primary-hover"
      >
        Try timed exam
      </Link>
    </section>
  );
};

const ActiveQuizSession = () => {
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user?.id) {
      setCourses([]);
      setUploads([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [coursesRes, uploadsRes] = await Promise.all([
        fetch('/api/courses', {
          credentials: 'include',
          headers: { Accept: 'application/json' },
        }),
        fetch('/api/uploads', {
          credentials: 'include',
          headers: { Accept: 'application/json' },
        }),
      ]);
      const coursesPayload = await coursesRes.json().catch(() => ({}));
      const uploadsPayload = await uploadsRes.json().catch(() => ({}));
      if (!coursesRes.ok) throw new Error(coursesPayload.error || 'Failed to load quizzes');
      setCourses(Array.isArray(coursesPayload.courses) ? coursesPayload.courses : []);
      setUploads(Array.isArray(uploadsPayload.uploads) ? uploadsPayload.uploads : []);
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
    () =>
      courses.filter(
        (course) =>
          Boolean(course.firstQuizTopicId)
          || Number(course.quizzesReady || 0) > 0
          || (Array.isArray(course.quizTopics) && course.quizTopics.length > 0),
      ),
    [courses],
  );

  const emptyAvailability = useMemo(
    () => classifyStudyToolAvailability({ uploads, courses }),
    [uploads, courses],
  );

  if (loading) {
    return (
      <div className="min-h-[calc(100dvh-4rem)] min-w-0 max-w-full overflow-x-hidden bg-background-light px-4 py-8 md:px-8 md:py-10">
        <div className="mx-auto w-full min-w-0 max-w-5xl space-y-5">
          <div className="h-16 rounded-[20px] bg-surface-soft" />
          <div className="grid min-w-0 gap-4 md:grid-cols-2">
            {[0, 1].map((item) => (
              <div key={item} className="h-40 rounded-[24px] bg-surface-soft" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100dvh-4rem)] min-w-0 max-w-full overflow-x-hidden bg-background-light px-4 py-8 md:px-8 md:py-10">
      <div className="mx-auto w-full min-w-0 max-w-5xl">
        <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-display-md font-bold tracking-[-0.02em] text-text-primary md:text-display-lg">
              Quizzes
            </h1>
            <p className="mt-2 max-w-2xl text-body-md text-text-secondary">
              Practice with questions generated from your uploaded materials.
            </p>
          </div>
          <Link
            to="/dashboard/exam"
            className="text-body-sm font-semibold text-primary hover:text-primary-hover"
          >
            Try timed exam
          </Link>
        </div>

        {error && (
          <div role="alert" className="mt-5 rounded-[16px] border border-error/30 bg-error-soft px-4 py-3 text-body-sm text-error">
            {error}
          </div>
        )}

        <div className="mt-8">
          {quizReadyCourses.length === 0 ? (
            <EmptyStudyToolState availability={emptyAvailability} />
          ) : (
            <div className="grid min-w-0 gap-4 md:grid-cols-2">
              {quizReadyCourses.map((course) => {
                const quizTopics = Array.isArray(course.quizTopics) && course.quizTopics.length > 0
                  ? course.quizTopics
                  : (course.firstQuizTopicId || course.firstTopicId
                    ? [{
                        topicId: course.firstQuizTopicId || course.firstTopicId,
                        title: 'Start quiz',
                        questionCount: null,
                      }]
                    : []);
                if (quizTopics.length === 0) return null;
                const quizCount = Number(course.quizzesReady || quizTopics.length || 0);
                return (
                  <article
                    key={course.id}
                    className="flex h-full min-w-0 max-w-full flex-col overflow-hidden rounded-[24px] border border-border-subtle bg-surface p-5 shadow-sm md:p-6"
                  >
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="flex size-11 items-center justify-center rounded-xl bg-primary-subtle text-primary">
                        <AppIcon name="quiz" className="text-[22px]" />
                      </div>
                      <span className="inline-flex items-center rounded-full bg-warning-soft px-2.5 py-1 text-caption font-semibold text-warning">
                        Ready
                      </span>
                    </div>
                    <p className="min-w-0 truncate text-caption font-semibold uppercase tracking-[0.06em] text-text-muted">
                      {formatCourseTitle(course.title) || course.title}
                    </p>
                    <h2 className="mt-2 min-w-0 font-display text-display-sm font-bold text-text-primary">
                      Practice quizzes
                    </h2>
                    <p className="mt-2 text-body-sm text-text-secondary">
                      {quizCount} quiz-ready topic{quizCount === 1 ? '' : 's'}
                    </p>
                    <ul className="mt-4 min-w-0 space-y-2">
                      {quizTopics.map((topic) => (
                        <li key={topic.topicId} className="min-w-0">
                          <Link
                            to={`/dashboard/quiz/${encodeURIComponent(topic.topicId)}`}
                            className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface-soft px-3 py-2.5 text-body-sm font-semibold text-text-primary transition-colors hover:border-primary/40 hover:bg-surface"
                          >
                            <span className="min-w-0 truncate" title={topic.title}>{topic.title}</span>
                            <span className="shrink-0 text-caption font-medium text-text-muted">
                              {Number(topic.questionCount || 0) > 0
                                ? `${topic.questionCount} Q`
                                : 'Open'}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <Link
                      to={`/dashboard/exam?courseId=${encodeURIComponent(course.id)}`}
                      className="mt-4 inline-flex items-center gap-1.5 text-body-sm font-semibold text-primary hover:text-primary-hover"
                    >
                      <AppIcon name="school" className="text-[16px]" />
                      Timed exam for this course
                    </Link>
                  </article>
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
