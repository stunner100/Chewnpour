import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AppIcon from '../components/AppIcon';
import { useExamTimer } from '../hooks/useExamTimer';
import { watermelonToast } from '../components/watermelon/watermelonToast';
import {
  classifyStudyToolAvailability,
  studyToolEmptyCopy,
} from '../lib/uploadReadiness';
import { formatCourseTitle } from '../lib/courseTitle';

const EmptyExamState = ({ availability }) => {
  const copy = studyToolEmptyCopy(availability);
  return (
    <section className="w-full rounded-2xl border border-border-subtle bg-surface p-space-8 text-center shadow-sm">
      <div className="mx-auto mb-space-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
        <AppIcon name="school" />
      </div>
      <h2 className="font-headline-sm text-headline-sm font-bold text-text-primary">
        {copy.title.replace('get started', 'unlock timed exams')}
      </h2>
      <p className="mx-auto mt-space-3 max-w-xl font-body-base text-body-base text-text-secondary">
        {availability === 'none'
          ? 'Exams pull multiple-choice questions across every quiz-ready topic in a course and run on a countdown timer (~1 minute per question).'
          : copy.description}
      </p>
      <Link
        to={copy.ctaHref}
        className="mt-space-6 inline-flex items-center justify-center gap-space-2 rounded-xl bg-primary px-space-5 py-space-3 font-label-md text-label-md text-on-primary shadow-sm transition-colors hover:bg-primary-hover"
      >
        <AppIcon name="cloud_upload" className="text-[20px]" />
        {copy.ctaLabel}
      </Link>
    </section>
  );
};

const reviewStatus = (item) => {
  if (item.selectedIndex == null) return 'skipped';
  return item.isCorrect ? 'correct' : 'incorrect';
};

