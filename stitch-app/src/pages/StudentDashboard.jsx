import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AppIcon from '../components/AppIcon';
import { formatCourseTitle } from '../lib/courseTitle';
import { resumeActivityCopy } from '../lib/resumeActivity';

const firstName = (value) => {
  const text = String(value || '').trim();
  if (!text) return 'there';
  return text.split(/\s+/)[0];
};

const courseHref = (course) => {
  if (!course?.id) return '/dashboard/lessons';
  return `/dashboard/lessons?courseId=${encodeURIComponent(course.id)}`;
};

const greetingForHour = (hour) => {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const StatCard = ({ label, value, icon }) => (
  <div className="rounded-[20px] border border-border-subtle bg-surface px-5 py-4 shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <p className="text-body-sm font-medium text-text-secondary">{label}</p>
      <span className="inline-flex size-9 items-center justify-center rounded-xl bg-primary-subtle text-primary">
        <AppIcon name={icon} className="text-[18px]" aria-hidden="true" />
      </span>
    </div>
    <p className="mt-3 font-display text-display-sm font-bold text-text-primary">{value}</p>
  </div>
);

const StudentDashboard = () => {
  const { user, profile } = useAuth();
  const displayName = firstName(profile?.fullName || user?.name || user?.email);
  const onboardingDone = profile?.onboardingCompleted === true;
  const greeting = greetingForHour(new Date().getHours());

  const [courses, setCourses] = useState([]);
  const [uploads, setUploads] = useState([]);
  const [resumeTarget, setResumeTarget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async () => {
    if (!user?.id) {
      setCourses([]);
      setUploads([]);
      setResumeTarget(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [coursesRes, uploadsRes, progressRes] = await Promise.all([
        fetch('/api/courses', { credentials: 'include', headers: { Accept: 'application/json' } }),
        fetch('/api/uploads', { credentials: 'include', headers: { Accept: 'application/json' } }),
        fetch('/api/progress', { credentials: 'include', headers: { Accept: 'application/json' } }),
      ]);
      const coursesPayload = await coursesRes.json().catch(() => ({}));
      const uploadsPayload = await uploadsRes.json().catch(() => ({}));
      const progressPayload = await progressRes.json().catch(() => ({}));
      if (!coursesRes.ok) throw new Error(coursesPayload.error || 'Failed to load courses');
      if (!uploadsRes.ok) throw new Error(uploadsPayload.error || 'Failed to load uploads');
      setCourses(Array.isArray(coursesPayload.courses) ? coursesPayload.courses : []);
      setUploads(Array.isArray(uploadsPayload.uploads) ? uploadsPayload.uploads : []);
      setResumeTarget(progressPayload?.progress?.resumeTarget || null);
    } catch (err) {
      setError(err.message || 'Could not load your study home');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const continueCourse = useMemo(() => {
    if (resumeTarget?.courseId) {
      const match = courses.find((course) => String(course.id) === String(resumeTarget.courseId));
      if (match) return match;
      return {
        id: resumeTarget.courseId,
        title: formatCourseTitle(resumeTarget.courseTitle || resumeTarget.title) || resumeTarget.courseTitle || resumeTarget.title || 'Continue learning',
      };
    }
    return courses[0] || null;
  }, [courses, resumeTarget]);

  const activity = useMemo(
    () => resumeActivityCopy(resumeTarget),
    [resumeTarget],
  );
  const continueHref = resumeTarget?.href
    || (continueCourse ? courseHref(continueCourse) : '/dashboard/upload');
  const continueHeading = resumeTarget
    ? resumeTarget.kind === 'exam'
      ? (formatCourseTitle(activity.heading) || activity.heading)
      : activity.heading
    : (continueCourse?.title || 'No courses yet');

  const recentUploads = useMemo(() => uploads.slice(0, 4), [uploads]);
  const readyCourses = courses.filter((course) => Number(course.topicCount || 0) > 0).length;
  const progressPct = Math.min(
    100,
    Math.max(0, Math.round(Number(resumeTarget?.progressPercent ?? continueCourse?.progressPercent ?? 0))),
  );

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background-light px-4 py-8 md:px-8 md:py-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-body-sm font-medium text-text-secondary">Study home</p>
            <h1 className="mt-1 font-display text-display-md font-bold tracking-[-0.02em] text-text-primary md:text-display-lg">
              {greeting}, {displayName}.
            </h1>
            <p className="mt-2 max-w-2xl text-body-md text-text-secondary">
              Upload material, study generated lessons, practice quizzes, and ask the AI tutor.
            </p>
          </div>
          <Link to="/dashboard/upload" className="btn-primary inline-flex min-h-11 shrink-0 text-body-sm">
            <AppIcon name="upload" className="text-[18px]" aria-hidden="true" />
            Upload material
          </Link>
        </div>

        {!onboardingDone && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-border-subtle bg-primary-subtle px-5 py-4">
            <div>
              <p className="font-semibold text-text-primary">Finish setting up your profile</p>
              <p className="mt-1 text-body-sm text-text-secondary">
                Add your education details so recommendations stay relevant.
              </p>
            </div>
            <Link to="/dashboard/settings#profile" className="btn-secondary inline-flex min-h-11 text-body-sm">
              Complete profile
            </Link>
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-[16px] border border-error/30 bg-error-soft px-4 py-3 text-body-sm text-error">
            {error}
          </div>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <StatCard label="Uploads" value={loading ? '—' : uploads.length} icon="cloud_upload" />
          <StatCard label="Courses ready" value={loading ? '—' : readyCourses} icon="menu_book" />
          <StatCard
            label="Next step"
            value={loading ? '—' : continueCourse || resumeTarget ? activity.nextStep : 'Upload your first file'}
            icon="bolt"
          />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.45fr_1fr]">
          <section className="rounded-[24px] border border-border-subtle bg-surface p-6 shadow-sm md:p-7">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-caption font-semibold uppercase tracking-[0.06em] text-text-muted">Continue learning</p>
                <h2 className="mt-2 font-display-sm text-display-sm text-text-primary leading-tight line-clamp-2 [overflow-wrap:anywhere] font-bold">
                  {loading ? 'Loading…' : continueHeading}
                </h2>
              </div>
              <span className="inline-flex items-center rounded-full bg-surface-soft px-3 py-1 text-caption font-semibold text-text-secondary">
                {resumeTarget ? activity.badge : 'Ready'}
              </span>
            </div>

            {loading ? (
              <div className="mt-6 h-28 animate-pulse rounded-2xl bg-surface-soft" />
            ) : continueCourse || resumeTarget ? (
              <>
                <p className="mt-3 text-body-sm text-text-secondary">
                  {activity.hint}
                </p>
                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between text-caption font-semibold text-text-secondary">
                    <span>Overall progress</span>
                    <span>{Number.isFinite(progressPct) ? progressPct : 0}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-soft">
                    <div
                      className="h-full rounded-full bg-cta transition-all"
                      style={{ width: `${Number.isFinite(progressPct) ? progressPct : 0}%` }}
                    />
                  </div>
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link to={continueHref} className="btn-primary inline-flex min-h-11 text-body-sm">
                    {activity.cta || 'Continue studying'}
                    <AppIcon name="arrow_forward" className="text-[18px]" aria-hidden="true" />
                  </Link>
                  <Link to="/dashboard/quiz" className="btn-secondary inline-flex min-h-11 text-body-sm">
                    Practice quiz
                  </Link>
                  <Link to="/dashboard/ai-tutor" className="btn-secondary inline-flex min-h-11 text-body-sm">
                    Ask AI tutor
                  </Link>
                </div>
              </>
            ) : (
              <>
                <p className="mt-3 text-body-md text-text-secondary">
                  Upload a PDF, deck, or notes file to generate your first lesson set.
                </p>
                <Link to="/dashboard/upload" className="btn-primary mt-6 inline-flex min-h-11 text-body-sm">
                  Upload material
                </Link>
              </>
            )}
          </section>

          <section className="flex flex-col rounded-[24px] border border-dashed border-border-default bg-surface p-6 shadow-sm md:p-7">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary-subtle text-primary">
              <AppIcon name="cloud_upload" className="text-[28px]" aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-center font-display text-display-sm font-bold text-text-primary">Upload material</h2>
            <p className="mt-2 text-center text-body-sm text-text-secondary">
              Drag & drop PDFs, docs, or images — or browse from your device.
            </p>
            <Link to="/dashboard/upload" className="btn-secondary mt-auto inline-flex min-h-11 justify-center text-body-sm">
              Browse files
            </Link>
          </section>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <section className="rounded-[24px] border border-border-subtle bg-surface p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-display-sm font-bold text-text-primary">Recent materials</h2>
              <Link to="/dashboard/library" className="text-body-sm font-semibold text-primary hover:text-primary-hover">
                View library
              </Link>
            </div>
            {loading ? (
              <div className="mt-4 h-36 animate-pulse rounded-2xl bg-surface-soft" />
            ) : recentUploads.length === 0 ? (
              <p className="mt-4 rounded-2xl border border-dashed border-border-default bg-surface-soft px-4 py-6 text-body-sm text-text-secondary">
                Nothing uploaded yet. Start with a lecture PDF or slide deck.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-border-subtle">
                {recentUploads.map((upload) => (
                  <li key={upload.id} className="flex min-h-14 items-center justify-between gap-3 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-error-soft text-error">
                        <AppIcon name="description" className="text-[20px]" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-text-primary">{upload.fileName || 'Untitled upload'}</p>
                        <p className="mt-0.5 text-caption text-text-secondary">{upload.status || 'processing'}</p>
                      </div>
                    </div>
                    <Link
                      to={upload.courseId ? courseHref({ id: upload.courseId }) : '/dashboard/library'}
                      className="shrink-0 text-body-sm font-semibold text-primary"
                    >
                      Open
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-[24px] border border-border-subtle bg-surface p-6 shadow-sm">
            <h2 className="font-display text-display-sm font-bold text-text-primary">Quick actions</h2>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {[
                { to: '/dashboard/upload', label: 'Upload', icon: 'cloud_upload' },
                { to: '/dashboard/library', label: 'Materials', icon: 'folder' },
                { to: '/dashboard/lessons', label: 'Lessons', icon: 'menu_book' },
                { to: '/dashboard/quiz', label: 'Quizzes', icon: 'quiz' },
                { to: '/dashboard/exam', label: 'Timed exams', icon: 'school' },
                { to: '/dashboard/progress', label: 'Progress', icon: 'bar_chart' },
              ].map((action) => (
                <Link
                  key={action.to}
                  to={action.to}
                  className="flex min-h-12 items-center gap-3 rounded-2xl bg-surface-soft px-3 py-2.5 text-body-sm font-semibold text-text-primary transition-colors hover:bg-primary-subtle"
                >
                  <AppIcon name={action.icon} className="text-[20px] text-primary" aria-hidden="true" />
                  {action.label}
                </Link>
              ))}
            </div>

            <div className="mt-5 rounded-[18px] bg-primary-subtle p-4">
              <p className="text-caption font-semibold uppercase tracking-[0.06em] text-primary">Recommended</p>
              <p className="mt-1 font-semibold text-text-primary">Take a short quiz on your latest course</p>
              <p className="mt-1 text-body-sm text-text-secondary">
                Active recall beats re-reading. Five minutes now surfaces what still needs work.
              </p>
              <Link to="/dashboard/quiz" className="btn-secondary mt-4 inline-flex min-h-11 text-body-sm">
                <AppIcon name="play_arrow" className="text-[18px]" aria-hidden="true" />
                Start quiz
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
