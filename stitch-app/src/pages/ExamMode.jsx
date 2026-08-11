import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AppIcon from '../components/AppIcon';
import { useExamTimer } from '../hooks/useExamTimer';
import { watermelonToast } from '../components/watermelon/watermelonToast';

const EmptyExamState = () => (
  <section className="w-full rounded-2xl border border-border-subtle bg-surface p-space-8 text-center shadow-sm">
    <div className="mx-auto mb-space-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
      <AppIcon name="school" />
    </div>
    <h2 className="font-headline-sm text-headline-sm font-bold text-text-primary">
      Upload material to unlock timed exams
    </h2>
    <p className="mx-auto mt-space-3 max-w-xl font-body-base text-body-base text-text-secondary">
      Exams pull multiple-choice questions across every quiz-ready topic in a course and run on a countdown timer.
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

const ExamMode = () => {
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [startingCourseId, setStartingCourseId] = useState('');
  const [exam, setExam] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

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
        (course) => Number(course.quizzesReady || course.quizTopicCount || 0) > 0,
      ),
    [courses],
  );

  const submitExam = useCallback(async (nextAnswers = answers) => {
    if (!exam?.id || submitting) return;
    setSubmitting(true);
    try {
      const response = await fetch(`/api/exams/${exam.id}/submit`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ answers: nextAnswers }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to submit exam');
      }
      setResult(payload.exam || null);
      setExam(null);
      watermelonToast('Exam submitted', { type: 'success' });
    } catch (err) {
      watermelonToast(err.message || 'Could not submit exam', { type: 'error' });
    } finally {
      setSubmitting(false);
    }
  }, [answers, exam?.id, submitting]);

  const { formattedTime, isLowTime } = useExamTimer(
    exam?.durationSeconds || 0,
    Boolean(exam?.id) && !result,
    () => {
      void submitExam(answers);
    },
  );

  const startExam = async (courseId) => {
    setStartingCourseId(courseId);
    setError('');
    setResult(null);
    try {
      const response = await fetch('/api/exams', {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ courseId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to start exam');
      }
      setExam(payload.exam);
      setAnswers({});
      setCurrentIndex(0);
    } catch (err) {
      setError(err.message || 'Could not start exam');
      watermelonToast(err.message || 'Could not start exam', { type: 'error' });
    } finally {
      setStartingCourseId('');
    }
  };

  const currentQuestion = exam?.questions?.[currentIndex] || null;

  if (exam?.questions?.length) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-space-6 px-space-4 py-space-8">
        <header className="flex items-center justify-between gap-space-4 rounded-2xl border border-border-subtle bg-surface p-space-4">
          <div>
            <p className="text-caption text-text-secondary">Timed course exam</p>
            <h1 className="font-headline-sm text-headline-sm font-bold text-text-primary">
              {exam.courseTitle || 'Exam'}
            </h1>
          </div>
          <div className={`rounded-xl px-space-4 py-space-2 font-mono text-lg font-bold ${isLowTime ? 'bg-error-soft text-error' : 'bg-primary-soft text-primary'}`}>
            {formattedTime}
          </div>
        </header>

        <section className="rounded-2xl border border-border-subtle bg-surface p-space-6 shadow-sm">
          <p className="text-caption text-text-secondary">
            Question {currentIndex + 1} of {exam.questions.length}
          </p>
          <h2 className="mt-space-3 font-body-lg text-body-lg font-semibold text-text-primary">
            {currentQuestion?.prompt}
          </h2>
          <div className="mt-space-5 space-y-space-3">
            {(currentQuestion?.options || []).map((option, optionIndex) => {
              const selected = answers[currentQuestion.id] === optionIndex;
              return (
                <button
                  key={`${currentQuestion.id}-${optionIndex}`}
                  type="button"
                  onClick={() =>
                    setAnswers((prev) => ({
                      ...prev,
                      [currentQuestion.id]: optionIndex,
                    }))
                  }
                  className={`flex w-full items-start gap-space-3 rounded-xl border px-space-4 py-space-3 text-left transition-colors ${
                    selected
                      ? 'border-primary bg-primary-soft text-text-primary'
                      : 'border-border-subtle bg-surface hover:border-primary/40'
                  }`}
                >
                  <span className="mt-0.5 inline-flex size-6 items-center justify-center rounded-full border border-current text-caption font-bold">
                    {String.fromCharCode(65 + optionIndex)}
                  </span>
                  <span className="font-body-base text-body-base">{option}</span>
                </button>
              );
            })}
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-space-3">
          <button
            type="button"
            className="rounded-xl border border-border-subtle px-space-4 py-space-3 font-label-md disabled:opacity-50"
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex((value) => Math.max(0, value - 1))}
          >
            Previous
          </button>
          <div className="flex gap-space-3">
            {currentIndex < exam.questions.length - 1 ? (
              <button
                type="button"
                className="rounded-xl bg-primary px-space-5 py-space-3 font-label-md text-on-primary"
                onClick={() =>
                  setCurrentIndex((value) =>
                    Math.min(exam.questions.length - 1, value + 1),
                  )
                }
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                className="rounded-xl bg-primary px-space-5 py-space-3 font-label-md text-on-primary disabled:opacity-50"
                disabled={submitting}
                onClick={() => submitExam(answers)}
              >
                {submitting ? 'Submitting…' : 'Submit exam'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-space-6 px-space-4 py-space-8">
      <header className="space-y-space-2">
        <h1 className="font-headline-md text-headline-md font-bold text-text-primary">
          Timed exams
        </h1>
        <p className="max-w-2xl font-body-base text-body-base text-text-secondary">
          Start a countdown exam drawn from every quiz-ready topic in a course. Topic Quizzes stay available for untimed practice.
        </p>
      </header>

      {result ? (
        <section className="rounded-2xl border border-border-subtle bg-surface p-space-6">
          <h2 className="font-headline-sm text-headline-sm font-bold text-text-primary">
            Exam results
          </h2>
          <p className="mt-space-2 text-body-base text-text-secondary">
            Score {result.score ?? 0}% · {result.correctCount ?? 0}/
            {result.totalQuestions ?? 0} correct
          </p>
          <button
            type="button"
            className="mt-space-4 rounded-xl border border-border-subtle px-space-4 py-space-3 font-label-md"
            onClick={() => setResult(null)}
          >
            Back to courses
          </button>
        </section>
      ) : null}

      {loading ? (
        <p className="text-body-base text-text-secondary">Loading courses…</p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-error/30 bg-error-soft px-space-4 py-space-3 text-sm text-error">
          {error}
        </p>
      ) : null}
      {!loading && examReadyCourses.length === 0 ? <EmptyExamState /> : null}

      <div className="grid gap-space-4">
        {examReadyCourses.map((course) => (
          <article
            key={course.id}
            className="flex flex-col gap-space-4 rounded-2xl border border-border-subtle bg-surface p-space-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <h2 className="font-body-lg text-body-lg font-semibold text-text-primary">
                {course.title}
              </h2>
              <p className="mt-space-1 text-caption text-text-secondary">
                {course.topicCount || 0} topics · {course.quizzesReady || 0} quiz-ready
              </p>
            </div>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-xl bg-primary px-space-5 py-space-3 font-label-md text-on-primary disabled:opacity-60"
              disabled={Boolean(startingCourseId)}
              onClick={() => startExam(course.id)}
            >
              {startingCourseId === course.id ? 'Starting…' : 'Start timed exam'}
            </button>
          </article>
        ))}
      </div>
    </div>
  );
};

export default ExamMode;