const ExamReviewPanel = ({ result, onRetry, onBack }) => {
  const review = Array.isArray(result?.review) ? result.review : [];
  const skippedCount = review.filter((item) => item.selectedIndex == null).length;
  const incorrectCount = review.filter(
    (item) => item.selectedIndex != null && !item.isCorrect,
  ).length;
  const correctCount = Number(result.correctCount ?? review.filter((item) => item.isCorrect).length);

  return (
    <section className="rounded-2xl border border-border-subtle bg-surface p-space-6">
      <div className="sticky top-0 z-10 -mx-space-6 -mt-space-6 mb-space-5 border-b border-border-subtle bg-surface/95 px-space-6 py-space-4 backdrop-blur">
        <h2 className="font-headline-sm text-headline-sm font-bold text-text-primary">
          Exam results
        </h2>
        <p className="mt-space-2 text-body-base text-text-primary">
          Score {result.score ?? 0}% · {correctCount}/{result.totalQuestions ?? 0} correct
        </p>
        <p className="mt-1 text-caption text-text-secondary">
          {correctCount} correct · {incorrectCount} incorrect · {skippedCount} skipped
        </p>
        <div className="mt-space-4 flex flex-wrap gap-space-3">
          {result.courseId ? (
            <button
              type="button"
              className="rounded-xl bg-primary px-space-4 py-space-3 font-label-md text-on-primary"
              onClick={() => onRetry(result.courseId)}
            >
              Retry timed exam
            </button>
          ) : null}
          {result.courseId ? (
            <Link
              to={`/dashboard/lessons?courseId=${encodeURIComponent(result.courseId)}`}
              className="rounded-xl border border-border-subtle px-space-4 py-space-3 font-label-md text-text-primary"
            >
              Back to lessons
            </Link>
          ) : null}
          <button
            type="button"
            className="rounded-xl border border-border-subtle px-space-4 py-space-3 font-label-md text-text-primary"
            onClick={onBack}
          >
            Back to courses
          </button>
        </div>
      </div>

      {review.length > 0 ? (
        <ul className="space-y-space-3">
          {review.map((item, index) => {
            const status = reviewStatus(item);
            const cardClass =
              status === 'correct'
                ? 'border-success/40 bg-success-soft dark:bg-emerald-950/40'
                : status === 'skipped'
                  ? 'border-warning/40 bg-warning-soft dark:bg-amber-950/40'
                  : 'border-error/40 bg-error-soft dark:bg-red-950/40';
            const statusLabel =
              status === 'correct' ? 'Correct' : status === 'skipped' ? 'Skipped' : 'Incorrect';
            const statusClass =
              status === 'correct'
                ? 'text-success'
                : status === 'skipped'
                  ? 'text-warning'
                  : 'text-error';
            return (
              <li
                key={item.questionId}
                className={`rounded-xl border px-space-4 py-space-3 ${cardClass}`}
              >
                <p className={`text-caption font-semibold uppercase tracking-wide ${statusClass}`}>
                  Question {index + 1} · {statusLabel}
                </p>
                <p className="mt-1 font-body-base text-body-base font-medium text-text-primary">
                  {item.prompt}
                </p>
                <div className="mt-2 space-y-1 text-body-sm text-text-primary">
                  <p>
                    Your answer:{' '}
                    <span className={status === 'skipped' ? 'text-warning' : undefined}>
                      {item.selectedIndex == null
                        ? 'Skipped'
                        : item.options?.[item.selectedIndex] || `Option ${item.selectedIndex + 1}`}
                    </span>
                  </p>
                  {status !== 'correct' ? (
                    <p>
                      Correct answer:{' '}
                      {item.correctIndex == null
                        ? 'Unavailable'
                        : item.options?.[item.correctIndex] || `Option ${item.correctIndex + 1}`}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
};

const ExamMode = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const preferredCourseId = String(searchParams.get('courseId') || '').trim();
  const shouldResume = searchParams.get('resume') === '1';
  const resumeAttemptedRef = useRef(false);
  const [courses, setCourses] = useState([]);
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [startingCourseId, setStartingCourseId] = useState('');
  const [exam, setExam] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const answersRef = useRef({});
  const submittingRef = useRef(false);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    submittingRef.current = submitting;
  }, [submitting]);

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
      if (!coursesRes.ok) throw new Error(coursesPayload.error || 'Failed to load exam courses');
      setCourses(Array.isArray(coursesPayload.courses) ? coursesPayload.courses : []);
      setUploads(Array.isArray(uploadsPayload.uploads) ? uploadsPayload.uploads : []);
    } catch (err) {
      setError(err.message || 'Could not load exam courses');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const examReadyCourses = useMemo(() => {
    const ready = courses.filter(
      (course) => Number(course.quizzesReady || course.quizTopicCount || 0) > 0,
    );
    if (!preferredCourseId) return ready;
    return [...ready].sort((a, b) => {
      if (a.id === preferredCourseId) return -1;
      if (b.id === preferredCourseId) return 1;
      return 0;
    });
  }, [courses, preferredCourseId]);

  const emptyAvailability = useMemo(
    () => classifyStudyToolAvailability({ uploads, courses }),
    [uploads, courses],
  );

  const submitExam = useCallback(async (nextAnswers = answersRef.current, { timedOut = false } = {}) => {
    if (!exam?.id || submittingRef.current) return;
    submittingRef.current = true;
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
      watermelonToast(
        timedOut ? 'Time’s up — your answers were submitted' : 'Exam submitted',
        { type: timedOut ? 'warning' : 'success' },
      );
    } catch (err) {
      watermelonToast(err.message || 'Could not submit exam', { type: 'error' });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [exam?.id]);

  const handleTimeUp = useCallback(() => {
    void submitExam(answersRef.current, { timedOut: true });
  }, [submitExam]);

  const { timeRemaining, formattedTime, isLowTime, setTimeRemaining } = useExamTimer(
    exam?.durationSeconds || 0,
    Boolean(exam?.id) && !result,
    handleTimeUp,
  );

  useEffect(() => {
    if (!exam?.id) return;
    const fromEndsAt = exam.endsAt
      ? Math.max(0, Math.ceil((Number(exam.endsAt) - Date.now()) / 1000))
      : 0;
    const nextSeconds = fromEndsAt || Number(exam.durationSeconds) || 0;
    setTimeRemaining(nextSeconds);
  }, [exam?.id, exam?.endsAt, exam?.durationSeconds, setTimeRemaining]);

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
      const nextExam = payload.exam;
      setExam(nextExam);
      const restoredAnswers =
        nextExam?.answers && typeof nextExam.answers === 'object' && !Array.isArray(nextExam.answers)
          ? nextExam.answers
          : {};
      setAnswers(restoredAnswers);
      answersRef.current = restoredAnswers;
      const questions = Array.isArray(nextExam?.questions) ? nextExam.questions : [];
      const firstUnanswered = questions.findIndex((question) => restoredAnswers[question.id] == null);
      setCurrentIndex(firstUnanswered >= 0 ? firstUnanswered : 0);
      const fromEndsAt = nextExam?.endsAt
        ? Math.max(0, Math.ceil((Number(nextExam.endsAt) - Date.now()) / 1000))
        : 0;
      setTimeRemaining(fromEndsAt || Number(nextExam?.durationSeconds) || 0);
    } catch (err) {
      setError(err.message || 'Could not start exam');
      watermelonToast(err.message || 'Could not start exam', { type: 'error' });
    } finally {
      setStartingCourseId('');
    }
  };

  useEffect(() => {
    if (resumeAttemptedRef.current) return;
    if (!shouldResume || !preferredCourseId || loading || exam || startingCourseId) return;
    resumeAttemptedRef.current = true;
    void startExam(preferredCourseId);
  }, [shouldResume, preferredCourseId, loading, exam, startingCourseId]);

  const questions = exam?.questions || [];
  const currentQuestion = questions[currentIndex] || null;
  const answeredCount = questions.filter(
    (question) => answers[question.id] != null && answers[question.id] !== '',
  ).length;
  const unansweredCount = Math.max(0, questions.length - answeredCount);

  const requestSubmit = () => {
    if (unansweredCount > 0) {
      const confirmed = window.confirm(
        `Submit with ${unansweredCount} unanswered question${unansweredCount === 1 ? '' : 's'}?`,
      );
      if (!confirmed) return;
    }
    void submitExam(answersRef.current);
  };

  if (questions.length) {
    const progressPct = questions.length
      ? Math.round((answeredCount / questions.length) * 100)
      : 0;
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-space-6 px-space-4 py-space-8">
        <header className="flex items-center justify-between gap-space-4 rounded-2xl border border-border-subtle bg-surface p-space-4">
          <div>
            <p className="text-caption text-text-secondary">Timed course exam</p>
            <h1 className="font-headline-sm text-headline-sm font-bold text-text-primary">
              {formatCourseTitle(exam.courseTitle) || exam.courseTitle || 'Exam'}
            </h1>
            <p className="mt-1 text-caption text-text-secondary">
              {answeredCount}/{questions.length} answered
            </p>
          </div>
          <div
            role="status"
            aria-live="polite"
            aria-label={`${timeRemaining} seconds remaining`}
            className={`rounded-xl px-space-4 py-space-2 font-mono text-lg font-bold ${isLowTime ? 'bg-error-soft text-error' : 'bg-primary-soft text-primary'}`}
          >
            {formattedTime}
          </div>
        </header>

        <div className="h-2 overflow-hidden rounded-full bg-surface-soft">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {questions.map((question, index) => {
            const answered = answers[question.id] != null && answers[question.id] !== '';
            const active = index === currentIndex;
            return (
              <button
                key={question.id}
                type="button"
                aria-label={`Question ${index + 1}${answered ? ', answered' : ''}`}
                onClick={() => setCurrentIndex(index)}
                className={`inline-flex size-9 items-center justify-center rounded-lg text-caption font-semibold transition-colors ${
                  active
                    ? 'bg-primary text-on-primary'
                    : answered
                      ? 'bg-primary-soft text-primary'
                      : 'border border-border-subtle bg-surface text-text-secondary'
                }`}
              >
                {index + 1}
              </button>
            );
          })}
        </div>

        <section className="rounded-2xl border border-border-subtle bg-surface p-space-6 shadow-sm">
          <p className="text-caption text-text-secondary">
            Question {currentIndex + 1} of {questions.length}
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
                    setAnswers((prev) => {
                      const next = {
                        ...prev,
                        [currentQuestion.id]: optionIndex,
                      };
                      answersRef.current = next;
                      return next;
                    })
                  }
                  className={`flex w-full items-start gap-space-3 rounded-xl border px-space-4 py-space-3 text-left transition-colors ${
                    selected
                      ? 'border-primary bg-primary-soft text-text-primary'
                      : 'border-border-subtle bg-surface text-text-primary hover:border-primary/40'
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
            className="rounded-xl border border-border-subtle px-space-4 py-space-3 font-label-md text-text-primary disabled:opacity-50"
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex((value) => Math.max(0, value - 1))}
          >
            Previous
          </button>
          <div className="flex gap-space-3">
            {currentIndex < questions.length - 1 ? (
              <button
                type="button"
                className="rounded-xl bg-primary px-space-5 py-space-3 font-label-md text-on-primary"
                onClick={() =>
                  setCurrentIndex((value) =>
                    Math.min(questions.length - 1, value + 1),
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
                onClick={requestSubmit}
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
          Start a countdown exam drawn from every quiz-ready topic in a course. Topic quizzes stay available for untimed practice.
        </p>
      </header>

      {result ? (
        <ExamReviewPanel
          result={result}
          onRetry={(courseId) => startExam(courseId)}
          onBack={() => setResult(null)}
        />
      ) : null}

      {!result ? (
        <>
          {loading ? (
            <p className="text-body-base text-text-secondary">Loading courses…</p>
          ) : null}
          {error ? (
            <p className="rounded-xl border border-error/30 bg-error-soft px-space-4 py-space-3 text-sm text-error">
              {error}
            </p>
          ) : null}
          {!loading && examReadyCourses.length === 0 ? (
            <EmptyExamState availability={emptyAvailability} />
          ) : null}

          <div className="grid gap-space-4">
            {examReadyCourses.map((course) => {
              const preferred = preferredCourseId && course.id === preferredCourseId;
              return (
                <article
                  key={course.id}
                  className={`flex flex-col gap-space-4 rounded-2xl border bg-surface p-space-5 shadow-sm sm:flex-row sm:items-center sm:justify-between ${
                    preferred ? 'border-primary ring-1 ring-primary/30' : 'border-border-subtle'
                  }`}
                >
                  <div>
                    <h2 className="font-body-lg text-body-lg font-semibold text-text-primary">
                      {formatCourseTitle(course.title) || course.title}
                    </h2>
                    <p className="mt-space-1 text-caption text-text-secondary">
                      {course.topicCount || 0} topics · {course.quizzesReady || 0} quiz-ready
                      {preferred ? ' · Selected from lessons' : ''}
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
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
};

export default ExamMode;
