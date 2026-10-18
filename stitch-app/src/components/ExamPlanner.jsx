import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import AppIcon from './AppIcon';
import { formatCourseTitle } from '../lib/courseTitle';
import {
  buildDailyPlan,
  dailyPlanItems,
  daysUntilExam,
  examCountdownLabel,
  localTodayMs,
} from '../lib/examPlan';
import { FUNNEL_EVENTS, trackFunnelEvent } from '../lib/funnelEvents';

const todayInputValue = () => new Date(localTodayMs()).toISOString().slice(0, 10);

const formatExamDay = (examDate) => {
  if (!examDate) return '';
  const [year, month, day] = examDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
};

const ITEM_ICONS = {
  review: 'history',
  lessons: 'menu_book',
  exam: 'school',
  'exam-done': 'verified',
  done: 'verified',
};

export const ExamCountdownBadge = ({ examDate }) => {
  const daysLeft = daysUntilExam(examDate, localTodayMs());
  if (daysLeft == null) return null;
  const urgent = daysLeft >= 0 && daysLeft <= 7;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-caption font-semibold ${
        urgent ? 'bg-primary-subtle text-primary' : 'bg-surface-soft text-text-secondary'
      }`}
    >
      <AppIcon name="calendar_today" className="text-[14px]" aria-hidden="true" />
      {examCountdownLabel(daysLeft)}
    </span>
  );
};

/** Set or clear a course's exam date. */
export const ExamDateControl = ({ course, onCourseChange }) => {
  const [value, setValue] = useState(course?.examDate || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async (examDate) => {
    if (!course?.id) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/courses/${encodeURIComponent(course.id)}/exam-date`, {
        method: 'PUT',
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ examDate: examDate || null }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Could not save the exam date');
      setValue(payload.course?.examDate || '');
      trackFunnelEvent(FUNNEL_EVENTS.examDateSet, { cleared: !examDate });
      onCourseChange?.(payload.course || null);
    } catch (err) {
      setError(err.message || 'Could not save the exam date');
    } finally {
      setBusy(false);
    }
  };

  const saved = course?.examDate || '';
  return (
    <div className="rounded-[20px] border border-border-subtle bg-surface p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-body-sm font-semibold text-text-primary">Exam date</p>
            {saved ? <ExamCountdownBadge examDate={saved} /> : null}
          </div>
          <p className="mt-1 text-caption text-text-secondary">
            {saved
              ? `${formatExamDay(saved)}. Reviews for this course come first as it gets close.`
              : 'Set it to get a daily plan and reviews that focus on this course.'}
          </p>
        </div>
        <form
          className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:flex-nowrap"
          onSubmit={(event) => {
            event.preventDefault();
            save(value);
          }}
        >
          <label className="sr-only" htmlFor={`exam-date-${course?.id}`}>Exam date</label>
          <input
            id={`exam-date-${course?.id}`}
            type="date"
            min={todayInputValue()}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="min-h-10 rounded-xl border border-border-subtle bg-surface-soft px-3 text-body-sm text-text-primary"
          />
          <button
            type="submit"
            className="btn-primary inline-flex min-h-10 items-center justify-center text-body-sm"
            disabled={busy || !value || value === saved}
          >
            Save
          </button>
          {saved ? (
            <button
              type="button"
              className="btn-secondary inline-flex min-h-10 items-center justify-center text-body-sm"
              disabled={busy}
              onClick={() => save(null)}
            >
              Clear
            </button>
          ) : null}
        </form>
      </div>
      {error ? <p className="mt-2 text-caption text-error" role="alert">{error}</p> : null}
    </div>
  );
};

/** Countdown plus today's plan for one course (an entry of review.exams). */
export const ExamPlanCard = ({ exam, showCourseLink = true }) => {
  const plan = buildDailyPlan(exam, localTodayMs());
  if (!plan) return null;
  const items = dailyPlanItems(plan);
  const courseTitle = formatCourseTitle(exam.courseTitle) || exam.courseTitle || 'Your course';
  const courseHref = `/dashboard/lessons?courseId=${encodeURIComponent(exam.courseId)}`;
  const urgent = plan.daysLeft <= 7;

  return (
    <section
      className={`min-w-0 rounded-[24px] border p-5 shadow-sm md:p-6 ${
        urgent ? 'border-primary/30 bg-primary-subtle' : 'border-border-subtle bg-surface'
      }`}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-caption font-semibold uppercase tracking-[0.06em] text-text-muted">
            Today's exam plan
          </p>
          <h2 className="mt-1 font-display text-display-sm font-bold text-text-primary [overflow-wrap:anywhere]">
            {examCountdownLabel(plan.daysLeft)}
          </h2>
          {showCourseLink ? (
            <Link to={courseHref} className="mt-1 block truncate text-body-sm font-semibold text-primary hover:text-primary-hover">
              {courseTitle}
            </Link>
          ) : null}
        </div>
        <span className="shrink-0 text-caption font-semibold text-text-secondary">{formatExamDay(exam.examDate)}</span>
      </div>
      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li key={item.kind} className="flex min-w-0 items-center gap-2 text-body-sm text-text-primary">
            <AppIcon name={ITEM_ICONS[item.kind] || 'check'} className="shrink-0 text-[18px] text-primary" aria-hidden="true" />
            <span className="min-w-0 [overflow-wrap:anywhere]">{item.text}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        {plan.reviewDue > 0 ? (
          <Link to="/dashboard/review" className="btn-primary inline-flex min-h-10 items-center gap-1.5 text-body-sm">
            Start review
          </Link>
        ) : null}
        {plan.lessonsToday > 0 && showCourseLink ? (
          <Link to={courseHref} className="btn-secondary inline-flex min-h-10 items-center gap-1.5 text-body-sm">
            Open lessons
          </Link>
        ) : null}
        {plan.timedExam === 'due' ? (
          <Link
            to={`/dashboard/exam?courseId=${encodeURIComponent(exam.courseId)}`}
            className="btn-secondary inline-flex min-h-10 items-center gap-1.5 text-body-sm"
          >
            <AppIcon name="school" className="text-[16px]" aria-hidden="true" />
            Timed exam
          </Link>
        ) : null}
      </div>
    </section>
  );
};
